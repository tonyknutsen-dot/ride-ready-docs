import { useState, useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ChecksOnboardingModal } from './ChecksOnboardingModal';
import { 
  ArrowLeft, FileText, CheckSquare, Mail, Wrench, Pencil, ImageIcon, Trash2,
  ShieldCheck, ShieldAlert, Clock
} from 'lucide-react';
import { Tables } from '@/integrations/supabase/types';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useStaff } from '@/contexts/StaffContext';
import { useEffectiveUserId } from '@/hooks/useEffectiveUserId';
import { useSubscription } from '@/hooks/useSubscription';
import RideDocuments from './RideDocuments';
import InspectionManager from './InspectionManager';
import { SendDocumentsDialog } from './SendDocumentsDialog';
import { FeatureGate } from './FeatureGate';
import RideForm from './RideForm';
import ImageViewer from './ImageViewer';
import { DeleteRideDialog } from './DeleteRideDialog';

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
  const { subscription } = useSubscription();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  
  const activeTab = searchParams.get('tab') || initialTab;
  const setActiveTab = (tab: string) => {
    setSearchParams({ tab }, { replace: true });
  };
  
  const [isEditing, setIsEditing] = useState(false);
  const [showChecksGuide, setShowChecksGuide] = useState(false);
  const [rideStats, setRideStats] = useState({
    docCount: 0,
    todayChecks: 0,
    maintenanceCount: 0,
    maintenanceCostYTD: 0,
    lastMaintenanceDate: null as string | null,
    riskCount: 0,
    riskMedium: 0,
    riskHigh: 0,
    hasExpiredDocs: false,
    hasExpiringSoonDocs: false,
    loading: true
  });
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);
  const [photoViewerOpen, setPhotoViewerOpen] = useState(false);

  useEffect(() => {
    loadRideStatistics();
    loadRidePhoto();
  }, [ride.id, user]);

  const loadRideStatistics = async () => {
    if (!effectiveUserId) return;
    try {
      let docQuery = supabase
        .from('documents')
        .select('expires_at, document_type', { count: 'exact' })
        .eq('ride_id', ride.id)
        .neq('document_type', 'maintenance')
        .neq('document_type', 'photo');
      if (!isStaff) docQuery = docQuery.eq('user_id', effectiveUserId);
      const { data: docData, count: docCount } = await docQuery;

      const thirtyDaysOut = new Date();
      thirtyDaysOut.setDate(thirtyDaysOut.getDate() + 30);
      const hasExpiredDocs = (docData || []).some(d => d.expires_at && new Date(d.expires_at) < new Date());
      const hasExpiringSoonDocs = !hasExpiredDocs && (docData || []).some(d => d.expires_at && new Date(d.expires_at) <= thirtyDaysOut);

      const today = new Date().toISOString().split('T')[0];
      let checksQuery = supabase
        .from('checks').select('*', { count: 'exact', head: true })
        .eq('ride_id', ride.id).eq('check_date', today);
      if (!isStaff) checksQuery = checksQuery.eq('user_id', effectiveUserId);
      const { count: todayChecks } = await checksQuery;

      let maintenanceQuery = supabase
        .from('maintenance_records').select('cost, maintenance_date, created_at')
        .eq('ride_id', ride.id);
      if (!isStaff) maintenanceQuery = maintenanceQuery.eq('user_id', effectiveUserId);
      const { data: maintenanceData } = await maintenanceQuery;

      const startOfYear = new Date(new Date().getFullYear(), 0, 1).toISOString();
      const maintenanceCostYTD = (maintenanceData || [])
        .filter(r => r.created_at >= startOfYear)
        .reduce((sum, r) => sum + (Number(r.cost) || 0), 0);
      const sortedMaint = (maintenanceData || []).sort((a, b) => b.maintenance_date.localeCompare(a.maintenance_date));
      const lastMaintenanceDate = sortedMaint[0]?.maintenance_date || null;

      let riskQuery = supabase
        .from('risk_assessment_items').select('risk_level, risk_assessment_id');
      const { data: raData } = await supabase
        .from('risk_assessments' as any).select('id').eq('ride_id', ride.id);
      const raIds = (raData || []).map((r: any) => r.id);
      let riskData: any[] = [];
      if (raIds.length > 0) {
        const { data: rItems } = await supabase
          .from('risk_assessment_items').select('risk_level').in('risk_assessment_id', raIds);
        riskData = rItems || [];
      }

      setRideStats({
        docCount: docCount || 0,
        todayChecks: todayChecks || 0,
        maintenanceCount: (maintenanceData || []).length,
        maintenanceCostYTD,
        lastMaintenanceDate,
        riskCount: riskData.length,
        riskMedium: riskData.filter(r => r.risk_level === 'medium').length,
        riskHigh: riskData.filter(r => r.risk_level === 'high').length,
        hasExpiredDocs,
        hasExpiringSoonDocs,
        loading: false,
      });
    } catch (error) {
      console.error('Error loading ride statistics:', error);
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

  // Compliance status
  const complianceStatus = rideStats.loading ? null
    : rideStats.hasExpiredDocs ? 'overdue'
    : rideStats.hasExpiringSoonDocs ? 'expiring'
    : 'compliant';

  const complianceConfig = {
    overdue:   { label: 'Attention Required', sub: 'One or more documents have expired', bg: '#FEF2F2', border: '#FCA5A5', text: '#991B1B', Icon: ShieldAlert },
    expiring:  { label: 'Due Soon', sub: 'Documents expiring within 30 days', bg: '#FFFBEB', border: '#FCD34D', text: '#92400E', Icon: Clock },
    compliant: { label: 'Compliant', sub: 'All documents current', bg: '#F0FDF4', border: '#86EFAC', text: '#166534', Icon: ShieldCheck },
  };

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

      {/* Sticky Header */}
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
            <SendDocumentsDialog ride={ride} trigger={
              <Button variant="ghost" size="icon" className="h-10 w-10 shrink-0 active:scale-95">
                <Mail className="h-4 w-4" />
              </Button>
            } />
            <DeleteRideDialog ride={ride} onDeleted={onBack} trigger={
              <Button variant="ghost" size="icon" className="h-10 w-10 shrink-0 active:scale-95 text-destructive hover:text-destructive hover:bg-destructive/10">
                <Trash2 className="h-4 w-4" />
              </Button>
            } />
          </div>
        </div>
      </div>

      {/* Photo Viewer */}
      {photoUrl && (
        <ImageViewer isOpen={photoViewerOpen} onClose={() => setPhotoViewerOpen(false)} imageUrl={photoUrl} imageName={ride.ride_name} onDownload={() => window.open(photoUrl, '_blank')} />
      )}

      {/* Main Tabs — underline style */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <div className="bg-white border border-border rounded-2xl overflow-hidden" style={{ boxShadow: '0 2px 6px rgba(0,0,0,0.04)' }}>
          <TabsList className="grid w-full grid-cols-3 h-auto p-0 bg-transparent rounded-none">
            {[
              { value: 'overview', label: 'Home', Icon: FileText },
              { value: 'checks',   label: 'Checks', Icon: CheckSquare },
              { value: 'documents', label: 'Docs', Icon: FileText },
            ].map(({ value, label, Icon }) => (
              <TabsTrigger
                key={value}
                value={value}
                className="flex flex-col items-center gap-1 py-3.5 text-xs font-semibold rounded-none border-b-2 data-[state=active]:border-b-[hsl(213_52%_24%)] data-[state=inactive]:border-b-transparent data-[state=active]:text-[hsl(213_52%_24%)] data-[state=inactive]:text-muted-foreground data-[state=active]:bg-transparent data-[state=inactive]:bg-transparent transition-all"
              >
                <Icon className="h-4 w-4" strokeWidth={2} />
                {label}
              </TabsTrigger>
            ))}
          </TabsList>
        </div>

        <TabsContent value="overview" className="space-y-4 animate-fade-in">

          {/* Top Summary Card */}
          <div className="bg-card rounded-2xl border border-border shadow-sm p-5 space-y-4">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-start gap-3">
                <div className="h-11 w-11 rounded-2xl bg-primary/10 flex items-center justify-center shrink-0">
                  <Wrench className="h-5 w-5 text-primary" strokeWidth={2} />
                </div>
                <div>
                  <h1 className="text-base font-bold text-foreground leading-tight">{ride.ride_name}</h1>
                  <p className="text-sm text-muted-foreground">{ride.ride_categories.name}{ride.manufacturer ? ` • ${ride.manufacturer}` : ''}{ride.year_manufactured ? ` • ${ride.year_manufactured}` : ''}</p>
                </div>
              </div>
              {complianceStatus && (() => {
                const cfg = complianceConfig[complianceStatus];
                return (
                  <span className="px-2.5 py-1 rounded-full text-[11px] font-bold border shrink-0" style={{ background: cfg.bg, borderColor: cfg.border, color: cfg.text }}>
                    {cfg.label.toUpperCase()}
                  </span>
                );
              })()}
            </div>

            {/* KPI Grid */}
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-muted/40 rounded-xl border border-border p-3.5">
                <p className="text-[11px] text-muted-foreground">Today's Checks</p>
                <p className="text-sm font-bold text-foreground mt-0.5">{rideStats.loading ? '—' : rideStats.todayChecks > 0 ? `${rideStats.todayChecks} done` : 'None yet'}</p>
                <p className="text-[11px] text-muted-foreground mt-1">Tap Checks tab to start</p>
              </div>
              <div className="bg-muted/40 rounded-xl border border-border p-3.5">
                <p className="text-[11px] text-muted-foreground">Last Maintenance</p>
                <p className="text-sm font-bold text-foreground mt-0.5">
                  {rideStats.loading ? '—' : rideStats.lastMaintenanceDate ? new Date(rideStats.lastMaintenanceDate).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : 'None logged'}
                </p>
                <p className="text-[11px] text-muted-foreground mt-1">YTD cost: £{rideStats.maintenanceCostYTD.toFixed(0)}</p>
              </div>
              <div className="bg-muted/40 rounded-xl border border-border p-3.5">
                <p className="text-[11px] text-muted-foreground">Risk Register</p>
                <p className="text-sm font-bold text-foreground mt-0.5">{rideStats.loading ? '—' : `${rideStats.riskCount} item${rideStats.riskCount !== 1 ? 's' : ''}`}</p>
                {rideStats.riskHigh > 0 ? (
                  <p className="text-[11px] text-destructive mt-1 font-semibold">High: {rideStats.riskHigh}</p>
                ) : rideStats.riskMedium > 0 ? (
                  <p className="text-[11px] text-amber-700 mt-1">Medium: {rideStats.riskMedium}</p>
                ) : (
                  <p className="text-[11px] text-muted-foreground mt-1">No high risks</p>
                )}
              </div>
              <div className="bg-muted/40 rounded-xl border border-border p-3.5">
                <p className="text-[11px] text-muted-foreground">Documents</p>
                <p className="text-sm font-bold text-foreground mt-0.5">{rideStats.loading ? '—' : `${rideStats.docCount} file${rideStats.docCount !== 1 ? 's' : ''}`}</p>
                {rideStats.hasExpiredDocs ? (
                  <p className="text-[11px] text-destructive mt-1 font-semibold">Expired docs!</p>
                ) : rideStats.hasExpiringSoonDocs ? (
                  <p className="text-[11px] text-amber-700 mt-1">Expiring soon</p>
                ) : (
                  <p className="text-[11px] text-muted-foreground mt-1">All current</p>
                )}
              </div>
            </div>
          </div>

          {/* Quick Actions */}
          <div className="bg-card rounded-2xl border border-border shadow-sm p-5 space-y-3">
            <h2 className="text-sm font-semibold text-foreground">Quick Actions</h2>
            <div className="grid grid-cols-2 gap-3">
              <Button className="h-12 rounded-xl text-sm font-semibold" onClick={() => setActiveTab('checks')}>
                <CheckSquare className="h-4 w-4 mr-1.5" />
                Start Check
              </Button>
              <Button variant="outline" className="h-12 rounded-xl text-sm font-semibold" onClick={() => navigate(`/maintenance?rideId=${ride.id}`)}>
                <Wrench className="h-4 w-4 mr-1.5" />
                Log Maintenance
              </Button>
              <Button variant="outline" className="h-12 rounded-xl text-sm font-semibold" onClick={() => setActiveTab('documents')}>
                <FileText className="h-4 w-4 mr-1.5" />
                Upload Document
              </Button>
              <Button variant="outline" className="h-12 rounded-xl text-sm font-semibold" onClick={() => navigate(`/risk-assessments`)}>
                <ShieldCheck className="h-4 w-4 mr-1.5" />
                Risk Register
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">Keep checks, maintenance and risks up to date so your generated PDFs are accurate.</p>
          </div>

          {/* Compliance Snapshot */}
          <div className="bg-card rounded-2xl border border-border shadow-sm p-5 space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold text-foreground">Compliance Snapshot</h2>
              <button className="text-xs font-semibold text-primary" onClick={() => setActiveTab('checks')}>View Checks</button>
            </div>

            {/* Checks row */}
            <div className="border border-border rounded-xl p-4 space-y-2">
              <div className="flex items-center justify-between">
                <p className="text-sm font-semibold text-foreground">Safety Checks</p>
                <span className={`px-2.5 py-1 rounded-full text-[11px] font-bold border ${rideStats.todayChecks > 0 ? 'bg-green-50 text-green-700 border-green-200' : 'bg-amber-50 text-amber-800 border-amber-200'}`}>
                  {rideStats.todayChecks > 0 ? 'DONE TODAY' : 'PENDING'}
                </span>
              </div>
              <p className="text-xs text-muted-foreground">{rideStats.todayChecks > 0 ? `${rideStats.todayChecks} check${rideStats.todayChecks !== 1 ? 's' : ''} completed today` : 'No checks completed today'}</p>
            </div>

            {/* Maintenance row */}
            <div className="border border-border rounded-xl p-4 space-y-2">
              <div className="flex items-center justify-between">
                <p className="text-sm font-semibold text-foreground">Maintenance</p>
                <span className="px-2.5 py-1 rounded-full text-[11px] font-bold bg-green-50 text-green-700 border border-green-200">OK</span>
              </div>
              <div className="grid grid-cols-2 gap-2 mt-1">
                <div className="bg-muted/40 border border-border rounded-xl p-2.5">
                  <p className="text-[11px] text-muted-foreground">Total Records</p>
                  <p className="text-sm font-semibold text-foreground">{rideStats.loading ? '—' : rideStats.maintenanceCount}</p>
                </div>
                <div className="bg-muted/40 border border-border rounded-xl p-2.5">
                  <p className="text-[11px] text-muted-foreground">YTD Cost</p>
                  <p className="text-sm font-semibold text-foreground">£{rideStats.maintenanceCostYTD.toFixed(0)}</p>
                </div>
              </div>
            </div>

            {/* Documents row */}
            <div className="border border-border rounded-xl p-4 space-y-2">
              <div className="flex items-center justify-between">
                <p className="text-sm font-semibold text-foreground">Documents</p>
                {rideStats.hasExpiredDocs ? (
                  <span className="px-2.5 py-1 rounded-full text-[11px] font-bold bg-destructive/10 text-destructive border border-destructive/20">EXPIRED</span>
                ) : rideStats.hasExpiringSoonDocs ? (
                  <span className="px-2.5 py-1 rounded-full text-[11px] font-bold bg-amber-50 text-amber-800 border border-amber-200">DUE SOON</span>
                ) : (
                  <span className="px-2.5 py-1 rounded-full text-[11px] font-bold bg-green-50 text-green-700 border border-green-200">OK</span>
                )}
              </div>
              <p className="text-xs text-muted-foreground">{rideStats.docCount} file{rideStats.docCount !== 1 ? 's' : ''} uploaded{rideStats.hasExpiredDocs ? ' — some have expired' : rideStats.hasExpiringSoonDocs ? ' — some expiring soon' : ', all current'}</p>
            </div>
          </div>

          {/* Asset Details */}
          <div className="bg-card rounded-2xl border border-border shadow-sm p-5">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-sm font-semibold text-foreground">Asset Details</h2>
              <button className="text-xs font-semibold text-primary" onClick={() => setIsEditing(true)}>Edit</button>
            </div>
            {/* Photo */}
            {photoUrl ? (
              <div className="relative rounded-xl overflow-hidden cursor-pointer flex items-center justify-center mb-3" style={{ backgroundColor: 'hsl(210 40% 98%)', border: '1px solid hsl(215 19% 90%)', minHeight: '120px' }} onClick={() => setPhotoViewerOpen(true)}>
                <img src={photoUrl} alt={ride.ride_name} className="h-32 w-auto max-w-full object-contain" />
                <div className="absolute bottom-2 right-2 text-[10px] px-2 py-0.5 rounded-full font-medium bg-white/80 text-muted-foreground">Tap to enlarge</div>
              </div>
            ) : (
              <div className="rounded-xl flex flex-col items-center justify-center gap-2 py-6 mb-3 cursor-pointer" style={{ backgroundColor: 'hsl(210 40% 98%)', border: '1px dashed hsl(215 19% 82%)' }} onClick={() => setIsEditing(true)}>
                <ImageIcon className="h-7 w-7 text-muted-foreground/40" strokeWidth={1.5} />
                <p className="text-xs text-muted-foreground">No photo — tap Edit to add</p>
              </div>
            )}
            <div className="grid grid-cols-2 gap-2.5">
              {[
                { label: 'Category', value: ride.ride_categories.name },
                { label: 'Manufacturer', value: ride.manufacturer || '—' },
                { label: 'Year', value: ride.year_manufactured?.toString() || '—' },
              ].map(({ label, value }) => (
                <div key={label} className="p-3 rounded-xl space-y-0.5 bg-muted/40 border border-border">
                  <span className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">{label}</span>
                  <p className="text-sm font-semibold truncate text-foreground">{value}</p>
                </div>
              ))}
              <div className="p-3 rounded-xl space-y-0.5" style={{ backgroundColor: ride.serial_number ? 'hsl(213 52% 24% / 0.04)' : 'hsl(38 92% 97%)', border: ride.serial_number ? '2px solid hsl(213 52% 24% / 0.3)' : '2px solid hsl(38 92% 70% / 0.6)' }}>
                <span className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Serial No.</span>
                <p className="text-sm font-bold truncate" style={{ color: ride.serial_number ? 'hsl(213 52% 24%)' : 'hsl(38 80% 40%)' }}>{ride.serial_number || 'Not set'}</p>
              </div>
            </div>
          </div>

        </TabsContent>

        <TabsContent value="documents" className="animate-fade-in">
          <RideDocuments ride={ride} />
        </TabsContent>

        <TabsContent value="checks" className="animate-fade-in">
          <FeatureGate feature="Safety Checks">
            <InspectionManager ride={ride} />
          </FeatureGate>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default RideDetail;
