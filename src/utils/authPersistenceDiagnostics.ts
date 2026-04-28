import { supabase } from '@/integrations/supabase/client';

export const SUPABASE_PROJECT_REF = 'sbtldudgiskqfqqkrmaa';
export const SUPABASE_AUTH_STORAGE_KEY = `sb-${SUPABASE_PROJECT_REF}-auth-token`;
export const AUTH_PERSISTENCE_CHECK_KEY = 'rrd-auth-persistence-check';

export type AuthPersistenceSnapshot = {
  checkedAt: string;
  origin: string;
  route: string;
  storageKey: string;
  localStorageAvailable: boolean;
  storageKeyPresent: boolean;
  storageJsonValid: boolean | null;
  storageHasAccessToken: boolean;
  storageHasRefreshToken: boolean;
  storageUserPresent: boolean;
  directSessionExists: boolean;
  directSessionUserPresent: boolean;
  directSessionEmailPresent: boolean;
  directSessionError: string | null;
};

export async function inspectAuthPersistence(): Promise<AuthPersistenceSnapshot> {
  const snapshot: AuthPersistenceSnapshot = {
    checkedAt: new Date().toISOString(),
    origin: window.location.origin,
    route: `${window.location.pathname}${window.location.search}${window.location.hash}` || '/',
    storageKey: SUPABASE_AUTH_STORAGE_KEY,
    localStorageAvailable: true,
    storageKeyPresent: false,
    storageJsonValid: null,
    storageHasAccessToken: false,
    storageHasRefreshToken: false,
    storageUserPresent: false,
    directSessionExists: false,
    directSessionUserPresent: false,
    directSessionEmailPresent: false,
    directSessionError: null,
  };

  try {
    const rawAuthToken = localStorage.getItem(SUPABASE_AUTH_STORAGE_KEY);
    snapshot.storageKeyPresent = !!rawAuthToken;

    if (rawAuthToken) {
      try {
        const parsed = JSON.parse(rawAuthToken);
        const currentSession = parsed?.currentSession ?? parsed;
        snapshot.storageJsonValid = true;
        snapshot.storageHasAccessToken = !!currentSession?.access_token;
        snapshot.storageHasRefreshToken = !!currentSession?.refresh_token;
        snapshot.storageUserPresent = !!currentSession?.user?.id;
      } catch {
        snapshot.storageJsonValid = false;
      }
    }
  } catch {
    snapshot.localStorageAvailable = false;
  }

  try {
    const { data, error } = await supabase.auth.getSession();
    snapshot.directSessionExists = !!data.session;
    snapshot.directSessionUserPresent = !!data.session?.user?.id;
    snapshot.directSessionEmailPresent = !!data.session?.user?.email;
    snapshot.directSessionError = error?.message ?? null;
  } catch (error) {
    snapshot.directSessionError = error instanceof Error ? error.message : 'Unknown session check error';
  }

  return snapshot;
}

export function saveAuthPersistenceSnapshot(snapshot: AuthPersistenceSnapshot) {
  try {
    sessionStorage.setItem(AUTH_PERSISTENCE_CHECK_KEY, JSON.stringify(snapshot));
  } catch {
    // Non-critical diagnostics only.
  }
}

export function readAuthPersistenceSnapshot(): AuthPersistenceSnapshot | null {
  try {
    const raw = sessionStorage.getItem(AUTH_PERSISTENCE_CHECK_KEY);
    return raw ? JSON.parse(raw) as AuthPersistenceSnapshot : null;
  } catch {
    return null;
  }
}