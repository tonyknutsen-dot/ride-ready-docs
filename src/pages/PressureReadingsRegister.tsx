import { useState, useEffect, useCallback, useMemo } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useEffectiveUserId } from '@/hooks/useEffectiveUserId';
import { useToast } from '@/hooks/use-toast';
import { useDateTimeSettings } from '@/hooks/useDateTimeSettings';
import { useIsMobile } from '@/hooks/use-mobile';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from '@/components/ui/sheet';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  Gauge, Plus, MapPin, Clock, ChevronDown, Loader2, FileDown, Search, ArrowLeft,
} from 'lucide-react';
import { format, startOfDay } from 'date-fns';
import { cn } from '@/lib/utils';
import PageHeader from '@/components/PageHeader';
import RegisterHeader, { PreviousReportsSection } from '@/components/RegisterHeader';
import PressureReaderPicker, { type PressureReaderProfile } from '@/components/PressureReaderPicker';
import ExportActionsDialog, { type ExportResult } from '@/components/ExportActionsDialog';
import { generatePressureReadingsPdf } from '@/utils/pressureReadingsPdf';
import { PressureReadingsHelpDialog } from '@/components/PressureReadingsHelpDialog';
import { HelpCircle } from 'lucide-react';

const SESSION_TYPES = [
  { value: 'pre-opening', label: 'Pre-opening' },
  { value: 'during-operation', label: 'During operation' },
  { value: 'end-of-day', label: 'End of day' },
  { value: 'other', label: 'Other' },
];

const SESSION_TYPE_LABELS: Record<string, string> = {
  'pre-opening': 'Pre-opening',
  'during-operation': 'During operation',
  'end-of-day': 'End of day',
  'after-adjustment': 'End of day', // legacy mapping
  'in-service': 'During operation', // legacy mapping
  'recheck': 'End of day', // legacy mapping
  'other': 'Other',
};

const PRESSURE_UNITS = [
  { value: 'psi', label: 'PSI' },
  { value: 'bar', label: 'Bar' },
  { value: 'mbar', label: 'mbar' },
  { value: 'mmH2O', label: 'mmH₂O' },
];

interface SectionConfig {
  name: string;
  default_reading_point?: string;
  target_pressure?: number;
  min_pressure?: number;
  max_pressure?: number;
}

interface SessionLine {
  section_number: number;
  section_name: string;
  reading_taken_at: string;
  pressure_value: string;
  pressure_unit: string;
  reading_point: string;
  notes: string;
}

interface PressureSession {
  id: string;
  session_date: string;
  session_time: string;
  session_type: string;
  taken_by: string;
  site_name: string;
  site_address: string;
  notes: string | null;
  is_complete: boolean;
  reader_make: string | null;
  reader_model: string | null;
  reader_serial: string | null;
  reader_unit: string;
  reader_type: string | null;
  reader_calibration_date: string | null;
  reader_notes: string | null;
  created_at: string;
  lines?: Array<{
    id: string;
    section_number: number;
    section_name: string;
    reading_taken_at: string | null;
    pressure_value: number | null;
    pressure_unit: string;
    reading_point: string | null;
    notes: string | null;
  }>;
}

interface PressureReadingsRegisterProps {
  /** When provided, uses this rideId instead of search params */
  rideIdProp?: string;
  /** When true, hides the PageHeader (for embedding in tabs) */
  embedded?: boolean;
}

const PressureReadingsRegister = ({ rideIdProp, embedded = false }: PressureReadingsRegisterProps = {}) => {
  const { user } = useAuth();
  const { effectiveUserId } = useEffectiveUserId();
  const { toast } = useToast();
  const { formatDate } = useDateTimeSettings();
  const isMobile = useIsMobile();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const rideId = rideIdProp || searchParams.get('rideId') || '';

  // Ride data
  const [rideName, setRideName] = useState('');
  const [isMultiSectional, setIsMultiSectional] = useState(false);
  const [sectionCount, setSectionCount] = useState(1);
  const [sectionConfig, setSectionConfig] = useState<SectionConfig[]>([]);
  const [pressureEnabled, setPressureEnabled] = useState(false);

  // Sessions
  const [sessions, setSessions] = useState<PressureSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  // Form
  const [sheetOpen, setSheetOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [sessionDate, setSessionDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [sessionTime, setSessionTime] = useState(format(new Date(), 'HH:mm'));
  const [sessionType, setSessionType] = useState('pre-opening');
  const [takenBy, setTakenBy] = useState('');
  const [siteName, setSiteName] = useState('');
  const [siteAddress, setSiteAddress] = useState('');
  const [sessionNotes, setSessionNotes] = useState('');
  const [lines, setLines] = useState<SessionLine[]>([]);

  // Pressure reader
  const [readerProfiles, setReaderProfiles] = useState<PressureReaderProfile[]>([]);
  const [selectedReaderId, setSelectedReaderId] = useState('manual');
  const [readerType, setReaderType] = useState('digital');
  const [readerMake, setReaderMake] = useState('');
  const [readerModel, setReaderModel] = useState('');
  const [readerSerial, setReaderSerial] = useState('');
  const [readerUnit, setReaderUnit] = useState('psi');
  const [defaultUnit, setDefaultUnit] = useState('psi');
  const [readerCalibration, setReaderCalibration] = useState('');
  const [readerNotes, setReaderNotes] = useState('');

  // Filters
  const [searchTerm, setSearchTerm] = useState('');
  const [filterDateFrom, setFilterDateFrom] = useState<Date | undefined>(undefined);
  const [filterDateTo, setFilterDateTo] = useState<Date | undefined>(undefined);
  const [filterType, setFilterType] = useState('all');
  const [filtersOpen, setFiltersOpen] = useState(false);

  // Export
  const [exportDialogOpen, setExportDialogOpen] = useState(false);
  const [exportResult, setExportResult] = useState<ExportResult | null>(null);
  const [savedReports, setSavedReports] = useState<any[]>([]);

  // Defaults
  const [defaultTakenBy, setDefaultTakenBy] = useState('');
  const [companyName, setCompanyName] = useState('');
  const [controllerName, setControllerName] = useState('');

  // Load ride info
  useEffect(() => {
    if (!rideId) return;
    const load = async () => {
      const { data } = await supabase
        .from('rides')
        .select('ride_name, pressure_monitoring_enabled, is_multi_sectional, section_count, section_config')
        .eq('id', rideId)
        .single();
      if (data) {
        const d = data as any;
        setRideName(d.ride_name);
        setPressureEnabled(d.pressure_monitoring_enabled ?? false);
        setIsMultiSectional(d.is_multi_sectional ?? false);
        setSectionCount(d.section_count ?? 1);
        setSectionConfig((d.section_config as SectionConfig[]) || []);
        const unit = d.default_pressure_unit || 'psi';
        setDefaultUnit(unit);
        setReaderUnit(unit);
      }
    };
    load();
  }, [rideId]);

  // Load profile defaults
  useEffect(() => {
    if (!effectiveUserId) return;
    const load = async () => {
      const { data } = await supabase
        .from('profiles')
        .select('controller_name, company_name')
        .eq('user_id', effectiveUserId)
        .maybeSingle();
      if (data?.controller_name) { setDefaultTakenBy(data.controller_name); setControllerName(data.controller_name); }
      if (data?.company_name) setCompanyName(data.company_name);
    };
    load();
  }, [effectiveUserId]);

  // Load reader profiles
  useEffect(() => {
    if (!effectiveUserId) return;
    const load = async () => {
      const { data } = await supabase
        .from('pressure_reader_profiles')
        .select('*')
        .eq('user_id', effectiveUserId)
        .order('is_default', { ascending: false })
        .order('created_at', { ascending: false });
      if (data) setReaderProfiles(data as PressureReaderProfile[]);
    };
    load();
  }, [effectiveUserId]);

  // Load sessions
  const loadSessions = useCallback(async () => {
    if (!effectiveUserId || !rideId) return;
    try {
      const { data: sessionsData, error } = await supabase
        .from('pressure_sessions')
        .select('*')
        .eq('ride_id', rideId)
        .order('session_date', { ascending: false })
        .order('session_time', { ascending: false })
        .limit(500);
      if (error) throw error;

      if (sessionsData && sessionsData.length > 0) {
        const sessionIds = sessionsData.map((s: any) => s.id);
        const allLines: any[] = [];
        for (let i = 0; i < sessionIds.length; i += 100) {
          const chunk = sessionIds.slice(i, i + 100);
          const { data: lineData } = await supabase
            .from('pressure_session_lines')
            .select('*')
            .in('session_id', chunk)
            .order('section_number');
          if (lineData) allLines.push(...lineData);
        }

        const linesBySession: Record<string, any[]> = {};
        for (const l of allLines) {
          if (!linesBySession[l.session_id]) linesBySession[l.session_id] = [];
          linesBySession[l.session_id].push(l);
        }

        setSessions(sessionsData.map((s: any) => ({
          ...s,
          lines: linesBySession[s.id] || [],
        })));
      } else {
        setSessions([]);
      }
    } catch (err) {
      console.error('Error loading pressure sessions:', err);
    } finally {
      setLoading(false);
    }
  }, [effectiveUserId, rideId]);

  useEffect(() => { loadSessions(); }, [loadSessions]);

  // Load saved reports
  useEffect(() => {
    if (!effectiveUserId || !rideId) return;
    const load = async () => {
      const { data } = await supabase
        .from('documents')
        .select('*')
        .eq('user_id', effectiveUserId)
        .eq('document_type', 'pressure_report')
        .eq('ride_id', rideId)
        .order('uploaded_at', { ascending: false });
      setSavedReports(data || []);
    };
    load();
  }, [effectiveUserId, rideId]);

  // Filtered sessions
  const filteredSessions = useMemo(() => {
    return sessions.filter(s => {
      if (filterDateFrom) {
        const d = startOfDay(new Date(s.session_date + 'T00:00:00'));
        if (d < startOfDay(filterDateFrom)) return false;
      }
      if (filterDateTo) {
        const d = startOfDay(new Date(s.session_date + 'T00:00:00'));
        if (d > startOfDay(filterDateTo)) return false;
      }
      if (filterType !== 'all' && s.session_type !== filterType) return false;
      if (searchTerm.trim()) {
        const q = searchTerm.toLowerCase();
        const matches = s.taken_by.toLowerCase().includes(q)
          || s.site_name.toLowerCase().includes(q)
          || (s.notes || '').toLowerCase().includes(q);
        if (!matches) return false;
      }
      return true;
    });
  }, [sessions, filterDateFrom, filterDateTo, filterType, searchTerm]);

  const hasFilters = !!filterDateFrom || !!filterDateTo || filterType !== 'all' || !!searchTerm;
  const activeFilterCount = [!!filterDateFrom || !!filterDateTo, filterType !== 'all', !!searchTerm].filter(Boolean).length;

  const clearFilters = () => {
    setFilterDateFrom(undefined);
    setFilterDateTo(undefined);
    setFilterType('all');
    setSearchTerm('');
  };

  // Open form
  const handleOpenSheet = () => {
    const n = new Date();
    setSessionDate(format(n, 'yyyy-MM-dd'));
    setSessionTime(format(n, 'HH:mm'));
    setSessionType('pre-opening');
    setTakenBy(defaultTakenBy);
    setSiteName('');
    setSiteAddress('');
    setSessionNotes('');

    // Build lines from section config
    const newLines: SessionLine[] = [];
    if (isMultiSectional && sectionConfig.length > 0) {
      sectionConfig.forEach((sc, i) => {
        newLines.push({
          section_number: i + 1,
          section_name: sc.name || `Section ${i + 1}`,
          reading_taken_at: format(n, 'HH:mm'),
          pressure_value: '',
          pressure_unit: defaultUnit || 'psi',
          reading_point: sc.default_reading_point || '',
          notes: '',
        });
      });
    } else if (isMultiSectional && sectionCount > 1) {
      for (let i = 0; i < sectionCount; i++) {
        newLines.push({
          section_number: i + 1,
          section_name: `Section ${i + 1}`,
          reading_taken_at: format(n, 'HH:mm'),
          pressure_value: '',
          pressure_unit: defaultUnit || 'psi',
          reading_point: '',
          notes: '',
        });
      }
    } else {
      newLines.push({
        section_number: 1,
        section_name: 'Main',
        reading_taken_at: format(n, 'HH:mm'),
        pressure_value: '',
        pressure_unit: defaultUnit || 'psi',
        reading_point: '',
        notes: '',
      });
    }
    setLines(newLines);

    // Default reader
    const defaultProfile = readerProfiles.find(p => p.is_default);
    if (defaultProfile) {
      setSelectedReaderId(defaultProfile.id);
      setReaderType(defaultProfile.reader_type || 'digital');
      setReaderMake(defaultProfile.make);
      setReaderModel(defaultProfile.model);
      setReaderSerial(defaultProfile.serial_number || '');
      setReaderUnit(defaultProfile.unit || defaultUnit || 'psi');
      setReaderCalibration(defaultProfile.last_calibration_date || '');
      setReaderNotes(defaultProfile.instrument_notes || '');
    } else {
      setSelectedReaderId('manual');
      setReaderType('digital');
      setReaderMake('');
      setReaderModel('');
      setReaderSerial('');
      setReaderUnit(defaultUnit || 'psi');
      setReaderCalibration('');
      setReaderNotes('');
    }

    setSheetOpen(true);
  };

  const updateLine = (index: number, field: keyof SessionLine, value: string) => {
    setLines(prev => prev.map((l, i) => i === index ? { ...l, [field]: value } : l));
  };

  const handleSave = async () => {
    if (!effectiveUserId || !rideId) return;
    if (!takenBy) { toast({ title: 'Missing fields', description: '"Taken by" is required.', variant: 'destructive' }); return; }
    if (!siteName) { toast({ title: 'Missing fields', description: 'Site / location name is required.', variant: 'destructive' }); return; }
    if (!readerMake || !readerModel) { toast({ title: 'Missing fields', description: 'Pressure reader make and model are required.', variant: 'destructive' }); return; }

    // Check all sections have readings if multi-sectional
    if (isMultiSectional) {
      const missingLines = lines.filter(l => !l.pressure_value);
      if (missingLines.length > 0) {
        toast({
          title: 'Incomplete readings',
          description: `${missingLines.length} section(s) still need readings: ${missingLines.map(l => l.section_name).join(', ')}`,
          variant: 'destructive',
        });
        return;
      }
    }

    const isComplete = lines.every(l => !!l.pressure_value);

    setSaving(true);
    try {
      const sessionId = crypto.randomUUID();
      const { error: sessionError } = await supabase.from('pressure_sessions').insert({
        id: sessionId,
        user_id: effectiveUserId,
        ride_id: rideId,
        session_date: sessionDate,
        session_time: sessionTime + ':00',
        session_type: sessionType,
        taken_by: takenBy,
        site_name: siteName,
        site_address: siteAddress,
        notes: sessionNotes || null,
        is_complete: isComplete,
        reader_type: readerType,
        reader_make: readerMake,
        reader_model: readerModel,
        reader_serial: readerSerial || null,
        reader_unit: readerUnit,
        reader_calibration_date: readerCalibration || null,
        reader_notes: readerNotes || null,
        reader_profile_id: selectedReaderId !== 'manual' ? selectedReaderId : null,
      });
      if (sessionError) throw sessionError;

      const lineRows = lines.map(l => ({
        session_id: sessionId,
        section_number: l.section_number,
        section_name: l.section_name,
        reading_taken_at: l.reading_taken_at ? l.reading_taken_at + ':00' : null,
        pressure_value: l.pressure_value ? parseFloat(l.pressure_value) : null,
        pressure_unit: l.pressure_unit || readerUnit,
        reading_point: l.reading_point || null,
        notes: l.notes || null,
      }));
      const { error: lineError } = await supabase.from('pressure_session_lines').insert(lineRows);
      if (lineError) throw lineError;

      toast({ title: 'Session saved' });
      setSheetOpen(false);
      loadSessions();
    } catch (err: any) {
      console.error('Error saving pressure session:', err);
      toast({ title: "Couldn't save session", description: err?.message, variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  // Export handlers
  const handleExportPdf = async () => {
    if (filteredSessions.length === 0) {
      toast({ title: 'Nothing to export', variant: 'destructive' });
      return;
    }
    const pdfSessions = filteredSessions.map(s => ({
      session_date: s.session_date,
      session_time: s.session_time,
      session_type: s.session_type,
      taken_by: s.taken_by,
      site_name: s.site_name,
      site_address: s.site_address,
      notes: s.notes,
      is_complete: s.is_complete,
      reader_type: s.reader_type,
      reader_make: s.reader_make,
      reader_model: s.reader_model,
      reader_serial: s.reader_serial,
      reader_unit: s.reader_unit,
      reader_calibration_date: s.reader_calibration_date,
      reader_notes: s.reader_notes,
      lines: (s.lines || []).map(l => ({
        section_number: l.section_number,
        section_name: l.section_name,
        reading_taken_at: l.reading_taken_at,
        pressure_value: l.pressure_value,
        pressure_unit: l.pressure_unit,
        reading_point: l.reading_point,
        notes: l.notes,
      })),
    }));
    const result = await generatePressureReadingsPdf({
      sessions: pdfSessions,
      inflatableName: rideName,
      rideId,
      companyName: companyName || undefined,
      controllerName: controllerName || undefined,
      dateRange: {
        from: filterDateFrom ? format(filterDateFrom, 'd MMM yyyy') : undefined,
        to: filterDateTo ? format(filterDateTo, 'd MMM yyyy') : undefined,
      },
    });

    const saveToDocuments = async (): Promise<string | void> => {
      const { data: { user: currentUser } } = await supabase.auth.getUser();
      if (!currentUser) throw new Error('Not authenticated');
      const storagePath = `${currentUser.id}/pressure-reports/${Date.now()}-${result.fileName}`;
      const { error: uploadError } = await supabase.storage.from('ride-documents').upload(storagePath, result.blob, { contentType: 'application/pdf' });
      if (uploadError) throw uploadError;
      const { data: doc } = await supabase.from('documents').insert({
        user_id: currentUser.id,
        document_name: `Pressure Readings – ${rideName}`,
        document_type: 'pressure_report',
        file_path: storagePath,
        mime_type: 'application/pdf',
        file_size: result.blob.size,
        notes: `Pressure sessions: ${filteredSessions.length} sessions`,
        is_global: false,
        ride_id: rideId,
      }).select('id').single();
      return doc?.id || undefined;
    };

    setExportResult({
      blob: result.blob,
      fileName: result.fileName,
      onSaveToDocuments: saveToDocuments,
      saveLabel: `Save to ${rideName} Documents`,
      saveHint: `Saves this report inside ${rideName}'s document register.`,
    });
    setExportDialogOpen(true);
  };

  const handleExportCsv = () => {
    if (filteredSessions.length === 0) {
      toast({ title: 'Nothing to export', variant: 'destructive' });
      return;
    }
    const headers = ['Date', 'Time', 'Type', 'Site', 'Address', 'Taken By', 'Section', 'Reading Point', 'Value', 'Unit', 'Status', 'Instrument', 'Notes'];
    const rows: string[][] = [];
    for (const s of filteredSessions) {
      for (const l of (s.lines || [])) {
        rows.push([
          s.session_date,
          s.session_time.slice(0, 5),
          SESSION_TYPE_LABELS[s.session_type] || s.session_type,
          s.site_name,
          s.site_address,
          s.taken_by,
          `${l.section_number}. ${l.section_name}`,
          l.reading_point || '',
          l.pressure_value != null ? String(l.pressure_value) : '',
          l.pressure_unit,
          s.is_complete ? 'Complete' : 'Incomplete',
          [s.reader_make, s.reader_model, s.reader_serial].filter(Boolean).join(' '),
          `"${(l.notes || '').replace(/"/g, '""')}"`,
        ]);
      }
    }
    const csv = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const fileName = `Pressure Readings - ${rideName} - ${format(new Date(), 'ddMMMyyyy')}.csv`;
    setExportResult({ blob, fileName });
    setExportDialogOpen(true);
  };

  if (!rideId) {
    return (
      <div className="text-center py-20">
        <p className="text-muted-foreground">No equipment selected.</p>
        <Button variant="ghost" onClick={() => navigate('/pressure-readings')} className="mt-2">
          <ArrowLeft className="h-4 w-4 mr-1" /> Back to Pressure Readings
        </Button>
      </div>
    );
  }

  return (
    <div className={cn("space-y-3", !embedded && "px-4 md:px-0 pb-[calc(env(safe-area-inset-bottom)+5.5rem)] md:pb-8")}>
      {!embedded && (
        <PageHeader
          icon={<Gauge className="h-5 w-5 text-primary" />}
          iconBgClass="from-primary/20 to-primary/10"
          title={rideName || 'Inflatable Pressure Readings'}
          subtitle="Pressure session history"
          showBackButton
          backTo="/pressure-readings"
        />
      )}

      <RegisterHeader
        resultCount={`${filteredSessions.length} session${filteredSessions.length !== 1 ? 's' : ''}`}
        totalCount={sessions.length}
        hasActiveFilters={hasFilters}
        searchTerm={searchTerm}
        onSearchChange={setSearchTerm}
        searchPlaceholder="Search sessions…"
        primaryAction={{
          label: 'Log pressure session',
          icon: <Plus className="h-4 w-4" />,
          onClick: handleOpenSheet,
        }}
        actions={[
          {
            label: 'Export CSV',
            icon: <FileDown className="h-4 w-4" />,
            onClick: handleExportCsv,
            variant: 'outline',
            disabled: filteredSessions.length === 0,
          },
          {
            label: 'Export PDF',
            icon: <FileDown className="h-4 w-4" />,
            onClick: handleExportPdf,
            variant: 'outline',
            disabled: filteredSessions.length === 0,
          },
        ]}
        filtersOpen={filtersOpen}
        onFiltersOpenChange={setFiltersOpen}
        filterContent={
          <div className="space-y-3">
            <div className="space-y-1">
              <Label className="text-[11px] text-muted-foreground">Session type</Label>
              <Select value={filterType} onValueChange={setFilterType}>
                <SelectTrigger className="h-9 text-[12px]"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All types</SelectItem>
                  {SESSION_TYPES.map(t => (
                    <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {hasFilters && (
              <button onClick={clearFilters} className="text-[12px] font-medium text-primary hover:underline">
                Clear all filters
              </button>
            )}
          </div>
        }
        dateFrom={filterDateFrom}
        dateTo={filterDateTo}
        onDateFromChange={setFilterDateFrom}
        onDateToChange={setFilterDateTo}
        activeFilterCount={activeFilterCount}
        savedReports={savedReports}
      />

      {/* Pressure setup summary on register page */}
      {!loading && (
        <div className="rounded-xl border border-border bg-card p-3 space-y-1.5">
          <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">Inflatable Pressure Setup</p>
          <div className="flex flex-wrap gap-x-5 gap-y-1 text-[12px]">
            <span className="text-muted-foreground">Monitoring: <span className="font-medium text-foreground">{pressureEnabled ? 'Enabled' : 'Not enabled'}</span></span>
            <span className="text-muted-foreground">Structure: <span className="font-medium text-foreground">{isMultiSectional ? 'Multi-sectional' : 'Single-section'}</span></span>
            <span className="text-muted-foreground">Sections: <span className="font-medium text-foreground">{isMultiSectional ? (sectionConfig.length || sectionCount) : 1}</span></span>
            {isMultiSectional && sectionConfig.length > 0 && (
              <span className="text-muted-foreground">Names: <span className="font-medium text-foreground">{sectionConfig.map(s => s.name).join(', ')}</span></span>
            )}
          </div>
          {pressureEnabled && isMultiSectional && sectionConfig.length === 0 && (
            <div className="flex items-center gap-2 mt-1.5 text-[11px] text-warning">
              <span>⚠ No sections configured.</span>
              <Button variant="link" size="sm" className="text-[11px] h-auto p-0 text-primary" onClick={() => navigate(`/rides/${rideId}`)}>
                Configure in inflatable settings →
              </Button>
            </div>
          )}
          {!pressureEnabled && (
            <p className="text-[11px] text-warning mt-1">Pressure monitoring is not enabled for this inflatable. You can still log sessions, but consider enabling it in <button type="button" className="underline text-primary" onClick={() => navigate(`/rides/${rideId}`)}>inflatable settings</button>.</p>
          )}
        </div>
      )}

      {/* Sessions list */}
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </div>
      ) : filteredSessions.length === 0 ? (
        <div className="text-center py-12 border border-border rounded-xl">
          <Gauge className="h-8 w-8 text-muted-foreground/30 mx-auto mb-2" />
          <p className="text-sm text-muted-foreground">No pressure sessions found.</p>
          <p className="text-[11px] text-muted-foreground mt-1">Tap "Log pressure session" to start.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {filteredSessions.map(session => {
            const isExpanded = expandedId === session.id;
            const completedLines = (session.lines || []).filter(l => l.pressure_value != null).length;
            const totalLines = (session.lines || []).length;

            return (
              <div key={session.id} className={cn(
                "border border-border rounded-xl bg-card overflow-hidden transition-colors",
                !session.is_complete && "border-l-2 border-l-warning"
              )}>
                <button
                  type="button"
                  className="w-full text-left px-3 py-3 min-h-[56px] active:bg-muted/20 transition-colors"
                  onClick={() => setExpandedId(isExpanded ? null : session.id)}
                >
                  {/* Row 1: Date + Time + Type + Status */}
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="text-[12px] font-medium text-foreground tabular-nums whitespace-nowrap">{formatDate(session.session_date)}</span>
                      <span className="text-[11px] text-muted-foreground tabular-nums whitespace-nowrap">{session.session_time.slice(0, 5)}</span>
                      <Badge variant="secondary" className="text-[10px] px-1.5 py-0">{SESSION_TYPE_LABELS[session.session_type] || session.session_type}</Badge>
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0">
                      <Badge variant="outline" className="text-[10px] px-1.5 py-0 tabular-nums">{completedLines}/{totalLines}</Badge>
                      {session.is_complete ? (
                        <Badge className="text-[10px] px-1.5 py-0 bg-primary/10 text-primary border-primary/30">Complete</Badge>
                      ) : (
                        <Badge variant="outline" className="text-[10px] px-1.5 py-0 text-warning border-warning/30">Incomplete</Badge>
                      )}
                      <ChevronDown className={cn("h-3.5 w-3.5 text-muted-foreground/40 transition-transform shrink-0", isExpanded && "rotate-180")} />
                    </div>
                  </div>
                  {/* Row 2: Site */}
                  <p className="text-[10px] text-muted-foreground mt-0.5 break-words leading-snug">
                    <MapPin className="h-2.5 w-2.5 inline-block mr-0.5 -mt-px" />
                    {session.site_name}{session.site_address ? `, ${session.site_address}` : ''}
                  </p>
                </button>

                {isExpanded && (
                  <div className="px-3 pb-3 space-y-2 border-t border-border/50 pt-2 mx-3">
                    <div className="grid grid-cols-2 gap-3 text-xs">
                      <div>
                        <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider block mb-0.5">Taken by</span>
                        <p className="text-foreground">{session.taken_by}</p>
                      </div>
                      <div>
                        <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider block mb-0.5">Instrument</span>
                        <p className="text-muted-foreground break-words leading-snug">
                          {[session.reader_make, session.reader_model, session.reader_serial ? `S/N ${session.reader_serial}` : null].filter(Boolean).join(' · ') || '—'}
                        </p>
                      </div>
                    </div>
                    {/* Reading lines */}
                    {(session.lines || []).length > 0 && (
                      <div className="mt-2 space-y-1">
                        <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider block mb-1">Readings</span>
                        {(session.lines || []).map(line => (
                          <div key={line.id} className="flex items-center justify-between gap-2 text-[11px] py-1 border-b border-border/30 last:border-0">
                            <span className="text-muted-foreground">{line.section_number}. {line.section_name}</span>
                            <span className={cn("font-semibold tabular-nums", line.pressure_value == null && "text-warning")}>
                              {line.pressure_value != null ? `${line.pressure_value} ${line.pressure_unit}` : 'No reading'}
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
                    {session.notes && (
                      <div>
                        <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider block mb-0.5">Notes</span>
                        <p className="text-[11px] text-muted-foreground break-words">{session.notes}</p>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      <PreviousReportsSection reports={savedReports} />

      {/* Session form sheet */}
      <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
        <SheetContent side={isMobile ? 'bottom' : 'right'} className={cn("overflow-y-auto", isMobile ? 'max-h-[90vh] rounded-t-2xl' : 'sm:max-w-lg')}>
          <SheetHeader>
            <SheetTitle>Log Pressure Session</SheetTitle>
            <SheetDescription>{rideName}</SheetDescription>
          </SheetHeader>

          <div className="space-y-4 py-4">
            {/* Date & Time */}
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1">
                <Label className="text-[11px] text-muted-foreground">Date *</Label>
                <Input type="date" value={sessionDate} onChange={e => setSessionDate(e.target.value)} className="h-10 text-[13px]" />
              </div>
              <div className="space-y-1">
                <Label className="text-[11px] text-muted-foreground">Time *</Label>
                <Input type="time" value={sessionTime} onChange={e => setSessionTime(e.target.value)} className="h-10 text-[13px]" />
              </div>
            </div>

            {/* Session type */}
            <div className="space-y-1">
              <Label className="text-[11px] text-muted-foreground">Session type *</Label>
              <Select value={sessionType} onValueChange={setSessionType}>
                <SelectTrigger className="h-10 text-[13px]"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {SESSION_TYPES.map(t => (
                    <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-[10px] text-muted-foreground">When during the day is this session being taken?</p>
            </div>

            {/* Pressure unit for this session */}
            <div className="space-y-1">
              <Label className="text-[11px] text-muted-foreground">Pressure unit for this session *</Label>
              <Select value={readerUnit} onValueChange={v => {
                setReaderUnit(v);
                // Update all lines to match the session unit
                setLines(prev => prev.map(l => ({ ...l, pressure_unit: v })));
              }}>
                <SelectTrigger className="h-10 text-[13px]"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {PRESSURE_UNITS.map(u => (
                    <SelectItem key={u.value} value={u.value}>{u.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-[10px] text-muted-foreground">All readings in this session will use this unit.</p>
            </div>

            {/* Taken by */}
            <div className="space-y-1">
              <Label className="text-[11px] text-muted-foreground">Taken by *</Label>
              <Input value={takenBy} onChange={e => setTakenBy(e.target.value)} placeholder="Name of person taking readings" className="h-10 text-[13px]" />
            </div>

            {/* Site / Location */}
            <div className="space-y-1">
              <Label className="text-[11px] text-muted-foreground">Site / location name *</Label>
              <Input value={siteName} onChange={e => setSiteName(e.target.value)} placeholder="e.g. Riverside Park" className="h-10 text-[13px]" />
            </div>
            <div className="space-y-1">
              <Label className="text-[11px] text-muted-foreground">Site address</Label>
              <Input value={siteAddress} onChange={e => setSiteAddress(e.target.value)} placeholder="Address" className="h-10 text-[13px]" />
            </div>

            {/* Pressure setup summary */}
            <div className="rounded-xl border border-border bg-muted/20 p-3 space-y-1.5">
              <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">Pressure Setup</p>
              <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-[12px]">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Monitoring</span>
                  <span className="font-medium text-foreground">{pressureEnabled ? 'Enabled' : 'Disabled'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Structure</span>
                  <span className="font-medium text-foreground">{isMultiSectional ? 'Multi-sectional' : 'Single-section'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Sections</span>
                  <span className="font-medium text-foreground">{isMultiSectional ? (sectionConfig.length || sectionCount) : 1}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Unit</span>
                  <span className="font-medium text-foreground">{readerUnit.toUpperCase()}</span>
                </div>
              </div>
            </div>

            {/* Warning if multi-sectional but no sections configured */}
            {pressureEnabled && isMultiSectional && sectionConfig.length === 0 && (
              <div className="rounded-xl border border-warning/40 bg-warning/10 p-3 space-y-2">
                <p className="text-[12px] font-semibold text-warning">Pressure setup incomplete</p>
                <p className="text-[11px] text-muted-foreground">
                  This inflatable is marked as multi-sectional but no sections have been configured. Reading rows cannot be auto-generated.
                </p>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="text-[11px] h-7"
                  onClick={() => { setSheetOpen(false); navigate(`/rides/${rideId}`); }}
                >
                  Go to inflatable settings
                </Button>
              </div>
            )}

            {/* Reading lines */}
            <div className="space-y-3">
              <div>
                <Label className="text-[13px] font-semibold">Pressure Readings</Label>
                {isMultiSectional ? (
                  <p className="text-[11px] text-muted-foreground mt-0.5">
                    Multi-sectional inflatable — {sectionConfig.length || sectionCount} sections. One reading required per section.
                  </p>
                ) : (
                  <p className="text-[11px] text-muted-foreground mt-0.5">
                    Single-section inflatable — enter one reading below.
                  </p>
                )}
              </div>
              {lines.map((line, idx) => (
                <div key={idx} className="rounded-xl border border-border bg-muted/10 p-3 space-y-2">
                  <p className="text-[12px] font-semibold text-foreground">
                    {line.section_number}. {line.section_name}
                  </p>
                  <div className="grid grid-cols-2 gap-2">
                    <div className="space-y-1">
                      <Label className="text-[10px] text-muted-foreground">Pressure value ({readerUnit.toUpperCase()}) *</Label>
                      <Input
                        type="number"
                        step="0.01"
                        value={line.pressure_value}
                        onChange={e => updateLine(idx, 'pressure_value', e.target.value)}
                        placeholder="e.g. 1.5"
                        className="h-9 text-[13px]"
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-[10px] text-muted-foreground">Where on this section?</Label>
                      <Input
                        value={line.reading_point}
                        onChange={e => updateLine(idx, 'reading_point', e.target.value)}
                        placeholder="e.g. Valve A, near seam"
                        className="h-9 text-[13px]"
                      />
                      <p className="text-[9px] text-muted-foreground">Exact point where the gauge was placed</p>
                    </div>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-[10px] text-muted-foreground">Time taken</Label>
                    <Input
                      type="time"
                      value={line.reading_taken_at}
                      onChange={e => updateLine(idx, 'reading_taken_at', e.target.value)}
                      className="h-9 text-[13px]"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-[10px] text-muted-foreground">Notes</Label>
                    <Input
                      value={line.notes}
                      onChange={e => updateLine(idx, 'notes', e.target.value)}
                      placeholder="Optional"
                      className="h-9 text-[13px]"
                    />
                  </div>
                </div>
              ))}
            </div>

            {/* Pressure reader picker */}
            <PressureReaderPicker
              profiles={readerProfiles}
              selectedProfileId={selectedReaderId}
              onSelectProfile={setSelectedReaderId}
              onProfileSaved={(p) => setReaderProfiles(prev => [p, ...prev])}
              effectiveUserId={effectiveUserId}
              readerType={readerType} setReaderType={setReaderType}
              make={readerMake} setMake={setReaderMake}
              model={readerModel} setModel={setReaderModel}
              serial={readerSerial} setSerial={setReaderSerial}
              unit={readerUnit} setUnit={setReaderUnit}
              calibrationDate={readerCalibration} setCalibrationDate={setReaderCalibration}
              instrumentNotes={readerNotes} setInstrumentNotes={setReaderNotes}
            />

            {/* Session notes */}
            <div className="space-y-1">
              <Label className="text-[11px] text-muted-foreground">Session notes</Label>
              <Textarea value={sessionNotes} onChange={e => setSessionNotes(e.target.value)} placeholder="Optional notes for this session" className="text-[13px] min-h-[60px]" />
            </div>

            {/* Save button */}
            <Button onClick={handleSave} disabled={saving} className="w-full h-11 text-[14px] font-semibold rounded-xl">
              {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Plus className="h-4 w-4 mr-2" />}
              Save session
            </Button>
          </div>
        </SheetContent>
      </Sheet>

      <ExportActionsDialog open={exportDialogOpen} onOpenChange={setExportDialogOpen} result={exportResult} />
    </div>
  );
};

export default PressureReadingsRegister;
