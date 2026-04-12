import { useState, useEffect } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Loader2, UserPlus, Users, Mail, Clock, Trash2, Settings2, Shield, Wrench, CheckCircle2, ShieldAlert } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { StaffInviteDialog } from './StaffInviteDialog';
import { StaffEquipmentDialog } from './StaffEquipmentDialog';
import { Database } from '@/integrations/supabase/types';
import { format } from 'date-fns';

type StaffRole = Database['public']['Enums']['staff_role'];

interface StaffMember {
  id: string;
  user_id: string;
  permission_level: StaffRole;
  joined_at: string;
  is_active: boolean;
  email?: string;
  assigned_rides: { id: string; ride_name: string }[];
}

interface PendingInvite {
  id: string;
  email: string;
  permission_level: StaffRole;
  created_at: string;
  expires_at: string;
  status: string;
}

const PERMISSION_CONFIG: Record<string, {
  label: string;
  shortLabel: string;
  bg: string;
  text: string;
  border: string;
  icon: typeof Shield;
}> = {
  staff: {
    label: 'Staff',
    shortLabel: 'Staff',
    bg: 'hsl(214 100% 97%)',
    text: 'hsl(213 52% 24%)',
    border: 'hsl(213 52% 80%)',
    icon: CheckCircle2,
  },
};

export function StaffManagement() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [staff, setStaff] = useState<StaffMember[]>([]);
  const [invites, setInvites] = useState<PendingInvite[]>([]);
  const [organisationId, setOrganisationId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [inviteDialogOpen, setInviteDialogOpen] = useState(false);
  const [equipmentDialogOpen, setEquipmentDialogOpen] = useState(false);
  const [selectedMember, setSelectedMember] = useState<StaffMember | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<StaffMember | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [permissionWarning, setPermissionWarning] = useState<{ memberId: string; email: string } | null>(null);

  useEffect(() => {
    if (user) fetchOrganisation();
  }, [user]);

  const fetchOrganisation = async () => {
    if (!user) return;
    try {
      const { data: org, error } = await supabase
        .from('organisations')
        .select('id')
        .eq('owner_id', user.id)
        .maybeSingle();
      if (error) throw error;
      if (org) {
        setOrganisationId(org.id);
        await Promise.all([fetchStaff(org.id), fetchInvites(org.id)]);
      }
    } catch (error) {
      console.error('Error fetching organisation:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchStaff = async (orgId: string) => {
    try {
      const { data: members, error } = await supabase
        .from('organisation_members')
        .select('id, user_id, permission_level, joined_at, is_active, invited_email')
        .eq('organisation_id', orgId)
        .eq('is_active', true);
      if (error) throw error;

      const staffWithDetails = await Promise.all(
        (members || []).map(async (member) => {
          let email = (member as any).invited_email || '';

          if (!email) {
            try {
              const { data } = await supabase.functions.invoke('get-user-email', {
                body: { userId: member.user_id },
              });
              email = data?.email || '';
            } catch (e) {
              console.error('Error fetching email:', e);
            }
          }

          const { data: assignments } = await supabase
            .from('staff_equipment_assignments')
            .select('ride_id, rides(id, ride_name)')
            .eq('member_id', member.id);

          const assignedRides = (assignments || [])
            .filter(a => a.rides)
            .map(a => ({
              id: (a.rides as any).id,
              ride_name: (a.rides as any).ride_name,
            }));

          return { ...member, email, assigned_rides: assignedRides };
        })
      );
      setStaff(staffWithDetails);
    } catch (error) {
      console.error('Error fetching staff:', error);
    }
  };

  const fetchInvites = async (orgId: string) => {
    try {
      const { data, error } = await supabase
        .from('staff_invites')
        .select('id, email, permission_level, created_at, expires_at, status')
        .eq('organisation_id', orgId)
        .eq('status', 'pending')
        .order('created_at', { ascending: false });
      if (error) throw error;
      setInvites(data || []);
    } catch (error) {
      console.error('Error fetching invites:', error);
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
    } catch (error: any) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    }
  };

  const removeStaff = async (memberId: string) => {
    try {
      // Deactivate membership — do NOT hard-delete the user's profile
      const { error } = await supabase
        .from('organisation_members')
        .update({ is_active: false })
        .eq('id', memberId);
      if (error) throw error;
      toast({ title: 'Staff member removed' });
      if (organisationId) fetchStaff(organisationId);
    } catch (error: any) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    }
  };

  const handlePermissionChange = (memberId: string, newPermission: StaffRole, _memberEmail: string) => {
    updatePermission(memberId, newPermission);
  };

  const updatePermission = async (memberId: string, newPermission: StaffRole) => {
    try {
      const { error } = await supabase
        .from('organisation_members')
        .update({ permission_level: newPermission })
        .eq('id', memberId);
      if (error) throw error;
      toast({ title: 'Permission updated' });
      if (organisationId) fetchStaff(organisationId);
    } catch (error: any) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    }
  };

  const PermissionBadge = ({ permission }: { permission: StaffRole }) => {
    const cfg = PERMISSION_CONFIG[permission];
    const Icon = cfg.icon;
    return (
      <span
        className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold"
        style={{ background: cfg.bg, color: cfg.text, border: `1px solid ${cfg.border}` }}
      >
        <Icon className="h-3 w-3" strokeWidth={2} />
        {cfg.shortLabel}
      </span>
    );
  };

  // Counts for authority summary
  const totalStaffCount = staff.length;

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-5">

      {/* Staff Count */}
      {staff.length > 0 && (
        <div
          className="rounded-xl p-4 text-center"
          style={{ background: 'hsl(var(--muted) / 0.5)', border: '1px solid hsl(var(--border))' }}
        >
          <div className="text-xl font-bold" style={{ color: 'hsl(213 52% 24%)' }}>{totalStaffCount}</div>
          <div className="text-[10px] font-medium" style={{ color: 'hsl(var(--muted-foreground))' }}>Staff Members</div>
        </div>
      )}

      {/* Invite CTA */}
      <Button
        onClick={() => setInviteDialogOpen(true)}
        className="w-full h-12 text-sm font-semibold rounded-xl gap-2"
      >
        <UserPlus className="h-4 w-4" />
        Invite Staff Member
      </Button>

      {/* Staff Cards */}
      {staff.length === 0 ? (
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
          <p className="text-sm font-medium text-foreground mb-1">No staff members yet</p>
          <p className="text-xs text-muted-foreground">Invite your first team member to get started.</p>
        </div>
      ) : (
        <div className="space-y-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground px-0.5">
            Active Staff — {staff.length} member{staff.length !== 1 ? 's' : ''}
          </p>
          {staff.map((member) => {
            const cfg = PERMISSION_CONFIG[member.permission_level];
            return (
              <div
                key={member.id}
                className="rounded-xl p-4 space-y-3"
                style={{
                  background: 'hsl(var(--card))',
                  border: '1px solid hsl(var(--border))',
                  boxShadow: '0 2px 8px rgba(0,0,0,0.04)',
                }}
              >
                {/* Top row: email + actions */}
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2.5 min-w-0">
                    {/* Avatar chip */}
                    <div
                      className="w-9 h-9 rounded-xl flex items-center justify-center text-xs font-bold flex-shrink-0"
                      style={{ background: cfg.bg, color: cfg.text }}
                    >
                      {(member.email || '?')[0].toUpperCase()}
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-semibold truncate">{member.email || 'Unknown'}</p>
                      <p className="text-[11px] text-muted-foreground">
                        Joined {format(new Date(member.joined_at), 'MMM d, yyyy')}
                      </p>
                    </div>
                  </div>

                  {/* Action icons */}
                  <div className="flex items-center gap-1 flex-shrink-0">
                    <button
                      onClick={() => { setSelectedMember(member); setEquipmentDialogOpen(true); }}
                      className="w-8 h-8 rounded-lg flex items-center justify-center transition-colors"
                      style={{ background: 'hsl(var(--muted))' }}
                      title="Manage equipment access"
                    >
                      <Settings2 className="h-3.5 w-3.5 text-muted-foreground" />
                    </button>
                    <button
                      onClick={() => { setDeleteTarget(member); setDeleteDialogOpen(true); }}
                      className="w-8 h-8 rounded-lg flex items-center justify-center transition-colors"
                      style={{ background: 'hsl(0 72% 97%)' }}
                      title="Remove staff member"
                    >
                      <Trash2 className="h-3.5 w-3.5" style={{ color: 'hsl(0 72% 51%)' }} />
                    </button>
                  </div>
                </div>

                {/* Read-only access summary */}
                <div
                  className="rounded-xl p-3 space-y-1.5"
                  style={{ background: 'hsl(var(--muted) / 0.4)', border: '1px solid hsl(var(--border))' }}
                >
                  <span className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground flex items-center gap-1">
                    <Shield className="h-3 w-3" />
                    Staff Access
                  </span>
                  <div className="space-y-0.5">
                    <p className="text-[11px] text-foreground">✓ Assigned rides · Checks · Maintenance · Defects</p>
                    <p className="text-[11px] text-muted-foreground/50">✗ Calendar · Documents · Billing · Settings</p>
                  </div>
                </div>

                {/* Equipment row */}
                <div className="flex items-center justify-between">
                  <span className="text-[11px] text-muted-foreground flex items-center gap-1">
                    <Wrench className="h-3 w-3" />
                    Equipment Access
                  </span>
                  <div className="flex flex-wrap gap-1 justify-end">
                    {member.assigned_rides.length === 0 ? (
                      <span
                        className="text-[11px] font-medium px-2 py-0.5 rounded-full"
                        style={{ background: 'hsl(214 100% 97%)', color: 'hsl(213 52% 24%)' }}
                      >
                        All equipment
                      </span>
                    ) : (
                      <>
                        {member.assigned_rides.slice(0, 2).map(r => (
                          <Badge key={r.id} variant="outline" className="text-[10px] px-1.5 py-0">
                            {r.ride_name}
                          </Badge>
                        ))}
                        {member.assigned_rides.length > 2 && (
                          <Badge variant="outline" className="text-[10px] px-1.5 py-0">
                            +{member.assigned_rides.length - 2}
                          </Badge>
                        )}
                      </>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Pending Invites */}
      {invites.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground px-0.5">
            Pending Invitations — {invites.length}
          </p>
          {invites.map((invite) => (
            <div
              key={invite.id}
              className="flex items-center justify-between p-3.5 rounded-xl"
              style={{ background: 'hsl(38 100% 97%)', border: '1px solid hsl(38 92% 80%)' }}
            >
              <div className="flex items-center gap-3 min-w-0">
                <div
                  className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
                  style={{ background: 'hsl(38 92% 90%)' }}
                >
                  <Mail className="h-4 w-4" style={{ color: 'hsl(32 95% 30%)' }} />
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-medium truncate">{invite.email}</p>
                  <div className="flex items-center gap-2 mt-0.5">
                    <PermissionBadge permission={invite.permission_level} />
                    <span className="text-[11px] text-muted-foreground flex items-center gap-1">
                      <Clock className="h-3 w-3" />
                      Expires {format(new Date(invite.expires_at), 'MMM d')}
                    </span>
                  </div>
                </div>
              </div>
              <Button
                variant="ghost"
                size="sm"
                className="text-destructive hover:text-destructive text-xs flex-shrink-0"
                onClick={() => cancelInvite(invite.id)}
              >
                Cancel
              </Button>
            </div>
          ))}
        </div>
      )}

      {/* Compliance footer */}
      <p className="text-center text-[11px] text-muted-foreground pt-1">
        All user actions are audit logged and traceable for compliance purposes.
      </p>

      {/* Dialogs */}
      {inviteDialogOpen && (
        <StaffInviteDialog
          open={inviteDialogOpen}
          onOpenChange={setInviteDialogOpen}
          onSuccess={() => { if (organisationId) fetchInvites(organisationId); }}
        />
      )}

      {selectedMember && equipmentDialogOpen && (
        <StaffEquipmentDialog
          open={equipmentDialogOpen}
          onOpenChange={setEquipmentDialogOpen}
          memberId={selectedMember.id}
          memberEmail={selectedMember.email || 'Staff member'}
          currentAssignments={selectedMember.assigned_rides.map(r => r.id)}
          onSuccess={() => { if (organisationId) fetchStaff(organisationId); }}
        />
      )}

      {/* Permission warning dialog removed — only staff role exists */}

      {deleteTarget && (
        <AlertDialog
          open={deleteDialogOpen}
          onOpenChange={(open) => { setDeleteDialogOpen(open); if (!open) setDeleteTarget(null); }}
        >
          <AlertDialogContent className="w-[95vw] max-w-[95vw] sm:max-w-lg">
            <AlertDialogHeader>
              <AlertDialogTitle>Remove Staff Member?</AlertDialogTitle>
              <AlertDialogDescription>
                This will revoke their access. They can be re-invited later.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction
                onClick={async () => {
                  await removeStaff(deleteTarget.id);
                  setDeleteDialogOpen(false);
                  setDeleteTarget(null);
                }}
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              >
                Remove
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      )}
    </div>
  );
}
