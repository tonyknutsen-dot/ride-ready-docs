import { useState, useEffect, useMemo, useCallback } from 'react';
import { AdminLayout } from '@/components/admin/AdminLayout';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useAuditLog } from '@/hooks/useAuditLog';
import { toast } from 'sonner';
import {
  Key, Clock, User, Loader2, RefreshCw, Search, Plus, ShieldOff,
  Eye, CheckCircle, XCircle, AlertTriangle, Building,
} from 'lucide-react';
import { formatDistanceToNow, format } from 'date-fns';

interface SupportGrant {
  id: string;
  user_id: string;
  granted_to_admin: string | null;
  reason: string;
  status: string;
  granted_at: string;
  expires_at: string;
  revoked_at: string | null;
  access_scope: string;
  created_at: string;
}

interface GrantWithProfile extends SupportGrant {
  user_company: string;
  user_name: string;
}

interface ProfileOption {
  user_id: string;
  full_name: string | null;
  company_name: string | null;
  controller_name: string | null;
}

type StatusFilter = 'active' | 'expired' | 'revoked' | 'all';

const STATUS_CONFIG: Record<string, { label: string; icon: React.ElementType; className: string }> = {
  active: { label: 'Active', icon: CheckCircle, className: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300' },
  expired: { label: 'Expired', icon: Clock, className: 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300' },
  revoked: { label: 'Revoked', icon: XCircle, className: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300' },
};

export default function SupportAccessAdmin() {
  const { user } = useAuth();
  const { logEvent } = useAuditLog();
  const [grants, setGrants] = useState<GrantWithProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Filters
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('active');
  const [search, setSearch] = useState('');

  // Revoke
  const [revokeTarget, setRevokeTarget] = useState<GrantWithProfile | null>(null);
  const [revoking, setRevoking] = useState(false);

  // Create
  const [createOpen, setCreateOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [userProfiles, setUserProfiles] = useState<ProfileOption[]>([]);
  const [newGrant, setNewGrant] = useState({ user_id: '', reason: '', hours: '24', scope: 'read_only' });

  // Claim
  const [claiming, setClaiming] = useState<string | null>(null);

  const fetchGrants = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const { data, error } = await supabase
        .from('support_access_grants')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(200);
      if (error) throw error;

      const raw = (data || []) as SupportGrant[];
      const userIds = [...new Set(raw.map(g => g.user_id))];
      let profileMap = new Map<string, { name: string; company: string }>();

      if (userIds.length > 0) {
        const { data: profiles } = await supabase
          .from('profiles')
          .select('user_id, controller_name, company_name, full_name')
          .in('user_id', userIds);
        (profiles || []).forEach((p: any) => {
          profileMap.set(p.user_id, {
            name: p.controller_name || p.full_name || '',
            company: p.company_name || '',
          });
        });
      }

      setGrants(raw.map(g => ({
        ...g,
        user_name: profileMap.get(g.user_id)?.name || '',
        user_company: profileMap.get(g.user_id)?.company || 'Unknown',
      })));
    } catch (err: any) {
      console.error('Error fetching grants:', err);
      toast.error('Failed to load support access grants');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { fetchGrants(); }, [fetchGrants]);

  const handleRefresh = () => { setRefreshing(true); fetchGrants(); };

  // Counts
  const counts = useMemo(() => {
    const c = { active: 0, expired: 0, revoked: 0, all: grants.length };
    grants.forEach(g => {
      const s = g.status as string;
      if (s === 'active') {
        // Check if actually expired
        if (new Date(g.expires_at) < new Date()) c.expired++;
        else c.active++;
      } else if (s === 'expired') c.expired++;
      else if (s === 'revoked') c.revoked++;
    });
    return c;
  }, [grants]);

  // Effective status (expired grants marked 'active' in DB but past expiry)
  const effectiveStatus = (g: SupportGrant): string => {
    if (g.status === 'active' && new Date(g.expires_at) < new Date()) return 'expired';
    return g.status;
  };

  // Filtered
  const filtered = useMemo(() => {
    let result = grants;

    if (statusFilter !== 'all') {
      result = result.filter(g => effectiveStatus(g) === statusFilter);
    }

    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter(g =>
        g.user_company.toLowerCase().includes(q) ||
        g.user_name.toLowerCase().includes(q) ||
        g.reason.toLowerCase().includes(q) ||
        g.user_id.toLowerCase().includes(q)
      );
    }

    return result;
  }, [grants, statusFilter, search]);

  // Revoke
  const handleRevoke = async () => {
    if (!revokeTarget || !user) return;
    setRevoking(true);
    try {
      const { error } = await supabase
        .from('support_access_grants')
        .update({ status: 'revoked', revoked_at: new Date().toISOString() })
        .eq('id', revokeTarget.id);
      if (error) throw error;

      await logEvent('revoke', 'support_access', revokeTarget.id as any, {
        user_id: revokeTarget.user_id,
        reason: revokeTarget.reason,
      });

      toast.success('Grant revoked');
      setRevokeTarget(null);
      fetchGrants(true);
    } catch (err: any) {
      toast.error(err.message || 'Failed to revoke grant');
    } finally {
      setRevoking(false);
    }
  };

  // Claim
  const handleClaim = async (grantId: string) => {
    if (!user) return;
    setClaiming(grantId);
    try {
      const { error } = await supabase
        .from('support_access_grants')
        .update({ granted_to_admin: user.id })
        .eq('id', grantId);
      if (error) throw error;

      await logEvent('grant', 'support_access', grantId as any, { action: 'claimed' });
      toast.success('Grant claimed');
      fetchGrants(true);
    } catch (err: any) {
      toast.error(err.message || 'Failed to claim grant');
    } finally {
      setClaiming(null);
    }
  };

  // Create grant - fetch users
  const openCreateDialog = async () => {
    setCreateOpen(true);
    setNewGrant({ user_id: '', reason: '', hours: '24', scope: 'read_only' });
    try {
      const { data } = await supabase
        .from('profiles')
        .select('user_id, company_name, controller_name')
        .order('company_name', { ascending: true })
        .limit(500);
      setUserProfiles((data || []).map((p: any) => ({ ...p, full_name: p.controller_name })) as ProfileOption[]);
    } catch { /* non-critical */ }
  };

  const handleCreate = async () => {
    if (!newGrant.user_id || !newGrant.reason.trim()) {
      toast.error('User and reason are required');
      return;
    }
    setCreating(true);
    try {
      const expiresAt = new Date(Date.now() + parseInt(newGrant.hours) * 60 * 60 * 1000).toISOString();
      const { error } = await supabase.from('support_access_grants').insert({
        user_id: newGrant.user_id,
        reason: newGrant.reason.trim(),
        expires_at: expiresAt,
        access_scope: newGrant.scope,
        granted_to_admin: user?.id || null,
        status: 'active',
      });
      if (error) throw error;

      await logEvent('grant', 'support_access', undefined, {
        target_user_id: newGrant.user_id,
        reason: newGrant.reason,
        duration_hours: newGrant.hours,
        scope: newGrant.scope,
      });

      toast.success('Support access grant created');
      setCreateOpen(false);
      fetchGrants(true);
    } catch (err: any) {
      toast.error(err.message || 'Failed to create grant');
    } finally {
      setCreating(false);
    }
  };

  const getTimeLabel = (g: SupportGrant) => {
    const eff = effectiveStatus(g);
    if (eff === 'revoked') return `Revoked ${g.revoked_at ? formatDistanceToNow(new Date(g.revoked_at), { addSuffix: true }) : ''}`;
    if (eff === 'expired') return `Expired ${formatDistanceToNow(new Date(g.expires_at), { addSuffix: true })}`;
    const remaining = new Date(g.expires_at).getTime() - Date.now();
    const hours = Math.floor(remaining / (1000 * 60 * 60));
    const minutes = Math.floor((remaining % (1000 * 60 * 60)) / (1000 * 60));
    if (hours > 24) return `${Math.floor(hours / 24)}d ${hours % 24}h remaining`;
    return `${hours}h ${minutes}m remaining`;
  };

  const StatusBadge = ({ status }: { status: string }) => {
    const cfg = STATUS_CONFIG[status] || STATUS_CONFIG.active;
    const Icon = cfg.icon;
    return (
      <Badge variant="outline" className={`text-xs gap-1 ${cfg.className}`}>
        <Icon className="h-3 w-3" />
        {cfg.label}
      </Badge>
    );
  };

  const FILTER_TABS: { value: StatusFilter; label: string }[] = [
    { value: 'active', label: `Active (${counts.active})` },
    { value: 'expired', label: `Expired (${counts.expired})` },
    { value: 'revoked', label: `Revoked (${counts.revoked})` },
    { value: 'all', label: `All (${counts.all})` },
  ];

  if (loading) {
    return (
      <AdminLayout>
        <div className="flex items-center justify-center min-h-[400px]">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout>
      <div className="space-y-5">
        {/* Header */}
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div>
            <h1 className="text-xl md:text-2xl font-bold flex items-center gap-2">
              <Key className="h-5 w-5 text-primary" />
              Support Access Grants
            </h1>
            <p className="text-sm text-muted-foreground mt-0.5">
              Manage user-granted temporary support access
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={handleRefresh} disabled={refreshing}>
              <RefreshCw className={`h-4 w-4 mr-1 ${refreshing ? 'animate-spin' : ''}`} />
              <span className="hidden sm:inline">Refresh</span>
            </Button>
            <Button size="sm" onClick={openCreateDialog}>
              <Plus className="h-4 w-4 mr-1" />
              <span className="hidden sm:inline">Create Grant</span>
              <span className="sm:hidden">New</span>
            </Button>
          </div>
        </div>

        {/* Filters */}
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="flex gap-1 overflow-x-auto">
            {FILTER_TABS.map(tab => (
              <Button
                key={tab.value}
                variant={statusFilter === tab.value ? 'default' : 'outline'}
                size="sm"
                className="text-xs whitespace-nowrap"
                onClick={() => setStatusFilter(tab.value)}
              >
                {tab.label}
              </Button>
            ))}
          </div>
          <div className="relative flex-1 max-w-xs">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search user, company, reason…"
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="pl-9 h-9 text-sm"
            />
          </div>
        </div>

        {/* List */}
        <div className="space-y-2">
          {filtered.length === 0 ? (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-12">
                <Key className="h-12 w-12 text-muted-foreground/30 mb-4" />
                <p className="text-muted-foreground text-sm">
                  {statusFilter === 'active' ? 'No active support access grants' :
                   statusFilter === 'expired' ? 'No expired grants' :
                   statusFilter === 'revoked' ? 'No revoked grants' :
                   'No support access grants found'}
                </p>
                {statusFilter === 'active' && (
                  <p className="text-xs text-muted-foreground/60 mt-1">
                    Users must explicitly grant access, or an admin can create one.
                  </p>
                )}
              </CardContent>
            </Card>
          ) : (
            filtered.map(grant => {
              const eff = effectiveStatus(grant);
              const isActive = eff === 'active';
              return (
                <Card
                  key={grant.id}
                  className={`transition-colors ${eff === 'revoked' ? 'opacity-70' : eff === 'expired' ? 'opacity-80' : ''}`}
                >
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0 flex-1 space-y-1.5">
                        {/* User info */}
                        <div className="flex items-center gap-2 flex-wrap">
                          <div className="flex items-center gap-1.5">
                            <Building className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                            <span className="font-medium text-sm">{grant.user_company}</span>
                          </div>
                          {grant.user_name && (
                            <span className="text-xs text-muted-foreground">({grant.user_name})</span>
                          )}
                          <StatusBadge status={eff} />
                        </div>

                        {/* Reason */}
                        <p className="text-sm text-muted-foreground">{grant.reason}</p>

                        {/* Meta */}
                        <div className="flex items-center gap-3 flex-wrap text-xs text-muted-foreground/70">
                          <span>Granted {format(new Date(grant.granted_at), 'dd MMM yyyy HH:mm')}</span>
                          <span>Expires {format(new Date(grant.expires_at), 'dd MMM yyyy HH:mm')}</span>
                          <span className={isActive ? 'text-green-600 dark:text-green-400 font-medium' : ''}>
                            {getTimeLabel(grant)}
                          </span>
                        </div>

                        {/* Assigned admin */}
                        {grant.granted_to_admin && (
                          <div className="flex items-center gap-1 text-xs text-muted-foreground/60">
                            <User className="h-3 w-3" />
                            <span>
                              Claimed by {grant.granted_to_admin === user?.id ? 'you' : `Admin ${grant.granted_to_admin.slice(0, 8)}…`}
                            </span>
                          </div>
                        )}
                      </div>

                      {/* Actions */}
                      <div className="flex items-center gap-1.5 shrink-0">
                        {isActive && !grant.granted_to_admin && (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleClaim(grant.id)}
                            disabled={claiming === grant.id}
                          >
                            {claiming === grant.id ? <Loader2 className="h-4 w-4 animate-spin" /> : (
                              <><Eye className="h-3.5 w-3.5 mr-1" />Claim</>
                            )}
                          </Button>
                        )}
                        {isActive && (
                          <Button
                            size="sm"
                            variant="destructive"
                            onClick={() => setRevokeTarget(grant)}
                          >
                            <ShieldOff className="h-3.5 w-3.5 mr-1" />
                            <span className="hidden sm:inline">Revoke</span>
                          </Button>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })
          )}
        </div>

        {/* Revoke Confirmation */}
        <AlertDialog open={!!revokeTarget} onOpenChange={open => { if (!open) setRevokeTarget(null); }}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle className="flex items-center gap-2">
                <AlertTriangle className="h-5 w-5 text-destructive" />
                Revoke Support Access
              </AlertDialogTitle>
              <AlertDialogDescription>
                This will immediately revoke support access for <strong>{revokeTarget?.user_company}</strong>.
                The user will need to create a new grant if they want to restore access.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel disabled={revoking}>Cancel</AlertDialogCancel>
              <AlertDialogAction
                onClick={handleRevoke}
                disabled={revoking}
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              >
                {revoking ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : null}
                Revoke Access
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        {/* Create Grant Dialog */}
        <Dialog open={createOpen} onOpenChange={setCreateOpen}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Create Support Access Grant</DialogTitle>
              <DialogDescription>
                Grant temporary access to a user's data for support purposes.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-2">
              <div className="space-y-2">
                <Label>User / Account</Label>
                <Select value={newGrant.user_id} onValueChange={v => setNewGrant(p => ({ ...p, user_id: v }))}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select a user…" />
                  </SelectTrigger>
                  <SelectContent className="max-h-60">
                    {userProfiles.map(p => (
                      <SelectItem key={p.user_id} value={p.user_id}>
                        {p.company_name || p.controller_name || p.full_name || p.user_id.slice(0, 8)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Reason</Label>
                <Textarea
                  value={newGrant.reason}
                  onChange={e => setNewGrant(p => ({ ...p, reason: e.target.value }))}
                  placeholder="Why is this access needed?"
                  rows={2}
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label>Duration</Label>
                  <Select value={newGrant.hours} onValueChange={v => setNewGrant(p => ({ ...p, hours: v }))}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="1">1 hour</SelectItem>
                      <SelectItem value="4">4 hours</SelectItem>
                      <SelectItem value="24">24 hours</SelectItem>
                      <SelectItem value="48">48 hours</SelectItem>
                      <SelectItem value="168">7 days</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Access Scope</Label>
                  <Select value={newGrant.scope} onValueChange={v => setNewGrant(p => ({ ...p, scope: v }))}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="read_only">Read Only</SelectItem>
                      <SelectItem value="full">Full Access</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setCreateOpen(false)} disabled={creating}>Cancel</Button>
              <Button onClick={handleCreate} disabled={creating || !newGrant.user_id || !newGrant.reason.trim()}>
                {creating ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Plus className="h-4 w-4 mr-1" />}
                Create Grant
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </AdminLayout>
  );
}
