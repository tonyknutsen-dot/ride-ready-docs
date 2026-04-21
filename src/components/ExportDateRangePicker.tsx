import { useState } from 'react';
import { format } from 'date-fns';
import { CalendarIcon } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';

export type DateRangePreset = '7d' | '30d' | '3m' | '6m' | '12m' | 'custom' | 'all';

export interface DateRange {
  from: Date | null;
  to: Date | null;
  preset: DateRangePreset;
}

const PRESETS: { value: DateRangePreset; label: string; days: number | null }[] = [
  { value: '7d',  label: '7 days',    days: 7 },
  { value: '30d', label: '30 days',   days: 30 },
  { value: '3m',  label: '3 months',  days: 90 },
  { value: '6m',  label: '6 months',  days: 180 },
  { value: '12m', label: '12 months', days: 365 },
  { value: 'all', label: 'All time',  days: null },
];

export const computeRangeFromPreset = (preset: DateRangePreset): { from: Date | null; to: Date | null } => {
  if (preset === 'all' || preset === 'custom') return { from: null, to: null };
  const config = PRESETS.find(p => p.value === preset);
  if (!config?.days) return { from: null, to: null };
  const to = new Date();
  const from = new Date();
  from.setDate(from.getDate() - config.days);
  return { from, to };
};

/** Format range for filenames: e.g. "2026-03-21_to_2026-04-21" or "all-time" */
export const formatRangeForFilename = (range: DateRange): string => {
  if (range.preset === 'all' || (!range.from && !range.to)) return 'all-time';
  const from = range.from ? format(range.from, 'yyyy-MM-dd') : 'start';
  const to = range.to ? format(range.to, 'yyyy-MM-dd') : 'now';
  return `${from}_to_${to}`;
};

/** Human-readable label for report metadata: e.g. "21 Mar 2026 – 21 Apr 2026" */
export const formatRangeForMetadata = (range: DateRange): string => {
  if (range.preset === 'all' || (!range.from && !range.to)) return 'All time';
  const from = range.from ? format(range.from, 'd MMM yyyy') : '—';
  const to = range.to ? format(range.to, 'd MMM yyyy') : '—';
  return `${from} – ${to}`;
};

interface ExportDateRangePickerProps {
  value: DateRange;
  onChange: (range: DateRange) => void;
  className?: string;
  /** Show "All time" preset (default true) */
  allowAllTime?: boolean;
}

const ExportDateRangePicker = ({ value, onChange, className, allowAllTime = true }: ExportDateRangePickerProps) => {
  const [customOpen, setCustomOpen] = useState(false);

  const presets = allowAllTime ? PRESETS : PRESETS.filter(p => p.value !== 'all');

  const handlePreset = (preset: DateRangePreset) => {
    const { from, to } = computeRangeFromPreset(preset);
    onChange({ from, to, preset });
  };

  return (
    <div className={cn('space-y-2', className)}>
      <div className="flex items-center justify-between">
        <label className="text-xs font-medium text-foreground">Date range</label>
        <span className="text-[11px] text-muted-foreground">{formatRangeForMetadata(value)}</span>
      </div>

      <div className="flex flex-wrap gap-1.5">
        {presets.map((p) => (
          <button
            key={p.value}
            type="button"
            onClick={() => handlePreset(p.value)}
            className={cn(
              'px-2.5 py-1 rounded-md text-[12px] font-medium border transition-colors',
              value.preset === p.value
                ? 'bg-primary text-primary-foreground border-primary'
                : 'bg-card text-foreground border-border hover:bg-muted/50',
            )}
          >
            {p.label}
          </button>
        ))}

        <Popover open={customOpen} onOpenChange={setCustomOpen}>
          <PopoverTrigger asChild>
            <Button
              type="button"
              variant={value.preset === 'custom' ? 'default' : 'outline'}
              size="sm"
              className="h-7 px-2.5 text-[12px] gap-1"
            >
              <CalendarIcon className="h-3 w-3" />
              Custom
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" align="start">
            <Calendar
              mode="range"
              selected={value.from && value.to ? { from: value.from, to: value.to } : undefined}
              onSelect={(range: any) => {
                onChange({
                  from: range?.from ?? null,
                  to: range?.to ?? null,
                  preset: 'custom',
                });
                if (range?.from && range?.to) setCustomOpen(false);
              }}
              numberOfMonths={1}
              className={cn('p-3 pointer-events-auto')}
            />
          </PopoverContent>
        </Popover>
      </div>
    </div>
  );
};

export default ExportDateRangePicker;
