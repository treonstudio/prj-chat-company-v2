/**
 * Device Utilities
 *
 * Provides utilities for device identification and information
 * Used for device locking (1 mobile + 1 web per user)
 */

export interface DeviceInfo {
  deviceType: 'mobile' | 'web';
  browser: string;
  os: string;
  userAgent: string;
  deviceName: string;
}

/**
 * Get or generate unique device ID
 * Stored in localStorage to persist across sessions
 */
export function getDeviceId(): string {
  if (typeof window === 'undefined') return '';

  let deviceId = localStorage.getItem('deviceId');

  if (!deviceId) {
    // Generate unique device ID: web_{timestamp}_{random}
    deviceId = `web_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    localStorage.setItem('deviceId', deviceId);
  }

  return deviceId;
}

/**
 * Get browser name from user agent
 * Order matters: Check specific browsers BEFORE generic Chrome
 */
function getBrowserName(userAgent: string): string {
  // Check for Brave first (Chromium-based, doesn't include 'Brave' in UA)
  // Brave detection requires checking navigator.brave API
  if (typeof navigator !== 'undefined' && (navigator as any).brave !== undefined) {
    return 'Brave';
  }

  // Check Edge before Chrome (Edge is Chromium-based and includes 'Chrome')
  if (userAgent.includes('Edg/') || userAgent.includes('Edge/')) return 'Edge';

  // Check Opera before Chrome (Opera is Chromium-based and includes 'Chrome')
  if (userAgent.includes('OPR/') || userAgent.includes('Opera')) return 'Opera';

  // Check Vivaldi before Chrome (Vivaldi is Chromium-based)
  if (userAgent.includes('Vivaldi')) return 'Vivaldi';

  // Firefox (not Chromium-based)
  if (userAgent.includes('Firefox')) return 'Firefox';

  // Safari (check before Chrome, as Chrome UA includes Safari)
  // But only return Safari if it's NOT Chrome
  if (userAgent.includes('Safari') && !userAgent.includes('Chrome')) return 'Safari';

  // Chrome and other Chromium browsers (check last)
  if (userAgent.includes('Chrome')) return 'Chrome';

  return 'Unknown';
}

/**
 * Get OS name from user agent
 */
function getOSName(userAgent: string): string {
  if (userAgent.includes('Windows')) return 'Windows';
  if (userAgent.includes('Mac OS')) return 'macOS';
  if (userAgent.includes('Linux')) return 'Linux';
  if (userAgent.includes('Android')) return 'Android';
  if (userAgent.includes('iOS')) return 'iOS';
  return 'Unknown';
}

/**
 * Get complete device information
 */
export function getDeviceInfo(): DeviceInfo {
  if (typeof window === 'undefined') {
    return {
      deviceType: 'web',
      browser: 'Unknown',
      os: 'Unknown',
      userAgent: '',
      deviceName: 'Unknown Device',
    };
  }

  const ua = navigator.userAgent;
  const browser = getBrowserName(ua);
  const os = getOSName(ua);
  const deviceName = `${browser} on ${os}`;

  return {
    deviceType: 'web',
    browser,
    os,
    userAgent: ua,
    deviceName,
  };
}

/**
 * Clear device ID (for logout)
 */
export function clearDeviceId(): void {
  if (typeof window === 'undefined') return;
  localStorage.removeItem('deviceId');
}

/**
 * Get or generate unique tab ID
 * Stored in sessionStorage (unique per tab/window)
 */
export function getTabId(): string {
  if (typeof window === 'undefined') return '';

  let tabId = sessionStorage.getItem('tabId');

  if (!tabId) {
    // Generate unique tab ID: tab_{timestamp}_{random}
    tabId = `tab_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    sessionStorage.setItem('tabId', tabId);
  }

  return tabId;
}

/**
 * Clear tab ID (for cleanup)
 */
export function clearTabId(): void {
  if (typeof window === 'undefined') return;
  sessionStorage.removeItem('tabId');
}
