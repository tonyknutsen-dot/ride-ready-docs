import { useState, useCallback } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ShieldCheck, AlertTriangle } from 'lucide-react';
import { hashPin } from '@/hooks/useSecuritySettings';

interface ReAuthDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  pinHash: string;
  actionLabel?: string;
  onSuccess: () => void;
}

const ReAuthDialog = ({ open, onOpenChange, pinHash, actionLabel, onSuccess }: ReAuthDialogProps) => {
  const [pin, setPin] = useState('');
  const [error, setError] = useState('');

  const handleVerify = useCallback(async () => {
    if (pin.length < 4) return;
    const hash = await hashPin(pin);
    if (hash === pinHash) {
      setPin('');
      setError('');
      // Store last re-auth time
      sessionStorage.setItem('rrd-last-reauth', Date.now().toString());
      onSuccess();
      onOpenChange(false);
    } else {
      setError('Incorrect PIN');
      setPin('');
    }
  }, [pin, pinHash, onSuccess, onOpenChange]);

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) { setPin(''); setError(''); } onOpenChange(o); }}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ShieldCheck className="h-5 w-5 text-primary" />
            Confirm Identity
          </DialogTitle>
          <DialogDescription>
            {actionLabel 
              ? `Enter your PIN to ${actionLabel}.`
              : 'Enter your PIN to continue with this action.'}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 pt-2">
          <div className="space-y-2">
            <Label>PIN</Label>
            <Input
              type="password"
              inputMode="numeric"
              maxLength={6}
              value={pin}
              onChange={e => { setPin(e.target.value.replace(/\D/g, '')); setError(''); }}
              onKeyDown={e => e.key === 'Enter' && handleVerify()}
              placeholder="••••"
              autoFocus
            />
          </div>
          {error && (
            <p className="text-sm text-destructive flex items-center gap-1">
              <AlertTriangle className="h-3.5 w-3.5" />{error}
            </p>
          )}
          <Button onClick={handleVerify} className="w-full" disabled={pin.length < 4}>
            Confirm
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default ReAuthDialog;
