import { useState } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Lock, Check, AlertTriangle } from 'lucide-react';
import { hashPin, useSecuritySettings } from '@/hooks/useSecuritySettings';
import { useToast } from '@/hooks/use-toast';

interface PinSetupDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  isChanging?: boolean;
}

const PinSetupDialog = ({ open, onOpenChange, isChanging }: PinSetupDialogProps) => {
  const { settings, updateSettings } = useSecuritySettings();
  const { toast } = useToast();
  const [step, setStep] = useState<'current' | 'new' | 'confirm'>( isChanging ? 'current' : 'new');
  const [currentPin, setCurrentPin] = useState('');
  const [newPin, setNewPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  const reset = () => {
    setStep(isChanging ? 'current' : 'new');
    setCurrentPin('');
    setNewPin('');
    setConfirmPin('');
    setError('');
    setSaving(false);
  };

  const handleVerifyCurrent = async () => {
    const hash = await hashPin(currentPin);
    if (hash !== settings.lock_pin_hash) {
      setError('Current PIN is incorrect');
      return;
    }
    setError('');
    setStep('new');
  };

  const handleSetNew = () => {
    if (newPin.length < 4 || newPin.length > 6) {
      setError('PIN must be 4–6 digits');
      return;
    }
    if (!/^\d+$/.test(newPin)) {
      setError('PIN must contain only digits');
      return;
    }
    setError('');
    setStep('confirm');
  };

  const handleConfirm = async () => {
    if (confirmPin !== newPin) {
      setError('PINs do not match');
      return;
    }
    setSaving(true);
    const hash = await hashPin(newPin);
    const err = await updateSettings({ lock_pin_hash: hash });
    setSaving(false);
    
    if (err) {
      setError('Failed to save PIN. Try again.');
      return;
    }

    // Also cache in localStorage for offline
    try {
      const userId = (await import('@/integrations/supabase/client')).supabase.auth.getUser().then(r => r.data.user?.id);
      const uid = await userId;
      if (uid) localStorage.setItem(`rrd-pin-hash-${uid}`, hash);
    } catch {}

    toast({
      title: isChanging ? 'PIN Updated' : 'PIN Set',
      description: 'Your lock screen PIN has been saved.',
    });
    reset();
    onOpenChange(false);
  };

  const handleRemovePin = async () => {
    setSaving(true);
    const err = await updateSettings({ lock_pin_hash: null, idle_lock_minutes: 0 });
    setSaving(false);
    if (!err) {
      toast({ title: 'PIN Removed', description: 'Lock screen has been disabled.' });
      try {
        const { supabase } = await import('@/integrations/supabase/client');
        const uid = (await supabase.auth.getUser()).data.user?.id;
        if (uid) localStorage.removeItem(`rrd-pin-hash-${uid}`);
      } catch {}
      reset();
      onOpenChange(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) reset(); onOpenChange(o); }}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Lock className="h-5 w-5 text-primary" />
            {isChanging ? 'Change PIN' : 'Set Lock PIN'}
          </DialogTitle>
          <DialogDescription>
            {step === 'current' && 'Enter your current PIN to continue.'}
            {step === 'new' && 'Choose a 4–6 digit PIN for your lock screen.'}
            {step === 'confirm' && 'Re-enter your PIN to confirm.'}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 pt-2">
          {step === 'current' && (
            <>
              <div className="space-y-2">
                <Label>Current PIN</Label>
                <Input
                  type="password"
                  inputMode="numeric"
                  maxLength={6}
                  value={currentPin}
                  onChange={e => { setCurrentPin(e.target.value.replace(/\D/g, '')); setError(''); }}
                  placeholder="••••"
                  autoFocus
                />
              </div>
              {error && <p className="text-sm text-destructive flex items-center gap-1"><AlertTriangle className="h-3.5 w-3.5" />{error}</p>}
              <Button onClick={handleVerifyCurrent} className="w-full" disabled={currentPin.length < 4}>
                Continue
              </Button>
            </>
          )}

          {step === 'new' && (
            <>
              <div className="space-y-2">
                <Label>New PIN</Label>
                <Input
                  type="password"
                  inputMode="numeric"
                  maxLength={6}
                  value={newPin}
                  onChange={e => { setNewPin(e.target.value.replace(/\D/g, '')); setError(''); }}
                  placeholder="4–6 digits"
                  autoFocus
                />
              </div>
              {error && <p className="text-sm text-destructive flex items-center gap-1"><AlertTriangle className="h-3.5 w-3.5" />{error}</p>}
              <Button onClick={handleSetNew} className="w-full" disabled={newPin.length < 4}>
                Continue
              </Button>
            </>
          )}

          {step === 'confirm' && (
            <>
              <div className="space-y-2">
                <Label>Confirm PIN</Label>
                <Input
                  type="password"
                  inputMode="numeric"
                  maxLength={6}
                  value={confirmPin}
                  onChange={e => { setConfirmPin(e.target.value.replace(/\D/g, '')); setError(''); }}
                  placeholder="Re-enter PIN"
                  autoFocus
                />
              </div>
              {error && <p className="text-sm text-destructive flex items-center gap-1"><AlertTriangle className="h-3.5 w-3.5" />{error}</p>}
              <Button onClick={handleConfirm} className="w-full" disabled={saving || confirmPin.length < 4}>
                <Check className="h-4 w-4 mr-2" />
                {saving ? 'Saving…' : 'Save PIN'}
              </Button>
            </>
          )}

          {isChanging && (
            <Button variant="ghost" size="sm" onClick={handleRemovePin} disabled={saving}
              className="w-full text-destructive hover:text-destructive hover:bg-destructive/10 text-xs mt-2"
            >
              Remove PIN & Disable Lock
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default PinSetupDialog;
