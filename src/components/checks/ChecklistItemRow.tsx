import { ReactNode } from 'react';
import { AlertTriangle, CheckCircle2, CheckSquare, GripVertical, Library, MinusCircle, Sparkles, XCircle } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { SourcePill, type ItemSource } from './SourcePill';

export type ChecklistRowResult = 'pass' | 'fail' | 'na' | 'pending';
export type ChecklistIconKey = 'alert' | 'specific' | 'general' | 'custom' | 'library' | 'check';
export type ChecklistRiskLevel = 'high' | 'med' | 'low' | 'standard';

export interface ChecklistItemRowProps {
  text: string;
  hint?: string | null;
  source?: ItemSource;
  rideTypeName?: string;
  riskLevel?: ChecklistRiskLevel | string | null;
  categoryLabel?: string | null;
  iconKey?: ChecklistIconKey;
  result?: ChecklistRowResult;
  index?: number;
  selected?: boolean;
  required?: boolean;
  compact?: boolean;
  disabled?: boolean;
  draggable?: boolean;
  dataItemId?: string;
  onSelectedChange?: (checked: boolean) => void;
  actions?: ReactNode;
  children?: ReactNode;
  className?: string;
}

export interface ChecklistTabOption<T extends string> {
  key: T;
  label: string;
  count?: number;
}

const getSourceIcon = (source?: ItemSource, riskLevel?: string | null, iconKey?: ChecklistIconKey) => {
  const key = iconKey || getChecklistIconKey(source, riskLevel);
  if (key === 'alert') return AlertTriangle;
  if (key === 'specific') return Sparkles;
  if (key === 'general' || key === 'library') return Library;
  return CheckSquare;
};

const getResultMeta = (result?: ChecklistRowResult) => {
  switch (result) {
    case 'pass':
      return { icon: CheckCircle2, label: 'Pass', row: 'border-success/40 bg-success/5', mark: 'bg-success text-success-foreground', text: 'text-success' };
    case 'fail':
      return { icon: XCircle, label: 'Fail', row: 'border-destructive/50 bg-destructive/5', mark: 'bg-destructive text-destructive-foreground', text: 'text-destructive' };
    case 'na':
      return { icon: MinusCircle, label: 'N/A', row: 'border-warning/40 bg-warning/5', mark: 'bg-warning text-warning-foreground', text: 'text-warning' };
    default:
      return { icon: CheckSquare, label: 'Pending', row: 'border-border bg-card', mark: 'bg-secondary text-secondary-foreground border border-border', text: 'text-muted-foreground' };
  }
};

const getSourceRowClass = (source?: ItemSource) => {
  switch (source) {
    case 'specific': return 'border-primary/35 bg-primary/5';
    case 'general':
    case 'library': return 'border-primary/30 bg-primary/5';
    case 'custom': return 'border-warning/35 bg-warning/5';
    default: return 'border-border bg-card';
  }
};

const getSourceIconClass = (source?: ItemSource, riskLevel?: string | null) => {
  if (riskLevel === 'high') return 'text-destructive';
  if (source === 'specific') return 'text-primary';
  if (source === 'general' || source === 'library') return 'text-primary';
  if (source === 'custom') return 'text-warning';
  return 'text-muted-foreground';
};

const getRiskBadgeClass = (level?: string | null) => {
  switch (level) {
    case 'high': return 'bg-destructive/10 text-destructive border-destructive/30';
    case 'med': return 'bg-warning/10 text-warning border-warning/30';
    case 'low': return 'bg-success/10 text-success border-success/30';
    case 'standard': return 'bg-primary/10 text-primary border-primary/30';
    default: return 'bg-primary/10 text-primary border-primary/30';
  }
};

const getRiskBadgeLabel = (level?: string | null) => {
  if (!level || level === 'standard') return 'STANDARD CHECK';
  return `${level.toUpperCase()} RISK`;
};

export const normalizeChecklistSource = (value?: string | null): ItemSource => {
  const normalized = (value || '').toLowerCase();
  if (['specific', 'general', 'custom', 'library', 'existing'].includes(normalized)) {
    return normalized as ItemSource;
  }
  return normalized ? 'existing' : 'general';
};

export const normalizeChecklistRiskLevel = (value?: string | null): ChecklistRiskLevel => {
  const normalized = (value || '').toLowerCase();
  if (normalized === 'high' || normalized === 'med' || normalized === 'low') return normalized;
  return 'standard';
};

export const getChecklistIconKey = (source?: ItemSource, riskLevel?: string | null): ChecklistIconKey => {
  if (riskLevel === 'high') return 'alert';
  if (source === 'specific') return 'specific';
  if (source === 'general') return 'general';
  if (source === 'library') return 'library';
  if (source === 'custom') return 'custom';
  return 'check';
};

export function ChecklistSegmentedTabs<T extends string>({
  options,
  value,
  onChange,
  className,
}: {
  options: ChecklistTabOption<T>[];
  value: T;
  onChange: (value: T) => void;
  className?: string;
}) {
  return (
    <div className={cn('flex gap-1 rounded-lg border border-border bg-card p-1 shadow-sm', className)}>
      {options.map((option) => {
        const active = value === option.key;
        return (
          <button
            key={option.key}
            type="button"
            onClick={() => onChange(option.key)}
            className={cn(
              'flex-1 rounded-md px-2 py-1.5 text-[11px] font-semibold leading-none transition-colors',
              active
                ? 'bg-primary text-primary-foreground shadow-sm'
                : 'bg-transparent text-foreground hover:bg-secondary'
            )}
          >
            <span>{option.label}</span>
            {typeof option.count === 'number' && <span className="ml-1 opacity-80">({option.count})</span>}
          </button>
        );
      })}
    </div>
  );
}

export function ChecklistItemRow({
  text,
  hint,
  source = 'general',
  rideTypeName,
  riskLevel,
  categoryLabel,
  iconKey,
  result,
  index,
  selected,
  required,
  compact,
  disabled,
  draggable,
  dataItemId,
  onSelectedChange,
  actions,
  children,
  className,
}: ChecklistItemRowProps) {
  const status = getResultMeta(result);
  const normalizedRisk = normalizeChecklistRiskLevel(riskLevel);
  const SourceIcon = getSourceIcon(source, normalizedRisk, iconKey);
  const StatusIcon = status.icon;
  const selectable = !!onSelectedChange;
  const sourceRowClass = getSourceRowClass(source);
  const Root = selectable ? 'label' : 'div';

  return (
    <Root
      data-item-id={dataItemId}
      className={cn(
        'block rounded-lg border shadow-sm transition-colors',
        result ? status.row : sourceRowClass,
        selectable && !disabled ? 'cursor-pointer hover:border-primary/45 hover:bg-primary/5' : 'hover:bg-card-hover',
        disabled && 'opacity-60',
        compact ? 'p-2' : 'p-2.5 md:p-3',
        className
      )}
    >
      <div className="flex items-start gap-2.5">
        {selectable ? (
          <input
            type="checkbox"
            checked={!!selected}
            disabled={disabled}
            onChange={(event) => onSelectedChange?.(event.target.checked)}
            className="mt-0.5 h-4 w-4 shrink-0 cursor-pointer accent-primary"
          />
        ) : (
          <div className={cn('mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[12px] font-bold', status.mark)}>
            {result ? <StatusIcon className="h-4 w-4" /> : draggable ? <GripVertical className="h-4 w-4" /> : index != null ? index + 1 : <SourceIcon className="h-3.5 w-3.5" />}
          </div>
        )}

        <div className="min-w-0 flex-1">
          <div className="flex items-start gap-2">
            <SourceIcon className={cn('mt-0.5 h-3.5 w-3.5 shrink-0', getSourceIconClass(source, normalizedRisk))} />
            <p className="min-w-0 flex-1 break-words text-sm font-semibold leading-snug text-foreground">
              {text}{required && <span className="ml-1 text-destructive">*</span>}
            </p>
            <div className="flex shrink-0 items-center gap-1.5">
              {result && (
                <Badge className={cn('border text-[10px] font-bold', status.row, status.text)}>{status.label}</Badge>
              )}
              <SourcePill source={source} rideTypeName={rideTypeName} />
              {actions}
            </div>
          </div>

          {hint && <p className="mt-1 line-clamp-2 text-[11px] leading-snug text-muted-foreground md:text-xs">{hint}</p>}

          <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
            <Badge variant="outline" className={cn('h-5 border px-1.5 text-[10px] font-bold', getRiskBadgeClass(normalizedRisk))}>
              {getRiskBadgeLabel(normalizedRisk)}
            </Badge>
            {categoryLabel && (
              <Badge variant="outline" className="h-5 border-border bg-card px-1.5 text-[10px] font-medium text-muted-foreground">
                {categoryLabel}
              </Badge>
            )}
          </div>

          {children && <div className="mt-2">{children}</div>}
        </div>
      </div>
    </Root>
  );
}

export default ChecklistItemRow;