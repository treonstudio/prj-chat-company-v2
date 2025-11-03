/**
 * Presence Repository
 *
 * Implements Firebase Presence System using Realtime Database + Firestore
 * Based on: https://firebase.google.com/docs/firestore/solutions/presence
 *
 * This service monitors user connection status and automatically updates
 * user status to OFFLINE when they disconnect (even if browser crashes).
 *
 * Extended with Device Session Management for device locking (1 mobile + 1 web)
 */

import { ref, onValue, onDisconnect, set, serverTimestamp as rtdbServerTimestamp, get, off, remove } from 'firebase/database';
import { doc, updateDoc, serverTimestamp, Timestamp, setDoc, collection, getDocs, query, where, deleteDoc } from 'firebase/firestore';
import { realtimeDatabase } from '@/lib/firebase/config';
import { db } from '@/lib/firebase/config';
import { UserStatus, DeviceType, DeviceSession } from '@/types/models';
import { DeviceInfo } from '@/lib/utils/device.utils';

export class PresenceRepository {
  private unsubscribeConnected: (() => void) | null = null;
  private unsubscribeStatus: (() => void) | null = null;
  private currentUserId: string | null = null;
  private currentDeviceId: string | null = null;
  private userStatusDatabaseRef: any = null;
  private sessionDatabaseRef: any = null;

  /**
   * Check existing sessions and kick out old device if needed
   * Grace period: 5 seconds before kicking out old device
   */
  private async checkAndKickExistingSession(
    userId: string,
    deviceType: DeviceType,
    currentDeviceId: string
  ): Promise<void> {
    try {
      const rtdb = realtimeDatabase();
      const sessionsRef = ref(rtdb, `/sessions/${userId}/${deviceType}`);
      const snapshot = await get(sessionsRef);

      if (snapshot.exists()) {
        const sessions = snapshot.val();
        const sessionEntries = Object.entries(sessions);

        // Find existing session (not current device)
        for (const [existingDeviceId, sessionData] of sessionEntries) {
          if (existingDeviceId !== currentDeviceId) {
            console.log(`[Presence] Found existing ${deviceType} session, kicking out:`, existingDeviceId);

            // Grace period: wait 5 seconds to allow for refresh scenarios
            await new Promise(resolve => setTimeout(resolve, 5000));

            // Kick out old device
            await this.kickOutDevice(userId, deviceType, existingDeviceId);
          }
        }
      }
    } catch (error) {
      console.error('[Presence] Error checking existing sessions:', error);
    }
  }

  /**
   * Get userId from username by querying users collection
   */
  async getUserIdByUsername(username: string): Promise<string | null> {
    try {
      const firestore = db();
      const usersRef = collection(firestore, 'users');
      const q = query(usersRef, where('username', '==', username));
      const snapshot = await getDocs(q);

      if (!snapshot.empty) {
        return snapshot.docs[0].id;
      }

      return null;
    } catch (error) {
      console.error('[Presence] Error getting userId by username:', error);
      return null;
    }
  }

  /**
   * Check if user has existing active sessions
   * Returns array of existing session info
   */
  async checkExistingSessions(userId: string, deviceType: DeviceType): Promise<{deviceId: string, deviceName: string}[]> {
    try {
      const rtdb = realtimeDatabase();
      const sessionsRef = ref(rtdb, `/sessions/${userId}/${deviceType}`);
      const snapshot = await get(sessionsRef);

      if (snapshot.exists()) {
        const sessions = snapshot.val();
        const sessionEntries = Object.entries(sessions);

        return sessionEntries.map(([deviceId, sessionData]: [string, any]) => ({
          deviceId,
          deviceName: sessionData.deviceName || 'Unknown Device'
        }));
      }

      return [];
    } catch (error) {
      console.error('[Presence] Error checking existing sessions:', error);
      return [];
    }
  }

  /**
   * Kick out a device session
   */
  async kickOutDevice(
    userId: string,
    deviceType: DeviceType,
    deviceId: string
  ): Promise<void> {
    try {
      const rtdb = realtimeDatabase();
      const firestore = db();

      // Remove from RTDB
      const sessionRef = ref(rtdb, `/sessions/${userId}/${deviceType}/${deviceId}`);
      await remove(sessionRef);

      // Add to kicked sessions in Firestore
      const kickedRef = doc(firestore, 'kickedSessions', deviceId);
      await setDoc(kickedRef, {
        userId,
        deviceType,
        deviceId,
        kickedAt: serverTimestamp(),
        reason: 'new_device_login',
      });

      console.log('[Presence] Device kicked out:', deviceId);
    } catch (error) {
      console.error('[Presence] Error kicking out device:', error);
    }
  }

  /**
   * Start monitoring user presence with device session management
   * This sets up the presence system for a user with device locking
   */
  async startPresenceMonitoring(
    userId: string,
    deviceId: string,
    deviceInfo: DeviceInfo
  ): Promise<void> {
    if (typeof window === 'undefined') {
      // Don't run on server side
      return;
    }

    // Cleanup any existing listeners first
    this.stopPresenceMonitoring();

    try {
      const rtdb = realtimeDatabase();
      const firestore = db();

      // Save current user ID and device ID for cleanup
      this.currentUserId = userId;
      this.currentDeviceId = deviceId;

      // Check and kick existing web session (with grace period)
      await this.checkAndKickExistingSession(userId, deviceInfo.deviceType, deviceId);

      // References
      this.userStatusDatabaseRef = ref(rtdb, `/status/${userId}`);
      this.sessionDatabaseRef = ref(rtdb, `/sessions/${userId}/${deviceInfo.deviceType}/${deviceId}`);
      const connectedRef = ref(rtdb, '.info/connected');
      const statusRef = ref(rtdb, `/status/${userId}`);

      // Firestore user document reference
      const userDocRef = doc(firestore, 'users', userId);

      // Set up a listener to sync RTDB -> Firestore (setup ONCE, outside connectedRef callback)
      // This ensures Firestore gets updated when RTDB changes (including onDisconnect)
      this.unsubscribeStatus = onValue(statusRef, async (statusSnapshot) => {
        const statusData = statusSnapshot.val();
        if (statusData) {
          try {
            // Sync to Firestore using the EXACT timestamp from RTDB
            // Convert RTDB timestamp (milliseconds) to Firestore Timestamp
            const lastSeenTimestamp = statusData.lastSeen
              ? Timestamp.fromMillis(statusData.lastSeen)
              : serverTimestamp();

            await updateDoc(userDocRef, {
              status: statusData.status,
              lastSeen: lastSeenTimestamp, // Use timestamp from RTDB, not current time
            });

            console.log('[Presence] Status synced to Firestore:', statusData.status, 'at', statusData.lastSeen ? new Date(statusData.lastSeen).toLocaleString() : 'unknown');
          } catch (error) {
            console.error('[Presence] Error syncing status to Firestore:', error);
          }
        }
      });

      // Set up the connection presence listener
      this.unsubscribeConnected = onValue(connectedRef, async (snapshot) => {
        if (snapshot.val() === false) {
          // Not connected, ignore
          console.log('[Presence] User disconnected (connectedRef=false)');
          return;
        }

        // We're connected (or reconnected)!
        console.log('[Presence] User connected (connectedRef=true):', userId);

        // When I disconnect, update the Realtime Database
        // This is a server-side trigger that executes when connection is lost
        await onDisconnect(this.userStatusDatabaseRef).set({
          status: UserStatus.OFFLINE,
          lastSeen: rtdbServerTimestamp(),
          disconnectedAt: rtdbServerTimestamp(),
        });

        // NOTE: We DON'T remove session on disconnect anymore
        // Sessions should only be deleted on:
        // 1. Manual logout (stopPresenceMonitoring)
        // 2. Kicked by another device (kickOutDevice)
        // This prevents auto-logout when user temporarily loses connection

        console.log('[Presence] onDisconnect handler set for status (session kept alive):', userId);

        // Set the user as ONLINE in Realtime Database
        await set(this.userStatusDatabaseRef, {
          status: UserStatus.ONLINE,
          lastSeen: rtdbServerTimestamp(),
          connectedAt: rtdbServerTimestamp(),
        });

        // Create device session
        await set(this.sessionDatabaseRef, {
          deviceId,
          deviceType: deviceInfo.deviceType,
          platform: 'Web',
          browser: deviceInfo.browser,
          os: deviceInfo.os,
          deviceName: deviceInfo.deviceName,
          userAgent: deviceInfo.userAgent,
          loginAt: rtdbServerTimestamp(),
          lastActive: rtdbServerTimestamp(),
          status: 'online',
        });

        console.log('[Presence] User status and session set to ONLINE in RTDB:', userId);
      });

      console.log('[Presence] Presence monitoring started for user:', userId);
    } catch (error) {
      console.error('[Presence] Error starting presence monitoring:', error);
      throw error;
    }
  }

  /**
   * Stop monitoring user presence and cleanup session
   */
  async stopPresenceMonitoring(): Promise<void> {
    // Delete session document before cleanup
    if (this.sessionDatabaseRef) {
      try {
        await remove(this.sessionDatabaseRef);
        console.log('[Presence] Session document deleted for:', this.currentUserId, this.currentDeviceId);
      } catch (error) {
        console.error('[Presence] Error deleting session document:', error);
      }
    }

    // Cancel onDisconnect handler for status
    // (No need to cancel session onDisconnect since we don't set it anymore)
    if (this.userStatusDatabaseRef) {
      onDisconnect(this.userStatusDatabaseRef).cancel();
    }

    console.log('[Presence] onDisconnect handler cancelled for:', this.currentUserId);

    // Unsubscribe from listeners
    if (this.unsubscribeConnected) {
      this.unsubscribeConnected();
      this.unsubscribeConnected = null;
    }
    if (this.unsubscribeStatus) {
      this.unsubscribeStatus();
      this.unsubscribeStatus = null;
    }

    // Clear references
    this.userStatusDatabaseRef = null;
    this.sessionDatabaseRef = null;
    this.currentUserId = null;
    this.currentDeviceId = null;

    console.log('[Presence] Presence monitoring stopped');
  }

  /**
   * Manually set user status to OFFLINE
   * Use this when user logs out
   */
  async setUserOffline(userId: string): Promise<void> {
    try {
      const rtdb = realtimeDatabase();
      const firestore = db();

      const userStatusDatabaseRef = ref(rtdb, `/status/${userId}`);
      const userDocRef = doc(firestore, 'users', userId);

      // Update Realtime Database
      await set(userStatusDatabaseRef, {
        status: UserStatus.OFFLINE,
        lastSeen: rtdbServerTimestamp(),
        disconnectedAt: rtdbServerTimestamp(),
      });

      // Update Firestore
      await updateDoc(userDocRef, {
        status: UserStatus.OFFLINE,
        lastSeen: serverTimestamp(),
      });

      console.log('[Presence] User set to offline:', userId);
    } catch (error) {
      console.error('[Presence] Error setting user offline:', error);
      throw error;
    }
  }

  /**
   * Manually set user status to ONLINE
   * Use this when user logs in
   */
  async setUserOnline(userId: string): Promise<void> {
    try {
      const rtdb = realtimeDatabase();
      const firestore = db();

      const userStatusDatabaseRef = ref(rtdb, `/status/${userId}`);
      const userDocRef = doc(firestore, 'users', userId);

      // Update Realtime Database
      await set(userStatusDatabaseRef, {
        status: UserStatus.ONLINE,
        lastSeen: rtdbServerTimestamp(),
        connectedAt: rtdbServerTimestamp(),
      });

      // Update Firestore
      await updateDoc(userDocRef, {
        status: UserStatus.ONLINE,
        lastSeen: serverTimestamp(),
      });

      console.log('[Presence] User set to online:', userId);
    } catch (error) {
      console.error('[Presence] Error setting user online:', error);
      throw error;
    }
  }

  /**
   * Get current user status from Realtime Database
   */
  async getUserStatus(userId: string): Promise<{ status: UserStatus; lastSeen: number } | null> {
    try {
      const rtdb = realtimeDatabase();
      const userStatusRef = ref(rtdb, `/status/${userId}`);
      const snapshot = await get(userStatusRef);

      if (snapshot.exists()) {
        const data = snapshot.val();
        return {
          status: data.status as UserStatus,
          lastSeen: data.lastSeen,
        };
      }

      return null;
    } catch (error) {
      console.error('[Presence] Error getting user status:', error);
      return null;
    }
  }

  /**
   * Get all active sessions for a user
   * Returns both mobile and web sessions
   */
  async getActiveSessions(userId: string): Promise<DeviceSession[]> {
    try {
      const rtdb = realtimeDatabase();
      const sessionsRef = ref(rtdb, `/sessions/${userId}`);
      const snapshot = await get(sessionsRef);

      if (!snapshot.exists()) {
        return [];
      }

      const sessionsData = snapshot.val();
      const sessions: DeviceSession[] = [];

      // Process mobile sessions
      if (sessionsData.mobile) {
        Object.entries(sessionsData.mobile).forEach(([deviceId, data]: [string, any]) => {
          sessions.push({
            deviceId,
            deviceType: 'mobile',
            platform: data.platform || 'Mobile',
            browser: data.browser,
            os: data.os,
            deviceName: data.deviceName || 'Mobile Device',
            userAgent: data.userAgent,
            loginAt: data.loginAt ? Timestamp.fromMillis(data.loginAt) : Timestamp.now(),
            lastActive: data.lastActive ? Timestamp.fromMillis(data.lastActive) : Timestamp.now(),
            status: data.status || 'online',
          });
        });
      }

      // Process web sessions
      if (sessionsData.web) {
        Object.entries(sessionsData.web).forEach(([deviceId, data]: [string, any]) => {
          sessions.push({
            deviceId,
            deviceType: 'web',
            platform: data.platform || 'Web',
            browser: data.browser,
            os: data.os,
            deviceName: data.deviceName || 'Web Browser',
            userAgent: data.userAgent,
            loginAt: data.loginAt ? Timestamp.fromMillis(data.loginAt) : Timestamp.now(),
            lastActive: data.lastActive ? Timestamp.fromMillis(data.lastActive) : Timestamp.now(),
            status: data.status || 'online',
          });
        });
      }

      return sessions;
    } catch (error) {
      console.error('[Presence] Error getting active sessions:', error);
      return [];
    }
  }

  /**
   * Manually logout a specific device session
   * Used by session management UI
   */
  async logoutDeviceSession(
    userId: string,
    deviceType: DeviceType,
    deviceId: string
  ): Promise<void> {
    try {
      await this.kickOutDevice(userId, deviceType, deviceId);
      console.log('[Presence] Device session manually logged out:', deviceId);
    } catch (error) {
      console.error('[Presence] Error logging out device session:', error);
      throw error;
    }
  }
}
