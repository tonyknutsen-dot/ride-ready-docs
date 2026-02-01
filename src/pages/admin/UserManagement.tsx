import { useState, useEffect } from 'react';
import { AdminLayout } from '@/components/admin/AdminLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Loader2, Users, Search, Shield, ShieldOff, Calendar, Building, Ban, CheckCircle, FlaskConical, Clock, Plus, UserMinus, UserX, History, ArrowRight } from 'lucide-react';
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
import { TesterInviteDialog } from '@/components/admin/TesterInviteDialog';

interface UserWithProfile {
  id: string;
  email: string;
  name: string | null;
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
  isTester: boolean;
  testerExpiresAt: string | null;
}

interface RoleChangeAudit {
  id: string;
  user_id: string;
  changed_by: string;
  previous_role: string;
  new_role: string;
  reason: string | null;
  changed_at: string;
  // Joined data
  user_company?: string | null;
  changed_by_company?: string | null;
}

interface TesterTimeData {
  user_id: string;
  company_name: string | null;
  total_minutes: number;
  session_count: number;
  last_session: string | null;
}

export default function UserManagement() {
  const [users, setUsers] = useState<UserWithProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [updatingUserId, setUpdatingUserId] = useState<string | null>(null);
  const [updatingTesterUserId, setUpdatingTesterUserId] = useState<string | null>(null);
  const [suspendingUserId, setSuspendingUserId] = useState<string | null>(null);
  const [suspendReason, setSuspendReason] = useState('');
  const [showSuspendDialog, setShowSuspendDialog] = useState<string | null>(null);
  const [showTesterDialog, setShowTesterDialog] = useState<string | null>(null);
  const [testerExpiryDays, setTesterExpiryDays] = useState<string>('30');
  const [offboardReason, setOffboardReason] = useState('');
  const [auditLog, setAuditLog] = useState<RoleChangeAudit[]>([]);
  const [auditLoading, setAuditLoading] = useState(false);
  const [showAuditLog, setShowAuditLog] = useState(false);
  const [testerTimeData, setTesterTimeData] = useState<TesterTimeData[]>([]);
  const [timeTrackingLoading, setTimeTrackingLoading] = useState(false);
  const [showTimeTracking, setShowTimeTracking] = useState(false);
  const [selectedMonth, setSelectedMonth] = useState<string>(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  });

  useEffect(() => {
    fetchUsers();
  }, []);

  useEffect(() => {
    if (showAuditLog) {
      fetchAuditLog();
    }
  }, [showAuditLog]);

  useEffect(() => {
    if (showTimeTracking) {
      fetchTesterTimeData();
    }
  }, [showTimeTracking, selectedMonth]);

  const getMonthDateRange = (monthStr: string) => {
    const [year, month] = monthStr.split('-').map(Number);
    const startDate = new Date(year, month - 1, 1);
    const endDate = new Date(year, month, 0, 23, 59, 59, 999);
    return { startDate, endDate };
  };

  const getAvailableMonths = (): string[] => {
    const months: string[] = [];
    const now = new Date();
    // Show last 12 months
    for (let i = 0; i < 12; i++) {
      const date = new Date(now.getFullYear(), now.getMonth() - i, 1);
      months.push(`${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`);
    }
    return months;
  };

  const formatMonthLabel = (monthStr: string): string => {
    const [year, month] = monthStr.split('-').map(Number);
    const date = new Date(year, month - 1, 1);
    return date.toLocaleDateString('en-GB', { month: 'long', year: 'numeric' });
  };

  const fetchTesterTimeData = async () => {
    setTimeTrackingLoading(true);
    try {
      const { startDate, endDate } = getMonthDateRange(selectedMonth);

      // Get tester sessions for selected month
      const { data: sessions, error } = await supabase
        .from('tester_sessions')
        .select('user_id, duration_minutes, session_start')
        .gte('session_start', startDate.toISOString())
        .lte('session_start', endDate.toISOString())
        .order('session_start', { ascending: false });

      if (error) throw error;

      // Get unique user IDs
      const userIds = [...new Set((sessions || []).map(s => s.user_id))];

      // Get profiles for these users
      const { data: profiles } = await supabase
        .from('profiles')
        .select('user_id, company_name')
        .in('user_id', userIds);

      const profileMap = new Map(profiles?.map(p => [p.user_id, p.company_name]) || []);

      // Aggregate by user
      const userTimeMap = new Map<string, { total: number; count: number; lastSession: string | null }>();
      
      for (const session of sessions || []) {
        const existing = userTimeMap.get(session.user_id) || { total: 0, count: 0, lastSession: null };
        userTimeMap.set(session.user_id, {
          total: existing.total + (session.duration_minutes || 0),
          count: existing.count + 1,
          lastSession: existing.lastSession || session.session_start,
        });
      }

      const timeData: TesterTimeData[] = Array.from(userTimeMap.entries()).map(([userId, data]) => ({
        user_id: userId,
        company_name: profileMap.get(userId) || null,
        total_minutes: data.total,
        session_count: data.count,
        last_session: data.lastSession,
      }));

      // Sort by total time descending
      timeData.sort((a, b) => b.total_minutes - a.total_minutes);

      setTesterTimeData(timeData);
    } catch (error: any) {
      console.error('Error fetching tester time data:', error);
      toast.error('Failed to load time tracking data');
    } finally {
      setTimeTrackingLoading(false);
    }
  };

  const formatDuration = (minutes: number): string => {
    if (minutes < 60) return `${minutes}m`;
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    if (hours < 24) return `${hours}h ${mins}m`;
    const days = Math.floor(hours / 24);
    const remainingHours = hours % 24;
    return `${days}d ${remainingHours}h`;
  };

  const fetchAuditLog = async () => {
    setAuditLoading(true);
    try {
      const { data, error } = await supabase
        .from('role_change_audit')
        .select('*')
        .order('changed_at', { ascending: false })
        .limit(50);

      if (error) throw error;

      // Get company names for user_ids and changed_by
      const userIds = new Set([
        ...(data || []).map(a => a.user_id),
        ...(data || []).map(a => a.changed_by)
      ]);

      const { data: profiles } = await supabase
        .from('profiles')
        .select('user_id, company_name')
        .in('user_id', Array.from(userIds));

      const profileMap = new Map(profiles?.map(p => [p.user_id, p.company_name]) || []);

      const enrichedData = (data || []).map(audit => ({
        ...audit,
        user_company: profileMap.get(audit.user_id) || null,
        changed_by_company: profileMap.get(audit.changed_by) || null,
      }));

      setAuditLog(enrichedData);
    } catch (error: any) {
      console.error('Error fetching audit log:', error);
      toast.error('Failed to load audit log');
    } finally {
      setAuditLoading(false);
    }
  };

  const fetchUsers = async () => {
    try {
      // Fetch profiles (which contain user_id)
      const { data: profiles, error: profilesError } = await supabase
        .from('profiles')
        .select('*')
        .order('created_at', { ascending: false });

      if (profilesError) throw profilesError;

      // Fetch admin and tester roles with expiry
      const { data: userRoles, error: rolesError } = await supabase
        .from('user_roles')
        .select('user_id, role, expires_at')
        .in('role', ['admin', 'tester']);

      if (rolesError) throw rolesError;

      // Fetch user emails and names from edge function
      const { data: authData, error: authError } = await supabase.functions.invoke('get-users-admin');
      
      const userEmailMap = new Map<string, { email: string; name: string | null }>();
      if (!authError && authData?.users) {
        for (const u of authData.users) {
          userEmailMap.set(u.id, { email: u.email, name: u.name });
        }
      }

      const adminUserIds = new Set(userRoles?.filter(r => r.role === 'admin').map(r => r.user_id) || []);
      const testerRoles = new Map(
        userRoles?.filter(r => r.role === 'tester').map(r => [r.user_id, r.expires_at]) || []
      );

      // Map profiles to user format
      const usersData: UserWithProfile[] = (profiles || []).map(profile => {
        const testerExpiresAt = testerRoles.get(profile.user_id) || null;
        const isTesterExpired = testerExpiresAt ? new Date(testerExpiresAt) < new Date() : false;
        const authInfo = userEmailMap.get(profile.user_id);
        
        return {
          id: profile.user_id,
          email: authInfo?.email || '',
          name: authInfo?.name || null,
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
          isTester: testerRoles.has(profile.user_id) && !isTesterExpired,
          testerExpiresAt: testerExpiresAt,
        };
      });

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

  const offboardTester = async (userId: string, newRole: 'user' | 'disabled', reason?: string) => {
    setUpdatingTesterUserId(userId);

    try {
      // Get current user for changed_by
      const { data: { user: currentUser } } = await supabase.auth.getUser();
      if (!currentUser) throw new Error('Not authenticated');

      // Remove tester role
      const { error: deleteError } = await supabase
        .from('user_roles')
        .delete()
        .eq('user_id', userId)
        .eq('role', 'tester');

      if (deleteError) throw deleteError;

      // Log the role change for audit
      const { error: auditError } = await supabase
        .from('role_change_audit')
        .insert({
          user_id: userId,
          changed_by: currentUser.id,
          previous_role: 'tester',
          new_role: newRole,
          reason: reason || null,
        });

      if (auditError) {
        console.error('Failed to log role change:', auditError);
        // Don't throw - the role change succeeded
      }

      // If disabled, also suspend the account
      if (newRole === 'disabled') {
        const { error: suspendError } = await supabase
          .from('profiles')
          .update({
            is_suspended: true,
            suspended_at: new Date().toISOString(),
            suspended_reason: reason || 'Tester access ended',
          })
          .eq('user_id', userId);

        if (suspendError) {
          console.error('Failed to suspend account:', suspendError);
        }
      }

      toast.success(newRole === 'disabled' 
        ? 'Tester off-boarded and account disabled' 
        : 'Tester converted to regular user');
      
      setShowTesterDialog(null);
      setTesterExpiryDays('30');
      setOffboardReason('');
      fetchUsers();
    } catch (error: any) {
      console.error('Error off-boarding tester:', error);
      toast.error('Failed to off-board tester');
    } finally {
      setUpdatingTesterUserId(null);
    }
  };

  const toggleTesterRole = async (userId: string, currentlyTester: boolean, expiryDays?: number) => {
    setUpdatingTesterUserId(userId);

    try {
      // Get current user for changed_by
      const { data: { user: currentUser } } = await supabase.auth.getUser();
      if (!currentUser) throw new Error('Not authenticated');

      if (currentlyTester) {
        // Use offboardTester for removal
        await offboardTester(userId, 'user');
        return;
      } else {
        // Calculate expiry date if provided
        const expiresAt = expiryDays && expiryDays > 0 
          ? new Date(Date.now() + expiryDays * 24 * 60 * 60 * 1000).toISOString()
          : null;

        // Add tester role with optional expiry
        const { error } = await supabase
          .from('user_roles')
          .insert({ 
            user_id: userId, 
            role: 'tester',
            expires_at: expiresAt
          });

        if (error) throw error;

        // Log the role change for audit
        await supabase
          .from('role_change_audit')
          .insert({
            user_id: userId,
            changed_by: currentUser.id,
            previous_role: 'user',
            new_role: 'tester',
            reason: expiresAt ? `Granted for ${expiryDays} days` : 'Granted permanently',
          });

        toast.success(expiresAt 
          ? `Tester role granted (expires in ${expiryDays} days)` 
          : 'Tester role granted (no expiry)');
      }

      setShowTesterDialog(null);
      setTesterExpiryDays('30');
      fetchUsers();
    } catch (error: any) {
      console.error('Error updating tester role:', error);
      toast.error('Failed to update role');
    } finally {
      setUpdatingTesterUserId(null);
    }
  };

  const extendTesterExpiry = async (userId: string, additionalDays: number) => {
    setUpdatingTesterUserId(userId);

    try {
      const user = users.find(u => u.id === userId);
      const currentExpiry = user?.testerExpiresAt ? new Date(user.testerExpiresAt) : new Date();
      const baseDate = currentExpiry > new Date() ? currentExpiry : new Date();
      const newExpiry = new Date(baseDate.getTime() + additionalDays * 24 * 60 * 60 * 1000);

      const { error } = await supabase
        .from('user_roles')
        .update({ expires_at: newExpiry.toISOString() })
        .eq('user_id', userId)
        .eq('role', 'tester');

      if (error) throw error;
      toast.success(`Tester expiry extended by ${additionalDays} days`);
      fetchUsers();
    } catch (error: any) {
      console.error('Error extending tester expiry:', error);
      toast.error('Failed to extend expiry');
    } finally {
      setUpdatingTesterUserId(null);
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
      user.email.toLowerCase().includes(searchLower) ||
      user.name?.toLowerCase().includes(searchLower) ||
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
              Manage user accounts and roles
            </p>
          </div>
          <div className="flex items-center gap-3">
            <TesterInviteDialog onInviteSent={fetchUsers} />
            <Users className="h-8 w-8 text-muted-foreground" />
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
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
              <CardTitle className="text-xs sm:text-sm font-medium text-muted-foreground leading-tight">
                Active Subs
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
                Testers
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-warning-foreground">
                {users.filter(u => u.isTester).length}
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
            placeholder="Search by name, email, company, country, or user ID..."
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
                  <TableHead>User</TableHead>
                  <TableHead className="hidden md:table-cell">Company</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="hidden sm:table-cell">Plan</TableHead>
                  <TableHead className="hidden lg:table-cell">Country</TableHead>
                  <TableHead className="hidden sm:table-cell">Joined</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredUsers.map((user) => (
                  <TableRow key={user.id}>
                    <TableCell>
                      <div className="min-w-0">
                        <div className="font-medium truncate">
                          {user.name || user.email?.split('@')[0] || 'Unknown'}
                        </div>
                        <div className="text-xs text-muted-foreground truncate">
                          {user.email || 'No email'}
                        </div>
                        {/* Show company on mobile within this cell */}
                        <div className="md:hidden flex items-center gap-1 text-xs text-muted-foreground mt-1">
                          <Building className="h-3 w-3 shrink-0" />
                          <span className="truncate">{user.profile?.company_name || 'No company'}</span>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="hidden md:table-cell">
                      <div className="flex items-center gap-2">
                        <Building className="h-4 w-4 text-muted-foreground shrink-0" />
                        <span className="font-medium truncate">
                          {user.profile?.company_name || 'No company'}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell>
                      {getStatusBadge(user.profile?.subscription_status, user.profile?.is_suspended ?? false)}
                    </TableCell>
                    <TableCell className="hidden sm:table-cell">
                      <span className="capitalize">
                        {user.profile?.subscription_plan || '-'}
                      </span>
                    </TableCell>
                    <TableCell className="hidden lg:table-cell">
                      {user.profile?.country || '-'}
                    </TableCell>
                    <TableCell className="hidden sm:table-cell">
                      <div className="flex items-center gap-1 text-sm text-muted-foreground">
                        <Calendar className="h-3 w-3" />
                        {format(new Date(user.created_at), 'MMM d, yyyy')}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-col gap-1">
                        {user.isAdmin ? (
                          <Badge className="bg-primary w-fit">
                            <Shield className="h-3 w-3 mr-1" />
                            Admin
                          </Badge>
                        ) : user.isTester ? (
                          <div className="space-y-1">
                            <Badge className="bg-warning text-warning-foreground w-fit">
                              <FlaskConical className="h-3 w-3 mr-1" />
                              Tester
                            </Badge>
                            {user.testerExpiresAt && (
                              <div className="flex items-center gap-1 text-xs text-muted-foreground">
                                <Clock className="h-3 w-3" />
                                {new Date(user.testerExpiresAt) < new Date() ? (
                                  <span className="text-destructive">Expired</span>
                                ) : (
                                  <span>Expires {format(new Date(user.testerExpiresAt), 'MMM d, yyyy')}</span>
                                )}
                              </div>
                            )}
                          </div>
                        ) : (
                          <Badge variant="outline" className="w-fit">User</Badge>
                        )}
                      </div>
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

                        {/* Tester Role Button - only show if not admin */}
                        {!user.isAdmin && (
                          <AlertDialog open={showTesterDialog === user.id} onOpenChange={(open) => {
                            if (!open) {
                              setShowTesterDialog(null);
                              setTesterExpiryDays('30');
                            }
                          }}>
                            <AlertDialogTrigger asChild>
                              <Button
                                variant={user.isTester ? 'outline' : 'secondary'}
                                size="sm"
                                disabled={updatingTesterUserId === user.id}
                                className={user.isTester ? 'border-warning text-warning-foreground hover:bg-warning/10' : ''}
                                onClick={() => setShowTesterDialog(user.id)}
                              >
                                {updatingTesterUserId === user.id ? (
                                  <Loader2 className="h-4 w-4 animate-spin" />
                                ) : user.isTester ? (
                                  <>
                                    <FlaskConical className="h-4 w-4 mr-1" />
                                    Manage Tester
                                  </>
                                ) : (
                                  <>
                                    <FlaskConical className="h-4 w-4 mr-1" />
                                    Make Tester
                                  </>
                                )}
                              </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle className="flex items-center gap-2">
                                  <FlaskConical className="h-5 w-5 text-warning" />
                                  {user.isTester ? 'Manage Tester Role' : 'Grant Tester Role'}
                                </AlertDialogTitle>
                                <AlertDialogDescription asChild>
                                  <div className="space-y-4">
                                    {user.isTester ? (
                                      <>
                                        <p>
                                          This user currently has the tester role.
                                          {user.testerExpiresAt && (
                                            <span className="block mt-1 font-medium">
                                              Expires: {format(new Date(user.testerExpiresAt), 'MMM d, yyyy h:mm a')}
                                              {new Date(user.testerExpiresAt) < new Date() && (
                                                <Badge variant="destructive" className="ml-2">Expired</Badge>
                                              )}
                                            </span>
                                          )}
                                        </p>
                                        <div className="space-y-2">
                                          <Label>Extend Access</Label>
                                          <div className="flex gap-2">
                                            <Button 
                                              size="sm" 
                                              variant="outline"
                                              onClick={() => extendTesterExpiry(user.id, 7)}
                                              disabled={updatingTesterUserId === user.id}
                                            >
                                              +7 days
                                            </Button>
                                            <Button 
                                              size="sm" 
                                              variant="outline"
                                              onClick={() => extendTesterExpiry(user.id, 30)}
                                              disabled={updatingTesterUserId === user.id}
                                            >
                                              +30 days
                                            </Button>
                                            <Button 
                                              size="sm" 
                                              variant="outline"
                                              onClick={() => extendTesterExpiry(user.id, 90)}
                                              disabled={updatingTesterUserId === user.id}
                                            >
                                              +90 days
                                            </Button>
                                          </div>
                                        </div>
                                        
                                        <hr className="my-4 border-border" />
                                        
                                        <div className="space-y-3">
                                          <Label className="text-destructive">Off-board Tester</Label>
                                          <div className="space-y-2">
                                            <Label htmlFor="offboard-reason" className="text-sm text-muted-foreground">Reason (optional)</Label>
                                            <Input
                                              id="offboard-reason"
                                              placeholder="e.g., Testing period complete"
                                              value={offboardReason}
                                              onChange={(e) => setOffboardReason(e.target.value)}
                                            />
                                          </div>
                                          <div className="flex gap-2">
                                            <Button
                                              size="sm"
                                              variant="outline"
                                              onClick={() => offboardTester(user.id, 'user', offboardReason)}
                                              disabled={updatingTesterUserId === user.id}
                                              className="flex-1"
                                            >
                                              <UserMinus className="h-4 w-4 mr-1" />
                                              Convert to User
                                            </Button>
                                            <Button
                                              size="sm"
                                              variant="destructive"
                                              onClick={() => offboardTester(user.id, 'disabled', offboardReason)}
                                              disabled={updatingTesterUserId === user.id}
                                              className="flex-1"
                                            >
                                              <UserX className="h-4 w-4 mr-1" />
                                              Disable Account
                                            </Button>
                                          </div>
                                          <p className="text-xs text-muted-foreground">
                                            <strong>Convert to User:</strong> Removes tester access, keeps account active.<br/>
                                            <strong>Disable Account:</strong> Removes tester access and suspends account.
                                          </p>
                                        </div>
                                      </>
                                    ) : (
                                      <>
                                        <p>
                                          This user will see a "TEST MODE" banner and have access to all paid features without billing.
                                        </p>
                                        <div className="space-y-2">
                                          <Label htmlFor="tester-expiry">Access Duration</Label>
                                          <div className="flex gap-2">
                                            <Input
                                              id="tester-expiry"
                                              type="number"
                                              min="0"
                                              value={testerExpiryDays}
                                              onChange={(e) => setTesterExpiryDays(e.target.value)}
                                              className="w-24"
                                            />
                                            <span className="self-center text-sm text-muted-foreground">days</span>
                                          </div>
                                          <p className="text-xs text-muted-foreground">
                                            Set to 0 for no expiry (permanent tester).
                                          </p>
                                        </div>
                                      </>
                                    )}
                                  </div>
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>Cancel</AlertDialogCancel>
                                {user.isTester ? (
                                  <AlertDialogAction
                                    onClick={() => toggleTesterRole(user.id, true)}
                                    className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                  >
                                    Remove Tester Role
                                  </AlertDialogAction>
                                ) : (
                                  <AlertDialogAction
                                    onClick={() => toggleTesterRole(user.id, false, parseInt(testerExpiryDays) || 0)}
                                  >
                                    Grant Tester Role
                                  </AlertDialogAction>
                                )}
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        )}
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

        {/* Tester Time Tracking */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Clock className="h-5 w-5 text-muted-foreground" />
                <div>
                  <CardTitle>Tester Time Tracking</CardTitle>
                  <CardDescription>Track tester usage time for billing purposes</CardDescription>
                </div>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowTimeTracking(!showTimeTracking)}
              >
                {showTimeTracking ? 'Hide' : 'Show'} Time Data
              </Button>
            </div>
          </CardHeader>
          {showTimeTracking && (
            <CardContent>
              {/* Month Selector */}
              <div className="flex items-center gap-4 mb-4">
                <Label htmlFor="month-select" className="text-sm font-medium">Billing Period:</Label>
                <select
                  id="month-select"
                  value={selectedMonth}
                  onChange={(e) => setSelectedMonth(e.target.value)}
                  className="px-3 py-2 border border-input rounded-md bg-background text-sm"
                >
                  {getAvailableMonths().map((month) => (
                    <option key={month} value={month}>
                      {formatMonthLabel(month)}
                    </option>
                  ))}
                </select>
              </div>

              {timeTrackingLoading ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                </div>
              ) : testerTimeData.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  No tester sessions recorded for {formatMonthLabel(selectedMonth)}.
                </div>
              ) : (
                <>
                  <div className="mb-4 p-4 bg-muted rounded-lg">
                    <div className="text-center mb-2">
                      <Badge variant="outline" className="text-base px-3 py-1">
                        {formatMonthLabel(selectedMonth)}
                      </Badge>
                    </div>
                    <div className="grid grid-cols-3 gap-4 text-center">
                      <div>
                        <div className="text-2xl font-bold">
                          {formatDuration(testerTimeData.reduce((sum, t) => sum + t.total_minutes, 0))}
                        </div>
                        <div className="text-sm text-muted-foreground">Total Time</div>
                      </div>
                      <div>
                        <div className="text-2xl font-bold">{testerTimeData.length}</div>
                        <div className="text-sm text-muted-foreground">Testers</div>
                      </div>
                      <div>
                        <div className="text-2xl font-bold">
                          {testerTimeData.reduce((sum, t) => sum + t.session_count, 0)}
                        </div>
                        <div className="text-sm text-muted-foreground">Sessions</div>
                      </div>
                    </div>
                  </div>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Tester</TableHead>
                        <TableHead>Total Time</TableHead>
                        <TableHead>Sessions</TableHead>
                        <TableHead>Last Active</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {testerTimeData.map((tester) => (
                        <TableRow key={tester.user_id}>
                          <TableCell>
                            <div className="font-medium">
                              {tester.company_name || 'Unknown'}
                            </div>
                            <div className="text-xs text-muted-foreground truncate max-w-[150px]">
                              {tester.user_id.slice(0, 8)}...
                            </div>
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline" className="font-mono">
                              {formatDuration(tester.total_minutes)}
                            </Badge>
                          </TableCell>
                          <TableCell>{tester.session_count}</TableCell>
                          <TableCell className="text-sm text-muted-foreground">
                            {tester.last_session 
                              ? format(new Date(tester.last_session), 'MMM d, yyyy h:mm a')
                              : '-'}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </>
              )}
            </CardContent>
          )}
        </Card>

        {/* Role Change Audit Log */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <History className="h-5 w-5 text-muted-foreground" />
                <div>
                  <CardTitle>Role Change Audit Log</CardTitle>
                  <CardDescription>History of role changes for debugging and compliance</CardDescription>
                </div>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowAuditLog(!showAuditLog)}
              >
                {showAuditLog ? 'Hide' : 'Show'} Log
              </Button>
            </div>
          </CardHeader>
          {showAuditLog && (
            <CardContent>
              {auditLoading ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                </div>
              ) : auditLog.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  No role changes recorded yet.
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Date</TableHead>
                      <TableHead>User</TableHead>
                      <TableHead>Role Change</TableHead>
                      <TableHead>Changed By</TableHead>
                      <TableHead>Reason</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {auditLog.map((audit) => (
                      <TableRow key={audit.id}>
                        <TableCell className="text-sm text-muted-foreground">
                          {format(new Date(audit.changed_at), 'MMM d, yyyy h:mm a')}
                        </TableCell>
                        <TableCell>
                          <div className="font-medium">
                            {audit.user_company || 'Unknown'}
                          </div>
                          <div className="text-xs text-muted-foreground truncate max-w-[150px]">
                            {audit.user_id.slice(0, 8)}...
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <Badge variant="outline" className="capitalize">
                              {audit.previous_role}
                            </Badge>
                            <ArrowRight className="h-3 w-3 text-muted-foreground" />
                            <Badge 
                              className={
                                audit.new_role === 'tester' 
                                  ? 'bg-warning text-warning-foreground' 
                                  : audit.new_role === 'disabled'
                                  ? 'bg-destructive'
                                  : 'bg-secondary'
                              }
                            >
                              {audit.new_role}
                            </Badge>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="text-sm">
                            {audit.changed_by_company || 'Admin'}
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="text-sm text-muted-foreground max-w-[200px] truncate">
                            {audit.reason || '-'}
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          )}
        </Card>
      </div>
    </AdminLayout>
  );
}