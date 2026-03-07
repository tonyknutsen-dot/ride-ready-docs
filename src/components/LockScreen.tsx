import { useState, useCallback, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Lock, LogOut, ShieldAlert, Fingerprint } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { hashPin } from '@/hooks/useSecuritySettings';
import { supabase } from '@/integrations/supabase/client';
import appLogo from '@/assets/pwa-icon.jpg';

interface LockScreenProps {
  pinHash: string;
  onUnlock: () => void;
  onSignOut: () => void;
}

const LockScreen = ({ pinHash, onUnlock, onSignOut }: LockScreenProps) => {
  const { user } = useAuth();
  const [pin, setPin] = useState('');
  const [error, setError] = useState('');
  const [attempts, setAttempts] = useState(0);
  const [lockedOut, setLockedOut] = useState(false);
  const [lockoutEnd, setLockoutEnd] = useState<number | null>(null);
  const [timeLeft, setTimeLeft] = useState(0);

  // Lockout countdown
  useEffect(() => {
    if (!lockoutEnd) return;
    const interval = setInterval(() => {
      const remaining = Math.max(0, Math.ceil((lockoutEnd - Date.now()) / 1000));
      setTimeLeft(remaining);
      if (remaining <= 0) {
        setLockedOut(false);
        setLockoutEnd(null);
        setAttempts(0);
      }
    }, 1000);
    return () => clearInterval(interval);
  }, [lockoutEnd]);

  const logUnlockAttempt = useCallback(async (success: boolean) => {
    try {
      await supabase.rpc('log_audit_event', {
        p_action: success ? 'unlock' : 'failed_unlock',
        p_resource_type: 'session',
        p_resource_id: null,
        p_details: { method: 'pin', attempts: attempts + 1 },
      });
    } catch {}
  }, [attempts]);

  const handleSubmit = useCallback(async () => {
    if (lockedOut || pin.length < 4) return;

    const enteredHash = await hashPin(pin);
    
    if (enteredHash === pinHash) {
      await logUnlockAttempt(true);
      setPin('');
      setAttempts(0);
      onUnlock();
    } else {
      const newAttempts = attempts + 1;
      setAttempts(newAttempts);
      setPin('');
      await logUnlockAttempt(false);

      if (newAttempts >= 5) {
        // Force full re-auth after 5 failed PIN attempts
        setError('Too many failed attempts. You must sign in again.');
        setTimeout(() => onSignOut(), 2000);
      } else {
        setError(`Incorrect PIN. ${5 - newAttempts} attempts remaining.`);
      }
    }
  }, [pin, pinHash, attempts, lockedOut, onUnlock, logUnlockAttempt]);

  const handleKeyPress = useCallback((digit: string) => {
    if (lockedOut) return;
    setError('');
    if (digit === 'delete') {
      setPin(prev => prev.slice(0, -1));
    } else if (pin.length < 6) {
      const newPin = pin + digit;
      setPin(newPin);
      // Auto-submit at 4+ digits after a short delay
      if (newPin.length >= 4) {
        setTimeout(async () => {
          const enteredHash = await hashPin(newPin);
          if (enteredHash === pinHash) {
            await logUnlockAttempt(true);
            setPin('');
            setAttempts(0);
            onUnlock();
          }
        }, 150);
      }
    }
  }, [pin, lockedOut, pinHash, onUnlock, logUnlockAttempt]);

  // Physical keyboard support
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key >= '0' && e.key <= '9') {
        handleKeyPress(e.key);
      } else if (e.key === 'Backspace') {
        handleKeyPress('delete');
      } else if (e.key === 'Enter' && pin.length >= 4) {
        handleSubmit();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyPress, handleSubmit, pin]);

  return (
    <div className="fixed inset-0 z-[9999] bg-background flex flex-col items-center justify-center px-4">
      <div className="w-full max-w-sm space-y-8 text-center">
        {/* Logo & Header */}
        <div className="space-y-3">
          <img src={appLogo} alt="Ride Ready Docs" className="mx-auto h-16 w-16 rounded-full shadow-lg" />
          <div className="flex items-center justify-center gap-2 text-muted-foreground">
            <Lock className="h-4 w-4" />
            <span className="text-sm font-medium">App Locked</span>
          </div>
          <p className="text-xs text-muted-foreground">
            {user?.email}
          </p>
        </div>

        {/* PIN Dots */}
        <div className="flex justify-center gap-3">
          {[0, 1, 2, 3, 4, 5].map(i => (
            <div
              key={i}
              className={`h-3.5 w-3.5 rounded-full border-2 transition-all ${
                i < pin.length
                  ? 'bg-primary border-primary scale-110'
                  : 'border-muted-foreground/30'
              }`}
            />
          ))}
        </div>

        {/* Error */}
        {error && (
          <div className="flex items-center justify-center gap-2 text-destructive text-sm">
            <ShieldAlert className="h-4 w-4" />
            <span>{error}</span>
          </div>
        )}

        {/* Lockout timer */}
        {lockedOut && (
          <p className="text-sm text-muted-foreground">
            Try again in {timeLeft}s
          </p>
        )}

        {/* Number Pad */}
        <div className="grid grid-cols-3 gap-3 max-w-[240px] mx-auto">
          {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map(digit => (
            <button
              key={digit}
              onClick={() => handleKeyPress(digit)}
              disabled={lockedOut}
              className="h-14 w-14 mx-auto rounded-full bg-muted hover:bg-muted/80 text-foreground text-xl font-semibold transition-all active:scale-95 disabled:opacity-40"
            >
              {digit}
            </button>
          ))}
          <button
            onClick={() => handleKeyPress('delete')}
            disabled={lockedOut || pin.length === 0}
            className="h-14 w-14 mx-auto rounded-full text-muted-foreground hover:bg-muted text-sm font-medium transition-all active:scale-95 disabled:opacity-40"
          >
            ⌫
          </button>
          <button
            onClick={() => handleKeyPress('0')}
            disabled={lockedOut}
            className="h-14 w-14 mx-auto rounded-full bg-muted hover:bg-muted/80 text-foreground text-xl font-semibold transition-all active:scale-95 disabled:opacity-40"
          >
            0
          </button>
          <button
            onClick={handleSubmit}
            disabled={lockedOut || pin.length < 4}
            className="h-14 w-14 mx-auto rounded-full bg-primary text-primary-foreground text-sm font-medium transition-all active:scale-95 disabled:opacity-40"
          >
            OK
          </button>
        </div>

        {/* Biometrics placeholder */}
        <button
          disabled
          className="flex items-center justify-center gap-2 text-muted-foreground/40 text-xs mx-auto"
        >
          <Fingerprint className="h-4 w-4" />
          <span>Biometrics (coming soon)</span>
        </button>

        {/* Sign out */}
        <Button
          variant="ghost"
          size="sm"
          onClick={onSignOut}
          className="text-destructive hover:text-destructive hover:bg-destructive/10 gap-2"
        >
          <LogOut className="h-4 w-4" />
          Sign Out
        </Button>
      </div>
    </div>
  );
};

export default LockScreen;
