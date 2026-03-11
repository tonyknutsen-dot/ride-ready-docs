import { useState, useMemo, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useEffectiveUserId } from '@/hooks/useEffectiveUserId';
import { format, formatDistanceToNow, parseISO, isWithinInterval, startOfDay, endOfDay, subMonths } from 'date-fns';
import {
  AlertOctagon, Clock, Wrench, Check, Search, ChevronRight, Camera,
  SlidersHorizontal, ExternalLink, MapPin, User, CalendarDays, ShieldAlert,
  ArrowLeft, FileText, CheckCircle2, Circle, AlertTriangle, Eye,
  FileDown, Filter, ChevronDown, X, Calendar,
} from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar as CalendarComponent } from '@/components/ui/calendar';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { cn } from '@/lib/utils';
import PageHeader from '@/components/PageHeader';
import DefectClosureDialog from '@/components/DefectClosureDialog';
import RegisterHeader, { PreviousReportsSection } from '@/components/RegisterHeader';
import EquipmentPickerDialog from '@/components/EquipmentPickerDialog';

import ExportActionsDialog, { type ExportResult } from '@/components/ExportActionsDialog';
import { useToast } from '@/hooks/use-toast';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import {
  PDF_COLORS, blobToDataUrl, drawSectionTitle, drawSummaryBox,
  PDF_TABLE_HEAD_STYLES, PDF_TABLE_BODY_STYLES, PDF_TABLE_ALT_ROW,
} from '@/utils/pdfUtils';
import { drawTemplateHeader, drawTemplateFooters, generateDocumentId } from '@/utils/pdfTemplate';
import { storeRideDocument, getRideCode } from '@/utils/rideDocumentService';

type DefectSeverity = 'non_urgent' | 'urgent' | 'stop_operation';
type DefectStatus = 'open' | 'acknowledged' | 'in_progress' | 'awaiting_review' | 'resolved';

interface DefectRow {
  id: string;
  description: string;
  severity: DefectSeverity;
  status: DefectStatus;
  location_on_ride: string | null;
  photo_paths: string[] | null;
  reported_at: string;
  resolved_at: string | null;
  resolved_by: string | null;
  resolution_notes: string | null;
  ride_id: string;
  check_id: string | null;
  created_at: string;
  updated_at: string;
  ride_name?: string;
  category_name?: string;
  category_group?: string;
}

const SEVERITY_CONFIG: Record<DefectSeverity, {
  label: string;
  icon: typeof AlertOctagon;
  badgeClass: string;
  sort: number;
  operational: string;
  operationalClass: string;
  operationalIcon: string;
}> = {
  stop_operation: {
    label: 'Stop Use', icon: AlertOctagon,
    badgeClass: 'bg-destructive text-destructive-foreground',
    sort: 0,
    operational: 'Do not operate',
    operationalClass: 'bg-destructive/10 text-destructive border-destructive/30',
    operationalIcon: '⛔',
  },
  urgent: {
    label: 'Important', icon: Wrench,
    badgeClass: 'bg-orange-500 text-white dark:bg-orange-600',
    sort: 1,
    operational: 'Repair required',
    operationalClass: 'bg-orange-50 text-orange-800 dark:bg-orange-900/30 dark:text-orange-300 border-orange-200 dark:border-orange-800/40',
    operationalIcon: '🔧',
  },
  non_urgent: {
    label: 'Low', icon: Clock,
    badgeClass: 'bg-yellow-500 text-white dark:bg-yellow-600',
    sort: 2,
    operational: 'Monitor',
    operationalClass: 'bg-yellow-50 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300 border-yellow-200 dark:border-yellow-800/40',
    operationalIcon: '👁',
  },
};

// ─── Defect Detail Sheet ─────────────────────────────────────
const DefectDetailSheet = ({
  defect, onClose, onCloseDefect, onNavigateToEquipment, photoUrls,
}: {
  defect: DefectRow;
  onClose: () => void;
  onCloseDefect: (d: DefectRow) => void;
  onNavigateToEquipment: (rideId: string) => void;
  photoUrls: string[];
}) => {
  const sev = SEVERITY_CONFIG[defect.severity];
  const SevIcon = sev.icon;
  const isOpen = defect.status !== 'resolved';

  const timeline: { label: string; date: string; icon: typeof Circle; color: string; description?: string }[] = [
    { label: 'Reported', date: defect.reported_at, icon: AlertTriangle, color: 'text-orange-500', description: 'Defect raised and logged' },
  ];
  if (defect.created_at !== defect.updated_at && defect.status !== 'resolved') {
    timeline.push({ label: 'Updated', date: defect.updated_at, icon: FileText, color: 'text-primary', description: 'Record modified' });
  }
  if (defect.resolved_at) {
    const closureDescription = [defect.resolved_by ? `By ${defect.resolved_by}` : 'Defect resolved'];
    if (defect.resolution_notes) {
      const actionLine = defect.resolution_notes.split('\n\nAdditional notes:')[0].trim();
      closureDescription.push(actionLine.length <= 80 ? actionLine : actionLine.slice(0, 77) + '…');
    }
    timeline.push({ label: 'Closed', date: defect.resolved_at, icon: CheckCircle2, color: 'text-green-600 dark:text-green-400', description: closureDescription.join(' · ') });
  }

  return (
    <div className="space-y-0">
      <div className={`flex items-center gap-3 px-4 py-3.5 rounded-xl border ${sev.operationalClass}`}>
        <div className="text-lg leading-none">{sev.operationalIcon}</div>
        <div className="flex-1">
          <p className="text-sm font-bold tracking-tight">{sev.operational}</p>
          <p className="text-[11px] opacity-75 mt-0.5">
            {isOpen ? 'This defect is open' : 'This defect has been closed'} · {sev.label} severity
          </p>
        </div>
        <Badge className={`text-[10px] px-2 py-0.5 ${sev.badgeClass}`}>{sev.label}</Badge>
      </div>

      <section className="pt-7">
        <SectionLabel>Description</SectionLabel>
        <div className="p-4 rounded-xl bg-muted/40 border border-border mt-2">
          <p className="text-sm text-foreground leading-relaxed">{defect.description}</p>
        </div>
      </section>

      <section className="pt-7">
        <SectionLabel>Details</SectionLabel>
        <div className="grid grid-cols-2 gap-x-5 gap-y-5 p-4 rounded-xl bg-card border border-border mt-2">
          <DetailField icon={<Wrench className="h-3.5 w-3.5" />} label="Equipment" value={defect.ride_name || 'Unknown'} />
          {defect.category_name && <DetailField icon={<FileText className="h-3.5 w-3.5" />} label="Type" value={defect.category_name} />}
          <DetailField icon={<CalendarDays className="h-3.5 w-3.5" />} label="Raised" value={format(new Date(defect.reported_at), 'dd MMM yyyy')} secondaryValue={format(new Date(defect.reported_at), 'HH:mm')} />
          {defect.location_on_ride && <DetailField icon={<MapPin className="h-3.5 w-3.5" />} label="Location" value={defect.location_on_ride} />}
          {defect.resolved_by && <DetailField icon={<User className="h-3.5 w-3.5" />} label="Closed by" value={defect.resolved_by} />}
          {defect.resolved_at && <DetailField icon={<CalendarDays className="h-3.5 w-3.5" />} label="Closed" value={format(new Date(defect.resolved_at), 'dd MMM yyyy')} secondaryValue={format(new Date(defect.resolved_at), 'HH:mm')} />}
        </div>
      </section>

      {defect.resolution_notes && (
        <section className="pt-7">
          <SectionLabel>Action taken</SectionLabel>
          <div className="p-4 rounded-xl bg-green-50 dark:bg-green-950/20 border border-green-200 dark:border-green-800/40 mt-2">
            <p className="text-sm text-foreground leading-relaxed whitespace-pre-line">{defect.resolution_notes}</p>
          </div>
        </section>
      )}

      {photoUrls.length > 0 && (
        <section className="pt-7">
          <SectionLabel>Evidence photos</SectionLabel>
          <div className="grid grid-cols-3 gap-2.5 mt-2">
            {photoUrls.map((url, idx) => (
              <a key={idx} href={url} target="_blank" rel="noopener noreferrer" className="aspect-square rounded-xl overflow-hidden border border-border hover:ring-2 hover:ring-primary/40 transition-all shadow-sm">
                <img src={url} alt={`Evidence ${idx + 1}`} className="w-full h-full object-cover" />
              </a>
            ))}
          </div>
        </section>
      )}

      <section className="pt-7">
        <SectionLabel>Lifecycle</SectionLabel>
        <div className="relative pl-6 space-y-5 py-2 mt-2">
          <div className="absolute left-[9px] top-3 bottom-3 w-px bg-border" />
          {timeline.map((evt, i) => {
            const TlIcon = evt.icon;
            const isLast = i === timeline.length - 1;
            return (
              <div key={i} className="relative flex items-start gap-3">
                <div className={`absolute -left-6 top-0.5 w-[18px] h-[18px] rounded-full bg-background border-2 ${isLast && !isOpen ? 'border-green-500' : 'border-border'} flex items-center justify-center`}>
                  <TlIcon className={`h-2.5 w-2.5 ${evt.color}`} />
                </div>
                <div className="pt-px">
                  <p className="text-xs font-semibold text-foreground">{evt.label}</p>
                  <p className="text-[11px] text-muted-foreground leading-snug mt-0.5">
                    {format(new Date(evt.date), 'dd MMM yyyy · HH:mm')}
                    <span className="mx-1">·</span>
                    {formatDistanceToNow(new Date(evt.date), { addSuffix: true })}
                  </p>
                  {evt.description && <p className="text-[11px] text-muted-foreground/80 mt-0.5">{evt.description}</p>}
                </div>
              </div>
            );
          })}
        </div>
      </section>

      <section className="pt-8 pb-6">
        <div className="rounded-xl border border-border bg-muted/30 p-4 space-y-2.5">
          {isOpen && (
            <Button className="gap-2 w-full h-11 text-sm font-semibold" onClick={() => onCloseDefect(defect)}>
              <Check className="h-4 w-4" /> Close defect
            </Button>
          )}
          <Button variant="outline" className="gap-2 w-full h-10 text-sm" onClick={() => onNavigateToEquipment(defect.ride_id)}>
            <ExternalLink className="h-3.5 w-3.5" /> View on equipment page
          </Button>
        </div>
      </section>
    </div>
  );
};

const SectionLabel = ({ children }: { children: React.ReactNode }) => (
  <p className="text-[11px] text-muted-foreground font-semibold uppercase tracking-wider mb-2">{children}</p>
);

const DetailField = ({ icon, label, value, secondaryValue }: { icon: React.ReactNode; label: string; value: string; secondaryValue?: string }) => (
  <div className="flex items-start gap-2.5">
    <span className="text-muted-foreground mt-0.5 shrink-0">{icon}</span>
    <div className="min-w-0">
      <p className="text-[10px] text-muted-foreground uppercase tracking-wide">{label}</p>
      <p className="text-[13px] font-medium text-foreground leading-snug">{value}</p>
      {secondaryValue && <p className="text-xs text-muted-foreground leading-snug">{secondaryValue}</p>}
    </div>
  </div>
);

// ─── Main Register ───────────────────────────────────────────
const DefectRegister = () => {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { effectiveUserId } = useEffectiveUserId();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const [statusFilter, setStatusFilter] = useState(searchParams.get('status') || 'open');
  const [severityFilter, setSeverityFilter] = useState(searchParams.get('severity') || 'all');
  const [rideFilter, setRideFilter] = useState(searchParams.get('rideId') || 'all');
  const [searchTerm, setSearchTerm] = useState('');

  // Date range
  const [dateFrom, setDateFrom] = useState<Date | undefined>(undefined);
  const [dateTo, setDateTo] = useState<Date | undefined>(undefined);
  const [dateFromOpen, setDateFromOpen] = useState(false);
  const [dateToOpen, setDateToOpen] = useState(false);
  const [filtersOpen, setFiltersOpen] = useState(false);

  const [closureDialogOpen, setClosureDialogOpen] = useState(false);
  const [selectedDefect, setSelectedDefect] = useState<DefectRow | null>(null);
  const [detailDefect, setDetailDefect] = useState<DefectRow | null>(null);
  const [detailPhotoUrls, setDetailPhotoUrls] = useState<string[]>([]);

  // Export
  const [generatingPdf, setGeneratingPdf] = useState(false);
  const [generatingCsv, setGeneratingCsv] = useState(false);
  const [exportDialogOpen, setExportDialogOpen] = useState(false);
  const [exportResult, setExportResult] = useState<ExportResult | null>(null);

  // Equipment picker for report defect
  const [defectPickerOpen, setDefectPickerOpen] = useState(false);

  // Saved reports
  const [savedReports, setSavedReports] = useState<any[]>([]);

  // Fetch all defects
  const { data: defects = [], isLoading } = useQuery({
    queryKey: ['defect-register', effectiveUserId],
    queryFn: async () => {
      if (!effectiveUserId) return [];
      const { data, error } = await supabase
        .from('defects')
        .select('id, description, severity, status, location_on_ride, photo_paths, reported_at, resolved_at, resolved_by, resolution_notes, ride_id, check_id, created_at, updated_at')
        .order('reported_at', { ascending: false });
      if (error) throw error;
      return (data || []) as DefectRow[];
    },
    enabled: !!effectiveUserId,
    refetchOnMount: 'always',
  });

  // Fetch rides for names
  const { data: rides = [] } = useQuery({
    queryKey: ['rides-list-for-defects', effectiveUserId],
    queryFn: async () => {
      if (!effectiveUserId) return [];
      const { data, error } = await supabase
        .from('rides')
        .select('id, ride_name, ride_categories(name, category_group)')
        .order('ride_name');
      if (error) throw error;
      return data || [];
    },
    enabled: !!effectiveUserId,
  });

  // Load saved defect reports
  useEffect(() => { loadSavedReports(); }, [effectiveUserId]);

  const loadSavedReports = async () => {
    if (!effectiveUserId) return;
    const { data, error } = await supabase
      .from('documents')
      .select('id, document_name, uploaded_at, file_path, mime_type, file_size, document_type')
      .eq('user_id', effectiveUserId)
      .eq('document_type', 'defect_report')
      .order('uploaded_at', { ascending: false })
      .limit(20);

    if (error) {
      console.error('[PDF DEBUG][Defects] loadSavedReports failed', { error, userId: effectiveUserId });
      return;
    }

    console.info('[PDF DEBUG][Defects] loadSavedReports', {
      userId: effectiveUserId,
      count: data?.length || 0,
      topRow: data?.[0]
        ? {
            id: data[0].id,
            file_path: data[0].file_path,
            mime_type: data[0].mime_type,
            file_size: data[0].file_size,
            document_type: data[0].document_type,
          }
        : null,
    });

    setSavedReports(data || []);
  };

  const rideMap = useMemo(() => {
    const m = new Map<string, { name: string; categoryName: string; group: string }>();
    for (const r of rides) {
      m.set(r.id, {
        name: r.ride_name,
        categoryName: (r.ride_categories as any)?.name || '',
        group: (r.ride_categories as any)?.category_group || '',
      });
    }
    return m;
  }, [rides]);

  const enriched = useMemo(() => {
    return defects.map(d => ({
      ...d,
      ride_name: rideMap.get(d.ride_id)?.name || 'Unknown',
      category_name: rideMap.get(d.ride_id)?.categoryName || '',
      category_group: rideMap.get(d.ride_id)?.group || '',
    }));
  }, [defects, rideMap]);

  // Sync filters from URL
  useEffect(() => {
    setStatusFilter(searchParams.get('status') || 'open');
    setSeverityFilter(searchParams.get('severity') || 'all');
    setRideFilter(searchParams.get('rideId') || 'all');
  }, [searchParams]);

  // Auto-open detail from URL
  useEffect(() => {
    const defectId = searchParams.get('defectId');
    const status = searchParams.get('status');
    const rideId = searchParams.get('rideId');

    console.info('[DefectRegister] URL params', {
      defectId,
      status,
      rideId,
      pathname: window.location.pathname,
      search: window.location.search,
    });

    if (!defectId || enriched.length === 0) {
      if (defectId) {
        console.info('[DefectRegister] Waiting for defects data before deep-link lookup', {
          defectId,
          loadedDefectCount: enriched.length,
        });
      }
      return;
    }

    const found = enriched.find((d) => d.id === defectId);

    console.info('[DefectRegister] Deep-link lookup result', {
      defectId,
      found: !!found,
      loadedDefectCount: enriched.length,
      foundStatus: found?.status,
      foundRideId: found?.ride_id,
    });

    if (found) {
      console.info('[DefectRegister] Opening detail sheet from deep-link', {
        defectId: found.id,
        rideId: found.ride_id,
      });
      openDetail(found);
    }
  }, [searchParams, enriched]);

  const updateFilterParams = (next: { status?: string; severity?: string; rideId?: string }) => {
    const params = new URLSearchParams(searchParams);
    if (next.status !== undefined) params.set('status', next.status);
    if (next.severity !== undefined) params.set('severity', next.severity);
    if (next.rideId !== undefined) params.set('rideId', next.rideId);
    params.delete('defectId');
    setSearchParams(params, { replace: true });
  };

  const openDetail = async (defect: DefectRow) => {
    console.info('[DefectRegister] openDetail called', {
      defectId: defect.id,
      status: defect.status,
      rideId: defect.ride_id,
      hasPhotos: !!defect.photo_paths?.length,
    });

    setDetailDefect(defect);
    const params = new URLSearchParams(searchParams);
    params.set('defectId', defect.id);
    setSearchParams(params, { replace: true });

    if (defect.photo_paths && defect.photo_paths.length > 0) {
      const urls: string[] = [];
      for (const path of defect.photo_paths) {
        const { data } = await supabase.storage.from('defect-photos').createSignedUrl(path, 3600);
        if (data?.signedUrl) urls.push(data.signedUrl);
      }
      setDetailPhotoUrls(urls);
    } else {
      setDetailPhotoUrls([]);
    }
  };

  const closeDetail = () => {
    setDetailDefect(null);
    setDetailPhotoUrls([]);
    const params = new URLSearchParams(searchParams);
    params.delete('defectId');
    setSearchParams(params, { replace: true });
  };

  const handleCloseDefect = (defect: DefectRow) => {
    setSelectedDefect(defect);
    setClosureDialogOpen(true);
  };

  const handleDefectUpdated = () => {
    queryClient.invalidateQueries({ queryKey: ['defect-register'] });
    queryClient.invalidateQueries({ queryKey: ['open-critical-defects'] });
    queryClient.invalidateQueries({ queryKey: ['all-rides-critical-defects'] });
    queryClient.invalidateQueries({ queryKey: ['all-rides-open-defects'] });
    queryClient.invalidateQueries({ queryKey: ['needs-attention'] });
    closeDetail();
  };

  const hasActiveFilters = statusFilter !== 'open' || severityFilter !== 'all' || rideFilter !== 'all' || !!searchTerm || !!dateFrom || !!dateTo;

  const activeFilterCount = [
    statusFilter !== 'open',
    severityFilter !== 'all',
    rideFilter !== 'all',
    !!dateFrom || !!dateTo,
    !!searchTerm,
  ].filter(Boolean).length;

  const getSeverityLabel = (s: DefectSeverity) => SEVERITY_CONFIG[s]?.label || s;
  const getStatusLabel = (s: DefectStatus) => s === 'resolved' ? 'Closed' : 'Open';

  const filterSummary = [
    statusFilter !== 'open' ? `Status: ${statusFilter === 'closed' ? 'Closed' : 'All'}` : null,
    severityFilter !== 'all' ? `Severity: ${getSeverityLabel(severityFilter as DefectSeverity)}` : null,
    rideFilter !== 'all' ? `Equipment: ${rideMap.get(rideFilter)?.name || 'Selected'}` : null,
    dateFrom && dateTo
      ? `${format(dateFrom, 'd MMM yyyy')} – ${format(dateTo, 'd MMM yyyy')}`
      : dateFrom
        ? `From ${format(dateFrom, 'd MMM yyyy')}`
        : dateTo
          ? `To ${format(dateTo, 'd MMM yyyy')}`
          : null,
    searchTerm ? `Search: “${searchTerm.trim()}”` : null,
  ].filter(Boolean).join(' • ');

  const filtered = useMemo(() => {
    let list = [...enriched];
    if (statusFilter === 'open') list = list.filter((d) => d.status !== 'resolved');
    else if (statusFilter === 'closed') list = list.filter((d) => d.status === 'resolved');
    if (severityFilter !== 'all') list = list.filter((d) => d.severity === severityFilter);
    if (rideFilter !== 'all') list = list.filter((d) => d.ride_id === rideFilter);
    if (searchTerm.trim()) {
      const q = searchTerm.toLowerCase();
      list = list.filter((d) =>
        d.description.toLowerCase().includes(q) ||
        (d.ride_name || '').toLowerCase().includes(q) ||
        (d.location_on_ride || '').toLowerCase().includes(q) ||
        (d.resolved_by || '').toLowerCase().includes(q)
      );
    }
    // Date range filter
    if (dateFrom || dateTo) {
      list = list.filter(d => {
        const reportedDate = new Date(d.reported_at);
        if (dateFrom && dateTo) return isWithinInterval(reportedDate, { start: startOfDay(dateFrom), end: endOfDay(dateTo) });
        if (dateFrom) return reportedDate >= startOfDay(dateFrom);
        if (dateTo) return reportedDate <= endOfDay(dateTo);
        return true;
      });
    }
    list.sort((a, b) => {
      const sa = SEVERITY_CONFIG[a.severity]?.sort ?? 3;
      const sb = SEVERITY_CONFIG[b.severity]?.sort ?? 3;
      if (sa !== sb) return sa - sb;
      return new Date(b.reported_at).getTime() - new Date(a.reported_at).getTime();
    });
    return list;
  }, [enriched, statusFilter, severityFilter, rideFilter, searchTerm, dateFrom, dateTo]);

  const ridesWithDefects = useMemo(() => {
    const ids = new Set(defects.map((d) => d.ride_id));
    return rides.filter((r) => ids.has(r.id));
  }, [rides, defects]);

  const openCount = enriched.filter((d) => d.status !== 'resolved').length;
  const stopUseCount = enriched.filter((d) => d.severity === 'stop_operation' && d.status !== 'resolved').length;

  const getSeverityLabel = (s: DefectSeverity) => SEVERITY_CONFIG[s]?.label || s;
  const getStatusLabel = (s: DefectStatus) => s === 'resolved' ? 'Closed' : 'Open';

  // ── Export CSV ──
  const handleExportCsv = () => {
    setGeneratingCsv(true);
    try {
      const headers = ['Reported', 'Equipment', 'Severity', 'Status', 'Description', 'Location', 'Resolved', 'Resolved By', 'Resolution Notes'];
      const rows = filtered.map(d => [
        format(new Date(d.reported_at), 'dd/MM/yyyy HH:mm'),
        d.ride_name || '',
        getSeverityLabel(d.severity),
        getStatusLabel(d.status),
        `"${d.description.replace(/"/g, '""')}"`,
        d.location_on_ride || '',
        d.resolved_at ? format(new Date(d.resolved_at), 'dd/MM/yyyy HH:mm') : '',
        d.resolved_by || '',
        `"${(d.resolution_notes || '').replace(/"/g, '""')}"`,
      ]);
      const csv = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
      const fileName = `Defect Register - ${format(new Date(), 'ddMMMyyyy')}.csv`;
      setExportResult({ blob, fileName });
      setExportDialogOpen(true);
    } catch (error) {
      console.error('CSV export error:', error);
      toast({ title: 'Error', description: 'Failed to export CSV', variant: 'destructive' });
    } finally { setGeneratingCsv(false); }
  };

  // ── Export PDF ──
  const handleExportPdf = async () => {
    setGeneratingPdf(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      if (filtered.length === 0) {
        toast({ title: 'No Records', description: 'No defects match current filters', variant: 'destructive' });
        setGeneratingPdf(false);
        return;
      }

      const { data: profile } = await supabase.from('profiles').select('*').eq('user_id', user.id).single();

      let logoDataUrl: string | null = null;
      if (profile?.company_logo_path) {
        try {
          const { data: logoBlob } = await supabase.storage.from('ride-documents').download(profile.company_logo_path);
          if (logoBlob) logoDataUrl = await blobToDataUrl(logoBlob);
        } catch { /* skip */ }
      }

      const docId = await generateDocumentId('global', 'DR');
      const doc = new jsPDF();
      const margin = 13;

      let yPos = drawTemplateHeader({ doc, title: 'DEFECT REGISTER', documentId: docId, docType: 'DR' as any });

      const periodLabel = dateFrom && dateTo
        ? `${format(dateFrom, 'dd/MM/yyyy')} – ${format(dateTo, 'dd/MM/yyyy')}`
        : dateFrom ? `From ${format(dateFrom, 'dd/MM/yyyy')}`
        : dateTo ? `Up to ${format(dateTo, 'dd/MM/yyyy')}`
        : 'All time';

      const openFiltered = filtered.filter(d => d.status !== 'resolved').length;
      const closedFiltered = filtered.filter(d => d.status === 'resolved').length;
      const stopUseFiltered = filtered.filter(d => d.severity === 'stop_operation' && d.status !== 'resolved').length;

      yPos = drawSectionTitle(doc, 'Report Summary', yPos, margin);
      yPos = drawSummaryBox(doc, [
        { label: 'Total Defects', value: String(filtered.length) },
        { label: 'Open', value: String(openFiltered), accent: openFiltered > 0 },
        { label: 'Closed', value: String(closedFiltered) },
        ...(stopUseFiltered > 0 ? [{ label: 'Stop Use', value: String(stopUseFiltered), accent: true }] : []),
        { label: 'Period', value: periodLabel },
        ...(statusFilter !== 'open' ? [{ label: 'Status Filter', value: statusFilter === 'closed' ? 'Closed' : 'All' }] : []),
        ...(severityFilter !== 'all' ? [{ label: 'Severity Filter', value: getSeverityLabel(severityFilter as DefectSeverity) }] : []),
        ...(rideFilter !== 'all' ? [{ label: 'Equipment Filter', value: rideMap.get(rideFilter)?.name || rideFilter }] : []),
      ], yPos, margin);

      yPos = drawSectionTitle(doc, 'Defect Records', yPos, margin);
      const truncate = (t: string, max: number) => t.length <= max ? t : t.substring(0, max - 3) + '...';
      const tableData = filtered.map((d, i) => [
        (i + 1).toString(),
        format(new Date(d.reported_at), 'dd/MM/yyyy'),
        d.ride_name || '-',
        getSeverityLabel(d.severity),
        truncate(d.description, 45),
        getStatusLabel(d.status),
        d.resolved_at ? format(new Date(d.resolved_at), 'dd/MM/yyyy') : '-',
      ]);

      autoTable(doc, {
        startY: yPos,
        head: [['#', 'Reported', 'Equipment', 'Severity', 'Description', 'Status', 'Resolved']],
        body: tableData,
        headStyles: PDF_TABLE_HEAD_STYLES,
        styles: PDF_TABLE_BODY_STYLES,
        columnStyles: {
          0: { cellWidth: 8, halign: 'center' },
          1: { cellWidth: 22, halign: 'center' },
          2: { cellWidth: 30 },
          3: { cellWidth: 18 },
          4: { cellWidth: 55 },
          5: { cellWidth: 16, halign: 'center' },
          6: { cellWidth: 22, halign: 'center' },
        },
        alternateRowStyles: PDF_TABLE_ALT_ROW,
        margin: { bottom: 28 },
      });

      drawTemplateFooters({ doc, title: 'DEFECT REGISTER', documentId: docId, docType: 'DR' as any });

      const fromStr = dateFrom ? format(dateFrom, 'ddMMMyyyy') : 'all';
      const toStr = dateTo ? format(dateTo, 'ddMMMyyyy') : 'present';
      const documentName = `Defect Register - ${fromStr} to ${toStr}`;
      const fileName = `${documentName.replace(/[^a-zA-Z0-9\s-]/g, '')}.pdf`;
      const pdfBlob = doc.output('blob');

      // Determine the target ride for saving — even if filter is 'all',
      // check if all filtered defects belong to a single ride
      const isSingleRideFilter = rideFilter !== 'all';
      const uniqueRideIds = [...new Set(filtered.map(d => d.ride_id))];
      const effectiveSingleRide = isSingleRideFilter
        ? rideFilter
        : uniqueRideIds.length === 1
          ? uniqueRideIds[0]
          : null;
      const targetRideName = effectiveSingleRide
        ? rides.find(r => r.id === effectiveSingleRide)?.ride_name
        : undefined;

      const saveToDocuments = async (): Promise<string | void> => {
        const storagePath = `${user.id}/defect-reports/${Date.now()}-${fileName}`;
        const { error: uploadError } = await supabase.storage.from('ride-documents').upload(storagePath, pdfBlob, { contentType: 'application/pdf' });
        if (uploadError) throw uploadError;

        // Save to documents table — always link to ride when possible
        const { data: legacyDoc } = await supabase
          .from('documents')
          .insert({
            user_id: user.id,
            document_name: documentName,
            document_type: 'defect_report',
            file_path: storagePath,
            mime_type: 'application/pdf',
            file_size: pdfBlob.size,
            notes: `Defect register: ${filtered.length} records, ${periodLabel}`,
            is_global: !effectiveSingleRide,
            ride_id: effectiveSingleRide || null,
          })
          .select('id')
          .single();

        // Also store in ride_documents register when we have a target ride
        if (effectiveSingleRide) {
          const rideCode = await getRideCode(effectiveSingleRide);
          const rideDocId = await storeRideDocument({
            rideId: effectiveSingleRide,
            rideCode,
            documentType: 'CR' as any,
            documentId: docId,
            fileUrl: storagePath,
            title: documentName,
            metadata: { defectCount: filtered.length, period: periodLabel },
          });
          await loadSavedReports();
          return rideDocId || legacyDoc?.id || undefined;
        }

        await loadSavedReports();
        return legacyDoc?.id || undefined;
      };

      const saveLabel = effectiveSingleRide
        ? `Save to ${targetRideName || 'Asset'} Documents`
        : 'Save as Global Document';
      const saveHint = effectiveSingleRide
        ? `Saves to ${targetRideName || 'this asset'}'s document register.`
        : 'This report covers multiple assets and will save to Global Documents.';
      setExportResult({ blob: pdfBlob, fileName, onSaveToDocuments: saveToDocuments, saveLabel, saveHint });
      setExportDialogOpen(true);
    } catch (error) {
      console.error('PDF error:', error);
      toast({ title: 'Error', description: 'Failed to generate report', variant: 'destructive' });
    } finally { setGeneratingPdf(false); }
  };

  // View is now handled internally by PreviousReportsSection
  const handleViewReport = async (_filePath: string) => {};

  return (
    <div className="space-y-3 px-4 md:px-0 pb-[calc(env(safe-area-inset-bottom)+5.5rem)] md:pb-8">
      <PageHeader
        icon={<AlertOctagon className="h-5 w-5 text-destructive" />}
        iconBgClass="from-destructive/20 to-destructive/10"
        title="Defect Register"
        subtitle={`${openCount} open defect${openCount !== 1 ? 's' : ''}${stopUseCount > 0 ? ` · ${stopUseCount} stop-use` : ''}`}
        showBackButton
        backTo="/overview"
      />

      <RegisterHeader
        resultCount={`${filtered.length} defect${filtered.length !== 1 ? 's' : ''}`}
        totalCount={enriched.length}
        hasActiveFilters={hasActiveFilters}
        searchTerm={searchTerm}
        onSearchChange={setSearchTerm}
        searchPlaceholder="Search defects…"
        activeFilterCount={activeFilterCount}
        filterSummary={filterSummary}
        primaryAction={{ label: 'Report defect', icon: <AlertOctagon className="h-4 w-4" />, onClick: () => { (document.activeElement as HTMLElement)?.blur(); setDefectPickerOpen(true); } }}
        actions={[
          { label: 'Export CSV', icon: <FileDown className="h-4 w-4" />, onClick: handleExportCsv, variant: 'outline', disabled: generatingCsv || filtered.length === 0 },
          { label: 'Export PDF', icon: <FileDown className="h-4 w-4" />, onClick: handleExportPdf, variant: 'outline', disabled: generatingPdf || filtered.length === 0, loading: generatingPdf },
        ]}
        filtersOpen={filtersOpen}
        onFiltersOpenChange={setFiltersOpen}
        dateFrom={dateFrom}
        dateTo={dateTo}
        onDateFromChange={setDateFrom}
        onDateToChange={setDateTo}
        savedReports={savedReports}
        onViewReport={handleViewReport}
        extraContent={
          stopUseCount > 0 ? (
            <div className="flex items-center gap-3 px-4 py-3 rounded-xl bg-destructive/10 border border-destructive/25 shadow-sm">
              <div className="w-8 h-8 rounded-full bg-destructive/20 flex items-center justify-center shrink-0">
                <AlertOctagon className="h-4 w-4 text-destructive" />
              </div>
              <div>
                <p className="text-sm font-bold text-destructive">{stopUseCount} stop-use defect{stopUseCount !== 1 ? 's' : ''}</p>
                <p className="text-[11px] text-destructive/80">Equipment must not be operated until resolved</p>
              </div>
            </div>
          ) : undefined
        }
        filterContent={
          <>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
              <div className="space-y-1">
                <Label className="text-[11px] font-medium text-muted-foreground">Status</Label>
                <Select value={statusFilter} onValueChange={(v) => { setStatusFilter(v); updateFilterParams({ status: v }); }}>
                  <SelectTrigger className="h-9 text-[12px]"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="open">Open</SelectItem>
                    <SelectItem value="closed">Closed</SelectItem>
                    <SelectItem value="all">All</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label className="text-[11px] font-medium text-muted-foreground">Severity</Label>
                <Select value={severityFilter} onValueChange={(v) => { setSeverityFilter(v); updateFilterParams({ severity: v }); }}>
                  <SelectTrigger className="h-9 text-[12px]"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All</SelectItem>
                    <SelectItem value="stop_operation">Stop Use</SelectItem>
                    <SelectItem value="urgent">Important</SelectItem>
                    <SelectItem value="non_urgent">Low</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label className="text-[11px] font-medium text-muted-foreground">Equipment</Label>
                <Select value={rideFilter} onValueChange={(v) => { setRideFilter(v); updateFilterParams({ rideId: v }); }}>
                  <SelectTrigger className="h-9 text-[12px]"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All</SelectItem>
                    {ridesWithDefects.map((r) => (
                      <SelectItem key={r.id} value={r.id}>{r.ride_name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            {hasActiveFilters && (
              <button onClick={() => {
                setStatusFilter('open'); setSeverityFilter('all'); setRideFilter('all');
                setDateFrom(undefined); setDateTo(undefined); setSearchTerm('');
                updateFilterParams({ status: 'open', severity: 'all', rideId: 'all' });
              }}
                className="text-[12px] font-medium text-primary hover:underline">
                Clear all filters
              </button>
            )}
          </>
        }
      />

      {/* Defect list */}
      {isLoading ? (
        <div className="flex justify-center py-16">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16 space-y-3">
          <div className="w-14 h-14 mx-auto rounded-full bg-muted/60 flex items-center justify-center">
            <CheckCircle2 className="h-7 w-7 text-muted-foreground/40" />
          </div>
          <p className="text-sm font-medium text-muted-foreground">
            {statusFilter === 'open' ? 'No open defects — all clear' : 'No defects found'}
          </p>
          {hasActiveFilters && (
            <p className="text-xs text-muted-foreground">Try adjusting your filters or date range</p>
          )}
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((defect) => {
            const sev = SEVERITY_CONFIG[defect.severity];
            const SevIcon = sev.icon;
            const isOpen = defect.status !== 'resolved';
            const hasPhotos = (defect.photo_paths?.length || 0) > 0;

            const stripColor = defect.severity === 'stop_operation'
              ? 'bg-destructive'
              : defect.severity === 'urgent' ? 'bg-orange-500' : 'bg-yellow-400';

            return (
              <div
                key={defect.id}
                className={`group relative rounded-xl border bg-card shadow-sm cursor-pointer transition-all duration-200 hover:shadow-md active:scale-[0.998] overflow-hidden ${
                  defect.severity === 'stop_operation' && isOpen
                    ? 'border-destructive/30 hover:border-destructive/50'
                    : 'border-border hover:border-primary/20'
                }`}
                onClick={() => openDetail(defect)}
              >
                <div className={`absolute left-0 top-0 bottom-0 w-1 ${stripColor} rounded-l-xl`} />

                <div className="pl-4 pr-3.5 py-4">
                  <div className="flex items-start gap-3">
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${sev.operationalClass} border`}>
                      <SevIcon className="h-4.5 w-4.5" />
                    </div>

                    <div className="flex-1 min-w-0">
                      <p className="text-[13px] font-semibold text-foreground leading-snug line-clamp-2">{defect.description}</p>

                      <div className="flex items-center gap-1.5 mt-1.5">
                        <Wrench className="h-3 w-3 text-muted-foreground shrink-0" />
                        <p className="text-xs text-muted-foreground truncate">
                          <span className="font-medium text-foreground/80">{defect.ride_name}</span>
                          {defect.category_name && <span> · {defect.category_name}</span>}
                        </p>
                      </div>

                      {defect.location_on_ride && (
                        <div className="flex items-center gap-1.5 mt-1">
                          <MapPin className="h-3 w-3 text-muted-foreground shrink-0" />
                          <p className="text-[11px] text-muted-foreground truncate">{defect.location_on_ride}</p>
                        </div>
                      )}

                      <div className="flex items-center gap-1.5 flex-wrap mt-2.5">
                        <Badge className={`text-[10px] px-2 py-0.5 font-semibold border-0 ${sev.badgeClass}`}>{sev.label}</Badge>
                        {isOpen ? (
                          <Badge variant="destructive" className="text-[10px] px-2 py-0.5 font-medium border-0">Open</Badge>
                        ) : (
                          <Badge variant="secondary" className="text-[10px] px-2 py-0.5 bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300 font-medium border-0">Closed</Badge>
                        )}
                        {hasPhotos && (
                          <span className="flex items-center gap-0.5 text-[10px] text-muted-foreground">
                            <Camera className="h-3 w-3" />
                            {defect.photo_paths?.length}
                          </span>
                        )}
                        <span className="text-[11px] text-muted-foreground ml-auto">
                          {formatDistanceToNow(new Date(defect.reported_at), { addSuffix: true })}
                        </span>
                      </div>

                      {isOpen && defect.severity === 'stop_operation' && (
                        <div className="flex items-center gap-1.5 mt-2 px-2.5 py-1.5 rounded-lg bg-destructive/8 border border-destructive/15">
                          <span className="text-xs">⛔</span>
                          <p className="text-[11px] font-semibold text-destructive">Do not operate</p>
                        </div>
                      )}

                      {!isOpen && defect.resolution_notes && (
                        <p className="text-[11px] text-muted-foreground italic line-clamp-1 mt-2">✓ {defect.resolution_notes}</p>
                      )}
                    </div>

                    <div className="flex flex-col items-end gap-2.5 shrink-0 ml-1 pt-0.5">
                      {isOpen && (
                        <Button
                          size="sm" variant="outline"
                          className="text-xs gap-1.5 h-8 rounded-lg px-3 font-medium"
                          onClick={(e) => { e.stopPropagation(); handleCloseDefect(defect); }}
                        >
                          <Check className="h-3 w-3" /> Close
                        </Button>
                      )}
                      <ChevronRight className="h-4 w-4 text-muted-foreground/30 group-hover:text-muted-foreground/60 transition-colors" />
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <PreviousReportsSection reports={savedReports} onViewReport={handleViewReport} />

      {/* Detail sheet */}
      <Sheet open={!!detailDefect} onOpenChange={(open) => { if (!open) closeDetail(); }}>
        <SheetContent side="right" className="w-full sm:max-w-lg overflow-y-auto p-0">
          {detailDefect && (
            <div className="flex flex-col h-full">
              <SheetHeader className="px-4 pt-4 pb-3 border-b border-border sticky top-0 bg-background z-10">
                <div className="flex items-center gap-3">
                  <Button variant="ghost" size="icon" className="h-9 w-9 shrink-0 rounded-full text-muted-foreground hover:text-foreground" onClick={closeDetail}>
                    <ArrowLeft className="h-4 w-4" />
                  </Button>
                  <div className="min-w-0">
                    <SheetTitle className="text-sm font-semibold truncate">Defect Detail</SheetTitle>
                    <p className="text-[11px] text-muted-foreground truncate">{detailDefect.ride_name}</p>
                  </div>
                </div>
              </SheetHeader>
              <div className="flex-1 px-5 py-6">
                <DefectDetailSheet
                  defect={detailDefect}
                  onClose={closeDetail}
                  onCloseDefect={handleCloseDefect}
                  onNavigateToEquipment={(rideId) => navigate(`/rides/${rideId}?tab=overview&section=defects`)}
                  photoUrls={detailPhotoUrls}
                />
              </div>
            </div>
          )}
        </SheetContent>
      </Sheet>

      {/* Closure dialog */}
      <DefectClosureDialog
        open={closureDialogOpen}
        onOpenChange={setClosureDialogOpen}
        defect={selectedDefect}
        rideName={selectedDefect?.ride_name || ''}
        onDefectUpdated={handleDefectUpdated}
      />

      {/* Export actions dialog */}
      <ExportActionsDialog
        open={exportDialogOpen}
        onOpenChange={setExportDialogOpen}
        result={exportResult}
      />

      {/* Equipment picker for reporting */}
      <EquipmentPickerDialog
        open={defectPickerOpen}
        onOpenChange={setDefectPickerOpen}
        title="Select equipment"
        subtitle="Choose equipment to report a defect on"
        onSelect={(ride) => {
          setDefectPickerOpen(false);
          navigate(`/defect-report?rideId=${ride.id}`);
        }}
      />
    </div>
  );
};

export default DefectRegister;
