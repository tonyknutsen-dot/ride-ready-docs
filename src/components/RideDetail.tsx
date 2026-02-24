import { useState, useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ChecksOnboardingModal } from './ChecksOnboardingModal';
import { 
  ArrowLeft, FileText, CheckSquare, Wrench, Pencil, ImageIcon, Trash2,
  AlertTriangle, AlertOctagon, Clock, PlayCircle, PauseCircle, History,
  Loader2, Camera, AlertCircle
} from 'lucide-react';
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
import ImageViewer from './ImageViewer';
import { DeleteRideDialog } from './DeleteRideDialog';
import { lazy, Suspense } from 'react';
import { useDailyStatus } from '@/hooks/useDailyStatus';
import { useAppRole } from '@/hooks/useAppRole';
import CriticalDefectBanner from './CriticalDefectBanner';
import { useOpenCriticalDefects } from '@/hooks/useOpenCriticalDefects';
import NotOperatingReasonDialog from '@/components/NotOperatingReasonDialog';
import { Textarea } from '@/components/ui/textarea';
import DefectsList from './DefectsList';
import { Collapsible, CollapsibleTrigger, CollapsibleContent } from '@/components/ui/collapsible';

const RideActivityTimeline = lazy(() => import('@/components/RideActivityTimeline'));

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
  const setActiveTab = (tab: string) => {
    setSearchParams({ tab }, { replace: true });
  };
  
  const [isEditing, setIsEditing] = useState(false);
  const [showChecksGuide, setShowChecksGuide] = useState(false);
  const [showStartCheckModal, setShowStartCheckModal] = useState(false);
  const [showConfirmOff, setShowConfirmOff] = useState(false);
  const [showOverrideDialog, setShowOverrideDialog] = useState(false);
  const [overrideReason, setOverrideReason] = useState('');
  const role = useAppRole();
  const { isOperating, isLoading: opLoading, canToggle, toggling, toggleOperating, autoSetOperating } = useDailyStatus(ride.id);
  const { hasCriticalDefects } = useOpenCriticalDefects(ride.id);
  
  const [rideStats, setRideStats] = useState({
    todayChecks: 0,
    docCount: 0,
    hasExpiredDocs: false,
    hasExpiringSoonDocs: false,
    openDefects: 0,
    overdueEvents: [] as Array<{ id: string; event_name: string; due_date: string }>,
    loading: true,
  });
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);
  const [photoViewerOpen, setPhotoViewerOpen] = useState(false);

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

      // Overdue compliance
      const overdueQuery = supabase
        .from('compliance_events')
        .select('id, event_name, due_date')
        .eq('user_id', effectiveUserId)
        .eq('status', 'scheduled')
        .lt('due_date', today)
        .or(`ride_id.eq.${ride.id},ride_id.is.null`)
        .order('due_date', { ascending: true })
        .limit(5);

      const [checksRes, docRes, defectRes, overdueRes] = await Promise.all([
        checksQuery, docQuery, defectQuery, overdueQuery,
      ]);

      const thirtyDays = new Date();
      thirtyDays.setDate(thirtyDays.getDate() + 30);
      const docs = docRes.data || [];
      const hasExpiredDocs = docs.some(d => d.expires_at && new Date(d.expires_at) < new Date());
      const hasExpiringSoonDocs = !hasExpiredDocs && docs.some(d => d.expires_at && new Date(d.expires_at) <= thirtyDays);

      setRideStats({
        todayChecks: checksRes.count || 0,
        docCount: docRes.count || 0,
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
        .from('documents').select('file_path')
        .eq('ride_id', ride.id).eq('document_type', 'photo')
        .eq('is_latest_version', true).order('uploaded_at', { ascending: false }).limit(1);
      if (!isStaff) photoQuery = photoQuery.eq('user_id', effectiveUserId);
      const { data: photoDoc } = await photoQuery.maybeSingle();
      if (photoDoc?.file_path) {
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

  const requiresOpChecks = ride.requires_operational_checks;
  const showCheckWarning = isOperating && requiresOpChecks && rideStats.todayChecks === 0 && !rideStats.loading;

  const handleStartDailyCheck = () => {
    if (!isOperating && requiresOpChecks) {
      setShowStartCheckModal(true);
    } else {
      setActiveTab('checks');
    }
  };

  const handleStartCheckAndMarkOperating = async () => {
    setShowStartCheckModal(false);
    await autoSetOperating('daily');
    setActiveTab('checks');
  };

  const handleStartCheckOnly = () => {
    setShowStartCheckModal(false);
    setActiveTab('checks');
  };

  // Build "Needs Attention" items
  const needsAttention: Array<{ key: string; icon: React.ElementType; label: string; detail: string; color: string; action?: () => void }> = [];
  
  if (!rideStats.loading) {
    if (showCheckWarning) {
      needsAttention.push({
        key: 'check-due',
        icon: AlertTriangle,
        label: 'Check outstanding',
        detail: 'In use today but no check completed',
        color: 'hsl(38 80% 40%)',
        action: () => setActiveTab('checks'),
      });
    }
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

      {/* Photo Viewer */}
      {photoUrl && (
        <ImageViewer isOpen={photoViewerOpen} onClose={() => setPhotoViewerOpen(false)} imageUrl={photoUrl} imageName={ride.ride_name} onDownload={() => window.open(photoUrl, '_blank')} />
      )}

      {/* Tab Navigation */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <div className="bg-card border border-border rounded-2xl overflow-hidden shadow-sm">
          <TabsList className="grid w-full grid-cols-4 h-auto p-0 bg-transparent rounded-none">
            {[
              { value: 'overview', label: 'Home', Icon: FileText },
              { value: 'checks',   label: 'Checks', Icon: CheckSquare },
              { value: 'documents', label: 'Docs', Icon: FileText },
              { value: 'activity', label: 'Activity', Icon: History },
            ].map(({ value, label, Icon }) => (
              <TabsTrigger
                key={value}
                value={value}
                className="flex flex-col items-center gap-1 py-3.5 text-xs font-semibold rounded-none border-b-2 data-[state=active]:border-b-primary data-[state=inactive]:border-b-transparent data-[state=active]:text-primary data-[state=inactive]:text-muted-foreground data-[state=active]:bg-transparent data-[state=inactive]:bg-transparent transition-all"
              >
                <Icon className="h-4 w-4" strokeWidth={2} />
                {label}
              </TabsTrigger>
            ))}
          </TabsList>
        </div>

        {/* ─── HOME TAB ─── */}
        <TabsContent value="overview" className="space-y-4 animate-fade-in">

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
              <div className="relative h-36 bg-muted cursor-pointer" onClick={() => setPhotoViewerOpen(true)}>
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

              {/* Operating Today */}
              <div className="flex items-center justify-between gap-3 bg-muted/30 rounded-xl border border-border px-3 py-2.5">
                <div className="flex items-center gap-2 min-w-0">
                  {isOperating ? (
                    <PlayCircle className="h-5 w-5 text-green-600 shrink-0" />
                  ) : (
                    <PauseCircle className="h-5 w-5 text-muted-foreground shrink-0" />
                  )}
                  <p className="text-sm font-semibold">
                    {opLoading ? 'Checking…' : isOperating ? 'In use today' : 'Not in use today'}
                  </p>
                </div>
                {canToggle && (
                  <Button
                    variant={isOperating ? 'outline' : 'default'}
                    size="sm"
                    disabled={toggling || opLoading}
                    onClick={() => {
                      if (isOperating) {
                        setShowConfirmOff(true);
                        return;
                      }
                      if (!isOperating && hasCriticalDefects) {
                        if (role === 'controller') {
                          setShowOverrideDialog(true);
                        } else {
                          toast({
                            title: 'Cannot mark in use',
                            description: 'Open critical defect — resolve it first.',
                            variant: 'destructive',
                          });
                        }
                        return;
                      }
                      toggleOperating();
                    }}
                    className="shrink-0 text-xs"
                  >
                    {toggling ? '…' : isOperating ? 'Set not in use' : 'Mark in use'}
                  </Button>
                )}
              </div>
            </div>
          </div>

          {/* Needs Attention */}
          {needsAttention.length > 0 && (
            <div className="bg-card rounded-2xl border border-border shadow-sm p-4 space-y-2">
              <h2 className="text-sm font-semibold text-foreground">Needs Attention</h2>
              <div className="space-y-1.5">
                {needsAttention.map(item => (
                  <button
                    key={item.key}
                    className="w-full flex items-center gap-3 p-2.5 rounded-xl hover:bg-muted/50 transition-colors text-left"
                    onClick={item.action}
                    disabled={!item.action}
                  >
                    <item.icon className="h-4 w-4 shrink-0" style={{ color: item.color }} />
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-foreground truncate">{item.label}</p>
                      <p className="text-xs text-muted-foreground">{item.detail}</p>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Quick Actions */}
          <div className="bg-card rounded-2xl border border-border shadow-sm p-4 space-y-3">
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
          <div className="grid grid-cols-3 gap-2">
            <button onClick={() => setActiveTab('checks')} className="bg-card rounded-xl border border-border p-3 text-center hover:bg-muted/30 transition-colors">
              <p className="text-lg font-bold text-foreground">{rideStats.loading ? '—' : rideStats.todayChecks}</p>
              <p className="text-[11px] text-muted-foreground">Checks today</p>
            </button>
            <button onClick={() => setActiveTab('documents')} className="bg-card rounded-xl border border-border p-3 text-center hover:bg-muted/30 transition-colors">
              <p className="text-lg font-bold text-foreground">{rideStats.loading ? '—' : rideStats.docCount}</p>
              <p className="text-[11px] text-muted-foreground">Documents</p>
            </button>
            <button onClick={() => document.getElementById('ride-defects-section')?.scrollIntoView({ behavior: 'smooth' })} className="bg-card rounded-xl border border-border p-3 text-center hover:bg-muted/30 transition-colors">
              <p className={`text-lg font-bold ${rideStats.openDefects > 0 ? 'text-destructive' : 'text-foreground'}`}>{rideStats.loading ? '—' : rideStats.openDefects}</p>
              <p className="text-[11px] text-muted-foreground">Open defects</p>
            </button>
          </div>

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

      </Tabs>

      {/* Confirmation modal: Start check when not operating */}
      <Dialog open={showStartCheckModal} onOpenChange={setShowStartCheckModal}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Not marked in use today</DialogTitle>
            <DialogDescription>
              Do you want to start the check and mark this ride as in use today?
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="flex flex-col gap-2 sm:flex-col">
            <Button onClick={handleStartCheckAndMarkOperating} className="w-full">
              Start check + mark in use
            </Button>
            <Button variant="outline" onClick={handleStartCheckOnly} className="w-full">
              Start check only
            </Button>
            <Button variant="ghost" onClick={() => setShowStartCheckModal(false)} className="w-full">
              Cancel
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Confirm OFF modal */}
      <NotOperatingReasonDialog
        open={showConfirmOff}
        onOpenChange={setShowConfirmOff}
        onConfirm={(reason) => {
          toggleOperating(reason);
          setShowConfirmOff(false);
        }}
        disabled={toggling}
        preselectReason={hasCriticalDefects ? 'Critical defect (pre-opening/daily check)' : undefined}
      />

      {/* Override dialog — controller only */}
      <Dialog open={showOverrideDialog} onOpenChange={setShowOverrideDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <div className="flex items-center gap-2 mb-1">
              <AlertOctagon className="h-5 w-5 text-destructive" />
              <DialogTitle className="text-destructive">Override — open critical defect</DialogTitle>
            </div>
            <DialogDescription>
              This ride has an open critical defect. Explain why it can still be used.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-1.5 py-2">
            <Label className="text-sm font-medium">Reason *</Label>
            <Textarea
              value={overrideReason}
              onChange={(e) => setOverrideReason(e.target.value)}
              placeholder="Explain why the ride can be used despite the defect…"
              rows={2}
              className="text-sm"
            />
          </div>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" onClick={() => { setShowOverrideDialog(false); setOverrideReason(''); }}>
              Cancel
            </Button>
            <Button onClick={() => {
              if (!overrideReason.trim()) return;
              toggleOperating(`Override: ${overrideReason.trim()}`);
              setShowOverrideDialog(false);
              setOverrideReason('');
            }} disabled={toggling || !overrideReason.trim()} className="bg-amber-600 hover:bg-amber-700 text-white">
              {toggling ? 'Updating…' : 'Override and mark in use'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default RideDetail;
