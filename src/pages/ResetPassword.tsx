import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Card, CardContent } from '@/components/ui/card';
import { Loader2, Eye, EyeOff, CheckCircle2, AlertCircle, ShieldCheck } from 'lucide-react';
import appLogo from '@/assets/app-logo.jpg';
import { PasswordStrengthIndicator } from '@/components/PasswordStrengthIndicator';
import { validatePasswordStrength } from '@/utils/emailSuggestion';
import { RESET_LINK_EXPIRED_MESSAGE, logRecoveryDiagnostic, parseAuthRecoveryParams } from '@/utils/authRecovery';
import { markResetPasswordRouteHealthy } from '@/utils/resetPasswordRouteFallback';

const ResetPassword = () => {
  const navigate = useNavigate();
  const [checking, setChecking] = useState(true);
  const [hasSession, setHasSession] = useState(false);
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    if (checking) {
      markResetPasswordRouteHealthy('checking');
      return;
    }
    if (success) {
      markResetPasswordRouteHealthy('success');
      return;
    }
    markResetPasswordRouteHealthy(hasSession ? 'form' : 'expired');
  }, [checking, hasSession, success]);

  useEffect(() => {
    let cancelled = false;
    const params = parseAuthRecoveryParams();

    logRecoveryDiagnostic('/auth/reset-password mounted', {
      sources: params.sources,
      isRecovery: params.isRecovery,
      hasHashTokens: params.hasHashTokens,
      hasCode: !!params.code,
      hasTokenHash: !!params.tokenHash,
      hasError: params.hasError,
      error: params.error,
      errorCode: params.errorCode,
    });

    if (params.isRecoveryError) {
      setError(RESET_LINK_EXPIRED_MESSAGE);
      setHasSession(false);
      setChecking(false);
      return () => { cancelled = true; };
    }

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (cancelled) return;
      if (session?.user) {
        logRecoveryDiagnostic('/auth/reset-password received auth session', { event, userIdPresent: true });
        setHasSession(true);
        setChecking(false);
      }
    });

    (async () => {
      if (params.accessToken && params.refreshToken) {
        const { data, error: sessionError } = await supabase.auth.setSession({
          access_token: params.accessToken,
          refresh_token: params.refreshToken,
        });
        if (cancelled) return;
        if (sessionError) {
          logRecoveryDiagnostic('/auth/reset-password hash session failed', { message: sessionError.message });
          setError(RESET_LINK_EXPIRED_MESSAGE);
          setHasSession(false);
          setChecking(false);
          return;
        }
        if (data.session?.user) {
          logRecoveryDiagnostic('/auth/reset-password hash session established', { userIdPresent: true });
          setHasSession(true);
          setChecking(false);
          return;
        }
      }

      if (params.isRecovery && params.tokenHash) {
        const { data, error: verifyError } = await supabase.auth.verifyOtp({
          type: 'recovery',
          token_hash: params.tokenHash,
        });
        if (cancelled) return;
        if (verifyError) {
          logRecoveryDiagnostic('/auth/reset-password token exchange failed', { message: verifyError.message });
          setError(RESET_LINK_EXPIRED_MESSAGE);
          setHasSession(false);
          setChecking(false);
          return;
        }
        if (data.session?.user) {
          logRecoveryDiagnostic('/auth/reset-password token session established', { userIdPresent: true });
          setHasSession(true);
          setChecking(false);
          return;
        }
      }

      if (params.isRecovery && params.code) {
        const { data, error: codeError } = await supabase.auth.exchangeCodeForSession(params.code);
        if (cancelled) return;
        if (codeError) {
          logRecoveryDiagnostic('/auth/reset-password code exchange failed', { message: codeError.message });
          setError(RESET_LINK_EXPIRED_MESSAGE);
          setHasSession(false);
          setChecking(false);
          return;
        }
        if (data.session?.user) {
          logRecoveryDiagnostic('/auth/reset-password code session established', { userIdPresent: true });
          setHasSession(true);
          setChecking(false);
          return;
        }
      }

      for (let i = 0; i < 16; i++) {
        const { data: { session } } = await supabase.auth.getSession();
        if (cancelled) return;
        if (session?.user) {
          logRecoveryDiagnostic('/auth/reset-password has valid recovery session', { userIdPresent: true });
          setHasSession(true);
          setChecking(false);
          return;
        }
        await new Promise((r) => setTimeout(r, 300));
      }
      if (!cancelled) {
        logRecoveryDiagnostic('/auth/reset-password has no valid recovery session', {
          hadRecoveryParams: params.sources.length > 0,
        });
        setHasSession(false);
        setError(RESET_LINK_EXPIRED_MESSAGE);
        setChecking(false);
      }
    })();

    return () => {
      cancelled = true;
      subscription.unsubscribe();
    };
  }, []);

  const passwordValidation = password ? validatePasswordStrength(password) : null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (password.length < 8) {
      setError('Password must be at least 8 characters.');
      return;
    }
    if (passwordValidation && !passwordValidation.valid) {
      setError('Please choose a stronger password.');
      return;
    }
    if (password !== confirm) {
      setError('Passwords do not match.');
      return;
    }

    setSubmitting(true);
    try {
      const { error: updateError } = await supabase.auth.updateUser({ password });
      if (updateError) {
        setError(updateError.message || 'Could not update password.');
        setSubmitting(false);
        return;
      }
      await supabase.auth.signOut();
      setSuccess(true);
      setSubmitting(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unexpected error.');
      setSubmitting(false);
    }
  };

  return (
    <main className="min-h-[100dvh] flex items-center justify-center bg-background px-4 py-8">
      <div className="w-full max-w-md min-w-0">
        <div className="flex flex-col items-center text-center mb-6">
          <img src={appLogo} alt="Ride Ready Docs" className="h-14 w-14 rounded-lg mb-3" />
          <h1 className="text-xl font-semibold text-foreground">Set a new password</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Choose a strong password to finish resetting your account.
          </p>
        </div>

        {checking && (
          <div className="flex items-center justify-center gap-2 text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
            <span className="text-sm">Verifying reset link…</span>
          </div>
        )}

        {!checking && !hasSession && !success && (
          <Card>
            <CardContent className="pt-6">
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertTitle>Reset link is invalid or expired</AlertTitle>
                <AlertDescription className="mt-2 space-y-3">
                  <p>{error || RESET_LINK_EXPIRED_MESSAGE}</p>
                  <Button onClick={() => navigate('/auth?reset=true', { replace: true })} className="w-full">
                    Request a new reset email
                  </Button>
                </AlertDescription>
              </Alert>
            </CardContent>
          </Card>
        )}

        {!checking && success && (
          <Card>
            <CardContent className="pt-6 space-y-4">
              <Alert>
                <CheckCircle2 className="h-4 w-4" />
                <AlertTitle>Password reset complete</AlertTitle>
                <AlertDescription>
                  Your password has been updated. Please sign in with your new password.
                </AlertDescription>
              </Alert>
              <Button onClick={() => navigate('/auth', { replace: true })} className="w-full">
                Back to sign in
              </Button>
            </CardContent>
          </Card>
        )}

        {!checking && hasSession && !success && (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="new-password">New password</Label>
              <div className="relative">
                <Input
                  id="new-password"
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoComplete="new-password"
                  required
                  className="pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground"
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
              {password && (
                <PasswordStrengthIndicator password={password} />
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="confirm-password">Confirm new password</Label>
              <Input
                id="confirm-password"
                type={showPassword ? 'text' : 'password'}
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                autoComplete="new-password"
                required
              />
            </div>

            {error && (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            <Button type="submit" disabled={submitting} className="w-full">
              {submitting ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  Updating…
                </>
              ) : (
                <>
                  <ShieldCheck className="h-4 w-4 mr-2" />
                  Update password
                </>
              )}
            </Button>
          </form>
        )}
      </div>
    </main>
  );
};

export default ResetPassword;
