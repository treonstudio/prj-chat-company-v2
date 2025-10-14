'use client';

import { createContext, useContext, useEffect, useState } from 'react';
import { FeatureFlagsRepository } from '@/lib/repositories/feature-flags.repository';
import { FeatureFlags } from '@/types/models';

interface FeatureFlagsContextType {
  featureFlags: FeatureFlags;
  loading: boolean;
  error: string | null;
}

const FeatureFlagsContext = createContext<FeatureFlagsContextType | undefined>(
  undefined
);

const featureFlagsRepository = new FeatureFlagsRepository();

export function FeatureFlagsProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [featureFlags, setFeatureFlags] = useState<FeatureFlags>({
    allowCall: true,
    allowChat: true,
    allowCreateGroup: true,
    allowSendText: true,
    allowSendMedia: true,
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const unsubscribe = featureFlagsRepository.getFeatureFlags(
      (flags) => {
        setFeatureFlags(flags);
        setLoading(false);
        setError(null);
      },
      (error) => {
        setError(error);
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, []);

  return (
    <FeatureFlagsContext.Provider value={{ featureFlags, loading, error }}>
      {children}
    </FeatureFlagsContext.Provider>
  );
}

export function useFeatureFlags() {
  const context = useContext(FeatureFlagsContext);
  if (context === undefined) {
    throw new Error(
      'useFeatureFlags must be used within a FeatureFlagsProvider'
    );
  }
  return context;
}
