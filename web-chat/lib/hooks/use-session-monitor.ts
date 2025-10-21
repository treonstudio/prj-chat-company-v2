/**
 * Session Monitor Hook
 *
 * Monitors if current device session has been kicked out
 * Provides graceful warning before forcing logout
 */

'use client';

import { useEffect, useState } from 'react';
import { doc, onSnapshot, deleteDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase/config';
import { toast } from 'sonner';
import { useRouter } from 'next/navigation';

export function useSessionMonitor(userId: string | null, deviceId: string | null) {
  const [isKicked, setIsKicked] = useState(false);
  const router = useRouter();

  useEffect(() => {
    if (!userId || !deviceId) return;

    console.log('[SessionMonitor] Monitoring session for device:', deviceId);

    // Listen for kicked session
    const kickedRef = doc(db(), 'kickedSessions', deviceId);
    const unsubscribe = onSnapshot(
      kickedRef,
      async (snapshot) => {
        if (snapshot.exists()) {
          const data = snapshot.data();
          console.log('[SessionMonitor] Device kicked out:', data);

          setIsKicked(true);

          // Show graceful warning
          toast.error(
            'Sesi Anda telah berakhir karena login dari perangkat lain',
            {
              duration: 5000,
              description: 'Anda akan dialihkan ke halaman login dalam 3 detik...',
            }
          );

          // Clean up kicked session document
          try {
            await deleteDoc(kickedRef);
          } catch (error) {
            console.error('[SessionMonitor] Error deleting kicked session:', error);
          }

          // Force logout after 3 seconds
          setTimeout(() => {
            // Clear localStorage
            localStorage.clear();

            // Redirect to login
            router.push('/login');

            // Force page reload to reset all state
            window.location.href = '/login';
          }, 3000);
        }
      },
      (error) => {
        console.error('[SessionMonitor] Error listening to kicked sessions:', error);
      }
    );

    return () => {
      console.log('[SessionMonitor] Cleanup listener for device:', deviceId);
      unsubscribe();
    };
  }, [userId, deviceId, router]);

  return { isKicked };
}
