import { useState, useMemo, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useEffectiveUserId } from '@/hooks/useEffectiveUserId';
import { format } from 'date-fns';
import { AlertOctagon, Clock, Wrench, Check, Search, ChevronRight, Camera, SlidersHorizontal, ExternalLink } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
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
  ride_name?: string;
  category_group?: string;
}

const SEVERITY_CONFIG: Record<DefectSeverity, { label: string; icon: typeof AlertOctagon; className: string; sort: number }> = {
  stop_operation: { label: 'Stop Use', icon: AlertOctagon, className: 'bg-destructive/10 text-destructive border-destructive/30', sort: 0 },
  urgent:        { label: 'Important', icon: Wrench,      className: 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-300 border-orange-300/30', sort: 1 },
  non_urgent:    { label: 'Low',       icon: Clock,       className: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300 border-yellow-300/30', sort: 2 },
};

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

  // Fetch all defects
  const { data: defects = [], isLoading } = useQuery({
    queryKey: ['defect-register', effectiveUserId],
    queryFn: async () => {
      if (!effectiveUserId) return [];
      const { data, error } = await supabase
        .from('defects')
        .select('id, description, severity, status, location_on_ride, photo_paths, reported_at, resolved_at, resolved_by, resolution_notes, ride_id, check_id')
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
    const m = new Map<string, { name: string; group: string }>();
    for (const r of rides) {
      m.set(r.id, {
        name: r.ride_name,
        group: (r.ride_categories as any)?.category_group || '',
      });
    }
    return m;
  }, [rides]);

  // Enrich defects with ride names
  const enriched = useMemo(() => {
    return defects.map(d => ({
      ...d,
      ride_name: rideMap.get(d.ride_id)?.name || 'Unknown',
      category_group: rideMap.get(d.ride_id)?.group || '',
    }));
  }, [defects, rideMap]);

  // Keep local filter state synced when deep-link params change
  useEffect(() => {
    setStatusFilter(searchParams.get('status') || 'open');
    setSeverityFilter(searchParams.get('severity') || 'all');
    setRideFilter(searchParams.get('rideId') || 'all');
  }, [searchParams]);

  // Open exact defect detail when deep-linked with ?defectId=
  useEffect(() => {
    const defectId = searchParams.get('defectId');
    if (!defectId || enriched.length === 0) return;
    const found = enriched.find((d) => d.id === defectId);
    if (found) setDetailDefect(found);
  }, [searchParams, enriched]);

  const updateFilterParams = (next: { status?: string; severity?: string; rideId?: string }) => {
    const params = new URLSearchParams(searchParams);
    if (next.status !== undefined) params.set('status', next.status);
    if (next.severity !== undefined) params.set('severity', next.severity);
    if (next.rideId !== undefined) params.set('rideId', next.rideId);
    params.delete('defectId');
    setSearchParams(params, { replace: true });
  };

  const handleOpenDefectDetail = (defect: DefectRow) => {
    setDetailDefect(defect);
    const params = new URLSearchParams(searchParams);
    params.set('defectId', defect.id);
    if (rideFilter !== 'all') params.set('rideId', rideFilter);
    if (severityFilter !== 'all') params.set('severity', severityFilter);
    params.set('status', statusFilter);
    setSearchParams(params, { replace: true });
  };

  const handleCloseDefectDetail = (open: boolean) => {
    if (open) return;
    setDetailDefect(null);
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
  };

  const filtered = useMemo(() => {
    let list = [...enriched];

    if (statusFilter === 'open') {
      list = list.filter((d) => d.status !== 'resolved');
    } else if (statusFilter === 'closed') {
      list = list.filter((d) => d.status === 'resolved');
    }

    if (severityFilter !== 'all') {
      list = list.filter((d) => d.severity === severityFilter);
    }

    if (rideFilter !== 'all') {
      list = list.filter((d) => d.ride_id === rideFilter);
    }

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
    <div className="space-y-4 pb-24 md:pb-8">
      <PageHeader
        icon={<AlertOctagon className="h-5 w-5 text-destructive" />}
        iconBgClass="from-destructive/20 to-destructive/10"
        title="Defect Register"
        subtitle={`${openCount} open defect${openCount !== 1 ? 's' : ''}${stopUseCount > 0 ? ` · ${stopUseCount} stop-use` : ''}`}
        actions={
          <DefectReportDialog
            onDefectReported={handleDefectUpdated}
            onCriticalDefectReported={handleDefectUpdated}
            trigger={
              <Button size="sm" className="gap-1.5">
                <AlertOctagon className="h-4 w-4" />
                <span className="hidden sm:inline">Report Defect</span>
                <span className="sm:hidden">Report</span>
              </Button>
            }
          />
        }
      />

      {/* KPI strip */}
      {stopUseCount > 0 && (
        <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-destructive/10 border border-destructive/20">
          <AlertOctagon className="h-4 w-4 text-destructive flex-shrink-0" />
          <span className="text-sm font-medium text-destructive">
            {stopUseCount} stop-use defect{stopUseCount !== 1 ? 's' : ''} require immediate attention
          </span>
        </div>
      )}

      {/* Filters */}
      <div className="flex flex-col gap-2">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search defects..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-9 h-10"
          />
        </div>
        <div className="flex gap-2 overflow-x-auto">
          <Select
            value={statusFilter}
            onValueChange={(value) => {
              setStatusFilter(value);
              updateFilterParams({ status: value });
            }}
          >
            <SelectTrigger className="w-[120px] h-9 text-xs shrink-0">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="open">Open</SelectItem>
              <SelectItem value="closed">Closed</SelectItem>
              <SelectItem value="all">All</SelectItem>
            </SelectContent>
          </Select>
          <Select
            value={severityFilter}
            onValueChange={(value) => {
              setSeverityFilter(value);
              updateFilterParams({ severity: value });
            }}
          >
            <SelectTrigger className="w-[130px] h-9 text-xs shrink-0">
              <SlidersHorizontal className="h-3 w-3 mr-1 text-muted-foreground" />
              <SelectValue placeholder="Severity" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Severities</SelectItem>
              <SelectItem value="stop_operation">Stop Use</SelectItem>
              <SelectItem value="urgent">Important</SelectItem>
              <SelectItem value="non_urgent">Low</SelectItem>
            </SelectContent>
          </Select>
          <Select
            value={rideFilter}
            onValueChange={(value) => {
              setRideFilter(value);
              updateFilterParams({ rideId: value });
            }}
          >
            <SelectTrigger className="w-[160px] h-9 text-xs shrink-0">
              <SelectValue placeholder="Equipment" />
            </SelectTrigger>
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
        <div className="flex justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-12 space-y-2">
          <AlertOctagon className="h-10 w-10 text-muted-foreground/30 mx-auto" />
          <p className="text-sm text-muted-foreground">
            {statusFilter === 'open' ? 'No open defects' : 'No defects found'}
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map((defect) => {
            const sev = SEVERITY_CONFIG[defect.severity];
            const SevIcon = sev.icon;
            const isOpen = defect.status !== 'resolved';
            const hasPhotos = (defect.photo_paths?.length || 0) > 0;

            return (
              <Card
                key={defect.id}
                className={`cursor-pointer transition-shadow hover:shadow-md active:scale-[0.995] ${
                  defect.severity === 'stop_operation' && isOpen
                    ? 'border-destructive/40 bg-destructive/5'
                    : ''
                }`}
                onClick={() => handleOpenDefectDetail(defect)}
              >
                <CardContent className="p-3">
                  <div className="flex items-start gap-3">
                    <div className="flex-1 min-w-0 space-y-1.5">
                      {/* Status row */}
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold border ${sev.className}`}>
                          <SevIcon className="h-3 w-3" />
                          {sev.label}
                        </span>
                        {isOpen ? (
                          <Badge variant="destructive" className="text-[10px] px-1.5 py-0">Open</Badge>
                        ) : (
                          <Badge variant="secondary" className="text-[10px] px-1.5 py-0">Closed</Badge>
                        )}
                        {hasPhotos && (
                          <Camera className="h-3 w-3 text-muted-foreground" />
                        )}
                      </div>

                      {/* Description */}
                      <p className="text-sm font-medium text-foreground line-clamp-2">{defect.description}</p>

                      {/* Equipment name */}
                      <p className="text-xs text-primary font-medium">{defect.ride_name}</p>

                      {/* Meta line */}
                      <p className="text-[11px] text-muted-foreground">
                        {format(new Date(defect.reported_at), 'dd MMM yyyy HH:mm')}
                        {defect.location_on_ride && ` · ${defect.location_on_ride}`}
                      </p>

                      {/* Resolution preview */}
                      {!isOpen && defect.resolution_notes && (
                        <p className="text-[11px] text-muted-foreground italic line-clamp-1">
                          ✓ {defect.resolution_notes}
                        </p>
                      )}
                    </div>

                    {/* Actions */}
                    <div className="flex flex-col items-end gap-2 shrink-0">
                      {isOpen && (
                        <Button
                          size="sm"
                          variant="outline"
                          className="text-xs gap-1 h-7"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleCloseDefect(defect);
                          }}
                        >
                          <Check className="h-3 w-3" />
                          Close
                        </Button>
                      )}
                      <ChevronRight className="h-4 w-4 text-muted-foreground/40" />
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      <Dialog open={!!detailDefect} onOpenChange={handleCloseDefectDetail}>
        <DialogContent className="max-w-lg">
          {detailDefect && (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  {(() => {
                    const DefectIcon = SEVERITY_CONFIG[detailDefect.severity].icon;
                    return <DefectIcon className="h-4 w-4 text-destructive" />;
                  })()}
                  Defect detail
                </DialogTitle>
                <DialogDescription>
                  {detailDefect.ride_name} • {format(new Date(detailDefect.reported_at), 'dd MMM yyyy HH:mm')}
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-3 text-sm">
                <div className="flex items-center gap-2 flex-wrap">
                  <Badge variant={detailDefect.status === 'resolved' ? 'secondary' : 'destructive'}>
                    {detailDefect.status === 'resolved' ? 'Closed' : 'Open'}
                  </Badge>
                  <Badge variant="outline">{SEVERITY_CONFIG[detailDefect.severity].label}</Badge>
                  {detailDefect.category_group && <Badge variant="outline">{detailDefect.category_group}</Badge>}
                </div>
                <p className="text-foreground">{detailDefect.description}</p>
                {detailDefect.location_on_ride && (
                  <p className="text-muted-foreground">Location: {detailDefect.location_on_ride}</p>
                )}
                {detailDefect.resolution_notes && (
                  <p className="text-muted-foreground">Resolution: {detailDefect.resolution_notes}</p>
                )}
                <div className="flex items-center gap-2 pt-1">
                  <Button
                    variant="outline"
                    size="sm"
                    className="gap-1"
                    onClick={() => navigate(`/rides/${detailDefect.ride_id}?tab=overview&section=defects`)}
                  >
                    <ExternalLink className="h-3.5 w-3.5" />
                    Open on equipment page
                  </Button>
                  {detailDefect.status !== 'resolved' && (
                    <Button
                      size="sm"
                      className="gap-1"
                      onClick={() => {
                        setSelectedDefect(detailDefect);
                        setClosureDialogOpen(true);
                      }}
                    >
                      <Check className="h-3.5 w-3.5" />
                      Close defect
                    </Button>
                  )}
                </div>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>

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
