'use client';

import React, { createContext, useContext, useEffect, useState } from 'react';
import { UsageControls, UsageControlsRepository } from '@/lib/repositories/usage-controls.repository';

interface UsageControlsContextType {
  usageControls: UsageControls;
  loading: boolean;
}

const UsageControlsContext = createContext<UsageControlsContextType | undefined>(undefined);

const usageControlsRepository = new UsageControlsRepository();

export function UsageControlsProvider({ children }: { children: React.ReactNode }) {
  const [usageControls, setUsageControls] = useState<UsageControls>({
    maxFileSizeUploadedInMB: 5, // Default 5MB
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = usageControlsRepository.getUsageControls(
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
