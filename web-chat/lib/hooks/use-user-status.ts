'use client';

import { useEffect, useState } from 'react';
import { ref, onValue, off } from 'firebase/database';
import { realtimeDatabase } from '@/lib/firebase/config';
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
 * Returns real-time status updates from RTDB (migrated from Firestore)
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

    // Listen to RTDB /status/{userId} for real-time presence
    const rtdb = realtimeDatabase();
    const statusRef = ref(rtdb, `/status/${userId}`);

    const unsubscribe = onValue(
      statusRef,
      (snapshot) => {
        console.log('[useUserStatus] ===== RTDB LISTENER FIRED =====');
        console.log('[useUserStatus] userId:', userId);
        console.log('[useUserStatus] snapshot.exists():', snapshot.exists());
        console.log('[useUserStatus] Raw RTDB data:', snapshot.val());

        if (snapshot.exists()) {
          const data = snapshot.val();
          const statusFromRTDB = data.status;
          const lastSeenTimestamp = data.lastSeen; // milliseconds

          console.log('[useUserStatus] statusFromRTDB:', statusFromRTDB);
          console.log('[useUserStatus] lastSeenTimestamp:', lastSeenTimestamp);

          // Parse status - RTDB returns plain string
          let userStatus: UserStatus;
          if (statusFromRTDB === 'ONLINE') {
            userStatus = UserStatus.ONLINE;
          } else {
            userStatus = UserStatus.OFFLINE;
          }

          console.log('[useUserStatus] Final status:', userStatus);

          setStatus(userStatus);

          // Handle status display based on availability of data
          if (userStatus === UserStatus.ONLINE) {
            // User is actively online
            if (lastSeenTimestamp) {
              setLastSeen(new Date(lastSeenTimestamp));
            }
            setLastSeenText('online');
            console.log('[useUserStatus] Displaying: online');
          } else if (userStatus === UserStatus.OFFLINE && lastSeenTimestamp) {
            // User is offline but has lastSeen timestamp
            const lastSeenDate = new Date(lastSeenTimestamp);
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
            // No lastSeen data
            setLastSeen(null);
            setLastSeenText('');
            console.log('[useUserStatus] No lastSeen data');
          }
        } else {
          // User status doesn't exist in RTDB
          console.log('[useUserStatus] User status not found in RTDB:', userId);
          setStatus(UserStatus.OFFLINE);
          setLastSeen(null);
          setLastSeenText('');
        }
      },
      (error) => {
        console.error('[useUserStatus] Error listening to RTDB:', error);
        setStatus(UserStatus.OFFLINE);
        setLastSeen(null);
        setLastSeenText('');
      }
    );

    return () => {
      // Cleanup RTDB listener
      off(statusRef, 'value', unsubscribe);
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
