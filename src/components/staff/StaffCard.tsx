import { Badge } from '@/components/ui/badge';
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
  const roleConfig = {
    manager: { bg: 'hsl(142 76% 96%)', color: 'hsl(142 72% 25%)' },
    supervisor: { bg: 'hsl(38 100% 97%)', color: 'hsl(32 95% 30%)' },
    staff: { bg: 'hsl(214 100% 97%)', color: 'hsl(213 52% 24%)' },
  };
  const cfg = roleConfig[member.permission_level] || roleConfig.staff;
  const displayName = member.display_name || member.email || 'Unknown';
  const initial = displayName[0]?.toUpperCase() || '?';

  return (
    <div
      onClick={onTap}
      className="rounded-xl p-3.5 cursor-pointer transition-all hover:shadow-md active:scale-[0.99]"
      style={{
        background: 'hsl(var(--card))',
        border: '1px solid hsl(var(--border))',
        boxShadow: 'var(--shadow-card)',
      }}
    >
      <div className="flex items-center gap-3">
        {/* Avatar */}
        <div
          className="w-10 h-10 rounded-xl flex items-center justify-center text-sm font-bold flex-shrink-0"
          style={{ background: cfg.bg, color: cfg.color }}
        >
          {initial}
        </div>

        {/* Info */}
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold truncate">{displayName}</p>
          <p className="text-[11px] text-muted-foreground">
            Joined {format(new Date(member.joined_at), 'MMM d, yyyy')}
          </p>
        </div>

        {/* Badges + kebab */}
        <div className="flex items-center gap-2 flex-shrink-0">
          <StaffRoleBadge role={member.permission_level as AppRole} />
          {canManage && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild onClick={e => e.stopPropagation()}>
                <button className="w-8 h-8 rounded-lg flex items-center justify-center hover:bg-muted transition-colors">
                  <MoreVertical className="h-4 w-4 text-muted-foreground" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-44">
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
                  Remove staff
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>
      </div>

      {/* Equipment badge row */}
      <div className="mt-2.5 flex items-center gap-1.5 flex-wrap">
        {member.assigned_rides.length === 0 ? (
          <span
            className="text-[11px] font-medium px-2 py-0.5 rounded-full"
            style={{ background: 'hsl(214 100% 97%)', color: 'hsl(213 52% 24%)' }}
          >
            All equipment
          </span>
        ) : (
          <span
            className="text-[11px] font-medium px-2 py-0.5 rounded-full"
            style={{ background: 'hsl(var(--muted))', color: 'hsl(var(--muted-foreground))' }}
          >
            Assigned: {member.assigned_rides.length} ride{member.assigned_rides.length !== 1 ? 's' : ''}
          </span>
        )}
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
    <div
      className="rounded-xl p-3.5"
      style={{ background: 'hsl(38 100% 97%)', border: '1px solid hsl(38 92% 80%)' }}
    >
      <div className="flex items-center gap-3">
        <div
          className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
          style={{ background: 'hsl(38 92% 90%)' }}
        >
          <Mail className="h-4 w-4" style={{ color: 'hsl(32 95% 30%)' }} />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium truncate">{invite.email}</p>
          <div className="flex items-center gap-2 mt-0.5">
            <StaffRoleBadge role={invite.permission_level as AppRole} size="sm" />
            <span className="text-[11px] text-muted-foreground flex items-center gap-1">
              <Clock className="h-3 w-3" />
              Expires {format(new Date(invite.expires_at), 'MMM d')}
            </span>
          </div>
        </div>
        {canManage && (
          <div className="flex gap-1 flex-shrink-0">
            <button
              onClick={onCancel}
              className="w-8 h-8 rounded-lg flex items-center justify-center hover:bg-red-100 transition-colors"
              title="Cancel invite"
            >
              <X className="h-4 w-4 text-destructive" />
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
