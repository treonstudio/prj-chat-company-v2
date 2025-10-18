'use client';

import { createContext, useContext, useEffect, useState } from 'react';
import { FeatureFlags } from '@/types/models';

interface FeatureFlagsContextType {
  featureFlags: FeatureFlags;
  loading: boolean;
  error: string | null;
}

const FeatureFlagsContext = createContext<FeatureFlagsContextType | undefined>(
  undefined
);

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
    // Only run on client-side
    if (typeof window === 'undefined') {
      setLoading(false);
      return;
    }

    // Dynamic import to avoid server-side execution
    import('@/lib/repositories/feature-flags.repository').then(({ FeatureFlagsRepository }) => {
      const repository = new FeatureFlagsRepository();

      const unsubscribe = repository.getFeatureFlags(
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
    }).catch((error) => {
      console.error('Failed to load feature flags repository:', error);
      setError('Failed to load feature flags');
      setLoading(false);
    });
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
