import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { X, Filter, ArrowUpDown } from 'lucide-react';
import { cn } from '@/lib/utils';

export type KpiFilter =
  | 'all'
  | 'suspended'
  | 'admins'
  | 'testers'
  | 'staff'
  | 'pending_invites';

export type AccountStatusFilter = 'any' | 'active' | 'suspended';
export type PlatformRoleFilter = 'any' | 'admin' | 'tester' | 'user';
export type OrgRoleFilter = 'any' | 'controller' | 'staff' | 'none';
export type BillingFilter = 'any' | 'active' | 'trial' | 'past_due' | 'expired' | 'no_subscription';
export type SortOption = 'recent' | 'name_asc' | 'name_desc' | 'status' | 'company';

export interface UserFilters {
  kpi: KpiFilter;
  accountStatus: AccountStatusFilter;
  platformRole: PlatformRoleFilter;
  orgRole: OrgRoleFilter;
  billing: BillingFilter;
  sort: SortOption;
}

export const DEFAULT_FILTERS: UserFilters = {
  kpi: 'all',
  accountStatus: 'any',
  platformRole: 'any',
  orgRole: 'any',
  billing: 'any',
  sort: 'recent',
};

export function hasActiveFilters(filters: UserFilters): boolean {
  return (
    filters.kpi !== 'all' ||
    filters.accountStatus !== 'any' ||
    filters.platformRole !== 'any' ||
    filters.orgRole !== 'any' ||
    filters.billing !== 'any'
  );
}

interface KpiCardProps {
  label: string;
  count: number;
  filterKey: KpiFilter;
  active: boolean;
  onClick: (key: KpiFilter) => void;
  className?: string;
}

function KpiCard({ label, count, filterKey, active, onClick, className }: KpiCardProps) {
  return (
    <button
      onClick={() => onClick(filterKey)}
      className={cn(
        'rounded-lg border p-3 text-left transition-all cursor-pointer',
        active
          ? 'border-primary bg-primary/5 ring-1 ring-primary/30 shadow-sm'
          : 'border-border bg-card hover:border-primary/40 hover:bg-muted/50',
        className,
      )}
    >
      <p className="text-[11px] font-medium text-muted-foreground leading-tight mb-1">{label}</p>
      <p className={cn('text-xl font-bold', active ? 'text-primary' : 'text-foreground')}>{count}</p>
    </button>
  );
}

interface KpiCardsProps {
  counts: {
    total: number;
    suspended: number;
    admins: number;
    testers: number;
    staff: number;
    pendingInvites: number;
  };
  activeKpi: KpiFilter;
  onKpiClick: (key: KpiFilter) => void;
}

export function KpiCards({ counts, activeKpi, onKpiClick }: KpiCardsProps) {
  return (
    <div className="grid grid-cols-3 gap-2 md:grid-cols-6 md:gap-3">
      <KpiCard label="All Users" count={counts.total} filterKey="all" active={activeKpi === 'all'} onClick={onKpiClick} />
      <KpiCard label="Suspended" count={counts.suspended} filterKey="suspended" active={activeKpi === 'suspended'} onClick={onKpiClick} className={counts.suspended > 0 ? 'text-destructive' : ''} />
      <KpiCard label="Admins" count={counts.admins} filterKey="admins" active={activeKpi === 'admins'} onClick={onKpiClick} />
      <KpiCard label="Testers" count={counts.testers} filterKey="testers" active={activeKpi === 'testers'} onClick={onKpiClick} />
      <KpiCard label="Staff" count={counts.staff} filterKey="staff" active={activeKpi === 'staff'} onClick={onKpiClick} />
      <KpiCard label="Pending Invites" count={counts.pendingInvites} filterKey="pending_invites" active={activeKpi === 'pending_invites'} onClick={onKpiClick} />
    </div>
  );
}

interface FilterBarProps {
  filters: UserFilters;
  onChange: (filters: UserFilters) => void;
  onClear: () => void;
}

export function FilterBar({ filters, onChange, onClear }: FilterBarProps) {
  const active = hasActiveFilters(filters);

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground shrink-0">
          <Filter className="h-3.5 w-3.5" />
          Filters
        </div>

        <Select
          value={filters.accountStatus}
          onValueChange={(v) => onChange({ ...filters, accountStatus: v as AccountStatusFilter })}
        >
          <SelectTrigger className="h-8 w-auto min-w-[120px] text-xs">
            <SelectValue placeholder="Account" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="any">Any Account</SelectItem>
            <SelectItem value="active">Active</SelectItem>
            <SelectItem value="suspended">Suspended</SelectItem>
          </SelectContent>
        </Select>

        <Select
          value={filters.platformRole}
          onValueChange={(v) => onChange({ ...filters, platformRole: v as PlatformRoleFilter })}
        >
          <SelectTrigger className="h-8 w-auto min-w-[120px] text-xs">
            <SelectValue placeholder="Platform" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="any">Any Platform</SelectItem>
            <SelectItem value="admin">Admin</SelectItem>
            <SelectItem value="tester">Tester</SelectItem>
            <SelectItem value="user">User</SelectItem>
          </SelectContent>
        </Select>

        <Select
          value={filters.orgRole}
          onValueChange={(v) => onChange({ ...filters, orgRole: v as OrgRoleFilter })}
        >
          <SelectTrigger className="h-8 w-auto min-w-[110px] text-xs">
            <SelectValue placeholder="Org Role" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="any">Any Org Role</SelectItem>
            <SelectItem value="controller">Controller</SelectItem>
            <SelectItem value="staff">Staff</SelectItem>
            <SelectItem value="none">None</SelectItem>
          </SelectContent>
        </Select>

        <Select
          value={filters.billing}
          onValueChange={(v) => onChange({ ...filters, billing: v as BillingFilter })}
        >
          <SelectTrigger className="h-8 w-auto min-w-[130px] text-xs">
            <SelectValue placeholder="Billing" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="any">Any Billing</SelectItem>
            <SelectItem value="active">Active</SelectItem>
            <SelectItem value="trial">Trial</SelectItem>
            <SelectItem value="past_due">Past Due</SelectItem>
            <SelectItem value="expired">Expired</SelectItem>
            <SelectItem value="no_subscription">No Subscription</SelectItem>
          </SelectContent>
        </Select>

        <div className="flex items-center gap-1.5 text-xs text-muted-foreground shrink-0 ml-auto">
          <ArrowUpDown className="h-3.5 w-3.5" />
          Sort
        </div>
        <Select
          value={filters.sort}
          onValueChange={(v) => onChange({ ...filters, sort: v as SortOption })}
        >
          <SelectTrigger className="h-8 w-auto min-w-[130px] text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="recent">Recently Joined</SelectItem>
            <SelectItem value="name_asc">Name A–Z</SelectItem>
            <SelectItem value="name_desc">Name Z–A</SelectItem>
            <SelectItem value="status">Status</SelectItem>
            <SelectItem value="company">Company</SelectItem>
          </SelectContent>
        </Select>

        {active && (
          <Button variant="ghost" size="sm" className="h-8 px-2 text-xs gap-1" onClick={onClear}>
            <X className="h-3.5 w-3.5" />
            Clear
          </Button>
        )}
      </div>

      {/* Active filter chips */}
      {active && (
        <div className="flex flex-wrap items-center gap-1.5">
          {filters.kpi !== 'all' && (
            <Badge variant="secondary" className="text-xs gap-1 pr-1">
              {filters.kpi.replace('_', ' ')}
              <button onClick={() => onChange({ ...filters, kpi: 'all' })} className="ml-0.5 rounded-full hover:bg-muted p-0.5">
                <X className="h-3 w-3" />
              </button>
            </Badge>
          )}
          {filters.accountStatus !== 'any' && (
            <Badge variant="secondary" className="text-xs gap-1 pr-1">
              Account: {filters.accountStatus}
              <button onClick={() => onChange({ ...filters, accountStatus: 'any' })} className="ml-0.5 rounded-full hover:bg-muted p-0.5">
                <X className="h-3 w-3" />
              </button>
            </Badge>
          )}
          {filters.platformRole !== 'any' && (
            <Badge variant="secondary" className="text-xs gap-1 pr-1">
              Platform: {filters.platformRole}
              <button onClick={() => onChange({ ...filters, platformRole: 'any' })} className="ml-0.5 rounded-full hover:bg-muted p-0.5">
                <X className="h-3 w-3" />
              </button>
            </Badge>
          )}
          {filters.orgRole !== 'any' && (
            <Badge variant="secondary" className="text-xs gap-1 pr-1">
              Org: {filters.orgRole}
              <button onClick={() => onChange({ ...filters, orgRole: 'any' })} className="ml-0.5 rounded-full hover:bg-muted p-0.5">
                <X className="h-3 w-3" />
              </button>
            </Badge>
          )}
          {filters.billing !== 'any' && (
            <Badge variant="secondary" className="text-xs gap-1 pr-1">
              Billing: {filters.billing.replace('_', ' ')}
              <button onClick={() => onChange({ ...filters, billing: 'any' })} className="ml-0.5 rounded-full hover:bg-muted p-0.5">
                <X className="h-3 w-3" />
              </button>
            </Badge>
          )}
        </div>
      )}
    </div>
  );
}
