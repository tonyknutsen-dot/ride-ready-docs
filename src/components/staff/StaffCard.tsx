import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { MoreVertical, Settings2, Eye, Trash2, Mail, X, Clock } from 'lucide-react';
import { StaffRoleBadge } from './StaffRoleBadge';
import { format } from 'date-fns';
import type { AppRole } from '@/utils/permissions';
import { Database } from '@/integrations/supabase/types';

type StaffRole = Database['public']['Enums']['staff_role'];

interface AssignedRide {
  id: string;
  ride_name: string;
}

export interface StaffMemberData {
  id: string;
  user_id: string;
  permission_level: StaffRole;
  joined_at: string;
  is_active: boolean;
  email?: string;
  display_name?: string;
  assigned_rides: AssignedRide[];
  equipment_access_mode: 'all' | 'assigned';
}

export interface PendingInviteData {
  id: string;
  email: string;
  permission_level: StaffRole;
  created_at: string;
  expires_at: string;
  status: string;
}

interface StaffCardProps {
  member: StaffMemberData;
  canManage: boolean;
  onTap: () => void;
  onEditAccess: () => void;
  onRemove: () => void;
}

export function StaffCard({ member, canManage, onTap, onEditAccess, onRemove }: StaffCardProps) {
  const displayName = member.display_name || member.email || 'Unknown';

  return (
    <div
      onClick={onTap}
      className="rounded-xl px-3.5 py-3 cursor-pointer transition-all hover:bg-muted/40 active:scale-[0.99] border border-border bg-card"
    >
      {/* Row 1: Name + Role pill */}
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm font-semibold truncate flex-1 min-w-0">{displayName}</p>
        <div className="flex items-center gap-1.5 flex-shrink-0">
          <StaffRoleBadge role={member.permission_level as AppRole} />
          {canManage && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild onClick={e => e.stopPropagation()}>
                <button className="w-7 h-7 rounded-lg flex items-center justify-center hover:bg-muted transition-colors -mr-1">
                  <MoreVertical className="h-4 w-4 text-muted-foreground" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-40">
                <DropdownMenuItem onClick={e => { e.stopPropagation(); onEditAccess(); }}>
                  <Settings2 className="h-3.5 w-3.5 mr-2" />
                  Edit access
                </DropdownMenuItem>
                <DropdownMenuItem onClick={e => { e.stopPropagation(); onTap(); }}>
                  <Eye className="h-3.5 w-3.5 mr-2" />
                  View details
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={e => { e.stopPropagation(); onRemove(); }}
                  className="text-destructive focus:text-destructive"
                >
                  <Trash2 className="h-3.5 w-3.5 mr-2" />
                  Remove
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>
      </div>

      {/* Row 2: Email + Joined */}
      <div className="flex items-center gap-2 mt-0.5">
        {member.email && member.display_name && (
          <span className="text-[11px] text-muted-foreground truncate">{member.email}</span>
        )}
        <span className="text-[11px] text-muted-foreground whitespace-nowrap">
          Joined {format(new Date(member.joined_at), 'MMM d, yyyy')}
        </span>
      </div>

      {/* Row 3: Ride access pill */}
      <div className="mt-2">
        <span
          className="text-[11px] font-medium px-2 py-0.5 rounded-full inline-block"
          style={{
            background: member.equipment_access_mode === 'all' ? 'hsl(214 100% 97%)' : 'hsl(var(--muted))',
            color: member.equipment_access_mode === 'all' ? 'hsl(213 52% 24%)' : 'hsl(var(--muted-foreground))',
          }}
        >
          {member.equipment_access_mode === 'all'
            ? 'Ride access: All rides'
            : `Ride access: ${member.assigned_rides.length} assigned`}
        </span>
      </div>
    </div>
  );
}

interface PendingInviteCardProps {
  invite: PendingInviteData;
  canManage: boolean;
  onResend: () => void;
  onCancel: () => void;
}

export function PendingInviteCard({ invite, canManage, onResend, onCancel }: PendingInviteCardProps) {
  return (
    <div className="rounded-xl px-3.5 py-3 border border-warning/40 bg-warning/5">
      {/* Row 1: Email + Pending badge */}
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm font-medium truncate flex-1 min-w-0">{invite.email}</p>
        <div className="flex items-center gap-1.5 flex-shrink-0">
          <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-warning/15 text-warning border border-warning/30">
            Invite pending
          </span>
          {canManage && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="w-7 h-7 rounded-lg flex items-center justify-center hover:bg-muted transition-colors -mr-1">
                  <MoreVertical className="h-4 w-4 text-muted-foreground" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-40">
                <DropdownMenuItem onClick={onResend}>
                  <Mail className="h-3.5 w-3.5 mr-2" />
                  Resend invite
                </DropdownMenuItem>
                <DropdownMenuItem onClick={onCancel} className="text-destructive focus:text-destructive">
                  <X className="h-3.5 w-3.5 mr-2" />
                  Revoke invite
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>
      </div>

      {/* Row 2: Role + Expiry */}
      <div className="flex items-center gap-2 mt-1">
        <StaffRoleBadge role={invite.permission_level as AppRole} size="sm" />
        <span className="text-[11px] text-muted-foreground flex items-center gap-1">
          <Clock className="h-3 w-3" />
          Expires {format(new Date(invite.expires_at), 'MMM d')}
        </span>
      </div>
    </div>
  );
}
