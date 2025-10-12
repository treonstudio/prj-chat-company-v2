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
    // Listen to auth state changes
    const unsubscribe = authRepository.onAuthStateChange(async (user) => {
      setCurrentUser(user);

      if (user) {
        // Fetch user data from Firestore
        const result = await userRepository.getUserById(user.uid);
        if (result.status === 'success') {
          setUserData(result.data);
        } else if (result.status === 'error') {
          // If user data not found or error, logout the user
          console.error('Failed to fetch user data:', result.message);
          await authRepository.signOut();
          setUserData(null);
          setCurrentUser(null);
        }
      } else {
        setUserData(null);
      }

      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const signIn = async (email: string, password: string) => {
    const result = await authRepository.signIn(email, password);
    if (result.status === 'success') {
      return { success: true };
    } else if (result.status === 'error') {
      return { success: false, error: result.message };
    } else {
      return { success: false, error: 'Unknown error occurred' };
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
