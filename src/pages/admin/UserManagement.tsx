import { useState, useEffect } from 'react';
import { AdminLayout } from '@/components/admin/AdminLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Loader2, Users, Search, Shield, ShieldOff, Calendar, Building, Ban, CheckCircle } from 'lucide-react';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { format } from 'date-fns';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';

interface UserWithProfile {
  id: string;
  email: string;
  created_at: string;
  profile: {
    company_name: string | null;
    subscription_status: string | null;
    subscription_plan: string | null;
    trial_ends_at: string | null;
    country: string | null;
    is_suspended: boolean;
    suspended_at: string | null;
    suspended_reason: string | null;
  } | null;
  isAdmin: boolean;
}

export default function UserManagement() {
  const [users, setUsers] = useState<UserWithProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [updatingUserId, setUpdatingUserId] = useState<string | null>(null);
  const [suspendingUserId, setSuspendingUserId] = useState<string | null>(null);
  const [suspendReason, setSuspendReason] = useState('');
  const [showSuspendDialog, setShowSuspendDialog] = useState<string | null>(null);
  useEffect(() => {
    fetchUsers();
  }, []);

  const fetchUsers = async () => {
    try {
      // Fetch profiles (which contain user_id)
      const { data: profiles, error: profilesError } = await supabase
        .from('profiles')
        .select('*')
        .order('created_at', { ascending: false });

      if (profilesError) throw profilesError;

      // Fetch admin roles
      const { data: adminRoles, error: rolesError } = await supabase
        .from('user_roles')
        .select('user_id')
        .eq('role', 'admin');

      if (rolesError) throw rolesError;

      const adminUserIds = new Set(adminRoles?.map(r => r.user_id) || []);

      // Map profiles to user format
      const usersData: UserWithProfile[] = (profiles || []).map(profile => ({
        id: profile.user_id,
        email: '', // We'll need to get this from auth.users via edge function if needed
        created_at: profile.created_at,
        profile: {
          company_name: profile.company_name,
          subscription_status: profile.subscription_status,
          subscription_plan: profile.subscription_plan,
          trial_ends_at: profile.trial_ends_at,
          country: profile.country,
          is_suspended: profile.is_suspended ?? false,
          suspended_at: profile.suspended_at,
          suspended_reason: profile.suspended_reason,
        },
        isAdmin: adminUserIds.has(profile.user_id),
      }));

      setUsers(usersData);
    } catch (error: any) {
      console.error('Error fetching users:', error);
      toast.error('Failed to load users');
    } finally {
      setLoading(false);
    }
  };

  const toggleAdminRole = async (userId: string, currentlyAdmin: boolean) => {
    setUpdatingUserId(userId);

    try {
      if (currentlyAdmin) {
        // Remove admin role
        const { error } = await supabase
          .from('user_roles')
          .delete()
          .eq('user_id', userId)
          .eq('role', 'admin');

        if (error) throw error;
        toast.success('Admin role removed');
      } else {
        // Add admin role
        const { error } = await supabase
          .from('user_roles')
          .insert({ user_id: userId, role: 'admin' });

        if (error) throw error;
        toast.success('Admin role granted');
      }

      fetchUsers();
    } catch (error: any) {
      console.error('Error updating role:', error);
      toast.error('Failed to update role');
    } finally {
      setUpdatingUserId(null);
    }
  };

  const getStatusBadge = (status: string | null, isSuspended: boolean) => {
    if (isSuspended) {
      return <Badge variant="destructive"><Ban className="h-3 w-3 mr-1" />Suspended</Badge>;
    }
    switch (status) {
      case 'active':
        return <Badge className="bg-green-500">Active</Badge>;
      case 'trial':
        return <Badge className="bg-blue-500">Trial</Badge>;
      case 'expired':
        return <Badge variant="destructive">Expired</Badge>;
      case 'cancelled':
        return <Badge variant="outline">Cancelled</Badge>;
      default:
        return <Badge variant="outline">{status || 'Unknown'}</Badge>;
    }
  };

  const toggleSuspension = async (userId: string, currentlySuspended: boolean) => {
    setSuspendingUserId(userId);

    // Find user info for email
    const targetUser = users.find(u => u.id === userId);

    try {
      // Get user email first
      const { data: emailData } = await supabase.functions.invoke('get-user-email', {
        body: { userId }
      });

      if (currentlySuspended) {
        // Reactivate user
        const { error } = await supabase
          .from('profiles')
          .update({
            is_suspended: false,
            suspended_at: null,
            suspended_reason: null,
          })
          .eq('user_id', userId);

        if (error) throw error;

        // Send reactivation email
        if (emailData?.email) {
          supabase.functions.invoke('send-suspension-email', {
            body: {
              email: emailData.email,
              companyName: targetUser?.profile?.company_name,
              isSuspended: false,
            }
          }).catch(e => console.error('Failed to send reactivation email:', e));
        }

        toast.success('User account reactivated');
      } else {
        // Suspend user
        const { error } = await supabase
          .from('profiles')
          .update({
            is_suspended: true,
            suspended_at: new Date().toISOString(),
            suspended_reason: suspendReason || null,
          })
          .eq('user_id', userId);

        if (error) throw error;

        // Send suspension email
        if (emailData?.email) {
          supabase.functions.invoke('send-suspension-email', {
            body: {
              email: emailData.email,
              companyName: targetUser?.profile?.company_name,
              isSuspended: true,
              reason: suspendReason || undefined,
            }
          }).catch(e => console.error('Failed to send suspension email:', e));
        }

        toast.success('User account suspended');
      }

      setShowSuspendDialog(null);
      setSuspendReason('');
      fetchUsers();
    } catch (error: any) {
      console.error('Error updating suspension:', error);
      toast.error('Failed to update account status');
    } finally {
      setSuspendingUserId(null);
    }
  };

  const filteredUsers = users.filter(user => {
    const searchLower = searchQuery.toLowerCase();
    return (
      user.id.toLowerCase().includes(searchLower) ||
      user.profile?.company_name?.toLowerCase().includes(searchLower) ||
      user.profile?.country?.toLowerCase().includes(searchLower)
    );
  });

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
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">User Management</h1>
            <p className="text-muted-foreground mt-1">
              Manage user accounts and admin roles
            </p>
          </div>
          <Users className="h-8 w-8 text-muted-foreground" />
        </div>

        {/* Stats Cards */}
        <div className="grid gap-4 md:grid-cols-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Total Users
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{users.length}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Active Subscriptions
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {users.filter(u => u.profile?.subscription_status === 'active').length}
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Admin Users
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {users.filter(u => u.isAdmin).length}
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Suspended Users
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-destructive">
                {users.filter(u => u.profile?.is_suspended).length}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search by company name, country, or user ID..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
          />
        </div>

        {/* Users Table */}
        <Card>
          <CardHeader>
            <CardTitle>All Users</CardTitle>
            <CardDescription>
              {filteredUsers.length} user{filteredUsers.length !== 1 ? 's' : ''} found
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Company</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Plan</TableHead>
                  <TableHead>Country</TableHead>
                  <TableHead>Joined</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredUsers.map((user) => (
                  <TableRow key={user.id}>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Building className="h-4 w-4 text-muted-foreground" />
                        <span className="font-medium">
                          {user.profile?.company_name || 'No company'}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell>
                      {getStatusBadge(user.profile?.subscription_status, user.profile?.is_suspended ?? false)}
                    </TableCell>
                    <TableCell>
                      <span className="capitalize">
                        {user.profile?.subscription_plan || '-'}
                      </span>
                    </TableCell>
                    <TableCell>
                      {user.profile?.country || '-'}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1 text-sm text-muted-foreground">
                        <Calendar className="h-3 w-3" />
                        {format(new Date(user.created_at), 'MMM d, yyyy')}
                      </div>
                    </TableCell>
                    <TableCell>
                      {user.isAdmin ? (
                        <Badge className="bg-primary">
                          <Shield className="h-3 w-3 mr-1" />
                          Admin
                        </Badge>
                      ) : (
                        <Badge variant="outline">User</Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-2">
                        {/* Suspend/Reactivate Button */}
                        <AlertDialog open={showSuspendDialog === user.id} onOpenChange={(open) => {
                          if (!open) {
                            setShowSuspendDialog(null);
                            setSuspendReason('');
                          }
                        }}>
                          <AlertDialogTrigger asChild>
                            <Button
                              variant={user.profile?.is_suspended ? 'default' : 'outline'}
                              size="sm"
                              disabled={suspendingUserId === user.id}
                              onClick={() => setShowSuspendDialog(user.id)}
                            >
                              {suspendingUserId === user.id ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                              ) : user.profile?.is_suspended ? (
                                <>
                                  <CheckCircle className="h-4 w-4 mr-1" />
                                  Reactivate
                                </>
                              ) : (
                                <>
                                  <Ban className="h-4 w-4 mr-1" />
                                  Suspend
                                </>
                              )}
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>
                                {user.profile?.is_suspended ? 'Reactivate User Account?' : 'Suspend User Account?'}
                              </AlertDialogTitle>
                              <AlertDialogDescription>
                                {user.profile?.is_suspended
                                  ? 'This will restore the user\'s access to their account.'
                                  : 'This will prevent the user from accessing their account.'}
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            {!user.profile?.is_suspended && (
                              <div className="space-y-2">
                                <Label htmlFor="suspend-reason">Reason (optional)</Label>
                                <Textarea
                                  id="suspend-reason"
                                  placeholder="Enter reason for suspension..."
                                  value={suspendReason}
                                  onChange={(e) => setSuspendReason(e.target.value)}
                                />
                              </div>
                            )}
                            {user.profile?.is_suspended && user.profile?.suspended_reason && (
                              <div className="text-sm text-muted-foreground bg-muted p-3 rounded-md">
                                <strong>Suspension reason:</strong> {user.profile.suspended_reason}
                              </div>
                            )}
                            <AlertDialogFooter>
                              <AlertDialogCancel>Cancel</AlertDialogCancel>
                              <AlertDialogAction
                                onClick={() => toggleSuspension(user.id, user.profile?.is_suspended ?? false)}
                              >
                                {user.profile?.is_suspended ? 'Reactivate' : 'Suspend'}
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>

                        {/* Admin Role Button */}
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button
                              variant={user.isAdmin ? 'outline' : 'secondary'}
                              size="sm"
                              disabled={updatingUserId === user.id}
                            >
                              {updatingUserId === user.id ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                              ) : user.isAdmin ? (
                                <>
                                  <ShieldOff className="h-4 w-4 mr-1" />
                                  Remove Admin
                                </>
                              ) : (
                                <>
                                  <Shield className="h-4 w-4 mr-1" />
                                  Make Admin
                                </>
                              )}
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>
                                {user.isAdmin ? 'Remove Admin Access?' : 'Grant Admin Access?'}
                              </AlertDialogTitle>
                              <AlertDialogDescription>
                                {user.isAdmin
                                  ? 'This user will lose access to the admin dashboard and management features.'
                                  : 'This user will gain full admin access including user management and system settings.'}
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Cancel</AlertDialogCancel>
                              <AlertDialogAction
                                onClick={() => toggleAdminRole(user.id, user.isAdmin)}
                              >
                                {user.isAdmin ? 'Remove Admin' : 'Grant Admin'}
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>

            {filteredUsers.length === 0 && (
              <div className="text-center py-8 text-muted-foreground">
                No users found matching your search.
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </AdminLayout>
  );
}