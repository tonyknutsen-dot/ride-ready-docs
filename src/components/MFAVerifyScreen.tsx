import { useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Shield, Loader2, AlertTriangle } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import appLogo from '@/assets/pwa-icon.jpg';

interface MFAVerifyScreenProps {
  onVerified: () => void;
  onCancel: () => void;
}

/**
 * Full-screen MFA verification shown after password login when user has TOTP enrolled.
 */
const MFAVerifyScreen = ({ onVerified, onCancel }: MFAVerifyScreenProps) => {
  const [code, setCode] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [factorId, setFactorId] = useState<string | null>(null);

  useEffect(() => {
    // Get the user's TOTP factor
    (async () => {
      const { data, error } = await supabase.auth.mfa.listFactors();
      if (data?.totp && data.totp.length > 0) {
        setFactorId(data.totp[0].id);
      }
    })();
  }, []);

  const handleVerify = useCallback(async () => {
    if (!factorId || code.length !== 6) return;
    setLoading(true);
    setError('');

    const { data: challengeData, error: challengeError } = await supabase.auth.mfa.challenge({
      factorId,
    });

    if (challengeError || !challengeData) {
      setError('Failed to create challenge. Please try again.');
      setLoading(false);
      return;
    }

    const { error: verifyError } = await supabase.auth.mfa.verify({
      factorId,
      challengeId: challengeData.id,
      code,
    });

    if (verifyError) {
      setError('Invalid code. Please try again.');
      setCode('');
      setLoading(false);
      return;
    }

    // Log MFA verification
    try {
      await supabase.rpc('log_audit_event', {
        p_action: 'login',
        p_resource_type: 'session',
        p_resource_id: null,
        p_details: { method: 'mfa_totp', step: 'verified' },
      });
    } catch {}

    onVerified();
  }, [factorId, code, onVerified]);

  // Auto-submit when 6 digits entered
  useEffect(() => {
    if (code.length === 6 && factorId) {
      handleVerify();
    }
  }, [code, factorId, handleVerify]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary/5 via-background to-accent/5 flex items-center justify-center p-4">
      <div className="w-full max-w-sm space-y-6 text-center">
        <div className="space-y-3">
          <img src={appLogo} alt="Ride Ready Docs" className="mx-auto h-16 w-16 rounded-full shadow-lg" />
          <div className="flex items-center justify-center gap-2">
            <Shield className="h-5 w-5 text-primary" />
            <h1 className="text-xl font-bold">Two-Factor Authentication</h1>
          </div>
          <p className="text-sm text-muted-foreground">
            Enter the 6-digit code from your authenticator app
          </p>
        </div>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label className="sr-only">Verification Code</Label>
            <Input
              type="text"
              inputMode="numeric"
              maxLength={6}
              value={code}
              onChange={e => { setCode(e.target.value.replace(/\D/g, '')); setError(''); }}
              onKeyDown={e => e.key === 'Enter' && handleVerify()}
              placeholder="000000"
              autoFocus
              className="text-center text-2xl tracking-[0.5em] font-mono h-14"
            />
          </div>

          {error && (
            <Alert variant="destructive">
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          <Button onClick={handleVerify} className="w-full" disabled={loading || code.length !== 6}>
            {loading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Verify
          </Button>

          <Button variant="ghost" size="sm" onClick={onCancel} className="text-muted-foreground">
            Use a different account
          </Button>
        </div>
      </div>
    </div>
  );
};

export default MFAVerifyScreen;
