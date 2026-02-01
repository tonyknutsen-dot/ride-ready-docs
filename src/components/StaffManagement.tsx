import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Loader2, UserPlus, Users, Mail, Clock, Trash2, Settings2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { StaffInviteDialog } from './StaffInviteDialog';
import { StaffEquipmentDialog } from './StaffEquipmentDialog';
import { Database } from '@/integrations/supabase/types';
import { format } from 'date-fns';

type StaffPermission = Database['public']['Enums']['staff_permission'];

interface StaffMember {
  id: string;
  user_id: string;
  permission_level: StaffPermission;
  joined_at: string;
  is_active: boolean;
  email?: string;
  assigned_rides: { id: string; ride_name: string }[];
}

interface PendingInvite {
  id: string;
  email: string;
  permission_level: StaffPermission;
  created_at: string;
  expires_at: string;
  status: string;
}

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
    if (user) {
      fetchOrganisation();
    }
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
        await Promise.all([
          fetchStaff(org.id),
          fetchInvites(org.id),
        ]);
      }
    } catch (error) {
      console.error('Error fetching organisation:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchStaff = async (orgId: string) => {
    try {
      // Fetch staff members
      const { data: members, error } = await supabase
        .from('organisation_members')
        .select(`
          id,
          user_id,
          permission_level,
          joined_at,
          is_active
        `)
        .eq('organisation_id', orgId)
        .eq('is_active', true);

      if (error) throw error;

      // For each member, get their email and assigned rides
      const staffWithDetails = await Promise.all(
        (members || []).map(async (member) => {
          // Get user email via edge function
          let email = '';
          try {
            const { data } = await supabase.functions.invoke('get-user-email', {
              body: { userId: member.user_id },
            });
            email = data?.email || '';
          } catch (e) {
            console.error('Error fetching email:', e);
          }

          // Get assigned rides
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

          return {
            ...member,
            email,
            assigned_rides: assignedRides,
          };
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
      toast({
        title: 'Error',
        description: error.message,
        variant: 'destructive',
      });
    }
  };

  const removeStaff = async (memberId: string) => {
    try {
      // Get the member's user_id before deactivating
      const memberToRemove = staff.find(s => s.id === memberId);
      
      const { error } = await supabase
        .from('organisation_members')
        .update({ is_active: false })
        .eq('id', memberId);

      if (error) throw error;

      // Also delete their profile so they can't sign in to a broken state
      // This effectively removes their account from the system
      if (memberToRemove?.user_id) {
        await supabase
          .from('profiles')
          .delete()
          .eq('user_id', memberToRemove.user_id);
      }

      toast({ title: 'Staff member removed' });
      if (organisationId) fetchStaff(organisationId);
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message,
        variant: 'destructive',
      });
    }
  };

  const handlePermissionChange = (memberId: string, newPermission: StaffPermission, memberEmail: string) => {
    if (newPermission === 'full_access') {
      setPermissionWarning({ memberId, email: memberEmail });
    } else {
      updatePermission(memberId, newPermission);
    }
  };

  const updatePermission = async (memberId: string, newPermission: StaffPermission) => {
    try {
      const { error } = await supabase
        .from('organisation_members')
        .update({ permission_level: newPermission })
        .eq('id', memberId);

      if (error) throw error;

      toast({ title: 'Permission updated' });
      if (organisationId) fetchStaff(organisationId);
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message,
        variant: 'destructive',
      });
    }
  };

  const getPermissionBadge = (permission: StaffPermission) => {
    const variants: Record<StaffPermission, { label: string; className: string }> = {
      'checks_only': { label: 'Checks Only', className: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400' },
      'checks_maintenance': { label: 'Checks & Maint.', className: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400' },
      'full_access': { label: 'Full Access', className: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' },
    };
    const v = variants[permission];
    return <Badge className={v.className}>{v.label}</Badge>;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold flex items-center gap-2">
            <Users className="h-6 w-6 text-primary" />
            Staff Management
          </h2>
          <p className="text-muted-foreground">
            Invite and manage your team members
          </p>
        </div>
        <Button onClick={() => setInviteDialogOpen(true)}>
          <UserPlus className="h-4 w-4 mr-2" />
          Invite Staff
        </Button>
      </div>

      {/* Current Staff */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Team Members</CardTitle>
          <CardDescription>
            {staff.length === 0 
              ? 'No staff members yet. Invite someone to get started.'
              : `${staff.length} active staff member${staff.length === 1 ? '' : 's'}`
            }
          </CardDescription>
        </CardHeader>
        <CardContent>
          {staff.length === 0 ? (
            <div className="text-center py-8">
              <Users className="h-12 w-12 mx-auto text-muted-foreground/50 mb-4" />
              <p className="text-muted-foreground">No staff members yet</p>
              <Button 
                variant="outline" 
                className="mt-4"
                onClick={() => setInviteDialogOpen(true)}
              >
                <UserPlus className="h-4 w-4 mr-2" />
                Invite Your First Staff Member
              </Button>
            </div>
          ) : (
            <>
              {/* Desktop Table View */}
              <div className="hidden md:block overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Email</TableHead>
                    <TableHead>Permission</TableHead>
                    <TableHead>Equipment</TableHead>
                    <TableHead>Joined</TableHead>
                    <TableHead className="w-[100px]">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {staff.map((member) => (
                    <TableRow key={member.id}>
                      <TableCell className="font-medium">
                        {member.email || 'Unknown'}
                      </TableCell>
                      <TableCell>
                        <select
                          value={member.permission_level}
                          onChange={(e) =>
                            handlePermissionChange(
                              member.id,
                              e.target.value as StaffPermission,
                              member.email || 'this staff member',
                            )
                          }
                          className="h-10 w-[140px] rounded-md border border-input bg-background px-3 py-2 text-sm"
                        >
                          <option value="checks_only">Checks Only</option>
                          <option value="checks_maintenance">Checks & Maint.</option>
                          <option value="full_access">Full Access</option>
                        </select>
                      </TableCell>
                      <TableCell>
                        {member.assigned_rides.length === 0 ? (
                          <span className="text-muted-foreground text-sm">All equipment</span>
                        ) : (
                          <div className="flex flex-wrap gap-1">
                            {member.assigned_rides.slice(0, 2).map(r => (
                              <Badge key={r.id} variant="outline" className="text-xs">
                                {r.ride_name}
                              </Badge>
                            ))}
                            {member.assigned_rides.length > 2 && (
                              <Badge variant="outline" className="text-xs">
                                +{member.assigned_rides.length - 2}
                              </Badge>
                            )}
                          </div>
                        )}
                      </TableCell>
                      <TableCell className="text-muted-foreground text-sm">
                        {format(new Date(member.joined_at), 'MMM d, yyyy')}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => {
                              setSelectedMember(member);
                              setEquipmentDialogOpen(true);
                            }}
                            title="Manage equipment access"
                          >
                            <Settings2 className="h-4 w-4" />
                          </Button>
                           <Button
                             variant="ghost"
                             size="icon"
                             className="text-destructive hover:text-destructive"
                             onClick={() => {
                               setDeleteTarget(member);
                               setDeleteDialogOpen(true);
                             }}
                             title="Remove staff member"
                           >
                             <Trash2 className="h-4 w-4" />
                           </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>

            {/* Mobile Card View */}
            <div className="md:hidden space-y-3">
              {staff.map((member) => (
                <Card key={member.id} className="border-border/50">
                  <CardContent className="p-4 space-y-3">
                    {/* Email & Actions Row */}
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-sm truncate">{member.email || 'Unknown'}</p>
                        <p className="text-xs text-muted-foreground">
                          Joined {format(new Date(member.joined_at), 'MMM d, yyyy')}
                        </p>
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8"
                          onClick={() => {
                            setSelectedMember(member);
                            setEquipmentDialogOpen(true);
                          }}
                          title="Manage equipment access"
                        >
                          <Settings2 className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-destructive hover:text-destructive"
                          onClick={() => {
                            setDeleteTarget(member);
                            setDeleteDialogOpen(true);
                          }}
                          title="Remove staff member"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                    
                    {/* Permission & Equipment */}
                    <div className="flex flex-col gap-2">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-xs text-muted-foreground">Permission:</span>
                        <select
                          value={member.permission_level}
                          onChange={(e) =>
                            handlePermissionChange(
                              member.id,
                              e.target.value as StaffPermission,
                              member.email || 'this staff member',
                            )
                          }
                          className="h-8 w-[140px] rounded-md border border-input bg-background px-2 text-xs"
                        >
                          <option value="checks_only">Checks Only</option>
                          <option value="checks_maintenance">Checks & Maint.</option>
                          <option value="full_access">Full Access</option>
                        </select>
                      </div>
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-xs text-muted-foreground">Equipment:</span>
                        <div className="flex flex-wrap gap-1 justify-end">
                          {member.assigned_rides.length === 0 ? (
                            <span className="text-xs text-muted-foreground">All</span>
                          ) : (
                            <>
                              {member.assigned_rides.slice(0, 1).map(r => (
                                <Badge key={r.id} variant="outline" className="text-[10px] px-1.5 py-0 max-w-[100px] truncate">
                                  {r.ride_name}
                                </Badge>
                              ))}
                              {member.assigned_rides.length > 1 && (
                                <Badge variant="outline" className="text-[10px] px-1.5 py-0">
                                  +{member.assigned_rides.length - 1}
                                </Badge>
                              )}
                            </>
                          )}
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* Pending Invites */}
      {invites.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Mail className="h-5 w-5" />
              Pending Invitations
            </CardTitle>
            <CardDescription>
              Invitations waiting to be accepted
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {invites.map((invite) => (
                <div 
                  key={invite.id}
                  className="flex items-center justify-between p-3 bg-muted/50 rounded-lg"
                >
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                      <Mail className="h-5 w-5 text-primary" />
                    </div>
                    <div>
                      <p className="font-medium">{invite.email}</p>
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        {getPermissionBadge(invite.permission_level)}
                        <span className="flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          Expires {format(new Date(invite.expires_at), 'MMM d')}
                        </span>
                      </div>
                    </div>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-destructive hover:text-destructive"
                    onClick={() => cancelInvite(invite.id)}
                  >
                    Cancel
                  </Button>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Invite Dialog - only mount when open to prevent ref loops */}
      {inviteDialogOpen && (
        <StaffInviteDialog
          open={inviteDialogOpen}
          onOpenChange={setInviteDialogOpen}
          onSuccess={() => {
            if (organisationId) {
              fetchInvites(organisationId);
            }
          }}
        />
      )}

      {/* Equipment Assignment Dialog */}
      {selectedMember && equipmentDialogOpen && (
        <StaffEquipmentDialog
          open={equipmentDialogOpen}
          onOpenChange={setEquipmentDialogOpen}
          memberId={selectedMember.id}
          memberEmail={selectedMember.email || 'Staff member'}
          currentAssignments={selectedMember.assigned_rides.map(r => r.id)}
          onSuccess={() => {
            if (organisationId) {
              fetchStaff(organisationId);
            }
          }}
        />
      )}

      {/* Full Access Warning Dialog - only mount when needed */}
      {permissionWarning && (
        <AlertDialog open onOpenChange={(open) => !open && setPermissionWarning(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle className="flex items-center gap-2 text-amber-600">
                <Settings2 className="h-5 w-5" />
                Grant Full Access?
              </AlertDialogTitle>
              <AlertDialogDescription className="space-y-2">
                <p>
                  You are about to grant <strong>Full Access</strong> to {permissionWarning.email}.
                </p>
                <p className="text-amber-600 font-medium">
                  This will allow them to view and manage:
                </p>
                <ul className="list-disc list-inside text-sm space-y-1 ml-2">
                  <li>All checks and inspections</li>
                  <li>Maintenance records</li>
                  <li>Documents and certificates</li>
                  <li>Risk assessments</li>
                </ul>
                <p className="text-sm text-muted-foreground mt-2">
                  Only grant this level of access to trusted team members.
                </p>
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction
                onClick={() => {
                  updatePermission(permissionWarning.memberId, 'full_access');
                  setPermissionWarning(null);
                }}
                className="bg-amber-600 hover:bg-amber-700"
              >
                Yes, Grant Full Access
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      )}

      {/* Remove Staff Dialog - single instance to avoid Radix ref loops */}
      {deleteTarget && (
        <AlertDialog
          open={deleteDialogOpen}
          onOpenChange={(open) => {
            setDeleteDialogOpen(open);
            if (!open) setDeleteTarget(null);
          }}
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
