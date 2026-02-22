import { useState, useEffect, useMemo } from 'react';
import { ArrowLeft, Users, UserPlus, Loader2, WifiOff } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useAppRole } from '@/hooks/useAppRole';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { useOnlineStatus } from '@/hooks/useOnlineStatus';
import { can_manage_staff } from '@/utils/permissions';
import { StaffStatusChips } from '@/components/staff/StaffStatusChips';
import { StaffFilters } from '@/components/staff/StaffFilters';
import { StaffCard, PendingInviteCard, type StaffMemberData, type PendingInviteData } from '@/components/staff/StaffCard';
import { StaffInviteModal } from '@/components/staff/StaffInviteModal';
import { StaffDetailsDrawer } from '@/components/staff/StaffDetailsDrawer';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Database } from '@/integrations/supabase/types';

type StaffRole = Database['public']['Enums']['staff_role'];
type FilterRole = 'all' | 'manager' | 'supervisor' | 'staff' | 'pending';

const Staff = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { toast } = useToast();
  const appRole = useAppRole();
  const isOnline = useOnlineStatus();
  const canManage = can_manage_staff(appRole);

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
        .select('id, user_id, permission_level, joined_at, is_active')
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

          return { ...member, email, display_name, assigned_rides };
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
    manager: staff.filter(s => s.permission_level === 'manager').length,
    supervisor: staff.filter(s => s.permission_level === 'supervisor').length,
    staff: staff.filter(s => s.permission_level === 'staff').length,
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
      <div className="container mx-auto px-4 py-5 pb-28 md:pb-8 max-w-4xl">
        <div className="rounded-xl p-8 text-center border border-border">
          <WifiOff className="h-10 w-10 mx-auto mb-3 text-muted-foreground" />
          <p className="text-sm font-medium">Requires connection</p>
          <p className="text-xs text-muted-foreground mt-1">Staff management needs an internet connection.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-5 pb-28 md:pb-8 space-y-5 max-w-4xl">
      {/* Back Button */}
      <Button
        variant="ghost"
        size="sm"
        onClick={() => navigate('/overview')}
        className="w-fit gap-1.5 -ml-2 text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" />
        Back
      </Button>

      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
            <Users className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h1 className="text-xl md:text-2xl font-bold">Staff & Permissions</h1>
            <p className="text-xs text-muted-foreground">Control access and ride assignments. All actions are audit-logged.</p>
          </div>
        </div>
        {canManage && (
          <Button size="sm" onClick={() => setInviteOpen(true)} className="gap-1.5 flex-shrink-0">
            <UserPlus className="h-4 w-4" />
            <span className="hidden sm:inline">Invite</span>
          </Button>
        )}
      </div>

      {/* Status chips */}
      {!loading && (
        <StaffStatusChips
          total={counts.all}
          managers={counts.manager}
          supervisors={counts.supervisor}
          staff={counts.staff}
          pending={counts.pending}
        />
      )}

      {/* Loading */}
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      ) : (
        <>
          {/* Search + Filters */}
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
            <div
              className="rounded-xl p-8 text-center"
              style={{ background: 'hsl(var(--muted) / 0.3)', border: '1px dashed hsl(var(--border))' }}
            >
              <div
                className="w-12 h-12 rounded-xl flex items-center justify-center mx-auto mb-3"
                style={{ background: 'hsl(var(--muted))' }}
              >
                <Users className="h-6 w-6 text-muted-foreground" />
              </div>
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
            <div className="space-y-3">
              {/* Staff cards */}
              {activeFilter !== 'pending' && filteredStaff.length > 0 && (
                <div className="space-y-2">
                  {filteredStaff.map(member => (
                    <StaffCard
                      key={member.id}
                      member={member}
                      canManage={canManage}
                      onTap={() => setDrawerMember(member)}
                      onEditAccess={() => setDrawerMember(member)}
                      onRemove={() => setDeleteTarget(member)}
                    />
                  ))}
                </div>
              )}

              {activeFilter !== 'pending' && filteredStaff.length === 0 && search.trim() && (
                <p className="text-sm text-muted-foreground text-center py-6">No staff match "{search}"</p>
              )}

              {/* Pending invites */}
              {showInvites && invites.length > 0 && (
                <div className="space-y-2">
                  <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground px-0.5 pt-2">
                    Pending Invitations — {invites.length}
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

          {/* Compliance footer */}
          {(staff.length > 0 || invites.length > 0) && (
            <p className="text-center text-[11px] text-muted-foreground pt-1">
              All user actions are audit logged and traceable.
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
        <AlertDialogContent className="w-[95vw] max-w-[95vw] sm:max-w-lg">
          <AlertDialogHeader>
            <AlertDialogTitle>Remove Staff Member?</AlertDialogTitle>
            <AlertDialogDescription>
              This will revoke {deleteTarget?.display_name || deleteTarget?.email || 'this person'}'s access. They can be re-invited later.
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
