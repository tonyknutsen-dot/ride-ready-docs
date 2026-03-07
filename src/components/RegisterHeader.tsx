import { ReactNode } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Filter, ChevronDown, Search, X, CalendarIcon, FileText, Eye } from 'lucide-react';
import { format, subMonths, parseISO } from 'date-fns';
import { cn } from '@/lib/utils';

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
  /** Action buttons */
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
  onViewReport: (filePath: string) => void;
  /** Extra content between stop-use banner and search */
  extraContent?: ReactNode;
}

const RegisterHeader = ({
  resultCount,
  totalCount,
  hasActiveFilters,
  searchTerm,
  onSearchChange,
  searchPlaceholder = 'Search…',
  actions,
  filtersOpen,
  onFiltersOpenChange,
  filterContent,
  dateFrom,
  dateTo,
  onDateFromChange,
  onDateToChange,
  savedReports,
  onViewReport,
  extraContent,
}: RegisterHeaderProps) => {
  return (
    <>
      {/* ── Action buttons ── */}
      <div className="flex flex-wrap items-center gap-1.5">
        {actions.map((action, i) => (
          <Button
            key={i}
            variant={action.variant || (i === 0 ? 'default' : 'outline')}
            size="sm"
            onClick={action.onClick}
            disabled={action.disabled}
            className={cn(
              'gap-1.5 h-10 min-h-[44px] text-[12px] px-3',
              i === 0 && 'sm:w-auto w-full'
            )}
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

      {extraContent}

      {/* ── Search bar ── */}
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

      {/* ── Collapsible Filters & date range ── */}
      <Collapsible open={filtersOpen} onOpenChange={onFiltersOpenChange}>
        <CollapsibleTrigger asChild>
          <button
            className="w-full flex items-center justify-between gap-2 rounded-xl border px-3 py-2.5 text-[13px] font-medium text-muted-foreground hover:text-foreground transition-colors mt-3"
            style={{
              borderColor: hasActiveFilters ? 'hsl(var(--primary))' : 'hsl(var(--border))',
              background: hasActiveFilters ? 'hsl(var(--primary) / 0.05)' : 'hsl(var(--background))',
            }}
          >
            <div className="flex items-center gap-2">
              <Filter className="h-3.5 w-3.5" />
              <span>{hasActiveFilters ? 'Filters active' : 'Filters & date range'}</span>
            </div>
            <ChevronDown className={cn('h-3.5 w-3.5 transition-transform', filtersOpen && 'rotate-180')} />
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

      {/* ── Result count + export hint ── */}
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

/** Shared "Previously Generated Reports" section */
export const PreviousReportsSection = ({
  reports,
  onViewReport,
}: {
  reports: Array<{ id: string; document_name: string; uploaded_at: string; file_path: string }>;
  onViewReport: (filePath: string) => void;
}) => {
  const handleDownload = async (filePath: string, fileName: string) => {
    try {
      const { data } = await (await import('@/integrations/supabase/client')).supabase.storage
        .from('ride-documents')
        .createSignedUrl(filePath, 300);
      if (data?.signedUrl) {
        const a = document.createElement('a');
        a.href = data.signedUrl;
        a.download = fileName;
        a.target = '_blank';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
      }
    } catch (err) {
      console.error('Download failed:', err);
    }
  };

  const handleShare = async (filePath: string, fileName: string) => {
    try {
      const { data } = await (await import('@/integrations/supabase/client')).supabase.storage
        .from('ride-documents')
        .createSignedUrl(filePath, 300);
      if (data?.signedUrl && navigator.share) {
        const response = await fetch(data.signedUrl);
        const blob = await response.blob();
        const file = new File([blob], fileName, { type: blob.type });
        await navigator.share({ files: [file], title: fileName });
      } else if (data?.signedUrl) {
        handleDownload(filePath, fileName);
      }
    } catch (err: any) {
      if (err?.name !== 'AbortError') {
        handleDownload(filePath, fileName);
      }
    }
  };

  return (
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
        reports.map((report) => (
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
            <div className="flex items-center gap-1.5">
              <Button variant="ghost" size="sm" onClick={() => onViewReport(report.file_path)} className="h-8 text-[11px] gap-1 flex-1 min-h-[36px]">
                <Eye className="h-3 w-3" /> View
              </Button>
              <Button variant="ghost" size="sm" onClick={() => handleDownload(report.file_path, report.document_name)} className="h-8 text-[11px] gap-1 flex-1 min-h-[36px]">
                <Download className="h-3 w-3" /> Download
              </Button>
              <Button variant="ghost" size="sm" onClick={() => handleShare(report.file_path, report.document_name)} className="h-8 text-[11px] gap-1 flex-1 min-h-[36px]">
                <Share2 className="h-3 w-3" /> Share
              </Button>
            </div>
          </div>
        ))
      )}
    </div>
  );
};

export default RegisterHeader;
