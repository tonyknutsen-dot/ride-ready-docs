import { useState, useEffect, useCallback } from 'react';
import { Settings2, Shield, ToggleLeft, FileText, History, Power, Globe, Sparkles, Mail, Key, Wrench, Activity, Layers, AlertTriangle, Save, Loader2 } from 'lucide-react';
import { AdminLayout } from '@/components/admin/AdminLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';

interface PlatformSetting {
  id: string;
  key: string;
  value: string;
  label: string;
  description: string | null;
  category: string;
  updated_at: string;
  updated_by: string | null;
}

type SettingsMap = Record<string, PlatformSetting>;

const TOGGLE_ICONS: Record<string, React.ElementType> = {
  maintenance_mode: Power,
  public_enquiries_enabled: Globe,
  early_access_enabled: Sparkles,
  marketing_tools_enabled: Mail,
  support_access_grants_enabled: Key,
  admin_system_health_enabled: Wrench,
  admin_email_log_enabled: Mail,
  admin_jobs_queues_enabled: Activity,
};

const ACCESS_KEYS = ['public_enquiries_enabled', 'early_access_enabled', 'marketing_tools_enabled', 'support_access_grants_enabled'];
const FLAG_KEYS = ['admin_system_health_enabled', 'admin_email_log_enabled', 'admin_jobs_queues_enabled'];

export default function PlatformSettings() {
  const { user } = useAuth();
  const [settings, setSettings] = useState<SettingsMap>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);
  const [confirmToggle, setConfirmToggle] = useState<{ key: string; newValue: string } | null>(null);
  const [recentChanges, setRecentChanges] = useState<any[]>([]);

  // Draft state for text fields
  const [releaseTitle, setReleaseTitle] = useState('');
  const [releaseBody, setReleaseBody] = useState('');
  const [deploymentNote, setDeploymentNote] = useState('');
  const [maintenanceMessage, setMaintenanceMessage] = useState('');
  const [maintenanceInternalNote, setMaintenanceInternalNote] = useState('');

  const fetchSettings = useCallback(async () => {
    const { data, error } = await (supabase as any)
      .from('platform_settings')
      .select('*')
      .order('category');

    if (error) {
      console.error('Failed to load platform settings:', error);
      toast.error('Failed to load platform settings');
      setLoading(false);
      return;
    }

    const map: SettingsMap = {};
    (data || []).forEach((s: PlatformSetting) => { map[s.key] = s; });
    setSettings(map);

    // Initialise draft text fields
    setReleaseTitle(map['release_note_title']?.value || '');
    setReleaseBody(map['release_note_body']?.value || '');
    setDeploymentNote(map['deployment_note']?.value || '');
    setMaintenanceMessage(map['maintenance_message']?.value || '');
    setMaintenanceInternalNote(map['maintenance_internal_note']?.value || '');

    setLoading(false);
  }, []);

  const fetchRecentChanges = useCallback(async () => {
    const { data } = await supabase
      .from('audit_logs')
      .select('*')
      .eq('resource_type', 'platform_setting')
      .order('created_at', { ascending: false })
      .limit(10);

    const logs = data || [];
    // Enrich with actor names from profiles
    const userIds = [...new Set(logs.map(l => l.user_id).filter(Boolean))];
    let actorMap: Record<string, string> = {};
    if (userIds.length > 0) {
      const { data: profiles } = await supabase
        .from('profiles')
        .select('user_id, controller_name, company_name')
        .in('user_id', userIds);
      (profiles || []).forEach((p: any) => {
        actorMap[p.user_id] = p.controller_name || p.company_name || '';
      });
    }
    setRecentChanges(logs.map(l => ({ ...l, _actorName: actorMap[l.user_id] || '' })));
  }, []);

  useEffect(() => {
    fetchSettings();
    fetchRecentChanges();
  }, [fetchSettings, fetchRecentChanges]);

  const updateSetting = async (key: string, newValue: string) => {
    const current = settings[key];
    if (!current) return;

    setSaving(key);
    const oldValue = current.value;

    const { error } = await (supabase as any)
      .from('platform_settings')
      .update({ value: newValue, updated_at: new Date().toISOString(), updated_by: user?.id })
      .eq('key', key);

    if (error) {
      toast.error(`Failed to update ${current.label}`);
      setSaving(null);
      return;
    }

    // Audit log
    await supabase.rpc('log_audit_event', {
      p_action: 'update',
      p_resource_type: 'platform_setting',
      p_details: { key, label: current.label, old_value: oldValue, new_value: newValue },
      p_before_data: { value: oldValue },
      p_after_data: { value: newValue },
      p_changed_fields: ['value'],
      p_result: 'success',
      p_context_hint: 'Platform Settings page',
    });

    // Update local state
    setSettings(prev => ({
      ...prev,
      [key]: { ...prev[key], value: newValue, updated_at: new Date().toISOString(), updated_by: user?.id || null },
    }));

    toast.success(`${current.label} updated`);
    setSaving(null);
    fetchRecentChanges();
  };

  const handleToggle = (key: string) => {
    const current = settings[key];
    if (!current) return;
    const newVal = current.value === 'true' ? 'false' : 'true';

    // Maintenance mode requires confirmation
    if (key === 'maintenance_mode') {
      setConfirmToggle({ key, newValue: newVal });
      return;
    }
    updateSetting(key, newVal);
  };

  const isOn = (key: string) => settings[key]?.value === 'true';

  const enabledFlags = Object.values(settings).filter(s => s.category === 'feature_flag' && s.value === 'true').length;
  const totalFlags = Object.values(settings).filter(s => s.category === 'feature_flag').length;

  if (loading) {
    return (
      <AdminLayout>
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </AdminLayout>
    );
  }

  const ToggleRow = ({ settingKey }: { settingKey: string }) => {
    const s = settings[settingKey];
    if (!s) return null;
    const Icon = TOGGLE_ICONS[settingKey] || ToggleLeft;
    return (
      <div className="flex items-center justify-between py-3">
        <div className="flex items-center gap-3 min-w-0">
          <Icon className="h-4 w-4 text-muted-foreground shrink-0" />
          <div className="min-w-0">
            <p className="text-sm font-medium">{s.label}</p>
            <p className="text-xs text-muted-foreground truncate">{s.description}</p>
          </div>
        </div>
        <Switch
          checked={isOn(settingKey)}
          onCheckedChange={() => handleToggle(settingKey)}
          disabled={saving === settingKey}
        />
      </div>
    );
  };

  return (
    <AdminLayout>
      <div className="space-y-6">
        {/* Page header */}
        <div>
          <h1 className="text-xl md:text-2xl font-bold flex items-center gap-2">
            <Settings2 className="h-5 md:h-6 w-5 md:w-6 text-primary" />
            Platform Settings
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Control platform-wide settings, feature flags, and rollout notes
          </p>
        </div>

        {/* A. Platform Status Summary */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          <Card className="hover:shadow-none hover:translate-y-0">
            <CardContent className="p-3 text-center">
              <p className="text-xs text-muted-foreground">Environment</p>
              <Badge variant="outline" className="mt-1">Production</Badge>
            </CardContent>
          </Card>
          <Card className="hover:shadow-none hover:translate-y-0">
            <CardContent className="p-3 text-center">
              <p className="text-xs text-muted-foreground">Maintenance</p>
              <Badge variant={isOn('maintenance_mode') ? 'destructive' : 'secondary'} className="mt-1">
                {isOn('maintenance_mode') ? 'On' : 'Off'}
              </Badge>
            </CardContent>
          </Card>
          <Card className="hover:shadow-none hover:translate-y-0">
            <CardContent className="p-3 text-center">
              <p className="text-xs text-muted-foreground">Public Signups</p>
              <Badge variant={isOn('early_access_enabled') ? 'default' : 'secondary'} className="mt-1">
                {isOn('early_access_enabled') ? 'Enabled' : 'Disabled'}
              </Badge>
            </CardContent>
          </Card>
          <Card className="hover:shadow-none hover:translate-y-0">
            <CardContent className="p-3 text-center">
              <p className="text-xs text-muted-foreground">Support Grants</p>
              <Badge variant={isOn('support_access_grants_enabled') ? 'default' : 'secondary'} className="mt-1">
                {isOn('support_access_grants_enabled') ? 'Enabled' : 'Disabled'}
              </Badge>
            </CardContent>
          </Card>
          <Card className="col-span-2 md:col-span-1 hover:shadow-none hover:translate-y-0">
            <CardContent className="p-3 text-center">
              <p className="text-xs text-muted-foreground">Feature Flags</p>
              <p className="text-sm font-semibold mt-1">{enabledFlags} / {totalFlags} enabled</p>
            </CardContent>
          </Card>
        </div>

        {/* B. Maintenance Mode */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Power className="h-4 w-4 text-destructive" />
              Maintenance Mode
            </CardTitle>
            <CardDescription>Blocks access to non-admin app routes during maintenance. Admin routes remain accessible. Internal notes are never shown publicly.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium">Enable Maintenance Mode</p>
                <p className="text-xs text-muted-foreground">Non-admin routes will be blocked and show the public message below</p>
              </div>
              <Switch
                checked={isOn('maintenance_mode')}
                onCheckedChange={() => handleToggle('maintenance_mode')}
                disabled={saving === 'maintenance_mode'}
              />
            </div>
            <Separator />
            <div className="space-y-2">
              <label className="text-sm font-medium">Public Message</label>
              <Textarea
                value={maintenanceMessage}
                onChange={e => setMaintenanceMessage(e.target.value)}
                placeholder="We are performing scheduled maintenance..."
                rows={2}
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Internal Note (admin-only)</label>
              <Input
                value={maintenanceInternalNote}
                onChange={e => setMaintenanceInternalNote(e.target.value)}
                placeholder="Reason for maintenance..."
              />
            </div>
            <Button
              size="sm"
              disabled={
                saving === 'maintenance_message' ||
                (maintenanceMessage === (settings['maintenance_message']?.value || '') &&
                 maintenanceInternalNote === (settings['maintenance_internal_note']?.value || ''))
              }
              onClick={async () => {
                await updateSetting('maintenance_message', maintenanceMessage);
                await updateSetting('maintenance_internal_note', maintenanceInternalNote);
              }}
            >
              <Save className="h-3.5 w-3.5 mr-1" />
              Save Maintenance Details
            </Button>
            {settings['maintenance_mode']?.updated_at && (
              <p className="text-xs text-muted-foreground">
                Last updated: {new Date(settings['maintenance_mode'].updated_at).toLocaleString()}
              </p>
            )}
          </CardContent>
        </Card>

        {/* C. Access / Growth Toggles */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Globe className="h-4 w-4 text-primary" />
              Access &amp; Growth Toggles
            </CardTitle>
            <CardDescription>Control app entry points and admin tooling availability.</CardDescription>
          </CardHeader>
          <CardContent className="divide-y divide-border">
            {ACCESS_KEYS.map(k => <ToggleRow key={k} settingKey={k} />)}
          </CardContent>
        </Card>

        {/* D. Feature Flags */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Layers className="h-4 w-4 text-primary" />
              Feature Flags
            </CardTitle>
            <CardDescription>Toggle platform features. These flags actively control sidebar visibility, route access, and feature availability across the app.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="divide-y divide-border">
              {FLAG_KEYS.map(k => {
                const s = settings[k];
                if (!s) return null;
                const Icon = TOGGLE_ICONS[k] || ToggleLeft;
                return (
                  <div key={k} className="flex items-center justify-between py-3">
                    <div className="flex items-center gap-3 min-w-0">
                      <Icon className="h-4 w-4 text-muted-foreground shrink-0" />
                      <div className="min-w-0">
                        <p className="text-sm font-medium">{s.label}</p>
                        <p className="text-xs text-muted-foreground">{s.description}</p>
                        <p className="text-[10px] text-muted-foreground/60 font-mono mt-0.5">{s.key}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <Badge variant="outline" className="text-[10px] hidden sm:inline-flex">Global</Badge>
                      <Switch
                        checked={isOn(k)}
                        onCheckedChange={() => handleToggle(k)}
                        disabled={saving === k}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>

        {/* E. Release / Rollout Notes */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <FileText className="h-4 w-4 text-primary" />
              Release &amp; Rollout Notes
            </CardTitle>
            <CardDescription>Record current release state and deployment notes. Not customer-facing.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Release Title</label>
              <Input
                value={releaseTitle}
                onChange={e => setReleaseTitle(e.target.value)}
                placeholder="v2.4.0 — Platform Settings launch"
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Release Notes</label>
              <Textarea
                value={releaseBody}
                onChange={e => setReleaseBody(e.target.value)}
                placeholder="Added Platform Settings admin page with feature flags, maintenance mode, and rollout notes..."
                rows={3}
              />
            </div>
            <Separator />
            <div className="space-y-2">
              <label className="text-sm font-medium">Last Deployment Note</label>
              <Input
                value={deploymentNote}
                onChange={e => setDeploymentNote(e.target.value)}
                placeholder="Deployed 2026-03-30 — no issues"
              />
            </div>
            <Button
              size="sm"
              disabled={
                saving !== null ||
                (releaseTitle === (settings['release_note_title']?.value || '') &&
                 releaseBody === (settings['release_note_body']?.value || '') &&
                 deploymentNote === (settings['deployment_note']?.value || ''))
              }
              onClick={async () => {
                await updateSetting('release_note_title', releaseTitle);
                await updateSetting('release_note_body', releaseBody);
                await updateSetting('deployment_note', deploymentNote);
              }}
            >
              <Save className="h-3.5 w-3.5 mr-1" />
              Save Release Notes
            </Button>
            {settings['release_note_title']?.updated_by && (
              <p className="text-xs text-muted-foreground">
                Last updated: {new Date(settings['release_note_title'].updated_at).toLocaleString()}
              </p>
            )}
          </CardContent>
        </Card>

        {/* F. Audit / Change History */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <History className="h-4 w-4 text-muted-foreground" />
              Recent Settings Changes
            </CardTitle>
            <CardDescription>Audit trail for platform settings modifications.</CardDescription>
          </CardHeader>
          <CardContent>
            {recentChanges.length === 0 ? (
              <p className="text-sm text-muted-foreground py-4 text-center">No settings changes recorded yet.</p>
            ) : (
              <div className="divide-y divide-border">
                {recentChanges.map(log => {
                  const details = log.details as any || {};
                  return (
                    <div key={log.id} className="py-2.5 text-sm">
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-medium text-xs">{details.label || details.key || 'Setting'}</span>
                        <span className="text-[10px] text-muted-foreground whitespace-nowrap">
                          {new Date(log.created_at).toLocaleString()}
                        </span>
                      </div>
                      <div className="flex flex-col gap-0.5 mt-0.5 text-xs text-muted-foreground">
                        {details.old_value !== undefined && (
                          <span>
                            <span className="line-through">{String(details.old_value) || '(empty)'}</span>
                            {' → '}
                            <span className="text-foreground">{String(details.new_value) || '(empty)'}</span>
                          </span>
                        )}
                        <span className="text-[10px]">by {log.user_id?.slice(0, 8) ?? 'unknown'}…</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Maintenance mode confirmation dialog */}
      <AlertDialog open={!!confirmToggle} onOpenChange={() => setConfirmToggle(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-destructive" />
              {confirmToggle?.newValue === 'true' ? 'Enable Maintenance Mode?' : 'Disable Maintenance Mode?'}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {confirmToggle?.newValue === 'true'
                ? 'This will show a maintenance banner to all users. Make sure the maintenance message is set.'
                : 'This will remove the maintenance banner and restore normal access.'}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (confirmToggle) updateSetting(confirmToggle.key, confirmToggle.newValue);
                setConfirmToggle(null);
              }}
            >
              Confirm
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AdminLayout>
  );
}
