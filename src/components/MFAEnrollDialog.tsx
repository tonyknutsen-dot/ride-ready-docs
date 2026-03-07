import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Shield, Check, AlertTriangle, Copy, Loader2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

interface MFAEnrollDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onEnrolled?: () => void;
}

const MFAEnrollDialog = ({ open, onOpenChange, onEnrolled }: MFAEnrollDialogProps) => {
  const { toast } = useToast();
  const [step, setStep] = useState<'intro' | 'qr' | 'verify'>('intro');
  const [qrCode, setQrCode] = useState('');
  const [secret, setSecret] = useState('');
  const [factorId, setFactorId] = useState('');
  const [verifyCode, setVerifyCode] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const reset = () => {
    setStep('intro');
    setQrCode('');
    setSecret('');
    setFactorId('');
    setVerifyCode('');
    setError('');
    setLoading(false);
  };

  const handleEnroll = async () => {
    setLoading(true);
    setError('');

    const { data, error: enrollError } = await supabase.auth.mfa.enroll({
      factorType: 'totp',
      friendlyName: 'Authenticator App',
    });

    if (enrollError || !data) {
      setError(enrollError?.message || 'Failed to start MFA enrolment.');
      setLoading(false);
      return;
    }

    setQrCode(data.totp.qr_code);
    setSecret(data.totp.secret);
    setFactorId(data.id);
    setStep('qr');
    setLoading(false);
  };

  const handleVerify = async () => {
    if (verifyCode.length !== 6) {
      setError('Enter the 6-digit code from your authenticator app.');
      return;
    }
    setLoading(true);
    setError('');

    // Challenge then verify
    const { data: challengeData, error: challengeError } = await supabase.auth.mfa.challenge({
      factorId,
    });

    if (challengeError || !challengeData) {
      setError(challengeError?.message || 'Failed to create MFA challenge.');
      setLoading(false);
      return;
    }

    const { error: verifyError } = await supabase.auth.mfa.verify({
      factorId,
      challengeId: challengeData.id,
      code: verifyCode,
    });

    if (verifyError) {
      setError('Invalid code. Please try again.');
      setVerifyCode('');
      setLoading(false);
      return;
    }

    toast({
      title: 'MFA Enabled',
      description: 'Two-factor authentication is now active on your account.',
    });
    reset();
    onOpenChange(false);
    onEnrolled?.();
  };

  const copySecret = () => {
    navigator.clipboard.writeText(secret);
    toast({ title: 'Copied', description: 'Secret key copied to clipboard.' });
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) reset(); onOpenChange(o); }}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5 text-primary" />
            Set Up Two-Factor Authentication
          </DialogTitle>
          <DialogDescription>
            {step === 'intro' && 'Add an extra layer of security to your account using an authenticator app.'}
            {step === 'qr' && 'Scan this QR code with your authenticator app (e.g. Google Authenticator, Authy).'}
            {step === 'verify' && 'Enter the 6-digit code from your authenticator app to confirm setup.'}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 pt-2">
          {step === 'intro' && (
            <>
              <div className="p-4 rounded-lg bg-muted/40 border border-border space-y-2">
                <p className="text-sm font-medium">How it works:</p>
                <ol className="text-xs text-muted-foreground space-y-1 list-decimal list-inside">
                  <li>Install an authenticator app on your phone</li>
                  <li>Scan a QR code to link your account</li>
                  <li>Enter a 6-digit code each time you sign in</li>
                </ol>
              </div>
              <Button onClick={handleEnroll} className="w-full" disabled={loading}>
                {loading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                Get Started
              </Button>
            </>
          )}

          {step === 'qr' && (
            <>
              <div className="flex justify-center p-4 bg-white rounded-lg">
                <img src={qrCode} alt="MFA QR Code" className="w-48 h-48" />
              </div>
              <div className="space-y-2">
                <p className="text-xs text-muted-foreground text-center">
                  Can't scan? Enter this key manually:
                </p>
                <div className="flex items-center gap-2">
                  <code className="flex-1 text-xs bg-muted px-3 py-2 rounded font-mono break-all">
                    {secret}
                  </code>
                  <Button variant="ghost" size="icon" onClick={copySecret}>
                    <Copy className="h-4 w-4" />
                  </Button>
                </div>
              </div>
              <Button onClick={() => setStep('verify')} className="w-full">
                I've Scanned the Code
              </Button>
            </>
          )}

          {step === 'verify' && (
            <>
              <div className="space-y-2">
                <Label>Verification Code</Label>
                <Input
                  type="text"
                  inputMode="numeric"
                  maxLength={6}
                  value={verifyCode}
                  onChange={e => { setVerifyCode(e.target.value.replace(/\D/g, '')); setError(''); }}
                  onKeyDown={e => e.key === 'Enter' && handleVerify()}
                  placeholder="000000"
                  autoFocus
                  className="text-center text-lg tracking-widest font-mono"
                />
              </div>
              {error && (
                <Alert variant="destructive">
                  <AlertTriangle className="h-4 w-4" />
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              )}
              <Button onClick={handleVerify} className="w-full" disabled={loading || verifyCode.length !== 6}>
                {loading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Check className="h-4 w-4 mr-2" />}
                Verify & Enable
              </Button>
            </>
          )}

          {error && step !== 'verify' && (
            <p className="text-sm text-destructive flex items-center gap-1">
              <AlertTriangle className="h-3.5 w-3.5" />{error}
            </p>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default MFAEnrollDialog;
