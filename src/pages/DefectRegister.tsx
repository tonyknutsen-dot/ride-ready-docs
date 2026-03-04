import { useState, useMemo, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useEffectiveUserId } from '@/hooks/useEffectiveUserId';
import { format, formatDistanceToNow } from 'date-fns';
import {
  AlertOctagon, Clock, Wrench, Check, Search, ChevronRight, Camera,
  SlidersHorizontal, ExternalLink, MapPin, User, CalendarDays, ShieldAlert,
  ArrowLeft, FileText, CheckCircle2, Circle, AlertTriangle, Eye,
} from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Separator } from '@/components/ui/separator';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import PageHeader from '@/components/PageHeader';
import DefectClosureDialog from '@/components/DefectClosureDialog';
import DefectReportDialog from '@/components/DefectReportDialog';

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

  // Build timeline events
  const timeline: { label: string; date: string; icon: typeof Circle; color: string; description?: string }[] = [
    { label: 'Reported', date: defect.reported_at, icon: AlertTriangle, color: 'text-orange-500', description: 'Defect raised and logged' },
  ];
  if (defect.created_at !== defect.updated_at && defect.status !== 'resolved') {
    timeline.push({ label: 'Updated', date: defect.updated_at, icon: FileText, color: 'text-primary', description: 'Record modified' });
  }
  if (defect.resolved_at) {
    timeline.push({
      label: 'Closed',
      date: defect.resolved_at,
      icon: CheckCircle2,
      color: 'text-green-600 dark:text-green-400',
      description: defect.resolved_by ? `By ${defect.resolved_by}` : 'Defect resolved',
    });
  }

  return (
    <div className="space-y-0">
      {/* ── Operational status banner ── */}
      <div className={`flex items-center gap-3 px-4 py-3.5 rounded-xl border ${sev.operationalClass}`}>
        <div className="text-lg leading-none">{sev.operationalIcon}</div>
        <div className="flex-1">
          <p className="text-sm font-bold tracking-tight">{sev.operational}</p>
          <p className="text-[11px] opacity-75 mt-0.5">
            {isOpen ? 'This defect is open' : 'This defect has been closed'}
            {' · '}
            {sev.label} severity
          </p>
        </div>
        <Badge className={`text-[10px] px-2 py-0.5 ${sev.badgeClass}`}>{sev.label}</Badge>
      </div>

      {/* ── Description ── */}
      <section className="pt-7">
        <SectionLabel>Description</SectionLabel>
        <div className="p-4 rounded-xl bg-muted/40 border border-border mt-2">
          <p className="text-sm text-foreground leading-relaxed">{defect.description}</p>
        </div>
      </section>

      {/* ── Core details grid ── */}
      <section className="pt-7">
        <SectionLabel>Details</SectionLabel>
        <div className="grid grid-cols-2 gap-x-5 gap-y-5 p-4 rounded-xl bg-card border border-border mt-2">
          <DetailField icon={<Wrench className="h-3.5 w-3.5" />} label="Equipment" value={defect.ride_name || 'Unknown'} />
          {defect.category_name && (
            <DetailField icon={<FileText className="h-3.5 w-3.5" />} label="Type" value={defect.category_name} />
          )}
          <DetailField
            icon={<CalendarDays className="h-3.5 w-3.5" />}
            label="Raised"
            value={format(new Date(defect.reported_at), 'dd MMM yyyy')}
            secondaryValue={format(new Date(defect.reported_at), 'HH:mm')}
          />
          {defect.location_on_ride && (
            <DetailField icon={<MapPin className="h-3.5 w-3.5" />} label="Location" value={defect.location_on_ride} />
          )}
          {defect.resolved_by && (
            <DetailField icon={<User className="h-3.5 w-3.5" />} label="Closed by" value={defect.resolved_by} />
          )}
          {defect.resolved_at && (
            <DetailField
              icon={<CalendarDays className="h-3.5 w-3.5" />}
              label="Closed"
              value={format(new Date(defect.resolved_at), 'dd MMM yyyy')}
              secondaryValue={format(new Date(defect.resolved_at), 'HH:mm')}
            />
          )}
        </div>
      </section>

      {/* ── Resolution notes ── */}
      {defect.resolution_notes && (
        <section className="pt-7">
          <SectionLabel>Repair / closure notes</SectionLabel>
          <div className="p-4 rounded-xl bg-green-50 dark:bg-green-950/20 border border-green-200 dark:border-green-800/40 mt-2">
            <p className="text-sm text-foreground leading-relaxed">{defect.resolution_notes}</p>
          </div>
        </section>
      )}

      {/* ── Evidence photos ── */}
      {photoUrls.length > 0 && (
        <section className="pt-7">
          <SectionLabel>Evidence photos</SectionLabel>
          <div className="grid grid-cols-3 gap-2.5 mt-2">
            {photoUrls.map((url, idx) => (
              <a
                key={idx}
                href={url}
                target="_blank"
                rel="noopener noreferrer"
                className="aspect-square rounded-xl overflow-hidden border border-border hover:ring-2 hover:ring-primary/40 transition-all shadow-sm"
              >
                <img src={url} alt={`Evidence ${idx + 1}`} className="w-full h-full object-cover" />
              </a>
            ))}
          </div>
        </section>
      )}

      {/* ── Lifecycle timeline ── */}
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
                  {evt.description && (
                    <p className="text-[11px] text-muted-foreground/80 mt-0.5">{evt.description}</p>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* ── Actions ── */}
      <section className="pt-8 pb-6">
        <div className="rounded-xl border border-border bg-muted/30 p-4 space-y-2.5">
          {isOpen && (
            <Button className="gap-2 w-full h-11 text-sm font-semibold" onClick={() => onCloseDefect(defect)}>
              <Check className="h-4 w-4" />
              Close defect
            </Button>
          )}
          <Button variant="outline" className="gap-2 w-full h-10 text-sm" onClick={() => onNavigateToEquipment(defect.ride_id)}>
            <ExternalLink className="h-3.5 w-3.5" />
            View on equipment page
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

  const [statusFilter, setStatusFilter] = useState(searchParams.get('status') || 'open');
  const [severityFilter, setSeverityFilter] = useState(searchParams.get('severity') || 'all');
  const [rideFilter, setRideFilter] = useState(searchParams.get('rideId') || 'all');
  const [searchTerm, setSearchTerm] = useState('');

  const [closureDialogOpen, setClosureDialogOpen] = useState(false);
  const [selectedDefect, setSelectedDefect] = useState<DefectRow | null>(null);
  const [detailDefect, setDetailDefect] = useState<DefectRow | null>(null);
  const [detailPhotoUrls, setDetailPhotoUrls] = useState<string[]>([]);

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
    if (!defectId || enriched.length === 0) return;
    const found = enriched.find((d) => d.id === defectId);
    if (found) openDetail(found);
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
        (d.location_on_ride || '').toLowerCase().includes(q)
      );
    }
    list.sort((a, b) => {
      const sa = SEVERITY_CONFIG[a.severity]?.sort ?? 3;
      const sb = SEVERITY_CONFIG[b.severity]?.sort ?? 3;
      if (sa !== sb) return sa - sb;
      return new Date(b.reported_at).getTime() - new Date(a.reported_at).getTime();
    });
    return list;
  }, [enriched, statusFilter, severityFilter, rideFilter, searchTerm]);

  const ridesWithDefects = useMemo(() => {
    const ids = new Set(defects.map((d) => d.ride_id));
    return rides.filter((r) => ids.has(r.id));
  }, [rides, defects]);

  const openCount = enriched.filter((d) => d.status !== 'resolved').length;
  const stopUseCount = enriched.filter((d) => d.severity === 'stop_operation' && d.status !== 'resolved').length;

  return (
    <div className="space-y-5 px-4 md:px-0 pb-24 md:pb-8">
      <PageHeader
        icon={<AlertOctagon className="h-5 w-5 text-destructive" />}
        iconBgClass="from-destructive/20 to-destructive/10"
        title="Defect Register"
        subtitle={`${openCount} open defect${openCount !== 1 ? 's' : ''}${stopUseCount > 0 ? ` · ${stopUseCount} stop-use` : ''}`}
        showBackButton
        backTo="/overview"
        actions={
          <DefectReportDialog
            onDefectReported={handleDefectUpdated}
            onCriticalDefectReported={handleDefectUpdated}
            trigger={
              <Button size="sm" className="gap-1.5 h-9">
                <AlertOctagon className="h-4 w-4" />
                <span className="hidden sm:inline">Report Defect</span>
                <span className="sm:hidden">Report</span>
              </Button>
            }
          />
        }
      />

      {/* Stop-use banner */}
      {stopUseCount > 0 && (
        <div className="flex items-center gap-3 px-4 py-3 rounded-xl bg-destructive/10 border border-destructive/25 shadow-sm">
          <div className="w-8 h-8 rounded-full bg-destructive/20 flex items-center justify-center shrink-0">
            <AlertOctagon className="h-4 w-4 text-destructive" />
          </div>
          <div>
            <p className="text-sm font-bold text-destructive">
              {stopUseCount} stop-use defect{stopUseCount !== 1 ? 's' : ''}
            </p>
            <p className="text-[11px] text-destructive/80">Equipment must not be operated until resolved</p>
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="flex flex-col gap-3">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search defects..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-9 h-11 rounded-xl"
          />
        </div>
        <div className="flex flex-wrap gap-2">
          <Select value={statusFilter} onValueChange={(v) => { setStatusFilter(v); updateFilterParams({ status: v }); }}>
            <SelectTrigger className="w-[110px] h-11 text-xs shrink-0 rounded-lg"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="open">Open</SelectItem>
              <SelectItem value="closed">Closed</SelectItem>
              <SelectItem value="all">All</SelectItem>
            </SelectContent>
          </Select>
          <Select value={severityFilter} onValueChange={(v) => { setSeverityFilter(v); updateFilterParams({ severity: v }); }}>
            <SelectTrigger className="w-[130px] h-11 text-xs shrink-0 rounded-lg">
              <SlidersHorizontal className="h-3 w-3 mr-1 text-muted-foreground" /><SelectValue placeholder="Severity" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Severities</SelectItem>
              <SelectItem value="stop_operation">Stop Use</SelectItem>
              <SelectItem value="urgent">Important</SelectItem>
              <SelectItem value="non_urgent">Low</SelectItem>
            </SelectContent>
          </Select>
          <Select value={rideFilter} onValueChange={(v) => { setRideFilter(v); updateFilterParams({ rideId: v }); }}>
            <SelectTrigger className="w-[160px] h-11 text-xs shrink-0 rounded-lg"><SelectValue placeholder="Equipment" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Equipment</SelectItem>
              {ridesWithDefects.map((r) => (
                <SelectItem key={r.id} value={r.id}>{r.ride_name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

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
                {/* Severity left strip */}
                <div className={`absolute left-0 top-0 bottom-0 w-1 ${stripColor} rounded-l-xl`} />

                <div className="pl-4 pr-3.5 py-4">
                  <div className="flex items-start gap-3">
                    {/* Severity icon */}
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${sev.operationalClass} border`}>
                      <SevIcon className="h-4.5 w-4.5" />
                    </div>

                    {/* Content */}
                    <div className="flex-1 min-w-0">
                      <p className="text-[13px] font-semibold text-foreground leading-snug line-clamp-2">
                        {defect.description}
                      </p>

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

                    {/* Right actions */}
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
    </div>
  );
};

export default DefectRegister;
