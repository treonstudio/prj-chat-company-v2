'use client';

import React, { createContext, useContext, useEffect, useState } from 'react';
import { User as FirebaseUser } from 'firebase/auth';
import { AuthRepository } from '@/lib/repositories/auth.repository';
import { UserRepository } from '@/lib/repositories/user.repository';
import { User } from '@/types/models';

interface AuthContextType {
  currentUser: FirebaseUser | null;
  userData: User | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<{ success: boolean; error?: string }>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const authRepository = new AuthRepository();
const userRepository = new UserRepository();

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [currentUser, setCurrentUser] = useState<FirebaseUser | null>(null);
  const [userData, setUserData] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let unsubscribeUserData: (() => void) | null = null;

    // Listen to auth state changes
    const unsubscribeAuth = authRepository.onAuthStateChange(async (user) => {
      if (user) {
        // Fetch user data from Firestore first before setting current user
        try {
          const result = await userRepository.getUserById(user.uid);
          if (result.status === 'success') {
            // Check if user is active
            if (result.data.isActive === false) {
              if (typeof window !== 'undefined') {
                console.log('User account is deactivated, logging out...');
              }
              await authRepository.signOut();
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
            unsubscribeUserData = userRepository.listenToUser(
              user.uid,
              (userData) => {
                // Check if user is still active
                if (userData.isActive === false) {
                  if (typeof window !== 'undefined') {
                    console.log('User account has been deactivated');
                  }
                  // Auto logout if user is deactivated
                  authRepository.signOut();
                  setUserData(null);
                  setCurrentUser(null);
                  return;
                }

                // User data updated
                setUserData(userData);
              },
              async (error) => {
                // User document deleted or error occurred
                if (typeof window !== 'undefined') {
                  console.error('User document deleted or error:', error);
                }
                // Auto logout
                await authRepository.signOut();
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
            await authRepository.signOut();
            setUserData(null);
            setCurrentUser(null);
            setLoading(false);
          }
        } catch (error) {
          // Handle any unexpected errors
          if (typeof window !== 'undefined') {
            console.error('Unexpected error fetching user data:', error);
          }
          await authRepository.signOut();
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

    return () => {
      unsubscribeAuth();
      if (unsubscribeUserData) {
        unsubscribeUserData();
      }
    };
  }, []);

  const signIn = async (email: string, password: string) => {
    try {
      const result = await authRepository.signIn(email, password);
      if (result.status === 'success' && result.data) {
        // Verify user data exists in Firestore
        const userResult = await userRepository.getUserById(result.data.uid);
        if (userResult.status === 'success') {
          // Check if user is active
          if (userResult.data.isActive === false) {
            await authRepository.signOut();
            return { success: false, error: 'Your account has been deactivated. Please contact administrator.' };
          }
          return { success: true };
        } else {
          // User authenticated but no user data found
          await authRepository.signOut();
          return { success: false, error: 'User data not found. Please contact administrator.' };
        }
      } else if (result.status === 'error') {
        return { success: false, error: result.message };
      } else {
        return { success: false, error: 'Unknown error occurred' };
      }
    } catch (error) {
      return { success: false, error: 'An unexpected error occurred during sign in' };
    }
  };

  const signOut = async () => {
    await authRepository.signOut();
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
