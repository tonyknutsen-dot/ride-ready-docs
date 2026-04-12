import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { Shield, FlaskConical, Ban, Users } from 'lucide-react';
import type { UserCardData } from './UserCard';
import {
  getAccountStatusMeta,
  getBillingStatusMeta,
  getOrgRoleLabel,
  getPlatformRoleLabel,
  getUserCompany,
} from './userManagementMeta';

interface UserListRowProps {
  user: UserCardData;
  onManage: (user: UserCardData) => void;
}

export function UserListRow({ user, onManage }: UserListRowProps) {
  const accountStatus = getAccountStatusMeta(user);
  const billingStatus = getBillingStatusMeta(user);
  const companyName = getUserCompany(user);
  const orgRole = getOrgRoleLabel(user);
  const platformRole = getPlatformRoleLabel(user);

  const getPlatformRole = () => {
    if (platformRole === 'Admin') return <Badge className="bg-primary text-primary-foreground text-[10px] px-1.5 py-0"><Shield className="h-3 w-3 mr-0.5" />Admin</Badge>;
    if (platformRole === 'Tester') return <Badge className="bg-warning text-warning-foreground text-[10px] px-1.5 py-0"><FlaskConical className="h-3 w-3 mr-0.5" />Tester</Badge>;
    return <Badge variant="outline" className="text-[10px] px-1.5 py-0">User</Badge>;
  };

  const getOrgRole = () => {
    if (orgRole === 'Controller') return <Badge variant="outline" className="text-[10px] px-1.5 py-0 border-primary/40 text-primary">Controller</Badge>;
    if (orgRole === 'Staff') return <Badge variant="outline" className="text-[10px] px-1.5 py-0 border-muted-foreground/40"><Users className="h-3 w-3 mr-0.5" />Staff</Badge>;
    return <Badge variant="outline" className="text-[10px] px-1.5 py-0 text-muted-foreground">None</Badge>;
  };

  return (
    <tr className={cn(
      'border-b border-border transition-colors',
      accountStatus.isSuspended ? 'bg-destructive/5 hover:bg-destructive/10' : 'hover:bg-muted/50',
    )}>
      {/* Name / Email */}
      <td className="py-2 px-3">
        <p className="font-medium text-sm truncate max-w-[200px]">
          {user.name || user.email?.split('@')[0] || 'Unknown'}
        </p>
        <p className="text-xs text-muted-foreground truncate max-w-[200px]">{user.email || 'No email'}</p>
      </td>
      {/* Company */}
      <td className="py-2 px-3 hidden md:table-cell">
        <span className="text-xs text-muted-foreground truncate max-w-[160px] block">
          {companyName || '—'}
        </span>
      </td>
      {/* Platform Role */}
      <td className="py-2 px-3 hidden lg:table-cell">{getPlatformRole()}</td>
      {/* Org Role */}
      <td className="py-2 px-3 hidden lg:table-cell">{getOrgRole()}</td>
      {/* Status */}
      <td className="py-2 px-3">
        <div className="flex flex-col gap-1">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-[10px] uppercase tracking-wide text-muted-foreground">Account</span>
            <Badge variant="outline" className={cn('text-[10px] px-1.5 py-0', accountStatus.className)}>
              {accountStatus.isSuspended && <Ban className="h-3 w-3 mr-0.5" />}
              {accountStatus.label}
            </Badge>
          </div>
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-[10px] uppercase tracking-wide text-muted-foreground">Billing</span>
            <Badge variant="outline" className={cn('text-[10px] px-1.5 py-0', billingStatus.className)}>
              {billingStatus.label}
            </Badge>
          </div>
        </div>
      </td>
      {/* Actions */}
      <td className="py-2 px-3 text-right">
        <Button variant="outline" size="sm" className="h-7 text-xs px-3" onClick={() => onManage(user)}>
          Manage
        </Button>
      </td>
    </tr>
  );
}
