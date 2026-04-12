import type { UserCardData } from './UserCard';

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
      return {
        label: 'Active',
        className: 'border-success/30 bg-success/10 text-success',
      };
    case 'trial':
      return {
        label: 'Trial',
        className: 'border-info/30 bg-info/10 text-info',
      };
    case 'past_due':
      return {
        label: 'Past Due',
        className: 'border-warning/30 bg-warning/10 text-warning',
      };
    case 'expired':
      return {
        label: 'Expired',
        className: 'border-destructive/30 bg-destructive/10 text-destructive',
      };
    case 'cancelled':
      return {
        label: 'Cancelled',
        className: 'border-border bg-muted text-muted-foreground',
      };
    default:
      return {
        label: 'No Subscription',
        className: 'border-border bg-muted/60 text-muted-foreground',
      };
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