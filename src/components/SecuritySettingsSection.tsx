import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { Shield, Lock, Key, LogOut, Smartphone, ShieldCheck, ShieldOff } from 'lucide-react';
import { useSecuritySettings } from '@/hooks/useSecuritySettings';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import PinSetupDialog from './PinSetupDialog';
import MFAEnrollDialog from './MFAEnrollDialog';

const IDLE_OPTIONS = [
  { value: '0', label: 'Off' },
  { value: '5', label: '5 minutes' },
  { value: '15', label: '15 minutes' },
  { value: '30', label: '30 minutes' },
  { value: '60', label: '60 minutes' },
];

export function SecuritySettingsSection() {
  const { user, signOut } = useAuth();
  const { settings, loading, hasPinSet, updateSettings } = useSecuritySettings();
  const { toast } = useToast();
  const [pinDialogOpen, setPinDialogOpen] = useState(false);
  const [mfaDialogOpen, setMfaDialogOpen] = useState(false);
  const [signingOutAll, setSigningOutAll] = useState(false);
  const [mfaEnrolled, setMfaEnrolled] = useState(false);
  const [mfaLoading, setMfaLoading] = useState(true);

  // Check MFA enrollment status
  useEffect(() => {
    (async () => {
      const { data } = await supabase.auth.mfa.listFactors();
      setMfaEnrolled(!!data?.totp?.length);
      setMfaLoading(false);
    })();
  }, []);

  const handleUnenrollMFA = async () => {
    const { data } = await supabase.auth.mfa.listFactors();
    if (data?.totp?.[0]) {
      const { error } = await supabase.auth.mfa.unenroll({ factorId: data.totp[0].id });
      if (error) {
        toast({ title: 'Error', description: error.message, variant: 'destructive' });
      } else {
        setMfaEnrolled(false);
        toast({ title: 'MFA Disabled', description: 'Two-factor authentication has been removed.' });
      }
    }
  };

  const handleIdleChange = async (value: string) => {
    const minutes = parseInt(value);
    if (minutes > 0 && !hasPinSet) {
      toast({
        title: 'Set a PIN first',
        description: 'You need to set a lock PIN before enabling idle lock.',
        variant: 'destructive',
      });
      setPinDialogOpen(true);
      return;
    }
    await updateSettings({ idle_lock_minutes: minutes });
    toast({ title: 'Idle lock updated', description: minutes > 0 ? `Lock after ${minutes} minutes of inactivity.` : 'Idle lock disabled.' });
  };

  const handleRememberDevice = async (enabled: boolean) => {
    await updateSettings({ remember_device_enabled: enabled });
    if (!enabled) {
      localStorage.removeItem('rrd-remember-device');
    }
    toast({ title: enabled ? 'Device remembered' : 'Device forgotten' });
  };

  const handleSignOut = async () => {
    try {
      await supabase.rpc('log_audit_event', {
        p_action: 'logout',
        p_resource_type: 'session',
        p_resource_id: null,
        p_details: { method: 'manual', scope: 'this_device' },
      });
    } catch {}
    await signOut();
    window.location.href = '/';
  };

  const handleSignOutAll = async () => {
    setSigningOutAll(true);
    try {
      await supabase.rpc('log_audit_event', {
        p_action: 'logout',
        p_resource_type: 'session',
        p_resource_id: null,
        p_details: { method: 'manual', scope: 'all_devices' },
      });
      await supabase.auth.signOut({ scope: 'global' });
      window.location.href = '/';
    } catch {
      toast({ title: 'Error', description: 'Failed to sign out all devices.', variant: 'destructive' });
      setSigningOutAll(false);
    }
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="py-6 space-y-4">
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      {/* Lock Screen & PIN */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-muted flex items-center justify-center">
              <Shield className="h-4 w-4 text-muted-foreground" />
            </div>
            <div>
              <CardTitle className="text-base">Session Security</CardTitle>
              <CardDescription className="text-sm mt-0.5">
                Lock screen, PIN, and idle timeout settings
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-5">
          {/* MFA (TOTP) */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              {mfaEnrolled ? (
                <ShieldCheck className="h-4 w-4 text-primary" />
              ) : (
                <ShieldOff className="h-4 w-4 text-muted-foreground" />
              )}
              <div>
                <div className="flex items-center gap-2">
                  <p className="text-sm font-medium">Two-Factor Authentication</p>
                  {mfaEnrolled && <Badge variant="secondary" className="text-[10px] px-1.5 py-0">Active</Badge>}
                </div>
                <p className="text-xs text-muted-foreground">
                  {mfaEnrolled ? 'TOTP authenticator app linked' : 'Add extra security with an authenticator app'}
                </p>
              </div>
            </div>
            {!mfaLoading && (
              mfaEnrolled ? (
                <Button variant="outline" size="sm" onClick={handleUnenrollMFA}>
                  Disable
                </Button>
              ) : (
                <Button variant="outline" size="sm" onClick={() => setMfaDialogOpen(true)}>
                  Enable
                </Button>
              )
            )}
          </div>

          {/* PIN Status */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Key className="h-4 w-4 text-muted-foreground" />
              <div>
                <p className="text-sm font-medium">Lock PIN</p>
                <p className="text-xs text-muted-foreground">
                  {hasPinSet ? 'PIN is set' : 'No PIN configured'}
                </p>
              </div>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPinDialogOpen(true)}
            >
              {hasPinSet ? 'Change' : 'Set PIN'}
            </Button>
          </div>

          {/* Idle Lock Timer */}
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <Lock className="h-4 w-4 text-muted-foreground" />
              <Label className="text-sm font-medium">Auto-Lock After</Label>
            </div>
            <Select
              value={String(settings.idle_lock_minutes)}
              onValueChange={handleIdleChange}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {IDLE_OPTIONS.map(opt => (
                  <SelectItem key={opt.value} value={opt.value}>
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              The app will lock and require your PIN after this period of inactivity.
            </p>
          </div>

          {/* Remember Device */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Smartphone className="h-4 w-4 text-muted-foreground" />
              <div>
                <p className="text-sm font-medium">Remember This Device</p>
                <p className="text-xs text-muted-foreground">
                  Skip lock screen on this device
                </p>
              </div>
            </div>
            <Switch
              checked={settings.remember_device_enabled}
              onCheckedChange={handleRememberDevice}
              disabled={!hasPinSet}
            />
          </div>
        </CardContent>
      </Card>

      {/* Sign Out Actions */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-muted flex items-center justify-center">
              <LogOut className="h-4 w-4 text-muted-foreground" />
            </div>
            <div>
              <CardTitle className="text-base">Account Actions</CardTitle>
              <CardDescription className="text-sm mt-0.5">
                Sign out of your account
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          <Button
            variant="outline"
            className="w-full justify-start gap-2"
            onClick={handleSignOut}
          >
            <LogOut className="h-4 w-4" />
            Sign Out (This Device)
          </Button>
          <Button
            variant="outline"
            className="w-full justify-start gap-2 border-destructive/50 text-destructive hover:bg-destructive/10"
            onClick={handleSignOutAll}
            disabled={signingOutAll}
          >
            <LogOut className="h-4 w-4" />
            {signingOutAll ? 'Signing out…' : 'Sign Out All Devices'}
          </Button>
          <p className="text-xs text-muted-foreground">
            "Sign Out All Devices" will end your session on every device and browser where you're logged in.
          </p>
        </CardContent>
      </Card>

      <PinSetupDialog
        open={pinDialogOpen}
        onOpenChange={setPinDialogOpen}
        isChanging={hasPinSet}
      />
      <MFAEnrollDialog
        open={mfaDialogOpen}
        onOpenChange={setMfaDialogOpen}
        onEnrolled={() => setMfaEnrolled(true)}
      />
    </>
  );
}
