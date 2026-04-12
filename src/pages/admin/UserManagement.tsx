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
import { UserCard } from '@/components/admin/UserCard';
import { UserListRow } from '@/components/admin/UserListRow';
import { UserManageDrawer } from '@/components/admin/UserManageDrawer';
import type { UserCardData } from '@/components/admin/UserCard';
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
import { useIsMobile } from '@/hooks/use-mobile';

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
    stripe_customer_id: string | null;
    stripe_subscription_id: string | null;
  } | null;
  isAdmin: boolean;
  isTester: boolean;
  isStaffMember: boolean;
  staffOrgName: string | null;
  testerExpiresAt: string | null;
  rideCount: number;
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
  email: string | null;
  name: string | null;
  total_minutes: number;
  session_count: number;
  last_session: string | null;
  has_active_session: boolean;
}

interface TesterAllTimeData {
  user_id: string;
  company_name: string | null;
  email: string | null;
  name: string | null;
  total_minutes: number;
  total_sessions: number;
  first_session: string | null;
  last_session: string | null;
  has_active_session: boolean;
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
  const [testerAllTimeData, setTesterAllTimeData] = useState<TesterAllTimeData[]>([]);
  const [timeTrackingLoading, setTimeTrackingLoading] = useState(false);
  const [allTimeLoading, setAllTimeLoading] = useState(false);
  const [showTimeTracking, setShowTimeTracking] = useState(false);
  const [timeViewMode, setTimeViewMode] = useState<'monthly' | 'alltime'>('alltime');
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
      if (timeViewMode === 'monthly') {
        fetchTesterTimeData();
      } else {
        fetchAllTimeData();
      }
    }
  }, [showTimeTracking, selectedMonth, timeViewMode]);

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

      // Get tester sessions for selected month (include session_end for active session calculation)
      const { data: sessions, error } = await supabase
        .from('tester_sessions')
        .select('user_id, duration_minutes, session_start, session_end')
        .gte('session_start', startDate.toISOString())
        .lte('session_start', endDate.toISOString())
        .order('session_start', { ascending: false });

      if (error) throw error;

      console.log('[TesterTimeTracking] Fetched sessions:', sessions?.length, sessions);

      // Get unique user IDs
      const userIds = [...new Set((sessions || []).map(s => s.user_id))];

      if (userIds.length === 0) {
        setTesterTimeData([]);
        return;
      }

      // Get profiles for these users
      const { data: profiles } = await supabase
        .from('profiles')
        .select('user_id, company_name')
        .in('user_id', userIds);

      // Get auth data for email/name
      const { data: authData } = await supabase.functions.invoke('get-users-admin');
      const userEmailMap = new Map<string, { email: string; name: string | null }>();
      authData?.users?.forEach((u: any) => {
        userEmailMap.set(u.id, { email: u.email, name: u.name });
      });

      const profileMap = new Map(profiles?.map(p => [p.user_id, p.company_name]) || []);

      // Aggregate by user - calculate live duration for active sessions
      const userTimeMap = new Map<string, { total: number; count: number; lastSession: string | null; hasActiveSession: boolean }>();
      const now = new Date();
      
      for (const session of sessions || []) {
        const existing = userTimeMap.get(session.user_id) || { total: 0, count: 0, lastSession: null, hasActiveSession: false };
        
        // Calculate duration - if session is active (no end), calculate from start to now
        let sessionDuration = session.duration_minutes || 0;
        const isActiveSession = !session.session_end;
        
        if (isActiveSession && session.session_start) {
          // Calculate live duration for active session
          const sessionStart = new Date(session.session_start);
          sessionDuration = Math.round((now.getTime() - sessionStart.getTime()) / 60000);
        }
        
        userTimeMap.set(session.user_id, {
          total: existing.total + sessionDuration,
          count: existing.count + 1,
          lastSession: existing.lastSession || session.session_start,
          hasActiveSession: existing.hasActiveSession || isActiveSession,
        });
      }

      const timeData: TesterTimeData[] = Array.from(userTimeMap.entries()).map(([userId, data]) => ({
        user_id: userId,
        company_name: profileMap.get(userId) || null,
        email: userEmailMap.get(userId)?.email || null,
        name: userEmailMap.get(userId)?.name || null,
        total_minutes: data.total,
        session_count: data.count,
        last_session: data.lastSession,
        has_active_session: data.hasActiveSession,
      }));

      // Sort by total time descending
      timeData.sort((a, b) => b.total_minutes - a.total_minutes);

      console.log('[TesterTimeTracking] Processed time data:', timeData);
      setTesterTimeData(timeData);
    } catch (error: any) {
      console.error('Error fetching tester time data:', error);
      toast.error('Failed to load time tracking data');
    } finally {
      setTimeTrackingLoading(false);
    }
  };

  const fetchAllTimeData = async () => {
    setAllTimeLoading(true);
    try {
      // Use the new RPC function to get all-time summary
      const { data: summaryData, error } = await supabase.rpc('get_tester_usage_summary');

      if (error) throw error;

      console.log('[TesterTimeTracking] All-time summary data:', summaryData);

      if (!summaryData || summaryData.length === 0) {
        setTesterAllTimeData([]);
        return;
      }

      // Get unique user IDs
      const userIds = summaryData.map((s: any) => s.user_id);

      // Get profiles for these users
      const { data: profiles } = await supabase
        .from('profiles')
        .select('user_id, company_name')
        .in('user_id', userIds);

      // Get auth data for email/name
      const { data: authData } = await supabase.functions.invoke('get-users-admin');
      const userEmailMap = new Map<string, { email: string; name: string | null }>();
      authData?.users?.forEach((u: any) => {
        userEmailMap.set(u.id, { email: u.email, name: u.name });
      });

      const profileMap = new Map(profiles?.map(p => [p.user_id, p.company_name]) || []);

      const allTimeData: TesterAllTimeData[] = summaryData.map((row: any) => ({
        user_id: row.user_id,
        company_name: profileMap.get(row.user_id) || null,
        email: userEmailMap.get(row.user_id)?.email || null,
        name: userEmailMap.get(row.user_id)?.name || null,
        total_minutes: Math.round(row.total_minutes || 0),
        total_sessions: row.total_sessions || 0,
        first_session: row.first_session_at,
        last_session: row.last_session_at,
        has_active_session: row.active_session || false,
      }));

      // Sort by total time descending
      allTimeData.sort((a, b) => b.total_minutes - a.total_minutes);

      console.log('[TesterTimeTracking] Processed all-time data:', allTimeData);
      setTesterAllTimeData(allTimeData);
    } catch (error: any) {
      console.error('Error fetching all-time data:', error);
      toast.error('Failed to load all-time tracking data');
    } finally {
      setAllTimeLoading(false);
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
      // Fetch profiles (some staff/tester users may not have one yet)
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

      // Fetch staff (organisation members)
      const { data: orgMembers } = await supabase
        .from('organisation_members')
        .select('user_id, is_active, organisations(name)')
        .eq('is_active', true);

      const staffMap = new Map<string, string | null>();
      for (const m of orgMembers || []) {
        const org = m.organisations as { name: string } | null;
        staffMap.set(m.user_id, org?.name || null);
      }

      // Fetch user emails and names from edge function
      const { data: authData, error: authError } = await supabase.functions.invoke('get-users-admin');
      
      const userEmailMap = new Map<string, { email: string; name: string | null; created_at?: string }>();
      if (!authError && authData?.users) {
        for (const u of authData.users) {
          userEmailMap.set(u.id, { email: u.email, name: u.name, created_at: u.created_at });
        }
      }

      const profileMap = new Map((profiles || []).map(profile => [profile.user_id, profile]));

      const authUsers = authData?.users || [];
      const authUserMap = new Map<string, { email: string; name: string | null; created_at: string }>();
      for (const user of authUsers) {
        authUserMap.set(user.id, {
          email: user.email || '',
          name: user.name || null,
          created_at: user.created_at,
        });
      }

      // Build from every relevant source so staff/tester users without profile rows still appear
      const userIds = Array.from(new Set([
        ...(profiles || []).map(p => p.user_id),
        ...(userRoles || []).map(r => r.user_id),
        ...(orgMembers || []).map(m => m.user_id),
      ]));

      // Fetch ride counts per user
      const { data: rideCounts } = await supabase
        .from('rides')
        .select('user_id')
        .in('user_id', userIds);
      
      const rideCountMap = new Map<string, number>();
      for (const r of rideCounts || []) {
        rideCountMap.set(r.user_id, (rideCountMap.get(r.user_id) || 0) + 1);
      }

      const adminUserIds = new Set(userRoles?.filter(r => r.role === 'admin').map(r => r.user_id) || []);
      const testerRoles = new Map(
        userRoles?.filter(r => r.role === 'tester').map(r => [r.user_id, r.expires_at]) || []
      );

      const usersData: UserWithProfile[] = userIds.map((userId) => {
        const profile = profileMap.get(userId);
        const testerExpiresAt = testerRoles.get(userId) || null;
        const isTesterExpired = testerExpiresAt ? new Date(testerExpiresAt) < new Date() : false;
        const authInfo = authUserMap.get(userId) || userEmailMap.get(userId);
        const createdAt = authInfo?.created_at || profile?.created_at || new Date().toISOString();
        
        return {
          id: userId,
          email: authInfo?.email || '',
          name: authInfo?.name || null,
          created_at: createdAt,
          profile: profile ? {
            company_name: profile.company_name,
            subscription_status: profile.subscription_status,
            subscription_plan: profile.subscription_plan,
            trial_ends_at: profile.trial_ends_at,
            country: profile.country,
            is_suspended: profile.is_suspended ?? false,
            suspended_at: profile.suspended_at,
            suspended_reason: profile.suspended_reason,
            stripe_customer_id: profile.stripe_customer_id || null,
            stripe_subscription_id: profile.stripe_subscription_id || null,
          } : null,
          isAdmin: adminUserIds.has(userId),
          isTester: testerRoles.has(userId) && !isTesterExpired,
          isStaffMember: staffMap.has(userId),
          staffOrgName: staffMap.get(userId) || null,
          testerExpiresAt: testerExpiresAt,
          rideCount: rideCountMap.get(userId) || 0,
        };
      });

      usersData.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

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
        user.staffOrgName?.toLowerCase().includes(searchLower) ||
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
            <h1 className="text-xl md:text-2xl font-bold flex items-center gap-2">
              <Users className="h-5 w-5 md:h-6 md:w-6 text-primary" />
              User Management
            </h1>
            <p className="text-sm text-muted-foreground mt-0.5">
              Manage user accounts and roles
            </p>
          </div>
          <div className="flex items-center gap-3">
            <TesterInviteDialog onInviteSent={fetchUsers} />
            <Users className="h-8 w-8 text-muted-foreground" />
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-6">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-xs sm:text-sm font-medium text-muted-foreground leading-tight">
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
              <CardTitle className="text-xs sm:text-sm font-medium text-muted-foreground leading-tight">
                Staff Members
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {users.filter(u => u.isStaffMember).length}
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-xs sm:text-sm font-medium text-muted-foreground leading-tight">
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
              <CardTitle className="text-xs sm:text-sm font-medium text-muted-foreground leading-tight">
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
              <CardTitle className="text-xs sm:text-sm font-medium text-muted-foreground leading-tight">
                Suspended
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

        {/* Users List */}
        <Card>
          <CardHeader>
            <CardTitle>All Users</CardTitle>
            <CardDescription>
              {filteredUsers.length} user{filteredUsers.length !== 1 ? 's' : ''} found
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-2">
              {filteredUsers.map((user) => (
                <UserCard
                  key={user.id}
                  user={user}
                  updatingUserId={updatingUserId}
                  updatingTesterUserId={updatingTesterUserId}
                  suspendingUserId={suspendingUserId}
                  onToggleAdmin={toggleAdminRole}
                  onToggleSuspension={(uid, suspended, reason) => {
                    if (reason) setSuspendReason(reason);
                    toggleSuspension(uid, suspended);
                  }}
                  onToggleTester={toggleTesterRole}
                  onExtendTester={extendTesterExpiry}
                  onOffboardTester={offboardTester}
                />
              ))}
            </div>

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
              {/* View Mode Toggle */}
              <div className="flex items-center gap-4 mb-4 flex-wrap">
                <div className="flex items-center gap-2">
                  <Label className="text-sm font-medium">View:</Label>
                  <div className="flex rounded-md border border-input overflow-hidden">
                    <button
                      onClick={() => setTimeViewMode('alltime')}
                      className={`px-3 py-1.5 text-sm font-medium transition-colors ${
                        timeViewMode === 'alltime'
                          ? 'bg-primary text-primary-foreground'
                          : 'bg-background hover:bg-muted'
                      }`}
                    >
                      All Time
                    </button>
                    <button
                      onClick={() => setTimeViewMode('monthly')}
                      className={`px-3 py-1.5 text-sm font-medium transition-colors border-l border-input ${
                        timeViewMode === 'monthly'
                          ? 'bg-primary text-primary-foreground'
                          : 'bg-background hover:bg-muted'
                      }`}
                    >
                      Monthly
                    </button>
                  </div>
                </div>
                
                {/* Month Selector - only show in monthly mode */}
                {timeViewMode === 'monthly' && (
                  <div className="flex items-center gap-2">
                    <Label htmlFor="month-select" className="text-sm font-medium">Period:</Label>
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
                )}
              </div>

              {/* All Time View */}
              {timeViewMode === 'alltime' && (
                <>
                  {allTimeLoading ? (
                    <div className="flex items-center justify-center py-8">
                      <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                    </div>
                  ) : testerAllTimeData.length === 0 ? (
                    <div className="text-center py-8 text-muted-foreground">
                      No tester sessions recorded yet.
                    </div>
                  ) : (
                    <>
                      <div className="mb-4 p-4 bg-gradient-to-r from-primary/10 to-primary/5 border border-primary/20 rounded-lg">
                        <div className="text-center mb-2">
                          <Badge className="bg-primary text-primary-foreground text-base px-3 py-1">
                            All Time Total
                          </Badge>
                        </div>
                        <div className="grid grid-cols-3 gap-4 text-center">
                          <div>
                            <div className="text-2xl font-bold text-primary">
                              {formatDuration(testerAllTimeData.reduce((sum, t) => sum + t.total_minutes, 0))}
                            </div>
                            <div className="text-sm text-muted-foreground">Total Time</div>
                          </div>
                          <div>
                            <div className="text-2xl font-bold">{testerAllTimeData.length}</div>
                            <div className="text-sm text-muted-foreground">Testers</div>
                          </div>
                          <div>
                            <div className="text-2xl font-bold">
                              {testerAllTimeData.reduce((sum, t) => sum + t.total_sessions, 0)}
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
                            <TableHead className="hidden sm:table-cell">First Session</TableHead>
                            <TableHead>Last Active</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {testerAllTimeData.map((tester) => (
                            <TableRow key={tester.user_id}>
                              <TableCell>
                                <div className="flex items-center gap-2">
                                  <div className="font-medium">
                                    {tester.name || tester.company_name || tester.email?.split('@')[0] || 'Unknown'}
                                  </div>
                                  {tester.has_active_session && (
                                    <Badge variant="default" className="bg-success text-success-foreground text-xs">
                                      Active
                                    </Badge>
                                  )}
                                </div>
                                <div className="text-xs text-muted-foreground">
                                  {tester.email || tester.user_id.slice(0, 8) + '...'}
                                </div>
                                {tester.company_name && tester.name && (
                                  <div className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                                    <Building className="h-3 w-3" />
                                    {tester.company_name}
                                  </div>
                                )}
                              </TableCell>
                              <TableCell>
                                <Badge variant="outline" className="font-mono font-bold">
                                  {formatDuration(tester.total_minutes)}
                                </Badge>
                              </TableCell>
                              <TableCell>{tester.total_sessions}</TableCell>
                              <TableCell className="text-sm text-muted-foreground hidden sm:table-cell">
                                {tester.first_session 
                                  ? format(new Date(tester.first_session), 'MMM d, yyyy')
                                  : '-'}
                              </TableCell>
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
                </>
              )}

              {/* Monthly View */}
              {timeViewMode === 'monthly' && (
                <>
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
                                <div className="flex items-center gap-2">
                                  <div className="font-medium">
                                    {tester.name || tester.company_name || tester.email?.split('@')[0] || 'Unknown'}
                                  </div>
                                  {tester.has_active_session && (
                                    <Badge variant="default" className="bg-success text-success-foreground text-xs">
                                      Active
                                    </Badge>
                                  )}
                                </div>
                                <div className="text-xs text-muted-foreground">
                                  {tester.email || tester.user_id.slice(0, 8) + '...'}
                                </div>
                                {tester.company_name && tester.name && (
                                  <div className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                                    <Building className="h-3 w-3" />
                                    {tester.company_name}
                                  </div>
                                )}
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