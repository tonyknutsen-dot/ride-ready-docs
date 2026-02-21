/**
 * Persists minimal user identity & app state to localStorage
 * so the PWA can boot into the correct route when offline.
 */

const IDENTITY_KEY = 'rrd_offline_identity';
const LAST_ROUTE_KEY = 'rrd_last_route';

export interface OfflineIdentity {
  userId: string;
  role: string;
  organisationId: string | null;
  setupComplete: boolean;
  permissions?: Record<string, boolean>;
  lastSync: string;
}

export function saveOfflineIdentity(identity: OfflineIdentity): void {
  try {
    localStorage.setItem(IDENTITY_KEY, JSON.stringify(identity));
  } catch {
    // localStorage quota exceeded or unavailable – ignore
  }
}

export function getOfflineIdentity(): OfflineIdentity | null {
  try {
    const raw = localStorage.getItem(IDENTITY_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as OfflineIdentity;
  } catch {
    return null;
  }
}

export function clearOfflineIdentity(): void {
  try {
    localStorage.removeItem(IDENTITY_KEY);
    localStorage.removeItem(LAST_ROUTE_KEY);
  } catch {
    // ignore
  }
}

export function saveLastRoute(path: string): void {
  // Don't save public / auth / setup routes
  const skip = ['/', '/auth', '/profile-setup', '/staff-invite', '/tester-invite'];
  if (skip.some(s => path === s || path.startsWith('/staff-invite/') || path.startsWith('/tester-invite/'))) return;
  try {
    localStorage.setItem(LAST_ROUTE_KEY, path);
  } catch {
    // ignore
  }
}

export function getLastRoute(): string | null {
  try {
    return localStorage.getItem(LAST_ROUTE_KEY);
  } catch {
    return null;
  }
}
