'use client';

import { useEffect, useState } from 'react';
import { doc, onSnapshot } from 'firebase/firestore';
import { db } from '@/lib/firebase/config';
import { UserStatus } from '@/types/models';
import { formatDistanceToNow } from 'date-fns';
import { id as localeId } from 'date-fns/locale';

interface UserStatusData {
  status: UserStatus;
  lastSeen: Date | null;
  lastSeenText: string;
}

/**
 * Hook to monitor another user's online/offline status
 * Returns real-time status updates from Firestore
 */
export function useUserStatus(userId: string | null): UserStatusData {
  const [status, setStatus] = useState<UserStatus>(UserStatus.OFFLINE);
  const [lastSeen, setLastSeen] = useState<Date | null>(null);
  const [lastSeenText, setLastSeenText] = useState<string>('');

  useEffect(() => {
    if (!userId) {
      setStatus(UserStatus.OFFLINE);
      setLastSeen(null);
      setLastSeenText('');
      return;
    }

    // Listen to user document for status changes
    const userRef = doc(db(), 'users', userId);
    const unsubscribe = onSnapshot(
      userRef,
      (snapshot) => {
        if (snapshot.exists()) {
          const data = snapshot.data();
          const userStatus = data.status || UserStatus.OFFLINE;
          const lastSeenTimestamp = data.lastSeen;

          console.log('[useUserStatus] Status update:', {
            userId,
            status: userStatus,
            lastSeen: lastSeenTimestamp ? new Date(lastSeenTimestamp.toMillis()).toLocaleString() : 'none',
            hasLastSeen: !!lastSeenTimestamp
          });

          setStatus(userStatus);

          // Handle status display based on availability of data
          if (userStatus === UserStatus.ONLINE && lastSeenTimestamp) {
            // User is actively online
            setLastSeen(lastSeenTimestamp.toDate());
            setLastSeenText('online');
            console.log('[useUserStatus] Displaying: online (active)');
          } else if (userStatus === UserStatus.OFFLINE && lastSeenTimestamp) {
            // User is offline but has lastSeen timestamp
            const lastSeenDate = lastSeenTimestamp.toDate();
            setLastSeen(lastSeenDate);

            try {
              const relativeTime = formatDistanceToNow(lastSeenDate, {
                addSuffix: true,
                locale: localeId,
              });
              const text = `terakhir dilihat ${relativeTime}`;
              setLastSeenText(text);
              console.log('[useUserStatus] Displaying:', text);
            } catch (error) {
              console.error('[useUserStatus] Error formatting last seen:', error);
              setLastSeenText('');
            }
          } else {
            // No lastSeen data (user never logged in since presence system enabled)
            // Display empty string (no status text)
            setLastSeen(null);
            setLastSeenText('');
            console.log('[useUserStatus] No lastSeen data, displaying empty');
          }
        } else {
          // User document doesn't exist (deleted user)
          // Display empty string
          console.log('[useUserStatus] User document not found:', userId);
          setStatus(UserStatus.OFFLINE);
          setLastSeen(null);
          setLastSeenText('');
        }
      },
      (error) => {
        console.error('[useUserStatus] Error listening to user status:', error);
        setStatus(UserStatus.OFFLINE);
        setLastSeen(null);
        setLastSeenText(''); // Empty on error
      }
    );

    return () => {
      unsubscribe();
    };
  }, [userId]);

  // Update last seen text periodically for relative time (only if OFFLINE with lastSeen)
  useEffect(() => {
    if (status === UserStatus.OFFLINE && lastSeen) {
      const interval = setInterval(() => {
        try {
          const relativeTime = formatDistanceToNow(lastSeen, {
            addSuffix: true,
            locale: localeId,
          });
          setLastSeenText(`terakhir dilihat ${relativeTime}`);
        } catch (error) {
          console.error('[useUserStatus] Error updating last seen text:', error);
          setLastSeenText(''); // Empty on error
        }
      }, 60000); // Update every minute

      return () => clearInterval(interval);
    }
  }, [status, lastSeen]);

  return {
    status,
    lastSeen,
    lastSeenText,
  };
}
