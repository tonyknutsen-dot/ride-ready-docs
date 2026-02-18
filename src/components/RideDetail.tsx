import { useState, useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  ArrowLeft, FileText, CheckSquare, Mail, Wrench, Pencil, ImageIcon, Trash2, HelpCircle,
  ShieldCheck, ShieldAlert, Clock, ChevronRight
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
import SafetyCertificateCard from './SafetyCertificateCard';
import ImageViewer from './ImageViewer';
import { DeleteRideDialog } from './DeleteRideDialog';
import { ChecksOnboardingModal } from './ChecksOnboardingModal';

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
        .from('maintenance_records').select('*', { count: 'exact', head: true })
        .eq('ride_id', ride.id);
      if (!isStaff) maintenanceQuery = maintenanceQuery.eq('user_id', effectiveUserId);
      const { count: maintenanceCount } = await maintenanceQuery;

      setRideStats({ docCount: docCount || 0, todayChecks: todayChecks || 0, maintenanceCount: maintenanceCount || 0, hasExpiredDocs, hasExpiringSoonDocs, loading: false });
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

      {/* Asset Hero Card */}
      <div className="bg-white border border-border rounded-2xl overflow-hidden" style={{ boxShadow: '0 4px 12px rgba(0,0,0,0.06)' }}>
        {/* Photo */}
        <div className="px-4 pt-4">
          {photoUrl ? (
            <div
              className="relative rounded-xl overflow-hidden cursor-pointer flex items-center justify-center"
              style={{ backgroundColor: 'hsl(210 40% 98%)', border: '1px solid hsl(215 19% 90%)', minHeight: '140px' }}
              onClick={() => setPhotoViewerOpen(true)}
            >
              <img src={photoUrl} alt={ride.ride_name} className="h-40 w-auto max-w-full object-contain" />
              <div className="absolute bottom-2 right-2 text-[10px] px-2 py-0.5 rounded-full font-medium" style={{ backgroundColor: 'hsl(217 91% 97%)', color: 'hsl(213 52% 24%)' }}>
                Tap to enlarge
              </div>
            </div>
          ) : (
            <div className="rounded-xl flex flex-col items-center justify-center gap-2 py-8" style={{ backgroundColor: 'hsl(210 40% 98%)', border: '1px dashed hsl(215 19% 82%)' }}>
              <ImageIcon className="h-8 w-8" style={{ color: 'hsl(215 19% 70%)' }} strokeWidth={1.5} />
              <p className="text-xs" style={{ color: 'hsl(215 19% 55%)' }}>No photo — edit to add</p>
            </div>
          )}
        </div>

        {/* Compliance Status Bar */}
        {complianceStatus && (() => {
          const cfg = complianceConfig[complianceStatus];
          return (
            <div className="mx-4 mt-3 rounded-xl px-3 py-2.5 flex items-center gap-2.5" style={{ backgroundColor: cfg.bg, border: `1px solid ${cfg.border}` }}>
              <cfg.Icon className="h-4 w-4 shrink-0" style={{ color: cfg.text }} strokeWidth={2} />
              <span className="text-xs font-bold" style={{ color: cfg.text }}>{cfg.label}</span>
              <span className="text-xs" style={{ color: cfg.text, opacity: 0.7 }}>· {cfg.sub}</span>
            </div>
          );
        })()}

        {/* Metadata Grid */}
        <div className="p-4 grid grid-cols-2 gap-2.5">
          {[
            { label: 'Category', value: ride.ride_categories.name },
            { label: 'Manufacturer', value: ride.manufacturer || '—' },
            { label: 'Year', value: ride.year_manufactured?.toString() || '—' },
          ].map(({ label, value }) => (
            <div key={label} className="p-3 rounded-xl space-y-1" style={{ backgroundColor: 'hsl(210 40% 98%)', border: '1px solid hsl(215 19% 90%)' }}>
              <span className="text-[11px] font-medium uppercase tracking-wide" style={{ color: 'hsl(215 19% 55%)' }}>{label}</span>
              <p className="text-sm font-semibold truncate" style={{ color: 'hsl(222 84% 5%)' }}>{value}</p>
            </div>
          ))}
          {/* Serial — compliance-critical */}
          <div className="p-3 rounded-xl space-y-1" style={{ 
            backgroundColor: ride.serial_number ? 'hsl(213 52% 24% / 0.04)' : 'hsl(38 92% 97%)',
            border: ride.serial_number ? '2px solid hsl(213 52% 24% / 0.3)' : '2px solid hsl(38 92% 70% / 0.6)'
          }}>
            <span className="text-[11px] font-medium uppercase tracking-wide" style={{ color: 'hsl(215 19% 55%)' }}>Serial No.</span>
            <p className="text-sm font-bold truncate" style={{ color: ride.serial_number ? 'hsl(213 52% 24%)' : 'hsl(38 80% 40%)' }}>
              {ride.serial_number || 'Not set'}
            </p>
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

        <TabsContent value="overview" className="space-y-3 animate-fade-in">
          {/* Safety Certificate */}
          <SafetyCertificateCard ride={ride} onUploadClick={() => setActiveTab("documents")} />

          {/* Checks — Primary (navy border, heavier shadow) */}
          <FeatureGate feature="Inspections">
            <button className="w-full text-left active:scale-[0.98] transition-all" onClick={() => setActiveTab("checks")}>
              <div className="bg-white border-2 rounded-2xl overflow-hidden" style={{ borderColor: 'hsl(213 52% 24%)', boxShadow: '0 4px 14px rgba(30,58,95,0.12)' }}>
                <div className="px-5 py-4 flex items-center gap-4">
                  <div className="w-14 h-14 rounded-xl flex items-center justify-center shrink-0" style={{ backgroundColor: 'hsl(217 91% 97%)' }}>
                    <CheckSquare className="h-7 w-7" style={{ color: 'hsl(213 52% 24%)' }} strokeWidth={2} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-bold text-base" style={{ color: 'hsl(222 84% 5%)' }}>Safety Checks</p>
                    <p className="text-xs mt-0.5" style={{ color: 'hsl(215 19% 50%)' }}>Pre-opening, daily, weekly, monthly &amp; yearly</p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-3xl font-bold" style={{ color: 'hsl(213 52% 24%)' }}>
                      {rideStats.loading ? '·' : rideStats.todayChecks}
                    </p>
                    <p className="text-[10px] uppercase font-semibold tracking-wide" style={{ color: 'hsl(215 19% 55%)' }}>Today</p>
                  </div>
                </div>
                <div className="px-5 py-2.5 border-t flex items-center justify-between" style={{ borderColor: 'hsl(213 52% 24% / 0.15)', backgroundColor: 'hsl(217 91% 97%)' }}>
                  <Button
                    variant="ghost" size="sm"
                    onClick={(e) => { e.stopPropagation(); setShowChecksGuide(true); }}
                    className="h-7 text-xs gap-1 px-2 text-muted-foreground hover:text-primary"
                  >
                    <HelpCircle className="h-3.5 w-3.5" strokeWidth={2} />
                    How it works
                  </Button>
                  <span className="text-xs font-bold flex items-center gap-1" style={{ color: 'hsl(213 52% 24%)' }}>
                    Start Check <ChevronRight className="h-3.5 w-3.5" />
                  </span>
                </div>
              </div>
            </button>
          </FeatureGate>

          {/* Documents — Secondary */}
          <button className="w-full text-left active:scale-[0.98] transition-all" onClick={() => setActiveTab("documents")}>
            <div className="bg-white border border-border rounded-2xl px-5 py-4 flex items-center gap-4 hover:border-primary/40 transition-colors" style={{ boxShadow: '0 2px 6px rgba(0,0,0,0.04)' }}>
              <div className="w-11 h-11 rounded-xl flex items-center justify-center shrink-0" style={{ backgroundColor: 'hsl(210 40% 97%)', border: '1px solid hsl(215 19% 90%)' }}>
                <FileText className="h-5 w-5 text-muted-foreground" strokeWidth={2} />
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-sm" style={{ color: 'hsl(222 84% 5%)' }}>Documents</p>
                <p className="text-xs text-muted-foreground">Upload and manage files</p>
              </div>
              <div className="text-right shrink-0 flex items-center gap-2">
                <div>
                  <p className="text-2xl font-bold" style={{ color: 'hsl(222 84% 5%)' }}>{rideStats.loading ? '·' : rideStats.docCount}</p>
                  <p className="text-[10px] uppercase font-medium text-muted-foreground">Files</p>
                </div>
                <ChevronRight className="h-4 w-4 text-muted-foreground" />
              </div>
            </div>
          </button>

          {/* Maintenance — Tertiary */}
          <FeatureGate feature="Maintenance Logging">
            <button className="w-full text-left active:scale-[0.98] transition-all" onClick={() => navigate(`/maintenance?rideId=${ride.id}`)}>
              <div className="bg-white border border-border rounded-2xl px-5 py-4 flex items-center gap-4 hover:border-primary/40 transition-colors" style={{ boxShadow: '0 2px 6px rgba(0,0,0,0.04)' }}>
                <div className="w-11 h-11 rounded-xl flex items-center justify-center shrink-0" style={{ backgroundColor: 'hsl(210 40% 97%)', border: '1px solid hsl(215 19% 90%)' }}>
                  <Wrench className="h-5 w-5 text-muted-foreground" strokeWidth={2} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-sm" style={{ color: 'hsl(222 84% 5%)' }}>Maintenance</p>
                  <p className="text-xs text-muted-foreground">Log repairs and service</p>
                </div>
                <div className="text-right shrink-0 flex items-center gap-2">
                  <div>
                    <p className="text-2xl font-bold" style={{ color: 'hsl(222 84% 5%)' }}>{rideStats.loading ? '·' : rideStats.maintenanceCount}</p>
                    <p className="text-[10px] uppercase font-medium text-muted-foreground">Records</p>
                  </div>
                  <ChevronRight className="h-4 w-4 text-muted-foreground" />
                </div>
              </div>
            </button>
          </FeatureGate>
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
