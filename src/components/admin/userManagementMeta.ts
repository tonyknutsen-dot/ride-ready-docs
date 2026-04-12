import type { UserCardData } from './UserCard';
import type { UserFilters, KpiFilter } from './UserManagementFilters';

export interface AdminBadgeMeta {
  label: string;
  className: string;
}

export function getUserCompany(user: UserCardData): string | null {
  return user.profile?.company_name || user.staffOrgName || null;
}

export function getAccountStatusMeta(user: UserCardData): AdminBadgeMeta & { isSuspended: boolean } {
  const isSuspended = user.profile?.is_suspended ?? false;

  if (isSuspended) {
    return {
      isSuspended: true,
      label: 'Suspended',
      className: 'border-destructive/30 bg-destructive/10 text-destructive',
    };
  }

  return {
    isSuspended: false,
    label: 'Active',
    className: 'border-success/30 bg-success/10 text-success',
  };
}

export function getBillingStatusMeta(user: UserCardData): AdminBadgeMeta {
  switch (user.profile?.subscription_status) {
    case 'active':
      return { label: 'Active', className: 'border-success/30 bg-success/10 text-success' };
    case 'trial':
      return { label: 'Trial', className: 'border-info/30 bg-info/10 text-info' };
    case 'past_due':
      return { label: 'Past Due', className: 'border-warning/30 bg-warning/10 text-warning' };
    case 'expired':
      return { label: 'Expired', className: 'border-destructive/30 bg-destructive/10 text-destructive' };
    case 'cancelled':
      return { label: 'Cancelled', className: 'border-border bg-muted text-muted-foreground' };
    default:
      return { label: 'No Subscription', className: 'border-border bg-muted/60 text-muted-foreground' };
  }
}

export function getPlatformRoleLabel(user: UserCardData): 'Admin' | 'Tester' | 'User' {
  if (user.isAdmin) return 'Admin';
  if (user.isTester) return 'Tester';
  return 'User';
}

export function getOrgRoleLabel(user: UserCardData): 'Controller' | 'Staff' | 'None' {
  if (user.isStaffMember) return 'Staff';
  if (user.profile?.company_name) return 'Controller';
  return 'None';
}

export function getAdminUserSearchText(user: UserCardData): string {
  return [
    user.id,
    user.email,
    user.name,
    user.staffOrgName,
    user.profile?.company_name,
    user.profile?.country,
    getAccountStatusMeta(user).label,
    getBillingStatusMeta(user).label,
    getPlatformRoleLabel(user),
    getOrgRoleLabel(user),
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();
}

/* ── Filtering ── */

function matchesKpi(user: UserCardData, kpi: KpiFilter): boolean {
  switch (kpi) {
    case 'all': return true;
    case 'suspended': return user.profile?.is_suspended === true;
    case 'admins': return user.isAdmin;
    case 'testers': return user.isTester;
    case 'staff': return user.isStaffMember;
    case 'pending_invites': return false; // handled separately
  }
}

export function applyUserFilters(
  users: UserCardData[],
  filters: UserFilters,
  searchQuery: string,
): UserCardData[] {
  let result = users;

  // KPI quick-filter (pending_invites handled at page level)
  if (filters.kpi !== 'all' && filters.kpi !== 'pending_invites') {
    result = result.filter(u => matchesKpi(u, filters.kpi));
  }

  // Account status
  if (filters.accountStatus === 'active') result = result.filter(u => !(u.profile?.is_suspended));
  if (filters.accountStatus === 'suspended') result = result.filter(u => u.profile?.is_suspended === true);

  // Platform role
  if (filters.platformRole === 'admin') result = result.filter(u => u.isAdmin);
  if (filters.platformRole === 'tester') result = result.filter(u => u.isTester);
  if (filters.platformRole === 'user') result = result.filter(u => !u.isAdmin && !u.isTester);

  // Org role
  if (filters.orgRole === 'controller') result = result.filter(u => u.profile?.company_name && !u.isStaffMember);
  if (filters.orgRole === 'staff') result = result.filter(u => u.isStaffMember);
  if (filters.orgRole === 'none') result = result.filter(u => !u.isStaffMember && !u.profile?.company_name);

  // Billing
  if (filters.billing !== 'any') {
    const key = filters.billing === 'no_subscription' ? undefined : filters.billing;
    result = result.filter(u => {
      const status = u.profile?.subscription_status;
      if (filters.billing === 'no_subscription') return !status;
      return status === key;
    });
  }

  // Search
  if (searchQuery.trim()) {
    const q = searchQuery.toLowerCase();
    result = result.filter(u => getAdminUserSearchText(u).includes(q));
  }

  return result;
}

/* ── Sorting ── */

export function sortUsers(users: UserCardData[], sort: UserFilters['sort']): UserCardData[] {
  const sorted = [...users];
  switch (sort) {
    case 'recent':
      return sorted.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
    case 'name_asc':
      return sorted.sort((a, b) => (a.name || a.email || '').localeCompare(b.name || b.email || ''));
    case 'name_desc':
      return sorted.sort((a, b) => (b.name || b.email || '').localeCompare(a.name || a.email || ''));
    case 'status': {
      const statusOrder = (u: UserCardData) => {
        if (u.profile?.is_suspended) return 0;
        if (u.profile?.subscription_status === 'expired') return 1;
        if (u.profile?.subscription_status === 'past_due') return 2;
        return 3;
      };
      return sorted.sort((a, b) => statusOrder(a) - statusOrder(b));
    }
    case 'company':
      return sorted.sort((a, b) => (getUserCompany(a) || 'zzz').localeCompare(getUserCompany(b) || 'zzz'));
    default:
      return sorted;
  }
}