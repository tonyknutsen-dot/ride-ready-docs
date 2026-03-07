import { ReactNode, useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Filter, ChevronDown, Search, X, CalendarIcon, FileText, Download, Link2 } from 'lucide-react';
import { format, subMonths, parseISO } from 'date-fns';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';
import {
  downloadBlob,
  getSignedStorageUrl,
  getStorageFileBlob,
} from '@/utils/exportFileActions';

interface ActionButton {
  label: string;
  icon: ReactNode;
  onClick: () => void;
  variant?: 'default' | 'outline';
  disabled?: boolean;
  loading?: boolean;
}

interface SavedReport {
  id: string;
  document_name: string;
  uploaded_at: string;
  file_path: string;
  mime_type?: string | null;
}

interface RegisterHeaderProps {
  /** Count text e.g. "12 defects" */
  resultCount: string;
  /** Total unfiltered count for "filtered from X" */
  totalCount?: number;
  /** Whether filters are active */
  hasActiveFilters: boolean;
  /** Search */
  searchTerm: string;
  onSearchChange: (value: string) => void;
  searchPlaceholder?: string;
  /** Primary CTA (dominant button) — rendered separately above search */
  primaryAction?: ActionButton;
  /** Export / secondary action buttons */
  actions: ActionButton[];
  /** Filter section */
  filtersOpen: boolean;
  onFiltersOpenChange: (open: boolean) => void;
  filterContent: ReactNode;
  /** Date range (shared across all registers) */
  dateFrom?: Date;
  dateTo?: Date;
  onDateFromChange: (date: Date | undefined) => void;
  onDateToChange: (date: Date | undefined) => void;
  /** Previously generated reports */
  savedReports: SavedReport[];
  /** @deprecated No longer needed — PreviousReportsSection handles viewing internally */
  onViewReport?: (filePath: string) => void;
  /** Extra content between CTA and search */
  extraContent?: ReactNode;
  /** Collapsed state summary text (e.g. "Status: Open • Last 30 days") */
  filterSummary?: string;
  /** Number of active filters for collapsed badge */
  activeFilterCount?: number;
}

/** Blur any active input to dismiss keyboard before opening a sheet/dialog */
export function blurActiveInput() {
  if (document.activeElement instanceof HTMLElement) {
    document.activeElement.blur();
  }
}

const RegisterHeader = ({
  resultCount,
  totalCount,
  hasActiveFilters,
  searchTerm,
  onSearchChange,
  searchPlaceholder = 'Search…',
  primaryAction,
  actions,
  filtersOpen,
  onFiltersOpenChange,
  filterContent,
  dateFrom,
  dateTo,
  onDateFromChange,
  onDateToChange,
  filterSummary,
  activeFilterCount = 0,
  extraContent,
}: RegisterHeaderProps) => {
  const collapsedSummaryText = hasActiveFilters
    ? (filterSummary || `${activeFilterCount || 'Some'} filter${activeFilterCount === 1 ? '' : 's'} active`)
    : 'No filters applied';

  return (
    <>
      {/* ── 1. Primary CTA ── */}
      {primaryAction && (
        <Button
          onClick={() => { blurActiveInput(); primaryAction.onClick(); }}
          disabled={primaryAction.disabled}
          className="gap-1.5 h-10 min-h-[44px] w-full sm:w-auto text-[12px]"
        >
          {primaryAction.loading ? (
            <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-current" />
          ) : (
            primaryAction.icon
          )}
          {primaryAction.label}
        </Button>
      )}

      {extraContent}

      {/* ── 2. Search bar ── */}
      <div className="relative mt-3">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          value={searchTerm}
          onChange={(e) => onSearchChange(e.target.value)}
          placeholder={searchPlaceholder}
          className="pl-9 h-10 rounded-xl"
        />
        {searchTerm && (
          <button onClick={() => onSearchChange('')} className="absolute right-3 top-1/2 -translate-y-1/2">
            <X className="h-3.5 w-3.5 text-muted-foreground" />
          </button>
        )}
      </div>

      {/* ── 3. Collapsible Filters & date range ── */}
      <Collapsible open={filtersOpen} onOpenChange={onFiltersOpenChange}>
        <CollapsibleTrigger asChild>
          <button
            className={cn(
              'w-full flex items-center justify-between gap-2 rounded-xl border px-3 py-2.5 text-[13px] font-medium transition-colors mt-3 text-left',
              hasActiveFilters
                ? 'border-primary bg-primary/5 text-foreground'
                : 'border-border bg-background text-muted-foreground hover:text-foreground',
            )}
          >
            <div className="min-w-0 flex items-center gap-2">
              <Filter className="h-3.5 w-3.5 shrink-0" />
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <span>{hasActiveFilters ? 'Filters active' : 'Filters & date range'}</span>
                  {hasActiveFilters && activeFilterCount > 0 && (
                    <Badge className="h-5 px-1.5 py-0 text-[10px] bg-primary/15 text-primary border border-primary/30">
                      {activeFilterCount}
                    </Badge>
                  )}
                </div>
                {!filtersOpen && (
                  <p className="text-[11px] text-muted-foreground truncate mt-0.5">
                    {collapsedSummaryText}
                  </p>
                )}
              </div>
            </div>
            <ChevronDown className={cn('h-3.5 w-3.5 shrink-0 transition-transform', filtersOpen && 'rotate-180')} />
          </button>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <div className="mt-2 rounded-xl border bg-card p-3 space-y-3">
            {/* Shared date range */}
            <div className="grid grid-cols-2 gap-2.5">
              <div className="space-y-1">
                <Label className="text-[11px] font-medium text-muted-foreground">From</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" size="sm" className={cn('w-full justify-start text-left h-9 text-[12px]', !dateFrom && 'text-muted-foreground')}>
                      <CalendarIcon className="mr-1.5 h-3.5 w-3.5" />
                      {dateFrom ? format(dateFrom, 'dd/MM/yyyy') : 'Start date'}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar mode="single" selected={dateFrom} onSelect={(d) => onDateFromChange(d || undefined)} initialFocus className="pointer-events-auto" />
                  </PopoverContent>
                </Popover>
              </div>
              <div className="space-y-1">
                <Label className="text-[11px] font-medium text-muted-foreground">To</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" size="sm" className={cn('w-full justify-start text-left h-9 text-[12px]', !dateTo && 'text-muted-foreground')}>
                      <CalendarIcon className="mr-1.5 h-3.5 w-3.5" />
                      {dateTo ? format(dateTo, 'dd/MM/yyyy') : 'End date'}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar mode="single" selected={dateTo} onSelect={(d) => onDateToChange(d || undefined)} initialFocus className="pointer-events-auto" />
                  </PopoverContent>
                </Popover>
              </div>
            </div>

            {/* Quick date presets */}
            <div className="flex flex-wrap gap-1.5">
              {[
                { label: 'Last 3 months', from: subMonths(new Date(), 3), to: new Date() },
                { label: 'Last 6 months', from: subMonths(new Date(), 6), to: new Date() },
                { label: 'Last 12 months', from: subMonths(new Date(), 12), to: new Date() },
              ].map(p => (
                <button key={p.label} onClick={() => { onDateFromChange(p.from); onDateToChange(p.to); }}
                  className="text-[11px] px-2.5 py-1 rounded-full border border-border bg-muted/50 text-muted-foreground hover:text-foreground hover:bg-muted transition-colors">
                  {p.label}
                </button>
              ))}
            </div>

            {/* Module-specific filter content */}
            {filterContent}
          </div>
        </CollapsibleContent>
      </Collapsible>

      {/* ── 4. Export actions ── */}
      {actions.length > 0 && (
        <div className="flex flex-wrap items-center gap-1.5 mt-3">
          {actions.map((action, i) => (
            <Button
              key={i}
              variant={action.variant || 'outline'}
              size="sm"
              onClick={action.onClick}
              disabled={action.disabled}
              className="gap-1.5 h-9 min-h-[40px] text-[12px] px-3"
            >
              {action.loading ? (
                <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-current" />
              ) : (
                action.icon
              )}
              {action.label}
            </Button>
          ))}
        </div>
      )}

      {/* ── 5. Result count + export hint ── */}
      <div className="space-y-1 mt-3">
        <p className="text-[13px] text-muted-foreground">
          {resultCount}
          {hasActiveFilters && totalCount !== undefined && ` (filtered from ${totalCount})`}
        </p>
        <p className="text-[11px] text-muted-foreground text-center">
          Exports include the current filters and date range
        </p>
      </div>
    </>
  );
};

/** Shared "Previously Generated Reports" section — self-contained with in-app PDF viewer */
export const PreviousReportsSection = ({
  reports,
}: {
  reports: Array<{ id: string; document_name: string; uploaded_at: string; file_path: string; mime_type?: string | null }>;
  /** @deprecated kept for backwards compat but ignored */
  onViewReport?: (filePath: string) => void;
}) => {
  const { toast } = useToast();

  const handleDownload = async (filePath: string, fileName: string) => {
    try {
      const blob = await getStorageFileBlob(filePath);
      downloadBlob(blob, fileName);
    } catch (error) {
      console.error('[History] download-failed', { storagePath: filePath, fileName, error });
      toast({ title: 'Download failed', description: 'Could not download the report file.', variant: 'destructive' });
    }
  };

  const handleShare = async (report: { file_path: string; document_name: string }) => {
    try {
      const outcome = await shareStoredFileOrFallback(report.file_path, report.document_name);
      if (outcome === 'copied') {
        toast({ title: 'Link copied', description: 'Signed link valid for 1 hour.' });
      } else if (outcome === 'downloaded') {
        toast({ title: 'Downloaded', description: 'Native sharing unavailable, file downloaded instead.' });
      }
    } catch {
      toast({ title: 'Share failed', description: 'Could not share this report.', variant: 'destructive' });
    }
  };

  const handleCopyLink = async (report: { file_path: string }) => {
    try {
      const signedUrl = await getSignedStorageUrl(report.file_path);
      if (!signedUrl) throw new Error('No signed URL');
      await navigator.clipboard.writeText(signedUrl);
      toast({ title: 'Link copied', description: 'Signed link valid for 1 hour.' });
    } catch {
      toast({ title: 'Copy link failed', description: 'Could not copy link.', variant: 'destructive' });
    }
  };

  return (
    <>
      <div className="space-y-2 pt-4 border-t">
        <h4 className="text-[13px] font-semibold text-muted-foreground">Previously Generated Reports</h4>
        {reports.length === 0 ? (
          <div className="flex flex-col items-center py-6 text-center">
            <div className="h-10 w-10 rounded-full bg-muted/60 flex items-center justify-center mb-2">
              <FileText className="h-4 w-4 text-muted-foreground/40" />
            </div>
            <p className="text-[12px] text-muted-foreground">No saved reports yet.</p>
            <p className="text-[11px] text-muted-foreground mt-0.5">Export a PDF and save it to Documents to see it here.</p>
          </div>
        ) : (
          reports.map((report) => {
            return (
              <div key={report.id} className="bg-card border border-border rounded-xl p-3 space-y-2">
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                      <FileText className="h-4 w-4 text-primary" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-[12px] font-medium text-foreground truncate">{report.document_name}</p>
                      <p className="text-[10px] text-muted-foreground">{format(parseISO(report.uploaded_at), 'd MMM yyyy')}</p>
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-1.5 flex-wrap">
                  <Button variant="ghost" size="sm" onClick={() => handleDownload(report.file_path, report.document_name)} className="h-8 text-[11px] gap-1 min-h-[36px]">
                    <Download className="h-3 w-3" /> Save to Device
                  </Button>
                  <Button variant="ghost" size="sm" onClick={() => handleCopyLink(report)} className="h-8 text-[11px] gap-1 min-h-[36px]">
                    <Link2 className="h-3 w-3" /> Copy Link
                  </Button>
                </div>
              </div>
            );
          })
        )}
      </div>

    </>
  );
};

export default RegisterHeader;
