import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Shield, FlaskConical, Ban, Users, Building } from 'lucide-react';
import type { UserCardData } from './UserCard';

interface UserListRowProps {
  user: UserCardData;
  onManage: (user: UserCardData) => void;
}

export function UserListRow({ user, onManage }: UserListRowProps) {
  const getPlatformRole = () => {
    if (user.isAdmin) return <Badge className="bg-primary text-primary-foreground text-[10px] px-1.5 py-0"><Shield className="h-3 w-3 mr-0.5" />Admin</Badge>;
    if (user.isTester) return <Badge className="bg-warning text-warning-foreground text-[10px] px-1.5 py-0"><FlaskConical className="h-3 w-3 mr-0.5" />Tester</Badge>;
    return <Badge variant="outline" className="text-[10px] px-1.5 py-0">User</Badge>;
  };

  const getOrgRole = () => {
    if (!user.isStaffMember && !user.staffOrgName) {
      if (user.profile?.company_name) return <Badge variant="outline" className="text-[10px] px-1.5 py-0 border-primary/40 text-primary">Controller</Badge>;
      return <span className="text-[10px] text-muted-foreground">—</span>;
    }
    return <Badge variant="outline" className="text-[10px] px-1.5 py-0 border-muted-foreground/40"><Users className="h-3 w-3 mr-0.5" />Staff</Badge>;
  };

  const getStatusBadge = () => {
    if (user.profile?.is_suspended) return <Badge variant="destructive" className="text-[10px] px-1.5 py-0"><Ban className="h-3 w-3 mr-0.5" />Suspended</Badge>;
    const status = user.profile?.subscription_status;
    if (!status) return <Badge variant="outline" className="text-[10px] px-1.5 py-0">No Sub</Badge>;
    switch (status) {
      case 'active': return <Badge className="bg-green-600 text-white text-[10px] px-1.5 py-0">Active</Badge>;
      case 'trial': return <Badge className="bg-blue-600 text-white text-[10px] px-1.5 py-0">Trial</Badge>;
      case 'past_due': return <Badge className="bg-yellow-500 text-black text-[10px] px-1.5 py-0">Past Due</Badge>;
      case 'expired': return <Badge variant="destructive" className="text-[10px] px-1.5 py-0">Expired</Badge>;
      case 'cancelled': return <Badge variant="outline" className="text-[10px] px-1.5 py-0">Cancelled</Badge>;
      default: return <Badge variant="outline" className="text-[10px] px-1.5 py-0 capitalize">{status}</Badge>;
    }
  };

  return (
    <tr className="border-b border-border hover:bg-muted/50 transition-colors">
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
          {user.profile?.company_name || user.staffOrgName || '—'}
        </span>
      </td>
      {/* Platform Role */}
      <td className="py-2 px-3 hidden lg:table-cell">{getPlatformRole()}</td>
      {/* Org Role */}
      <td className="py-2 px-3 hidden lg:table-cell">{getOrgRole()}</td>
      {/* Status */}
      <td className="py-2 px-3">{getStatusBadge()}</td>
      {/* Actions */}
      <td className="py-2 px-3 text-right">
        <Button variant="outline" size="sm" className="h-7 text-xs px-3" onClick={() => onManage(user)}>
          Manage
        </Button>
      </td>
    </tr>
  );
}
