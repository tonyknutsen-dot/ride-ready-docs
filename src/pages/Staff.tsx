import { useState, useEffect, useMemo } from 'react';
import { ArrowLeft, Users, UserPlus, Loader2, WifiOff, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useAppRole } from '@/hooks/useAppRole';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { useOnlineStatus } from '@/hooks/useOnlineStatus';
import { useSubscription } from '@/hooks/useSubscription';
import { can_manage_staff } from '@/utils/permissions';
import { StaffFilters } from '@/components/staff/StaffFilters';
import { StaffCard, PendingInviteCard, type StaffMemberData, type PendingInviteData } from '@/components/staff/StaffCard';
import { StaffInviteModal } from '@/components/staff/StaffInviteModal';
import { StaffDetailsDrawer } from '@/components/staff/StaffDetailsDrawer';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Database } from '@/integrations/supabase/types';
import { useAuditLog } from '@/hooks/useAuditLog';

type StaffRole = Database['public']['Enums']['staff_role'];
type FilterRole = 'all' | 'staff' | 'pending';

const Staff = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { toast } = useToast();
  const { logEvent } = useAuditLog();
  const appRole = useAppRole();
  const isOnline = useOnlineStatus();
  const { subscription } = useSubscription();
  const canManage = can_manage_staff(appRole);
  const isExpired = subscription?.isExpired === true;
  const canInvite = canManage && !isExpired;

  const [staff, setStaff] = useState<StaffMemberData[]>([]);
  const [invites, setInvites] = useState<PendingInviteData[]>([]);
  const [organisationId, setOrganisationId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [inviteOpen, setInviteOpen] = useState(false);
  const [drawerMember, setDrawerMember] = useState<StaffMemberData | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<StaffMemberData | null>(null);

  // Filters
  const [search, setSearch] = useState('');
  const [activeFilter, setActiveFilter] = useState<FilterRole>('all');

  useEffect(() => {
    if (user) fetchOrganisation();
  }, [user]);

  const fetchOrganisation = async () => {
    if (!user) return;
    try {
      const { data: org } = await supabase
        .from('organisations')
        .select('id')
        .eq('owner_id', user.id)
        .maybeSingle();
      if (org) {
        setOrganisationId(org.id);
        await Promise.all([fetchStaff(org.id), fetchInvites(org.id)]);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const fetchStaff = async (orgId: string) => {
    try {
      const { data: members } = await supabase
        .from('organisation_members')
        .select('id, user_id, permission_level, joined_at, is_active, equipment_access_mode')
        .eq('organisation_id', orgId)
        .eq('is_active', true);

      const staffWithDetails = await Promise.all(
        (members || []).map(async member => {
          let email = '';
          let display_name = '';
          try {
            const { data } = await supabase.functions.invoke('get-user-email', {
              body: { userId: member.user_id },
            });
            email = data?.email || '';
            display_name = data?.name || '';
          } catch (_) {}

          const { data: assignments } = await supabase
            .from('staff_equipment_assignments')
            .select('ride_id, rides(id, ride_name)')
            .eq('member_id', member.id);

          const assigned_rides = (assignments || [])
            .filter(a => a.rides)
            .map(a => ({ id: (a.rides as any).id, ride_name: (a.rides as any).ride_name }));

          return {
            ...member,
            email,
            display_name,
            assigned_rides,
            equipment_access_mode: (member as any).equipment_access_mode || 'all',
          };
        })
      );
      setStaff(staffWithDetails);
    } catch (e) {
      console.error(e);
    }
  };

  const fetchInvites = async (orgId: string) => {
    try {
      const { data } = await supabase
        .from('staff_invites')
        .select('id, email, permission_level, created_at, expires_at, status')
        .eq('organisation_id', orgId)
        .eq('status', 'pending')
        .order('created_at', { ascending: false });
      setInvites(data || []);
    } catch (e) {
      console.error(e);
    }
  };

  const cancelInvite = async (inviteId: string) => {
    try {
      const { error } = await supabase
        .from('staff_invites')
        .update({ status: 'cancelled' })
        .eq('id', inviteId);
      if (error) throw error;
      toast({ title: 'Invitation cancelled' });
      if (organisationId) fetchInvites(organisationId);
    } catch (e: any) {
      toast({ title: 'Error', description: e.message, variant: 'destructive' });
    }
  };

  const removeStaff = async () => {
    if (!deleteTarget) return;
    try {
      const { error } = await supabase
        .from('organisation_members')
        .update({ is_active: false })
        .eq('id', deleteTarget.id);
      if (error) throw error;
      if (deleteTarget.user_id) {
        await supabase.from('profiles').delete().eq('user_id', deleteTarget.user_id);
      }

      logEvent('delete', 'staff', deleteTarget.id, {
        name: deleteTarget.display_name || deleteTarget.email || 'Unknown',
        email: deleteTarget.email,
        role: deleteTarget.permission_level,
      }, {
        before: {
          display_name: deleteTarget.display_name,
          email: deleteTarget.email,
          permission_level: deleteTarget.permission_level,
          equipment_access_mode: deleteTarget.equipment_access_mode,
          is_active: true,
        },
        after: { is_active: false },
        changedFields: ['is_active'],
        contextHint: 'staff member removed and profile deleted',
      });

      toast({ title: 'Staff member removed' });
      if (organisationId) fetchStaff(organisationId);
    } catch (e: any) {
      toast({ title: 'Error', description: e.message, variant: 'destructive' });
    } finally {
      setDeleteTarget(null);
    }
  };

  const refreshAll = () => {
    if (organisationId) {
      fetchStaff(organisationId);
      fetchInvites(organisationId);
    }
  };

  // Counts
  const counts = useMemo(() => ({
    all: staff.length,
    staff: staff.length,
    pending: invites.length,
  }), [staff, invites]);

  // Filtered list
  const filteredStaff = useMemo(() => {
    let list = staff;
    if (activeFilter !== 'all' && activeFilter !== 'pending') {
      list = list.filter(s => s.permission_level === activeFilter);
    }
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(s =>
        (s.email || '').toLowerCase().includes(q) ||
        (s.display_name || '').toLowerCase().includes(q)
      );
    }
    return list;
  }, [staff, activeFilter, search]);

  const showInvites = activeFilter === 'all' || activeFilter === 'pending';

  if (!isOnline && staff.length === 0) {
    return (
      <div className="container mx-auto px-4 py-5 pb-28 md:pb-8 max-w-2xl">
        <div className="rounded-xl p-8 text-center border border-border">
          <WifiOff className="h-10 w-10 mx-auto mb-3 text-muted-foreground" />
          <p className="text-sm font-medium">Requires connection</p>
          <p className="text-xs text-muted-foreground mt-1">Staff management needs an internet connection.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-5 pb-28 md:pb-8 space-y-4 max-w-2xl">
      {/* Back */}
      <Button
        variant="ghost"
        size="sm"
        onClick={() => navigate('/overview')}
        className="w-fit gap-1.5 -ml-2 text-muted-foreground hover:text-foreground h-8"
      >
        <ArrowLeft className="h-4 w-4" />
        Back
      </Button>

      {/* Header */}
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-lg font-bold">Staff & Permissions</h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            {staff.length} member{staff.length !== 1 ? 's' : ''}
            {invites.length > 0 && ` · ${invites.length} pending`}
          </p>
        </div>
        {canManage && (
          <Button size="sm" onClick={() => setInviteOpen(true)} className="gap-1.5 h-9">
            <UserPlus className="h-4 w-4" />
            <span className="hidden sm:inline">Invite</span>
          </Button>
        )}
      </div>

      {/* Loading */}
      {loading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="h-7 w-7 animate-spin text-primary" />
        </div>
      ) : (
        <>
          {/* Search + Filter chips */}
          {(staff.length > 0 || invites.length > 0) && (
            <StaffFilters
              search={search}
              onSearchChange={setSearch}
              activeFilter={activeFilter}
              onFilterChange={setActiveFilter}
              counts={counts}
            />
          )}

          {/* Empty state */}
          {staff.length === 0 && invites.length === 0 ? (
            <div className="rounded-xl p-8 text-center border border-dashed border-border">
              <Users className="h-8 w-8 mx-auto mb-2 text-muted-foreground/50" />
              <p className="text-sm font-medium mb-1">No staff members yet</p>
              <p className="text-xs text-muted-foreground mb-4">Invite your first team member to get started.</p>
              {canManage && (
                <Button size="sm" onClick={() => setInviteOpen(true)} className="gap-1.5">
                  <UserPlus className="h-4 w-4" />
                  Invite Staff
                </Button>
              )}
            </div>
          ) : (
            <div className="space-y-2">
              {/* Staff cards */}
              {activeFilter !== 'pending' && filteredStaff.map(member => (
                <StaffCard
                  key={member.id}
                  member={member}
                  canManage={canManage}
                  onTap={() => setDrawerMember(member)}
                  onEditAccess={() => setDrawerMember(member)}
                  onRemove={() => setDeleteTarget(member)}
                />
              ))}

              {activeFilter !== 'pending' && filteredStaff.length === 0 && search.trim() && (
                <p className="text-sm text-muted-foreground text-center py-6">No staff match "{search}"</p>
              )}

              {/* Pending invites */}
              {showInvites && invites.length > 0 && (
                <div className="space-y-2 pt-1">
                  <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground px-0.5">
                    Pending — {invites.length}
                  </p>
                  {invites.map(invite => (
                    <PendingInviteCard
                      key={invite.id}
                      invite={invite}
                      canManage={canManage}
                      onResend={() => {}}
                      onCancel={() => cancelInvite(invite.id)}
                    />
                  ))}
                </div>
              )}
            </div>
          )}

          {(staff.length > 0 || invites.length > 0) && (
            <p className="text-center text-[10px] text-muted-foreground pt-1">
              All actions are audit logged.
            </p>
          )}
        </>
      )}

      {/* Invite Modal */}
      <StaffInviteModal
        open={inviteOpen}
        onOpenChange={setInviteOpen}
        onSuccess={refreshAll}
      />

      {/* Details Drawer */}
      <StaffDetailsDrawer
        open={!!drawerMember}
        onOpenChange={open => { if (!open) setDrawerMember(null); }}
        member={drawerMember}
        actorRole={appRole}
        onRefresh={refreshAll}
      />

      {/* Remove Confirmation */}
      <AlertDialog open={!!deleteTarget} onOpenChange={open => { if (!open) setDeleteTarget(null); }}>
        <AlertDialogContent className="w-[95vw] max-w-[95vw] sm:max-w-sm">
          <AlertDialogHeader>
            <AlertDialogTitle>Remove Staff Member?</AlertDialogTitle>
            <AlertDialogDescription>
              This will revoke {deleteTarget?.display_name || deleteTarget?.email || 'this person'}'s access.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={removeStaff}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Remove
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default Staff;
