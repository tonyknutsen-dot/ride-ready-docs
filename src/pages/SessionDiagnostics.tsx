import { useEffect, useMemo, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

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

export default function SessionDiagnostics() {
  const location = useLocation();
  const { user, session, loading, isOfflineMode } = useAuth();
  const [directSession, setDirectSession] = useState<DirectSessionState>(initialDirectSessionState);

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

  const rows = useMemo(() => [
    ['Origin', window.location.origin],
    ['Current route', `${location.pathname}${location.search}${location.hash}` || '/'],
    ['Auth restore pending', loading ? 'Yes' : 'No'],
    ['Auth restore failed', !loading && !session ? 'Yes' : 'No'],
    ['Supabase session exists', session ? 'Yes' : 'No'],
    ['Direct getSession exists', directSession.checked ? (directSession.exists ? 'Yes' : 'No') : 'Checking'],
    ['User id present', user?.id || directSession.userIdPresent ? 'Yes' : 'No'],
    ['User email present', user?.email || directSession.emailPresent ? 'Yes' : 'No'],
    ['Offline mode', isOfflineMode ? 'Yes' : 'No'],
    ['Session expires at', directSession.expiresAt || 'Not available'],
    ['Session check error', directSession.error || 'None'],
  ], [directSession, isOfflineMode, loading, location.hash, location.pathname, location.search, session, user]);

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