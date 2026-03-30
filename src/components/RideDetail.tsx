import { useState, useEffect } from 'react';
import { isDocExpired, isDocExpiringSoon } from '@/utils/documentHelpers';
import { countExpiredDocs, countExpiringSoonDocs } from '@/utils/complianceCounts';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ChecksOnboardingModal } from './ChecksOnboardingModal';
import { 
  ArrowLeft, FileText, CheckSquare, Wrench, Pencil, ImageIcon, Trash2,
  AlertTriangle, AlertOctagon, Clock, History,
  Loader2, Camera, AlertCircle, Wind, Gauge, MoreHorizontal
} from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { Tables } from '@/integrations/supabase/types';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useStaff } from '@/contexts/StaffContext';
import { useEffectiveUserId } from '@/hooks/useEffectiveUserId';
import RideDocuments from './RideDocuments';
import InspectionManager from './InspectionManager';
import DefectReportDialog from './DefectReportDialog';
import { FeatureGate } from './FeatureGate';
import RideForm from './RideForm';
import { DeleteRideDialog } from './DeleteRideDialog';
import { lazy, Suspense } from 'react';
import CriticalDefectBanner from './CriticalDefectBanner';
import { useOpenCriticalDefects } from '@/hooks/useOpenCriticalDefects';
import DefectsList from './DefectsList';
import { Collapsible, CollapsibleTrigger, CollapsibleContent } from '@/components/ui/collapsible';

const RideActivityTimeline = lazy(() => import('@/components/RideActivityTimeline'));
const WindSpeedLog = lazy(() => import('@/components/WindSpeedLog'));
const PressureReadingsRegister = lazy(() => import('@/pages/PressureReadingsRegister'));

/** Pressure summary card for the Home tab */
const PressureSummaryCard = ({ ride, onViewPress }: { ride: Ride; onViewPress: () => void }) => {
  const [lastSession, setLastSession] = useState<string | null>(null);
  const { effectiveUserId } = useEffectiveUserId();

  useEffect(() => {
    if (!ride.id || !effectiveUserId) return;
    const load = async () => {
      const { data } = await supabase
        .from('pressure_sessions')
        .select('session_date, session_time')
        .eq('ride_id', ride.id)
        .order('session_date', { ascending: false })
        .order('session_time', { ascending: false })
        .limit(1)
        .maybeSingle();
      if (data) {
        setLastSession(`${data.session_date} ${(data.session_time || '').slice(0, 5)}`);
      }
    };
    load();
  }, [ride.id, effectiveUserId]);

  return (
    <button
      onClick={onViewPress}
      className="w-full bg-card rounded-2xl border border-border shadow-sm p-4 text-left hover:bg-muted/30 active:scale-[0.99] transition-all"
    >
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <Gauge className="h-4 w-4 text-primary" />
          <h2 className="text-sm font-semibold text-foreground">Pressure Monitoring</h2>
        </div>
        <span className="text-[10px] text-muted-foreground font-medium uppercase tracking-wide">View →</span>
      </div>
      <div className="flex flex-wrap gap-x-4 gap-y-1 text-[12px]">
        <span className="text-muted-foreground">Structure: <span className="font-medium text-foreground">{ride.is_multi_sectional ? 'Multi-sectional' : 'Single-section'}</span></span>
        <span className="text-muted-foreground">Sections: <span className="font-medium text-foreground">{ride.is_multi_sectional ? (ride.section_count || '—') : '1'}</span></span>
        {lastSession && (
          <span className="text-muted-foreground">Last session: <span className="font-medium text-foreground">{lastSession}</span></span>
        )}
      </div>
    </button>
  );
};

type Ride = Tables<'rides'> & {
  ride_categories: {
    name: string;
    description: string | null;
    category_group: string;
  };
};

interface RideDetailProps {
  ride: Ride;
  onBack: () => void;
  onUpdate: () => void;
  initialTab?: string;
}

const RideDetail = ({ ride, onBack, onUpdate, initialTab = "overview" }: RideDetailProps) => {
  const { user } = useAuth();
  const { isStaff } = useStaff();
  const { effectiveUserId } = useEffectiveUserId();
  const { toast } = useToast();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  
  const activeTab = searchParams.get('tab') || initialTab;
  const sectionParam = searchParams.get('section');
  const setActiveTab = (tab: string) => {
    setSearchParams({ tab }, { replace: true });
  };

  // Auto-scroll to a specific section when deep-linked (e.g. ?tab=overview&section=defects)
  useEffect(() => {
    if (sectionParam && activeTab === 'overview') {
      const timeout = setTimeout(() => {
        const el = document.getElementById(`ride-${sectionParam}-section`);
        if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }, 400); // allow tab content to render
      return () => clearTimeout(timeout);
    }
  }, [sectionParam, activeTab]);
  
  const [isEditing, setIsEditing] = useState(false);
  const [showChecksGuide, setShowChecksGuide] = useState(false);
  
  const { hasCriticalDefects } = useOpenCriticalDefects(ride.id);
  
  const [rideStats, setRideStats] = useState({
    todayChecks: 0,
    docCount: 0,
    expiredDocCount: 0,
    expiringSoonDocCount: 0,
    hasExpiredDocs: false,
    hasExpiringSoonDocs: false,
    openDefects: 0,
    overdueEvents: [] as Array<{ id: string; event_name: string; due_date: string }>,
    loading: true,
  });
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);
  const [photoDocumentId, setPhotoDocumentId] = useState<string | null>(null);

  useEffect(() => {
    loadRideStats();
    loadRidePhoto();
  }, [ride.id, user]);

  const loadRideStats = async () => {
    if (!effectiveUserId) return;
    try {
      const today = new Date().toISOString().split('T')[0];

      // Today's checks
      let checksQuery = supabase
        .from('checks').select('*', { count: 'exact', head: true })
        .eq('ride_id', ride.id).eq('check_date', today);
      if (!isStaff) checksQuery = checksQuery.eq('user_id', effectiveUserId);

      // Documents
      let docQuery = supabase
        .from('documents')
        .select('expires_at', { count: 'exact' })
        .eq('ride_id', ride.id)
        .neq('document_type', 'maintenance')
        .neq('document_type', 'photo');
      if (!isStaff) docQuery = docQuery.eq('user_id', effectiveUserId);

      // Open defects
      const defectQuery = supabase
        .from('defects')
        .select('id', { count: 'exact', head: true })
        .eq('ride_id', ride.id)
        .neq('status', 'resolved');

      // Overdue compliance (exclude routine checks — they are log-first, not date-enforced)
      const overdueQuery = supabase
        .from('compliance_events')
        .select('id, event_name, due_date, event_type')
        .eq('user_id', effectiveUserId)
        .eq('status', 'scheduled')
        .lt('due_date', today)
        .not('event_type', 'in', '("daily_check","pre_opening_check")')
        .or(`ride_id.eq.${ride.id},ride_id.is.null`)
        .order('due_date', { ascending: true })
        .limit(5);

      const [checksRes, docRes, defectRes, overdueRes] = await Promise.all([
        checksQuery, docQuery, defectQuery, overdueQuery,
      ]);

      const docs = docRes.data || [];
      const expiredDocCount = countExpiredDocs(docs);
      const expiringSoonDocCount = countExpiringSoonDocs(docs);
      const hasExpiredDocs = expiredDocCount > 0;
      const hasExpiringSoonDocs = !hasExpiredDocs && expiringSoonDocCount > 0;

      setRideStats({
        todayChecks: checksRes.count || 0,
        docCount: docRes.count || 0,
        expiredDocCount,
        expiringSoonDocCount,
        hasExpiredDocs,
        hasExpiringSoonDocs,
        openDefects: defectRes.count || 0,
        overdueEvents: (overdueRes.data || []) as any,
        loading: false,
      });
    } catch (error) {
      console.error('Error loading ride stats:', error);
      setRideStats(prev => ({ ...prev, loading: false }));
    }
  };

  const loadRidePhoto = async () => {
    if (!effectiveUserId) return;
    try {
      let photoQuery = supabase
        .from('documents').select('id, file_path')
        .eq('ride_id', ride.id).eq('document_type', 'photo')
        .eq('is_latest_version', true).order('uploaded_at', { ascending: false }).limit(1);
      if (!isStaff) photoQuery = photoQuery.eq('user_id', effectiveUserId);
      const { data: photoDoc } = await photoQuery.maybeSingle();
      if (photoDoc?.file_path) {
        setPhotoDocumentId(photoDoc.id);
        const { data, error } = await supabase.storage.from('ride-documents').createSignedUrl(photoDoc.file_path, 3600);
        if (data?.signedUrl && !error) setPhotoUrl(data.signedUrl);
      }
    } catch (error) {
      console.error('Error loading ride photo:', error);
    }
  };

  const handleEditSuccess = () => {
    setIsEditing(false);
    onUpdate();
    loadRidePhoto();
  };

  const handleStartDailyCheck = () => {
    setActiveTab('checks');
  };

  // Build "Needs Attention" items
  const needsAttention: Array<{ key: string; icon: React.ElementType; label: string; detail: string; color: string; action?: () => void }> = [];
  
  if (!rideStats.loading) {
    if (rideStats.hasExpiredDocs) {
      needsAttention.push({
        key: 'expired-docs',
        icon: Clock,
        label: 'Expired documents',
        detail: 'One or more documents have expired',
        color: 'hsl(0 72% 50%)',
        action: () => setActiveTab('documents'),
      });
    }
    if (rideStats.hasExpiringSoonDocs) {
      needsAttention.push({
        key: 'expiring-docs',
        icon: Clock,
        label: 'Documents expiring soon',
        detail: 'Within the next 30 days',
        color: 'hsl(38 80% 40%)',
        action: () => setActiveTab('documents'),
      });
    }
    for (const evt of rideStats.overdueEvents) {
      needsAttention.push({
        key: `overdue-${evt.id}`,
        icon: AlertCircle,
        label: evt.event_name,
        detail: `Overdue since ${new Date(evt.due_date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}`,
        color: 'hsl(0 72% 50%)',
        action: () => navigate(`/calendar?eventId=${evt.id}`),
      });
    }
    if (rideStats.openDefects > 0 && !hasCriticalDefects) {
      needsAttention.push({
        key: 'open-defects',
        icon: AlertTriangle,
        label: `${rideStats.openDefects} open defect${rideStats.openDefects !== 1 ? 's' : ''}`,
        detail: 'View defects below',
        color: 'hsl(38 80% 40%)',
        action: () => {
          document.getElementById('ride-defects-section')?.scrollIntoView({ behavior: 'smooth' });
        },
      });
    }
  }

  if (isEditing) {
    return (
      <div className="space-y-4">
        <RideForm ride={ride} onSuccess={handleEditSuccess} onCancel={() => setIsEditing(false)} />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <ChecksOnboardingModal forceOpen={showChecksGuide} onClose={() => setShowChecksGuide(false)} />

      {/* Sticky Header — compact */}
      <div className="sticky top-0 z-10 -mx-4 px-4 py-3 bg-background/95 backdrop-blur-sm border-b border-border/50">
        <div className="flex items-center justify-between gap-3">
          <Button variant="ghost" size="icon" onClick={onBack} className="h-10 w-10 shrink-0 active:scale-95">
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div className="flex-1 min-w-0 text-center">
            <h1 className="text-base font-bold truncate">{ride.ride_name}</h1>
            <p className="text-xs text-muted-foreground">{ride.ride_categories.name}</p>
          </div>
          <div className="flex gap-1">
            <Button variant="ghost" size="icon" onClick={() => setIsEditing(true)} className="h-10 w-10 shrink-0 active:scale-95">
              <Pencil className="h-4 w-4" />
            </Button>
            {!isStaff && (
              <DeleteRideDialog ride={ride} onDeleted={onBack} trigger={
                <Button variant="ghost" size="icon" className="h-10 w-10 shrink-0 active:scale-95 text-destructive hover:text-destructive hover:bg-destructive/10">
                  <Trash2 className="h-4 w-4" />
                </Button>
              } />
            )}
          </div>
        </div>
      </div>
      {/* Tab Navigation */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        {(() => {
          const isInflatable = ride.ride_categories.category_group === 'Inflatables';
          const primaryTabs = [
            { value: 'overview', label: 'Home', Icon: FileText },
            { value: 'checks',   label: 'Checks', Icon: CheckSquare },
            { value: 'documents', label: 'Docs', Icon: FileText },
          ];
          const moreTabs = [
            { value: 'activity', label: 'Activity', Icon: History },
            ...(isInflatable ? [{ value: 'windlog', label: 'Wind', Icon: Wind }] : []),
            ...(isInflatable ? [{ value: 'pressure', label: 'Pressure', Icon: Gauge }] : []),
          ];
          const isMoreActive = moreTabs.some(t => t.value === activeTab);
          const activeMoreLabel = moreTabs.find(t => t.value === activeTab)?.label;
          return (
            <div className="bg-card border border-border rounded-2xl overflow-hidden shadow-sm">
              <TabsList className="w-full h-auto p-0.5 bg-transparent rounded-none grid grid-cols-4">
                {primaryTabs.map(({ value, label, Icon }) => (
                  <TabsTrigger
                    key={value}
                    value={value}
                    className="flex flex-col items-center gap-1 py-2 text-[11px] font-semibold rounded-lg border-b-0 data-[state=active]:bg-primary/10 data-[state=active]:text-primary data-[state=inactive]:text-muted-foreground data-[state=active]:shadow-none data-[state=inactive]:bg-transparent transition-all min-h-[44px]"
                  >
                    <Icon className="h-3.5 w-3.5" strokeWidth={2} />
                    {label}
                  </TabsTrigger>
                ))}
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <button
                      type="button"
                      className={`relative flex flex-col items-center justify-center gap-0.5 py-2 text-[11px] font-semibold rounded-lg transition-all min-h-[44px] ${
                        isMoreActive
                          ? 'bg-primary/10 text-primary'
                          : 'text-muted-foreground hover:text-foreground'
                      }`}
                    >
                      <MoreHorizontal className="h-3.5 w-3.5" strokeWidth={2} />
                      <span>More</span>
                      {isMoreActive && activeMoreLabel && (
                        <span className="text-[9px] font-medium text-primary/70 leading-none">{activeMoreLabel}</span>
                      )}
                    </button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="min-w-[160px]">
                    {moreTabs.map(({ value, label, Icon }) => (
                      <DropdownMenuItem
                        key={value}
                        onClick={() => setActiveTab(value)}
                        className={`gap-2 ${activeTab === value ? 'bg-primary/10 text-primary' : ''}`}
                      >
                        <Icon className="h-4 w-4" />
                        {label}
                      </DropdownMenuItem>
                    ))}
                  </DropdownMenuContent>
                </DropdownMenu>
              </TabsList>
            </div>
          );
        })()}

        {/* ─── HOME TAB ─── */}
        <TabsContent value="overview" className="space-y-5 animate-fade-in">

           {/* Critical Defect Banner — top priority */}
          <CriticalDefectBanner
            rideId={ride.id}
            rideName={ride.ride_name}
            onViewDefects={() => {
              document.getElementById('ride-defects-section')?.scrollIntoView({ behavior: 'smooth' });
            }}
          />

          {/* Ride Card — photo + details + operating status */}
          <div className="bg-card rounded-2xl border border-border shadow-sm overflow-hidden">
            {/* Photo */}
              {photoUrl ? (
                <div
                  className="relative h-36 bg-muted cursor-pointer"
                  onClick={() => {
                    if (!photoDocumentId) return;
                    void openDocumentById({
                      documentId: photoDocumentId,
                      navigate,
                      sourceComponent: 'RideDetail.photo',
                      toast,
                    });
                  }}
                >
                <img src={photoUrl} alt={ride.ride_name} className="w-full h-full object-cover" />
              </div>
            ) : (
              <div className="h-24 bg-muted/60 flex items-center justify-center cursor-pointer" onClick={() => setIsEditing(true)}>
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Camera className="h-5 w-5" />
                  <span className="text-xs">Add photo</span>
                </div>
              </div>
            )}

            <div className="p-4 space-y-3">
              {/* Details row */}
              <div className="flex flex-wrap gap-2">
                {[
                  ride.ride_categories.name,
                  ride.manufacturer,
                  ride.year_manufactured?.toString(),
                  ride.serial_number ? `S/N: ${ride.serial_number}` : null,
                ].filter(Boolean).map((detail, i) => (
                  <span key={i} className="px-2.5 py-1 rounded-full text-xs font-medium bg-muted text-muted-foreground border border-border">
                    {detail}
                  </span>
                ))}
              </div>

            </div>
          </div>

          {/* Needs Attention */}
          {needsAttention.length > 0 && (
            <button
              className="w-full bg-card rounded-2xl border border-orange-200 dark:border-orange-800/40 shadow-sm p-4 space-y-2 text-left hover:bg-muted/30 active:scale-[0.99] transition-all"
              onClick={() => document.getElementById('ride-defects-section')?.scrollIntoView({ behavior: 'smooth' })}
            >
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-semibold text-foreground">Needs Attention</h2>
                <span className="text-[10px] text-muted-foreground font-medium uppercase tracking-wide">View ↓</span>
              </div>
              <div className="space-y-1.5">
                {needsAttention.map(item => (
                  <div
                    key={item.key}
                    className="flex items-center gap-3 p-2 rounded-lg"
                  >
                    <item.icon className="h-4 w-4 shrink-0" style={{ color: item.color }} />
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-foreground truncate">{item.label}</p>
                      <p className="text-xs text-muted-foreground">{item.detail}</p>
                    </div>
                  </div>
                ))}
              </div>
            </button>
          )}

          {/* Quick Actions */}
          <div className="rounded-2xl p-4 space-y-3">
            <h2 className="text-sm font-semibold text-foreground">Quick Actions</h2>
            <div className="grid grid-cols-2 gap-2.5">
              <button
                className="flex items-center justify-center gap-2 rounded-xl bg-primary text-primary-foreground py-3 px-3 min-h-[48px] font-semibold text-sm shadow-sm hover:opacity-90 col-span-2 active:scale-[0.98] transition-transform"
                onClick={handleStartDailyCheck}
              >
                <CheckSquare className="h-4 w-4 shrink-0" />
                Start Check
              </button>
              <DefectReportDialog
                rideId={ride.id}
                rideName={ride.ride_name}
                onDefectReported={loadRideStats}
                trigger={
                  <button
                    className="flex items-center justify-center gap-2 rounded-xl border border-border bg-card py-3 px-3 min-h-[48px] font-semibold text-sm text-foreground hover:bg-muted/40 active:scale-[0.98] transition-transform"
                  >
                    <AlertTriangle className="h-4 w-4 shrink-0" />
                    Report Defect
                  </button>
                }
              />
              <button
                className="flex items-center justify-center gap-2 rounded-xl border border-border bg-card py-3 px-3 min-h-[48px] font-semibold text-sm text-foreground hover:bg-muted/40 active:scale-[0.98] transition-transform"
                onClick={() => setActiveTab('documents')}
              >
                <FileText className="h-4 w-4 shrink-0" />
                Upload Document
              </button>
              <button
                className="flex items-center justify-center gap-2 rounded-xl border border-border bg-card py-3 px-3 min-h-[48px] font-semibold text-sm text-foreground hover:bg-muted/40 active:scale-[0.98] transition-transform col-span-2"
                onClick={() => navigate(`/maintenance?rideId=${ride.id}`)}
              >
                <Wrench className="h-4 w-4 shrink-0" />
                Log Maintenance
              </button>
            </div>
          </div>

          {/* Summary Stats — compact row */}
          <div className="grid grid-cols-3 gap-2.5">
            <button onClick={() => setActiveTab('checks')} className="bg-card rounded-xl border border-border p-3.5 text-center hover:bg-muted/30 active:scale-[0.98] transition-all">
              <p className="text-lg font-bold text-foreground">{rideStats.loading ? '—' : rideStats.todayChecks}</p>
              <p className="text-[11px] text-muted-foreground leading-tight">Checks today</p>
            </button>
            <button onClick={() => setActiveTab('documents')} className={`bg-card rounded-xl border p-3.5 text-center hover:bg-muted/30 active:scale-[0.98] transition-all ${rideStats.hasExpiredDocs ? 'border-destructive/30' : rideStats.hasExpiringSoonDocs ? 'border-orange-300 dark:border-orange-800/40' : 'border-border'}`}>
              <p className={`text-lg font-bold ${rideStats.hasExpiredDocs ? 'text-destructive' : rideStats.hasExpiringSoonDocs ? 'text-orange-600 dark:text-orange-400' : 'text-green-600 dark:text-green-400'}`}>
                {rideStats.loading ? '—' : rideStats.hasExpiredDocs ? rideStats.expiredDocCount : rideStats.hasExpiringSoonDocs ? rideStats.expiringSoonDocCount : '✓'}
              </p>
              <p className="text-[11px] text-muted-foreground leading-tight">{rideStats.hasExpiredDocs ? 'Docs expired' : rideStats.hasExpiringSoonDocs ? 'Docs expiring' : 'Docs current'}</p>
            </button>
            <button onClick={() => document.getElementById('ride-defects-section')?.scrollIntoView({ behavior: 'smooth' })} className={`bg-card rounded-xl border p-3.5 text-center hover:bg-muted/30 active:scale-[0.98] transition-all ${rideStats.openDefects > 0 ? 'border-destructive/30' : 'border-border'}`}>
              <p className={`text-lg font-bold ${rideStats.openDefects > 0 ? 'text-destructive' : 'text-foreground'}`}>{rideStats.loading ? '—' : rideStats.openDefects}</p>
              <p className="text-[11px] text-muted-foreground leading-tight">Open defects</p>
            </button>
          </div>

          {/* Pressure Monitoring Summary (all inflatables) */}
          {ride.ride_categories.category_group === 'Inflatables' && (
            <PressureSummaryCard ride={ride} onViewPress={() => setActiveTab('pressure')} />
          )}

          {/* ─── DEFECTS SECTION ─── */}
          <div id="ride-defects-section" className="space-y-3">
            <h3 className="text-[13px] font-bold text-foreground tracking-[1px] uppercase">Defects</h3>
            <div className="h-px bg-border" />
            <DefectsList
              rideId={ride.id}
              rideName={ride.ride_name}
              showResolved={false}
              onDefectUpdated={loadRideStats}
            />
            <Collapsible>
              <CollapsibleTrigger className="flex items-center gap-2 text-xs text-muted-foreground hover:text-foreground transition-colors py-1">
                <History className="h-3.5 w-3.5" />
                <span>Show closed defects</span>
              </CollapsibleTrigger>
              <CollapsibleContent className="pt-2">
                <DefectsList
                  rideId={ride.id}
                  rideName={ride.ride_name}
                  showResolved={true}
                  onDefectUpdated={loadRideStats}
                />
              </CollapsibleContent>
            </Collapsible>
          </div>

        </TabsContent>

        {/* ─── DOCS TAB ─── */}
        <TabsContent value="documents" className="animate-fade-in">
          <RideDocuments ride={ride} />
        </TabsContent>

        {/* ─── CHECKS TAB ─── */}
        <TabsContent value="checks" className="animate-fade-in">
          <FeatureGate feature="Safety Checks">
            <InspectionManager ride={ride} />
          </FeatureGate>
        </TabsContent>

        {/* ─── ACTIVITY TAB ─── */}
        <TabsContent value="activity" className="animate-fade-in">
          <Suspense fallback={<div className="flex items-center justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>}>
            <RideActivityTimeline rideId={ride.id} />
          </Suspense>
        </TabsContent>

        {/* ─── WIND LOG TAB (inflatables only) ─── */}
        {ride.ride_categories.category_group === 'Inflatables' && (
          <TabsContent value="windlog" className="animate-fade-in">
            <Suspense fallback={<div className="flex items-center justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>}>
              <WindSpeedLog rideId={ride.id} rideName={ride.ride_name} />
            </Suspense>
          </TabsContent>
        )}

        {/* ─── PRESSURE TAB (all inflatables) ─── */}
        {ride.ride_categories.category_group === 'Inflatables' && (
          <TabsContent value="pressure" className="animate-fade-in">
            <Suspense fallback={<div className="flex items-center justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>}>
              <PressureReadingsRegister rideIdProp={ride.id} embedded onEditRide={() => setIsEditing(true)} />
            </Suspense>
          </TabsContent>
        )}

      </Tabs>

    </div>
  );
};

export default RideDetail;
