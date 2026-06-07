import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Button } from '@/components/ui/button';
import { MoreVertical, Settings2, Eye, Trash2, Mail, X, Clock, Link2, AlertTriangle, CheckCircle2, Ban } from 'lucide-react';
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
  updated_at?: string | null;
  expires_at: string;
  status: string; // 'pending' | 'expired' | 'cancelled' | 'accepted'
  accepted_at?: string | null;
  invited_by?: string | null;
  invited_by_name?: string | null;
  invite_token?: string | null;
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
  onCopyLink: () => void;
}

function relativeFromNow(target: Date): string {
  const diffMs = target.getTime() - Date.now();
  const past = diffMs < 0;
  const abs = Math.abs(diffMs);
  const mins = Math.round(abs / 60000);
  const hrs = Math.round(abs / 3600000);
  const days = Math.round(abs / 86400000);
  let phrase: string;
  if (mins < 60) phrase = `${mins} minute${mins === 1 ? '' : 's'}`;
  else if (hrs < 48) phrase = `${hrs} hour${hrs === 1 ? '' : 's'}`;
  else phrase = `${days} day${days === 1 ? '' : 's'}`;
  return past ? `${phrase} ago` : `in ${phrase}`;
}

const UK_DATETIME = 'd MMMM yyyy \'at\' HH:mm';

export function PendingInviteCard({ invite, canManage, onResend, onCancel, onCopyLink }: PendingInviteCardProps) {
  const expiresAt = new Date(invite.expires_at);
  const now = new Date();
  const isAccepted = invite.status === 'accepted';
  const isCancelled = invite.status === 'cancelled';
  const isExpired = !isAccepted && !isCancelled && (invite.status === 'expired' || expiresAt < now);
  const isPending = !isAccepted && !isCancelled && !isExpired;

  const statusBadge = isAccepted
    ? { label: 'Accepted', icon: CheckCircle2, cls: 'bg-success/15 text-success border-success/30' }
    : isCancelled
    ? { label: 'Cancelled', icon: Ban, cls: 'bg-muted text-muted-foreground border-border' }
    : isExpired
    ? { label: 'Expired', icon: AlertTriangle, cls: 'bg-destructive/10 text-destructive border-destructive/30' }
    : { label: 'Pending', icon: Clock, cls: 'bg-warning/15 text-warning border-warning/30' };

  const StatusIcon = statusBadge.icon;

  const containerCls = isPending
    ? 'border-warning/40 bg-warning/5'
    : isExpired
    ? 'border-destructive/30 bg-destructive/5'
    : 'border-border bg-muted/30';

  const expiryLine = isAccepted
    ? `Accepted ${format(new Date(invite.accepted_at || invite.updated_at || invite.created_at), UK_DATETIME)}`
    : isCancelled
    ? `Cancelled ${format(new Date(invite.updated_at || invite.created_at), UK_DATETIME)}`
    : isExpired
    ? `Expired ${relativeFromNow(expiresAt)} · ${format(expiresAt, UK_DATETIME)}`
    : `Expires ${format(expiresAt, UK_DATETIME)} (${relativeFromNow(expiresAt)})`;

  const sentLine = `Sent ${format(new Date(invite.created_at), UK_DATETIME)}`;
  const resentLine = invite.updated_at && new Date(invite.updated_at).getTime() - new Date(invite.created_at).getTime() > 60_000 && isPending
    ? `Re-sent ${format(new Date(invite.updated_at), UK_DATETIME)}`
    : null;

  return (
    <div className={`rounded-xl px-3.5 py-3 border ${containerCls}`}>
      {/* Row 1: Email + Status badge */}
      <div className="flex items-start justify-between gap-2">
        <p className="text-sm font-medium break-all flex-1 min-w-0">{invite.email}</p>
        <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border inline-flex items-center gap-1 whitespace-nowrap ${statusBadge.cls}`}>
          <StatusIcon className="h-3 w-3" />
          {statusBadge.label}
        </span>
      </div>

      {/* Role */}
      <div className="flex items-center gap-2 mt-1.5">
        <StaffRoleBadge role={invite.permission_level as AppRole} size="sm" />
      </div>

      {/* Meta */}
      <dl className="mt-2 space-y-0.5 text-[11px] text-muted-foreground">
        <div><span className="text-foreground/70">{sentLine}</span></div>
        {resentLine && <div><span className="text-foreground/70">{resentLine}</span></div>}
        <div className={isExpired ? 'text-destructive font-medium' : ''}>{expiryLine}</div>
        {invite.invited_by_name && <div>Invited by {invite.invited_by_name}</div>}
      </dl>

      {/* Actions */}
      {canManage && (isPending || isExpired) && (
        <div className="mt-3 flex flex-wrap gap-2">
          <Button
            type="button"
            size="sm"
            variant="default"
            className="h-11 min-w-[110px] gap-1.5"
            onClick={onResend}
          >
            <Mail className="h-3.5 w-3.5" />
            {isExpired ? 'Send again' : 'Resend'}
          </Button>
          {isPending && (
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="h-11 min-w-[110px] gap-1.5"
              onClick={onCopyLink}
            >
              <Link2 className="h-3.5 w-3.5" />
              Copy link
            </Button>
          )}
          {isPending && (
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="h-11 min-w-[100px] gap-1.5 text-destructive hover:text-destructive border-destructive/30 hover:bg-destructive/10"
              onClick={onCancel}
            >
              <X className="h-3.5 w-3.5" />
              Cancel
            </Button>
          )}
        </div>
      )}
    </div>
  );
}

