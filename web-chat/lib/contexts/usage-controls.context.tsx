'use client';

import React, { createContext, useContext, useEffect, useState } from 'react';

interface UsageControls {
  maxFileSizeUploadedInMB: number;
}

interface UsageControlsContextType {
  usageControls: UsageControls;
  loading: boolean;
}

const UsageControlsContext = createContext<UsageControlsContextType | undefined>(undefined);

export function UsageControlsProvider({ children }: { children: React.ReactNode }) {
  const [usageControls, setUsageControls] = useState<UsageControls>({
    maxFileSizeUploadedInMB: 5, // Default 5MB
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Only run on client-side
    if (typeof window === 'undefined') {
      setLoading(false);
      return;
    }

    // Dynamic import to avoid server-side execution
    import('@/lib/repositories/usage-controls.repository').then(({ UsageControlsRepository }) => {
      const repository = new UsageControlsRepository();

      const unsubscribe = repository.getUsageControls(
        (controls) => {
          setUsageControls(controls);
          setLoading(false);
        },
        (error) => {
          console.error('Failed to fetch usage controls:', error);
          // Keep default values on error
          setLoading(false);
        }
      );

      return () => unsubscribe();
    }).catch((error) => {
      console.error('Failed to load usage controls repository:', error);
      setLoading(false);
    });
  }, []);

  const value: UsageControlsContextType = {
    usageControls,
    loading,
  };

  return (
    <UsageControlsContext.Provider value={value}>
      {children}
    </UsageControlsContext.Provider>
  );
}

export function useUsageControls() {
  const context = useContext(UsageControlsContext);
  if (context === undefined) {
    throw new Error('useUsageControls must be used within a UsageControlsProvider');
  }
  return context;
}
