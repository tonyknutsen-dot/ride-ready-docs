import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

interface PlatformSetting {
  key: string;
  value: string;
  label: string;
  description: string | null;
  category: string;
}

type SettingsMap = Record<string, string>;

const DEFAULTS: SettingsMap = {
  maintenance_mode: 'false',
  maintenance_message: '',
  maintenance_internal_note: '',
  public_enquiries_enabled: 'true',
  early_access_enabled: 'true',
  marketing_tools_enabled: 'true',
  support_access_grants_enabled: 'true',
  admin_system_health_enabled: 'true',
  admin_email_log_enabled: 'true',
  admin_jobs_queues_enabled: 'true',
};

async function fetchPlatformSettings(): Promise<SettingsMap> {
  const { data, error } = await (supabase as any)
    .from('platform_settings')
    .select('key, value');

  if (error) {
    console.error('Failed to fetch platform settings:', error);
    return { ...DEFAULTS };
  }

  const map: SettingsMap = { ...DEFAULTS };
  (data || []).forEach((s: { key: string; value: string }) => {
    map[s.key] = s.value;
  });
  return map;
}

/**
 * React hook for reading platform settings.
 * Returns { settings, isLoading, isOn(key) }.
 * Safe defaults are used while loading or if a setting is missing.
 */
export function usePlatformSettings() {
  const { data: settings = DEFAULTS, isLoading } = useQuery({
    queryKey: ['platform-settings'],
    queryFn: fetchPlatformSettings,
    staleTime: 1000 * 60 * 2, // fresh for 2 minutes
    gcTime: 1000 * 60 * 10,
    refetchOnWindowFocus: true, // pick up changes quickly
  });

  const isOn = (key: string): boolean => {
    const val = settings[key];
    if (val === undefined) return DEFAULTS[key] === 'true';
    return val === 'true';
  };

  const getSetting = (key: string): string => {
    return settings[key] ?? DEFAULTS[key] ?? '';
  };

  return { settings, isLoading, isOn, getSetting };
}

/**
 * Non-hook helper for one-off reads (e.g. edge cases outside React tree).
 */
export async function getPlatformSetting(key: string): Promise<string> {
  const { data } = await (supabase as any)
    .from('platform_settings')
    .select('value')
    .eq('key', key)
    .single();
  return data?.value ?? DEFAULTS[key] ?? '';
}
