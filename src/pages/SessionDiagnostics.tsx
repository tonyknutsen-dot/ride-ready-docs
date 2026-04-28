import { useEffect, useMemo, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  inspectAuthPersistence,
  readAuthPersistenceSnapshot,
  SUPABASE_AUTH_STORAGE_KEY,
  type AuthPersistenceSnapshot,
} from '@/utils/authPersistenceDiagnostics';

const DIAGNOSTICS_BUILD_ID = 'canonical-auth-probe-2026-04-28-3';

type DirectSessionState = {
  checked: boolean;
  exists: boolean;
  userIdPresent: boolean;
  emailPresent: boolean;
  expiresAt: string | null;
  error: string | null;
};

const initialDirectSessionState: DirectSessionState = {
  checked: false,
  exists: false,
  userIdPresent: false,
  emailPresent: false,
  expiresAt: null,
  error: null,
};

type RuntimeStorageState = {
  loadedAt: string;
  scriptAssets: string;
  authStorageKeyPresent: boolean;
  authStorageJsonValid: boolean | null;
  authStorageHasAccessToken: boolean;
  authStorageHasRefreshToken: boolean;
  authStorageUserPresent: boolean;
  supabaseStorageKeys: string;
  localStorageAvailable: boolean;
  serviceWorkerControlled: boolean;
  serviceWorkerController: string;
  serviceWorkerRegistrations: string;
  cacheNames: string;
  lastSignInSnapshot: AuthPersistenceSnapshot | null;
};

const initialRuntimeStorageState: RuntimeStorageState = {
  loadedAt: 'Checking',
  scriptAssets: 'Checking',
  authStorageKeyPresent: false,
  authStorageJsonValid: null,
  authStorageHasAccessToken: false,
  authStorageHasRefreshToken: false,
  authStorageUserPresent: false,
  supabaseStorageKeys: 'Checking',
  localStorageAvailable: true,
  serviceWorkerControlled: false,
  serviceWorkerController: 'Checking',
  serviceWorkerRegistrations: 'Checking',
  cacheNames: 'Checking',
  lastSignInSnapshot: null,
};

export default function SessionDiagnostics() {
  const location = useLocation();
  const { user, session, loading, isOfflineMode } = useAuth();
  const [directSession, setDirectSession] = useState<DirectSessionState>(initialDirectSessionState);
  const [runtimeStorage, setRuntimeStorage] = useState<RuntimeStorageState>(initialRuntimeStorageState);

  useEffect(() => {
    let mounted = true;

    const checkSession = async () => {
      try {
        const { data, error } = await supabase.auth.getSession();
        if (!mounted) return;

        const activeSession = data.session;
        setDirectSession({
          checked: true,
          exists: !!activeSession,
          userIdPresent: !!activeSession?.user?.id,
          emailPresent: !!activeSession?.user?.email,
          expiresAt: activeSession?.expires_at ? new Date(activeSession.expires_at * 1000).toISOString() : null,
          error: error?.message ?? null,
        });
      } catch (error) {
        if (!mounted) return;
        setDirectSession({
          ...initialDirectSessionState,
          checked: true,
          error: error instanceof Error ? error.message : 'Unknown session check error',
        });
      }
    };

    void checkSession();

    return () => {
      mounted = false;
    };
  }, [session?.access_token]);

  useEffect(() => {
    let mounted = true;

    const inspectRuntimeStorage = async () => {
      const nextState: RuntimeStorageState = { ...initialRuntimeStorageState };
      nextState.loadedAt = new Date().toISOString();
      nextState.scriptAssets = Array.from(document.scripts)
        .map((script) => script.src)
        .filter(Boolean)
        .map((src) => src.replace(window.location.origin, ''))
        .join(', ') || 'None detected';

      try {
        const keys = Object.keys(localStorage).filter((key) => key.startsWith('sb-') || key.includes('supabase'));
        const rawAuthToken = localStorage.getItem(SUPABASE_AUTH_STORAGE_KEY);
        nextState.authStorageKeyPresent = !!rawAuthToken;
        nextState.supabaseStorageKeys = keys.length ? keys.sort().join(', ') : 'None on this origin';

        if (rawAuthToken) {
          try {
            const parsed = JSON.parse(rawAuthToken);
            const currentSession = parsed?.currentSession ?? parsed;
            nextState.authStorageJsonValid = true;
            nextState.authStorageHasAccessToken = !!currentSession?.access_token;
            nextState.authStorageHasRefreshToken = !!currentSession?.refresh_token;
            nextState.authStorageUserPresent = !!currentSession?.user?.id;
          } catch {
            nextState.authStorageJsonValid = false;
          }
        }
      } catch {
        nextState.localStorageAvailable = false;
        nextState.supabaseStorageKeys = 'localStorage unavailable';
      }

      if ('serviceWorker' in navigator) {
        nextState.serviceWorkerControlled = !!navigator.serviceWorker.controller;
        nextState.serviceWorkerController = navigator.serviceWorker.controller?.scriptURL || 'None';
        try {
          const registrations = await navigator.serviceWorker.getRegistrations();
          nextState.serviceWorkerRegistrations = registrations.length
            ? registrations.map((registration) => registration.active?.scriptURL || registration.waiting?.scriptURL || registration.installing?.scriptURL || 'registration without active script').join(', ')
            : 'None';
        } catch {
          nextState.serviceWorkerRegistrations = 'Unable to inspect';
        }
      } else {
        nextState.serviceWorkerRegistrations = 'Not supported';
      }

      if ('caches' in window) {
        try {
          const names = await caches.keys();
          nextState.cacheNames = names.length ? names.join(', ') : 'None';
        } catch {
          nextState.cacheNames = 'Unable to inspect';
        }
      } else {
        nextState.cacheNames = 'Not supported';
      }

      if (mounted) {
        setRuntimeStorage(nextState);
      }
    };

    void inspectRuntimeStorage();

    return () => {
      mounted = false;
    };
  }, [session?.access_token]);

  const rows = useMemo(() => [
    ['Diagnostics build', DIAGNOSTICS_BUILD_ID],
    ['Page loaded at', runtimeStorage.loadedAt],
    ['Origin', window.location.origin],
    ['Current route', `${location.pathname}${location.search}${location.hash}` || '/'],
    ['Loaded script assets', runtimeStorage.scriptAssets],
    ['Auth restore pending', loading ? 'Yes' : 'No'],
    ['Auth restore failed', !loading && !session ? 'Yes' : 'No'],
    ['Supabase session exists', session ? 'Yes' : 'No'],
    ['Direct getSession exists', directSession.checked ? (directSession.exists ? 'Yes' : 'No') : 'Checking'],
    ['User id present', user?.id || directSession.userIdPresent ? 'Yes' : 'No'],
    ['User email present', user?.email || directSession.emailPresent ? 'Yes' : 'No'],
    ['Offline mode', isOfflineMode ? 'Yes' : 'No'],
    ['Session expires at', directSession.expiresAt || 'Not available'],
    ['Session check error', directSession.error || 'None'],
    ['Supabase auth storage key', SUPABASE_AUTH_STORAGE_KEY],
    ['Auth storage key present on this origin', runtimeStorage.authStorageKeyPresent ? 'Yes' : 'No'],
    ['Auth storage JSON valid', runtimeStorage.authStorageJsonValid === null ? 'Not available' : runtimeStorage.authStorageJsonValid ? 'Yes' : 'No'],
    ['Auth storage access token present', runtimeStorage.authStorageHasAccessToken ? 'Yes' : 'No'],
    ['Auth storage refresh token present', runtimeStorage.authStorageHasRefreshToken ? 'Yes' : 'No'],
    ['Auth storage user present', runtimeStorage.authStorageUserPresent ? 'Yes' : 'No'],
    ['Supabase/local auth storage keys', runtimeStorage.supabaseStorageKeys],
    ['localStorage available', runtimeStorage.localStorageAvailable ? 'Yes' : 'No'],
    ['Service worker controlled page', runtimeStorage.serviceWorkerControlled ? 'Yes' : 'No'],
    ['Service worker controller', runtimeStorage.serviceWorkerController],
    ['Service worker registrations', runtimeStorage.serviceWorkerRegistrations],
    ['Cache storage names', runtimeStorage.cacheNames],
  ], [directSession, isOfflineMode, loading, location.hash, location.pathname, location.search, runtimeStorage, session, user]);

  return (
    <main className="min-h-screen bg-background p-4 md:p-6">
      <div className="mx-auto max-w-3xl space-y-4">
        <div className="space-y-1">
          <Badge variant="outline">Temporary diagnostics</Badge>
          <h1 className="text-xl font-bold tracking-tight text-foreground">Session diagnostics</h1>
          <p className="text-sm text-muted-foreground">Non-secret runtime status for auth/origin debugging.</p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Runtime session state</CardTitle>
          </CardHeader>
          <CardContent>
            <dl className="divide-y divide-border text-sm">
              {rows.map(([label, value]) => (
                <div key={label} className="grid gap-1 py-3 md:grid-cols-[180px_1fr]">
                  <dt className="font-medium text-muted-foreground">{label}</dt>
                  <dd className="break-words font-mono text-foreground">{value}</dd>
                </div>
              ))}
            </dl>
          </CardContent>
        </Card>
      </div>
    </main>
  );
}