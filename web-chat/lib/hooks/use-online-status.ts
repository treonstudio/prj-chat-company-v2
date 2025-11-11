import { useState, useEffect } from 'react';

export interface ConnectionStatus {
  isOnline: boolean;
  isSlow: boolean;
  effectiveType?: 'slow-2g' | '2g' | '3g' | '4g';
}

export function useOnlineStatus(): ConnectionStatus {
  const [status, setStatus] = useState<ConnectionStatus>({
    isOnline: typeof navigator !== 'undefined' ? navigator.onLine : true,
    isSlow: false,
  });

  useEffect(() => {
    // Skip on server-side
    if (typeof window === 'undefined') {
      return;
    }

    const updateOnlineStatus = () => {
      setStatus((prev) => ({
        ...prev,
        isOnline: navigator.onLine,
      }));
    };

    const updateConnectionQuality = () => {
      // @ts-ignore - NetworkInformation API might not be available in all browsers
      const connection = navigator.connection || navigator.mozConnection || navigator.webkitConnection;


      if (connection) {
        const effectiveType = connection.effectiveType;
        const isSlow = effectiveType === 'slow-2g' || effectiveType === '2g' || effectiveType === '3g';

        setStatus((prev) => ({
          ...prev,
          isSlow,
          effectiveType,
        }));
      } else {
      }
    };

    // Initial check
    updateOnlineStatus();
    updateConnectionQuality();

    // Listen to online/offline events
    window.addEventListener('online', updateOnlineStatus);
    window.addEventListener('offline', updateOnlineStatus);

    // Listen to connection changes
    // @ts-ignore
    const connection = navigator.connection || navigator.mozConnection || navigator.webkitConnection;
    if (connection) {
      connection.addEventListener('change', updateConnectionQuality);
    }

    return () => {
      window.removeEventListener('online', updateOnlineStatus);
      window.removeEventListener('offline', updateOnlineStatus);

      if (connection) {
        connection.removeEventListener('change', updateConnectionQuality);
      }
    };
  }, []);

  return status;
}
