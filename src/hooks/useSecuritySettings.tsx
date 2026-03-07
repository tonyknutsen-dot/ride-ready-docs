import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

export interface SecuritySettings {
  lock_pin_hash: string | null;
  idle_lock_minutes: number;
  remember_device_enabled: boolean;
}

const DEFAULT_SETTINGS: SecuritySettings = {
  lock_pin_hash: null,
  idle_lock_minutes: 15,
  remember_device_enabled: false,
};

// Simple hash for PIN (SHA-256 via SubtleCrypto, works offline)
export async function hashPin(pin: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(pin + 'rrd-salt-v1');
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

export function useSecuritySettings() {
  const { user } = useAuth();
  const [settings, setSettings] = useState<SecuritySettings>(DEFAULT_SETTINGS);
  const [loading, setLoading] = useState(true);

  const fetchSettings = useCallback(async () => {
    if (!user) { setLoading(false); return; }
    
    const { data, error } = await supabase
      .from('user_security_settings')
      .select('lock_pin_hash, idle_lock_minutes, remember_device_enabled')
      .eq('user_id', user.id)
      .maybeSingle();

    if (data) {
      setSettings({
        lock_pin_hash: data.lock_pin_hash,
        idle_lock_minutes: data.idle_lock_minutes ?? 15,
        remember_device_enabled: data.remember_device_enabled ?? false,
      });
    }
    setLoading(false);
  }, [user]);

  useEffect(() => { fetchSettings(); }, [fetchSettings]);

  const updateSettings = useCallback(async (updates: Partial<SecuritySettings>) => {
    if (!user) return;

    const { error } = await supabase
      .from('user_security_settings')
      .upsert({
        user_id: user.id,
        ...updates,
      }, { onConflict: 'user_id' });

    if (!error) {
      setSettings(prev => ({ ...prev, ...updates }));
      // Cache for offline use
      try {
        localStorage.setItem(`rrd-security-${user.id}`, JSON.stringify({ ...settings, ...updates }));
      } catch {}
    }
    return error;
  }, [user, settings]);

  const hasPinSet = !!settings.lock_pin_hash;
  const isLockEnabled = hasPinSet && settings.idle_lock_minutes > 0;

  return {
    settings,
    loading,
    hasPinSet,
    isLockEnabled,
    updateSettings,
    refetch: fetchSettings,
  };
}
