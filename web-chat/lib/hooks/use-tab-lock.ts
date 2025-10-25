/**
 * Tab Lock Hook
 *
 * Ensures only one tab is active per browser
 * Shows dialog when conflict detected (like WhatsApp Web)
 */

'use client';

import { useEffect, useState, useRef, useCallback } from 'react';
import { getTabId, clearTabId } from '@/lib/utils/device.utils';

interface ActiveTab {
  tabId: string;
  timestamp: number;
}

const ACTIVE_TAB_KEY = 'activeTab';
const GRACE_PERIOD_MS = 2000; // 2 seconds grace period for reload

export function useTabLock(userId: string | null) {
  const [hasConflict, setHasConflict] = useState(false);
  const [isActive, setIsActive] = useState(true);
  const tabIdRef = useRef<string>('');
  const checkIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const conflictDetectedRef = useRef(false);

  useEffect(() => {
    if (!userId || typeof window === 'undefined') return;

    const currentTabId = getTabId();
    tabIdRef.current = currentTabId;

    console.log('[TabLock] Tab initialized:', currentTabId);

    // Function to claim this tab as active
    const claimActiveTab = (forceLog = false) => {
      const activeTab: ActiveTab = {
        tabId: currentTabId,
        timestamp: Date.now(),
      };
      localStorage.setItem(ACTIVE_TAB_KEY, JSON.stringify(activeTab));
      setIsActive(true);
      setHasConflict(false);
      conflictDetectedRef.current = false;
      // Only log on initial claim or force, not on periodic refresh
      if (forceLog) {
        console.log('[TabLock] Claimed as active tab:', currentTabId);
      }
    };

    // Function to check if this tab should be active
    const checkTabStatus = () => {
      try {
        const activeTabStr = localStorage.getItem(ACTIVE_TAB_KEY);
        if (!activeTabStr) {
          // No active tab, claim it
          claimActiveTab(true);
          return;
        }

        const activeTab: ActiveTab = JSON.parse(activeTabStr);

        // Check if this is the active tab
        if (activeTab.tabId === currentTabId) {
          // This tab is active, update timestamp silently (no log spam)
          claimActiveTab(false);
          return;
        }

        // Another tab is active, check timestamp
        const timeDiff = Date.now() - activeTab.timestamp;

        // If the active tab timestamp is recent (within grace period + 5s)
        // it means another tab is actively claiming
        if (timeDiff < GRACE_PERIOD_MS + 5000) {
          if (!conflictDetectedRef.current) {
            console.log('[TabLock] Another tab is active, showing conflict dialog');
            setHasConflict(true);
            setIsActive(false);
            conflictDetectedRef.current = true;
          }
        } else {
          // Active tab seems stale (no update in grace period + 5s)
          // This could mean the other tab was closed, so claim this tab
          console.log('[TabLock] Previous active tab seems stale, claiming this tab');
          claimActiveTab(true);
        }
      } catch (error) {
        console.error('[TabLock] Error checking tab status:', error);
        claimActiveTab(true);
      }
    };

    // Initial claim
    claimActiveTab(true);

    // Check tab status periodically (increased to 5s since we have real-time storage events)
    checkIntervalRef.current = setInterval(checkTabStatus, 5000); // Check every 5 seconds

    // Listen to storage events (when other tabs update localStorage)
    const handleStorageChange = (event: StorageEvent) => {
      if (event.key === ACTIVE_TAB_KEY && event.newValue) {
        try {
          const activeTab: ActiveTab = JSON.parse(event.newValue);

          // If another tab claimed active status
          if (activeTab.tabId !== currentTabId) {
            console.log('[TabLock] Another tab claimed active status via storage event:', activeTab.tabId);

            // Instant conflict detection - no delay
            if (!conflictDetectedRef.current) {
              console.log('[TabLock] Showing conflict dialog immediately');
              setHasConflict(true);
              setIsActive(false);
              conflictDetectedRef.current = true;
            }
          }
        } catch (error) {
          console.error('[TabLock] Error parsing storage event:', error);
        }
      }
    };

    window.addEventListener('storage', handleStorageChange);

    // Cleanup on unmount
    return () => {
      if (checkIntervalRef.current) {
        clearInterval(checkIntervalRef.current);
      }
      window.removeEventListener('storage', handleStorageChange);

      // Clear active tab if this tab is leaving
      try {
        const activeTabStr = localStorage.getItem(ACTIVE_TAB_KEY);
        if (activeTabStr) {
          const activeTab: ActiveTab = JSON.parse(activeTabStr);
          if (activeTab.tabId === currentTabId) {
            localStorage.removeItem(ACTIVE_TAB_KEY);
            console.log('[TabLock] Cleared active tab on unmount');
          }
        }
      } catch (error) {
        console.error('[TabLock] Error clearing active tab:', error);
      }
    };
  }, [userId]);

  // Handle page visibility change (tab focus/blur)
  useEffect(() => {
    if (!userId || typeof window === 'undefined') return;

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible' && isActive) {
        // Tab became visible, reclaim active status
        const currentTabId = tabIdRef.current;
        const activeTab: ActiveTab = {
          tabId: currentTabId,
          timestamp: Date.now(),
        };
        localStorage.setItem(ACTIVE_TAB_KEY, JSON.stringify(activeTab));
        console.log('[TabLock] Tab became visible, reclaimed active status');
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [userId, isActive]);

  // Callback untuk "Gunakan di Sini"
  const useHere = useCallback(() => {
    const currentTabId = tabIdRef.current;
    const activeTab: ActiveTab = {
      tabId: currentTabId,
      timestamp: Date.now(),
    };
    localStorage.setItem(ACTIVE_TAB_KEY, JSON.stringify(activeTab));
    setIsActive(true);
    setHasConflict(false);
    conflictDetectedRef.current = false;
    console.log('[TabLock] User chose to use this tab');
  }, []);

  // Callback untuk "Tutup"
  const closeTab = useCallback(() => {
    clearTabId();
    setHasConflict(false);
    setIsActive(false);
    console.log('[TabLock] User chose to close this tab');
    // Redirect to login or close window
    if (typeof window !== 'undefined') {
      window.location.href = '/login';
    }
  }, []);

  return {
    isActive,
    hasConflict,
    useHere,
    closeTab,
  };
}
