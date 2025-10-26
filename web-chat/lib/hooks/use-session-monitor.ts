/**
 * Session Monitor Hook
 *
 * Monitors if current device session has been kicked out or deleted
 * Provides graceful warning before forcing logout
 *
 * Monitors two sources:
 * 1. Firestore kickedSessions collection (kicked by another device login)
 * 2. RTDB session path (manual deletion or admin action)
 */

'use client';

import React, { useEffect, useState, useRef } from 'react';
import { doc, onSnapshot, deleteDoc } from 'firebase/firestore';
import { ref, onValue, off } from 'firebase/database';
import { db, realtimeDatabase } from '@/lib/firebase/config';
import { toast } from 'sonner';
import { useRouter } from 'next/navigation';

interface SessionMonitorOptions {
  userId: string | null;
  deviceId: string | null;
  onSessionDeleted?: () => Promise<void>;
  isManualLogoutRef?: React.MutableRefObject<boolean>;
}

export function useSessionMonitor({ userId, deviceId, onSessionDeleted, isManualLogoutRef }: SessionMonitorOptions) {
  const [isKicked, setIsKicked] = useState(false);
  const router = useRouter();
  const sessionInitialized = useRef(false);
  const logoutTriggered = useRef(false);

  useEffect(() => {
    if (!userId || !deviceId) return;

    console.log('[SessionMonitor] Monitoring session for device:', deviceId);

    // Helper function to trigger logout
    const triggerLogout = async (reason: string) => {
      // Prevent multiple logout triggers
      if (logoutTriggered.current) {
        console.log('[SessionMonitor] Logout already triggered, skipping');
        return;
      }

      logoutTriggered.current = true;
      setIsKicked(true);

      console.log('[SessionMonitor] Triggering logout:', reason);

      // Stop presence monitoring BEFORE logout to prevent session recreation
      if (onSessionDeleted) {
        console.log('[SessionMonitor] Calling onSessionDeleted callback...');
        await onSessionDeleted();
      }

      // Show graceful warning only if NOT manual logout
      const isManualLogout = isManualLogoutRef?.current || false;
      console.log('[SessionMonitor] isManualLogout flag:', isManualLogout, 'reason:', reason);

      // Force logout after 3 seconds (or immediately if manual)
      const delay = isManualLogout ? 0 : 3000;
      setTimeout(() => {
        // Clear localStorage
        localStorage.clear();

        // Redirect to login
        router.push('/login');

        // Force page reload to reset all state
        window.location.href = '/login';
      }, delay);
    };

    // 1. Listen for kicked session in Firestore
    const kickedRef = doc(db(), 'kickedSessions', deviceId);
    const unsubscribeKicked = onSnapshot(
      kickedRef,
      async (snapshot) => {
        if (snapshot.exists()) {
          const data = snapshot.data();
          console.log('[SessionMonitor] Device kicked out:', data);

          // Clean up kicked session document
          try {
            await deleteDoc(kickedRef);
          } catch (error) {
            console.error('[SessionMonitor] Error deleting kicked session:', error);
          }

          await triggerLogout('kicked_by_another_device');
        }
      },
      (error) => {
        console.error('[SessionMonitor] Error listening to kicked sessions:', error);
      }
    );

    // 2. Listen for session deletion in RTDB
    const rtdb = realtimeDatabase();
    const sessionRef = ref(rtdb, `/sessions/${userId}/web/${deviceId}`);

    const unsubscribeSession = onValue(
      sessionRef,
      (snapshot) => {
        if (sessionInitialized.current && !snapshot.exists()) {
          // Session was deleted after being initialized
          console.log('[SessionMonitor] Session deleted from RTDB');
          triggerLogout('session_deleted_from_rtdb');
        } else if (snapshot.exists()) {
          // Session exists, mark as initialized
          if (!sessionInitialized.current) {
            console.log('[SessionMonitor] Session initialized in RTDB');
            sessionInitialized.current = true;
          }
        }
      },
      (error) => {
        console.error('[SessionMonitor] Error listening to RTDB session:', error);
      }
    );

    return () => {
      console.log('[SessionMonitor] Cleanup listeners for device:', deviceId);
      unsubscribeKicked();
      off(sessionRef);
      sessionInitialized.current = false;
      logoutTriggered.current = false;
    };
  }, [userId, deviceId, router, onSessionDeleted, isManualLogoutRef]);

  return { isKicked };
}
