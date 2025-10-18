'use client';

import React, { createContext, useContext, useEffect, useState, useRef } from 'react';
import { User as FirebaseUser } from 'firebase/auth';
import { User } from '@/types/models';

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
  const authRepositoryRef = useRef<any>(null);
  const userRepositoryRef = useRef<any>(null);

  useEffect(() => {
    // Only run on client-side
    if (typeof window === 'undefined') {
      setLoading(false);
      return;
    }

    let unsubscribeAuth: (() => void) | null = null;
    let unsubscribeUserData: (() => void) | null = null;

    // Dynamic import to avoid server-side execution
    Promise.all([
      import('@/lib/repositories/auth.repository'),
      import('@/lib/repositories/user.repository')
    ]).then(([{ AuthRepository }, { UserRepository }]) => {
      authRepositoryRef.current = new AuthRepository();
      userRepositoryRef.current = new UserRepository();

      // Listen to auth state changes
      unsubscribeAuth = authRepositoryRef.current.onAuthStateChange(async (user: FirebaseUser | null) => {
        if (user) {
          // Fetch user data from Firestore first before setting current user
          try {
            const result = await userRepositoryRef.current.getUserById(user.uid);
            if (result.status === 'success') {
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

              // Setup real-time listener to detect if user is deleted from Firestore
              unsubscribeUserData = userRepositoryRef.current.listenToUser(
                user.uid,
                (userData: User) => {
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
      if (unsubscribeAuth) {
        unsubscribeAuth();
      }
      if (unsubscribeUserData) {
        unsubscribeUserData();
      }
    };
  }, []);

  const signIn = async (email: string, password: string) => {
    if (!authRepositoryRef.current || !userRepositoryRef.current) {
      return { success: false, error: 'Layanan autentikasi belum siap' };
    }

    try {
      const result = await authRepositoryRef.current.signIn(email, password);
      if (result.status === 'success' && result.data) {
        // Verify user data exists in Firestore
        const userResult = await userRepositoryRef.current.getUserById(result.data.uid);
        if (userResult.status === 'success') {
          // Check if user is active
          if (userResult.data.isActive === false) {
            await authRepositoryRef.current.signOut();
            return { success: false, error: 'Akun Anda telah dinonaktifkan. Silakan hubungi administrator.' };
          }

          // Check if displayName exists
          if (!userResult.data.displayName || userResult.data.displayName.trim() === '') {
            await authRepositoryRef.current.signOut();
            return { success: false, error: 'Akun tidak memiliki username. Silakan hubungi administrator.' };
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

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
