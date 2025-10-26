'use client';

import React, { createContext, useContext, useEffect, useState, useRef } from 'react';
import { User as FirebaseUser } from 'firebase/auth';
import { User } from '@/types/models';
import { getDeviceId, getDeviceInfo, clearDeviceId, clearTabId } from '@/lib/utils/device.utils';
import { useSessionMonitor } from '@/lib/hooks/use-session-monitor';
import { useTabLock } from '@/lib/hooks/use-tab-lock';
import { TabConflictDialog } from '@/components/tab-conflict-dialog';
import { doc, onSnapshot } from 'firebase/firestore';
import { db } from '@/lib/firebase/config';
import { toast } from 'sonner';

interface AuthContextType {
  currentUser: FirebaseUser | null;
  userData: User | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<{ success: boolean; error?: string }>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [currentUser, setCurrentUser] = useState<FirebaseUser | null>(null);
  const [userData, setUserData] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [deviceId, setDeviceId] = useState<string | null>(null);
  const authRepositoryRef = useRef<any>(null);
  const userRepositoryRef = useRef<any>(null);
  const presenceRepositoryRef = useRef<any>(null);

  // Monitor if device session has been kicked out
  useSessionMonitor(currentUser?.uid || null, deviceId);

  // Monitor if tab should be kicked out (only 1 tab per browser)
  const { hasConflict, useHere, closeTab } = useTabLock(currentUser?.uid || null);

  useEffect(() => {
    // Only run on client-side
    if (typeof window === 'undefined') {
      setLoading(false);
      return;
    }

    let unsubscribeAuth: (() => void) | null = null;
    let unsubscribeUserData: (() => void) | null = null;
    let unsubscribeMaintenance: (() => void) | null = null;

    // Dynamic import to avoid server-side execution
    Promise.all([
      import('@/lib/repositories/auth.repository'),
      import('@/lib/repositories/user.repository'),
      import('@/lib/repositories/presence.repository')
    ]).then(([{ AuthRepository }, { UserRepository }, { PresenceRepository }]) => {
      authRepositoryRef.current = new AuthRepository();
      userRepositoryRef.current = new UserRepository();
      presenceRepositoryRef.current = new PresenceRepository();

      // Listen to maintenance mode config
      try {
        const maintenanceRef = doc(db(), 'appConfigs', 'usageControls');
        unsubscribeMaintenance = onSnapshot(maintenanceRef, (snapshot) => {
          if (snapshot.exists()) {
            const data = snapshot.data();
            const isMaintenance = data?.isMaintaince === true;

            if (isMaintenance) {
              console.log('[Maintenance] App is in maintenance mode, logging out...');

              // Show toast warning
              toast.warning('Aplikasi sedang dalam maintenance. Silakan coba lagi nanti.', {
                duration: 5000,
              });

              // Logout user if logged in
              if (authRepositoryRef.current) {
                authRepositoryRef.current.signOut().catch((error: any) => {
                  console.error('[Maintenance] Error during logout:', error);
                });
              }
            }
          }
        }, (error) => {
          console.error('[Maintenance] Error listening to maintenance config:', error);
        });
      } catch (error) {
        console.error('[Maintenance] Error setting up maintenance listener:', error);
      }

      // Listen to auth state changes
      unsubscribeAuth = authRepositoryRef.current.onAuthStateChange(async (user: FirebaseUser | null) => {
        if (user) {
          // Fetch user data from Firestore first before setting current user
          try {
            const result = await userRepositoryRef.current.getUserById(user.uid);
            if (result.status === 'success') {
              // Check if user is deleted
              if (result.data.isDeleted === true) {
                if (typeof window !== 'undefined') {
                  console.log('User account has been deleted, logging out...');
                }
                await authRepositoryRef.current.signOut();
                setUserData(null);
                setCurrentUser(null);
                setLoading(false);
                return;
              }

              // Check if user is active
              if (result.data.isActive === false) {
                if (typeof window !== 'undefined') {
                  console.log('User account is deactivated, logging out...');
                }
                await authRepositoryRef.current.signOut();
                setUserData(null);
                setCurrentUser(null);
                setLoading(false);
                return;
              }

              // Check if displayName exists
              if (!result.data.displayName || result.data.displayName.trim() === '') {
                if (typeof window !== 'undefined') {
                  console.log('User has no displayName, logging out...');
                }
                await authRepositoryRef.current.signOut();
                setUserData(null);
                setCurrentUser(null);
                setLoading(false);
                return;
              }

              // Only set user if data is found
              setCurrentUser(user);
              setUserData(result.data);
              setLoading(false);

              // Get device ID and info
              const currentDeviceId = getDeviceId();
              const currentDeviceInfo = getDeviceInfo();
              setDeviceId(currentDeviceId);

              // Start presence monitoring with device tracking
              if (presenceRepositoryRef.current) {
                try {
                  await presenceRepositoryRef.current.startPresenceMonitoring(
                    user.uid,
                    currentDeviceId,
                    currentDeviceInfo
                  );
                } catch (error) {
                  console.error('[Auth] Error starting presence monitoring:', error);
                }
              }

              // Setup real-time listener to detect if user is deleted from Firestore
              unsubscribeUserData = userRepositoryRef.current.listenToUser(
                user.uid,
                (userData: User) => {
                  // Check if user has been deleted
                  if (userData.isDeleted === true) {
                    if (typeof window !== 'undefined') {
                      console.log('User account has been deleted by admin');
                    }
                    // Auto logout if user is deleted
                    authRepositoryRef.current.signOut();
                    setUserData(null);
                    setCurrentUser(null);
                    return;
                  }

                  // Check if user is still active
                  if (userData.isActive === false) {
                    if (typeof window !== 'undefined') {
                      console.log('User account has been deactivated');
                    }
                    // Auto logout if user is deactivated
                    authRepositoryRef.current.signOut();
                    setUserData(null);
                    setCurrentUser(null);
                    return;
                  }

                  // Check if displayName exists
                  if (!userData.displayName || userData.displayName.trim() === '') {
                    if (typeof window !== 'undefined') {
                      console.log('User displayName has been removed, logging out...');
                    }
                    // Auto logout if displayName is removed
                    authRepositoryRef.current.signOut();
                    setUserData(null);
                    setCurrentUser(null);
                    return;
                  }

                  // User data updated
                  setUserData(userData);
                },
                async (error: string) => {
                  // User document deleted or error occurred
                  if (typeof window !== 'undefined') {
                    console.error('User document deleted or error:', error);
                  }
                  // Auto logout
                  await authRepositoryRef.current.signOut();
                  setUserData(null);
                  setCurrentUser(null);
                }
              );
            } else if (result.status === 'error') {
              // If user data not found or error, logout the user immediately
              if (typeof window !== 'undefined') {
                console.error('Failed to fetch user data:', result.message);
              }
              // Sign out silently without updating state first
              await authRepositoryRef.current.signOut();
              setUserData(null);
              setCurrentUser(null);
              setLoading(false);
            }
          } catch (error) {
            // Handle any unexpected errors
            if (typeof window !== 'undefined') {
              console.error('Unexpected error fetching user data:', error);
            }
            await authRepositoryRef.current.signOut();
            setUserData(null);
            setCurrentUser(null);
            setLoading(false);
          }
        } else {
          // User logged out
          setCurrentUser(null);
          setUserData(null);
          setLoading(false);

          // Stop presence monitoring
          if (presenceRepositoryRef.current) {
            presenceRepositoryRef.current.stopPresenceMonitoring();
          }

          // Cleanup user data listener if exists
          if (unsubscribeUserData) {
            unsubscribeUserData();
            unsubscribeUserData = null;
          }
        }
      });
    }).catch((error) => {
      console.error('Failed to load auth repositories:', error);
      setLoading(false);
    });

    return () => {
      // Stop presence monitoring on cleanup
      if (presenceRepositoryRef.current) {
        presenceRepositoryRef.current.stopPresenceMonitoring();
      }

      if (unsubscribeAuth) {
        unsubscribeAuth();
      }
      if (unsubscribeUserData) {
        unsubscribeUserData();
      }
      if (unsubscribeMaintenance) {
        unsubscribeMaintenance();
      }
    };
  }, []);

  const signIn = async (email: string, password: string) => {
    if (!authRepositoryRef.current || !userRepositoryRef.current) {
      return { success: false, error: 'Layanan autentikasi belum siap' };
    }

    try {
      // Check maintenance mode before attempting login
      const { getDoc } = await import('firebase/firestore');
      const maintenanceRef = doc(db(), 'appConfigs', 'usageControls');
      const maintenanceSnap = await getDoc(maintenanceRef);

      if (maintenanceSnap.exists()) {
        const data = maintenanceSnap.data();
        const isMaintenance = data?.isMaintaince === true;

        if (isMaintenance) {
          return {
            success: false,
            error: 'Aplikasi sedang dalam maintenance. Silakan coba lagi nanti.'
          };
        }
      }

      const result = await authRepositoryRef.current.signIn(email, password);
      if (result.status === 'success' && result.data) {
        // Verify user data exists in Firestore
        const userResult = await userRepositoryRef.current.getUserById(result.data.uid);
        if (userResult.status === 'success') {
          console.log('[Login] User data:', {
            isDeleted: userResult.data.isDeleted,
            isActive: userResult.data.isActive,
            displayName: userResult.data.displayName
          });

          // Check if user is deleted
          if (userResult.data.isDeleted === true) {
            console.log('[Login] User is deleted, logging out...');
            await authRepositoryRef.current.signOut();
            return { success: false, error: 'Akun Anda telah dihapus oleh administrator. Silakan hubungi administrator untuk informasi lebih lanjut.' };
          }

          // Check if user is active
          if (userResult.data.isActive === false) {
            await authRepositoryRef.current.signOut();
            return { success: false, error: 'Akun Anda telah dinonaktifkan. Silakan hubungi administrator untuk informasi lebih lanjut.' };
          }

          // Check if displayName exists
          if (!userResult.data.displayName || userResult.data.displayName.trim() === '') {
            await authRepositoryRef.current.signOut();
            return { success: false, error: 'Akun Anda tidak memiliki username. Silakan hubungi administrator untuk informasi lebih lanjut.' };
          }

          return { success: true };
        } else {
          // User authenticated but no user data found
          await authRepositoryRef.current.signOut();
          return { success: false, error: 'Data user tidak ditemukan. Silakan hubungi administrator.' };
        }
      } else if (result.status === 'error') {
        return { success: false, error: result.message };
      } else {
        return { success: false, error: 'Terjadi kesalahan yang tidak diketahui' };
      }
    } catch (error) {
      return { success: false, error: 'Terjadi kesalahan saat login. Silakan coba lagi' };
    }
  };

  const signOut = async () => {
    // Set user offline before signing out
    if (presenceRepositoryRef.current && currentUser) {
      try {
        await presenceRepositoryRef.current.setUserOffline(currentUser.uid);
      } catch (error) {
        console.error('[Auth] Error setting user offline:', error);
      }
    }

    // Stop presence monitoring and delete session
    if (presenceRepositoryRef.current) {
      try {
        await presenceRepositoryRef.current.stopPresenceMonitoring();
      } catch (error) {
        console.error('[Auth] Error stopping presence monitoring:', error);
      }
    }

    // Clear device ID and tab ID
    clearDeviceId();
    clearTabId();
    setDeviceId(null);

    // Sign out
    if (authRepositoryRef.current) {
      await authRepositoryRef.current.signOut();
    }
  };

  const value: AuthContextType = {
    currentUser,
    userData,
    loading,
    signIn,
    signOut,
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
      <TabConflictDialog
        open={hasConflict}
        onUseHere={useHere}
        onClose={closeTab}
      />
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
