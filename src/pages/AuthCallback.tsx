import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams, Link } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Loader2, AlertCircle, CheckCircle2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import appLogo from '@/assets/app-logo.jpg';

type Status = 'working' | 'error' | 'success';

const AuthCallback = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [status, setStatus] = useState<Status>('working');
  const [errorMessage, setErrorMessage] = useState<string>('');
  const [resending, setResending] = useState(false);
  const [resendDone, setResendDone] = useState(false);
  const [emailForResend, setEmailForResend] = useState<string>('');

  useEffect(() => {
    let cancelled = false;

    const route = async (userId: string) => {
      try {
        const { data: profile } = await supabase
          .from('profiles')
          .select('setup_complete, full_name')
          .eq('user_id', userId)
          .maybeSingle();
        if (cancelled) return;
        const complete = !!profile?.setup_complete;
        navigate(complete ? '/overview' : '/profile-setup', { replace: true });
      } catch {
        if (!cancelled) navigate('/profile-setup', { replace: true });
      }
    };

    const handle = async () => {
      try {
        const url = new URL(window.location.href);
        const code = url.searchParams.get('code');
        const errorParam =
          url.searchParams.get('error_description') ||
          url.searchParams.get('error') ||
          (url.hash.match(/error_description=([^&]+)/)?.[1] ?? null);

        if (errorParam) {
          setStatus('error');
          setErrorMessage(decodeURIComponent(errorParam).replace(/\+/g, ' '));
          return;
        }

        // PKCE / new flow: exchange ?code= for a session
        if (code) {
          const { data, error } = await supabase.auth.exchangeCodeForSession(code);
          if (error) {
            console.error('[AuthCallback] exchangeCodeForSession failed:', error);
            setStatus('error');
            setErrorMessage(error.message || 'Could not confirm your email. The link may have expired.');
            return;
          }
          if (data.session?.user) {
            setStatus('success');
            setEmailForResend(data.session.user.email ?? '');
            await route(data.session.user.id);
            return;
          }
        }

        // Legacy implicit flow: token lives in URL hash and supabase-js parses it automatically.
        // Wait briefly for onAuthStateChange to fire.
        const { data: { session } } = await supabase.auth.getSession();
        if (session?.user) {
          setStatus('success');
          setEmailForResend(session.user.email ?? '');
          await route(session.user.id);
          return;
        }

        // Poll up to ~6s for hash-based session
        for (let i = 0; i < 12; i++) {
          await new Promise((r) => setTimeout(r, 500));
          if (cancelled) return;
          const { data: { session: s } } = await supabase.auth.getSession();
          if (s?.user) {
            setStatus('success');
            setEmailForResend(s.user.email ?? '');
            await route(s.user.id);
            return;
          }
        }

        setStatus('error');
        setErrorMessage(
          'We could not confirm your account from this link. It may have expired or already been used.'
        );
      } catch (err) {
        console.error('[AuthCallback] unexpected error:', err);
        if (cancelled) return;
        setStatus('error');
        setErrorMessage(err instanceof Error ? err.message : 'Unexpected error confirming your account.');
      }
    };

    void handle();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleResend = async () => {
    const email = (emailForResend || searchParams.get('email') || '').trim();
    if (!email) {
      navigate('/auth', { replace: true });
      return;
    }
    setResending(true);
    try {
      await supabase.auth.resend({ type: 'signup', email });
      setResendDone(true);
    } catch (err) {
      console.error('[AuthCallback] resend failed:', err);
    } finally {
      setResending(false);
    }
  };

  return (
    <main className="min-h-[100dvh] flex items-center justify-center bg-background px-4 py-8">
      <div className="w-full max-w-md min-w-0">
        <div className="flex flex-col items-center text-center space-y-4">
          <img src={appLogo} alt="Ride Ready Docs" className="h-14 w-14 rounded-lg" />

          {status === 'working' && (
            <>
              <Loader2 className="h-8 w-8 animate-spin text-primary" aria-hidden />
              <h1 className="text-xl font-semibold text-foreground">Confirming your account…</h1>
              <p className="text-sm text-muted-foreground">This usually takes a couple of seconds.</p>
            </>
          )}

          {status === 'success' && (
            <>
              <CheckCircle2 className="h-8 w-8 text-primary" aria-hidden />
              <h1 className="text-xl font-semibold text-foreground">Account confirmed</h1>
              <p className="text-sm text-muted-foreground">Taking you to your account…</p>
            </>
          )}

          {status === 'error' && (
            <>
              <AlertCircle className="h-8 w-8 text-destructive" aria-hidden />
              <h1 className="text-xl font-semibold text-foreground">We couldn’t confirm your account</h1>
              <p
                className="text-sm text-muted-foreground break-words"
                style={{ overflowWrap: 'anywhere' }}
              >
                {errorMessage}
              </p>

              <div className="w-full flex flex-col gap-2 pt-2">
                <Button onClick={() => navigate('/auth', { replace: true })} className="w-full">
                  Go to sign in
                </Button>
                <Button
                  variant="outline"
                  onClick={handleResend}
                  disabled={resending || resendDone}
                  className="w-full"
                >
                  {resendDone
                    ? 'Confirmation email sent'
                    : resending
                    ? 'Sending…'
                    : 'Resend confirmation email'}
                </Button>
                <Link
                  to="/help"
                  className="text-xs text-muted-foreground underline underline-offset-2 mt-1"
                >
                  Need help? Contact support
                </Link>
              </div>
            </>
          )}
        </div>
      </div>
    </main>
  );
};

export default AuthCallback;
