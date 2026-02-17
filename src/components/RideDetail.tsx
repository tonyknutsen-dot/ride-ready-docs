import { useState, useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ArrowLeft, FileText, CheckSquare, Upload, Settings, Mail, Wrench, Pencil, ImageIcon, Trash2, HelpCircle } from 'lucide-react';
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
import { RestrictedFeatureCard } from './RestrictedFeatureCard';
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
  
  // Sync tab state with URL for proper back/forward navigation
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
    loading: true
  });
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);
  const [photoViewerOpen, setPhotoViewerOpen] = useState(false);

  // All paying users and testers have full access
  const isActiveUser = subscription?.subscriptionStatus === 'active' || subscription?.isTesterAccount;

  useEffect(() => {
    loadRideStatistics();
    loadRidePhoto();
  }, [ride.id, user]);

  const loadRideStatistics = async () => {
    if (!effectiveUserId) return;

    try {
      // Count ride-specific documents only (exclude maintenance and photo docs for display)
      // For staff, don't filter by user_id - RLS handles access
      let docQuery = supabase
        .from('documents')
        .select('*', { count: 'exact', head: true })
        .eq('ride_id', ride.id)
        .neq('document_type', 'maintenance')
        .neq('document_type', 'photo');
      if (!isStaff) docQuery = docQuery.eq('user_id', effectiveUserId);
      const { count: docCount } = await docQuery;

      const today = new Date().toISOString().split('T')[0];
      let checksQuery = supabase
        .from('checks')
        .select('*', { count: 'exact', head: true })
        .eq('ride_id', ride.id)
        .eq('check_date', today);
      if (!isStaff) checksQuery = checksQuery.eq('user_id', effectiveUserId);
      const { count: todayChecks } = await checksQuery;

      let maintenanceQuery = supabase
        .from('maintenance_records')
        .select('*', { count: 'exact', head: true })
        .eq('ride_id', ride.id);
      if (!isStaff) maintenanceQuery = maintenanceQuery.eq('user_id', effectiveUserId);
      const { count: maintenanceCount } = await maintenanceQuery;

      setRideStats({
        docCount: docCount || 0,
        todayChecks: todayChecks || 0,
        maintenanceCount: maintenanceCount || 0,
        loading: false
      });
    } catch (error) {
      console.error('Error loading ride statistics:', error);
      setRideStats(prev => ({ ...prev, loading: false }));
    }
  };

  const loadRidePhoto = async () => {
    if (!effectiveUserId) return;

    try {
      // Get the device photo document
      // For staff, RLS handles access; for owners, filter by user_id
      let photoQuery = supabase
        .from('documents')
        .select('file_path')
        .eq('ride_id', ride.id)
        .eq('document_type', 'photo')
        .eq('is_latest_version', true)
        .order('uploaded_at', { ascending: false })
        .limit(1);
      if (!isStaff) photoQuery = photoQuery.eq('user_id', effectiveUserId);
      const { data: photoDoc } = await photoQuery.maybeSingle();

      if (photoDoc?.file_path) {
        // Bucket is private, so use signed URL
        const { data, error } = await supabase.storage
          .from('ride-documents')
          .createSignedUrl(photoDoc.file_path, 3600); // 1 hour expiry
        
        if (data?.signedUrl && !error) {
          setPhotoUrl(data.signedUrl);
        }
      }
    } catch (error) {
      console.error('Error loading ride photo:', error);
    }
  };

  const handleEditSuccess = () => {
    setIsEditing(false);
    onUpdate();
    loadRidePhoto(); // Refresh photo after edit
  };

  if (isEditing) {
    return (
      <div className="space-y-4">
        <RideForm 
          ride={ride} 
          onSuccess={handleEditSuccess} 
          onCancel={() => setIsEditing(false)} 
        />
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <ChecksOnboardingModal forceOpen={showChecksGuide} onClose={() => setShowChecksGuide(false)} />
      {/* Sticky Header */}
      <div className="sticky top-0 z-10 -mx-4 px-4 py-3 bg-background/95 backdrop-blur-sm border-b border-border/50">
        <div className="flex items-center justify-between gap-3">
          <Button 
            variant="ghost" 
            size="icon" 
            onClick={onBack} 
            className="h-10 w-10 shrink-0 active:scale-95 transition-transform"
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>
          
          <div className="flex-1 min-w-0 text-center">
            <h1 className="text-base font-semibold truncate">{ride.ride_name}</h1>
            <Badge variant="outline" className="text-[10px] px-1.5 py-0 mt-0.5">
              {ride.ride_categories.name}
            </Badge>
          </div>
          
          <div className="flex gap-1.5">
            <Button 
              variant="ghost" 
              size="icon"
              onClick={() => setIsEditing(true)} 
              className="h-10 w-10 shrink-0 active:scale-95 transition-transform"
            >
              <Pencil className="h-4 w-4" />
            </Button>
            <SendDocumentsDialog 
              ride={ride}
              trigger={
                <Button 
                  variant="ghost"
                  size="icon"
                  className="h-10 w-10 shrink-0 active:scale-95 transition-transform"
                >
                  <Mail className="h-4 w-4" />
                </Button>
              }
            />
            <DeleteRideDialog
              ride={ride}
              onDeleted={onBack}
              trigger={
                <Button 
                  variant="ghost"
                  size="icon"
                  className="h-10 w-10 shrink-0 active:scale-95 transition-transform text-destructive hover:text-destructive hover:bg-destructive/10"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              }
            />
          </div>
        </div>
      </div>

      {/* Equipment Photo & Details */}
      <Card className="overflow-hidden border-border">
        <CardContent className="p-4 space-y-4">
          {/* Photo Section - Centered with border */}
          {photoUrl ? (
            <div 
              className="flex justify-center cursor-pointer"
              onClick={() => setPhotoViewerOpen(true)}
            >
              <div className="relative rounded-xl overflow-hidden border-2 border-primary/20 bg-gradient-to-br from-primary/5 to-accent/5 shadow-sm">
                <img 
                  src={photoUrl} 
                  alt={ride.ride_name}
                  className="h-40 w-auto max-w-full object-contain"
                />
                <div className="absolute inset-0 bg-black/0 hover:bg-black/10 transition-colors flex items-center justify-center opacity-0 hover:opacity-100">
                  <span className="text-xs text-white bg-black/50 px-2 py-1 rounded">Tap to enlarge</span>
                </div>
              </div>
            </div>
          ) : (
            <div className="flex justify-center">
              <div className="w-32 h-32 rounded-xl border-2 border-dashed border-primary/30 bg-gradient-to-br from-primary/5 to-accent/5 flex flex-col items-center justify-center gap-2">
                <ImageIcon className="h-8 w-8 text-primary/40" />
                <p className="text-xs text-muted-foreground text-center px-2">No photo</p>
              </div>
            </div>
          )}
          
          {/* Details Grid */}
          <div className="grid grid-cols-2 gap-3">
            <div className="p-3 rounded-xl bg-white border border-[#E2E8F0] space-y-1">
              <span className="text-xs text-[#475569] font-medium">Category</span>
              <p className="text-sm font-semibold text-[#0F172A]">{ride.ride_categories.name}</p>
            </div>
            <div className="p-3 rounded-xl bg-white border border-[#E2E8F0] space-y-1">
              <span className="text-xs text-[#475569] font-medium">Manufacturer</span>
              <p className="text-sm font-semibold text-[#0F172A] truncate">{ride.manufacturer || '—'}</p>
            </div>
            <div className="p-3 rounded-xl bg-white border border-[#E2E8F0] space-y-1">
              <span className="text-xs text-[#475569] font-medium">Year</span>
              <p className="text-sm font-semibold text-[#0F172A]">{ride.year_manufactured || '—'}</p>
            </div>
            <div className={`p-3 rounded-xl bg-white border space-y-1 ${!ride.serial_number ? 'border-[#F59E0B]' : 'border-[#E2E8F0]'}`}>
              <span className="text-xs text-[#475569] font-medium">Serial</span>
              <p className="text-sm font-semibold text-[#0F172A] truncate">{ride.serial_number || '—'}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Photo Viewer */}
      {photoUrl && (
        <ImageViewer
          isOpen={photoViewerOpen}
          onClose={() => setPhotoViewerOpen(false)}
          imageUrl={photoUrl}
          imageName={ride.ride_name}
          onDownload={() => window.open(photoUrl, '_blank')}
        />
      )}

      {/* Main Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-5">
        <TabsList className="grid w-full h-auto p-1.5 gap-1.5 bg-secondary border border-border grid-cols-3">
          <TabsTrigger 
            value="overview" 
            className="flex flex-col items-center justify-center gap-1 py-3 px-2 text-xs font-semibold data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-md rounded-lg min-h-[60px] transition-all"
          >
            <FileText className="h-5 w-5" />
            <span>Home</span>
          </TabsTrigger>
          <TabsTrigger 
            value="checks" 
            className="flex flex-col items-center justify-center gap-1 py-3 px-2 text-xs font-semibold data-[state=active]:bg-success data-[state=active]:text-success-foreground data-[state=active]:shadow-md rounded-lg min-h-[60px] transition-all"
          >
            <CheckSquare className="h-5 w-5" />
            <span>Checks</span>
          </TabsTrigger>
          <TabsTrigger 
            value="documents" 
            className="flex flex-col items-center justify-center gap-1 py-3 px-2 text-xs font-semibold data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-md rounded-lg min-h-[60px] transition-all"
          >
            <FileText className="h-5 w-5" />
            <span>Docs</span>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-4 animate-fade-in">
          {/* Safety Certificate - Prominent Position */}
          <SafetyCertificateCard 
            ride={ride} 
            onUploadClick={() => setActiveTab("documents")} 
          />

          <div className="grid grid-cols-1 gap-3">
            {/* CHECKS - Main Priority Action */}
            <FeatureGate feature="Inspections">
              <Card 
                className="active:scale-[0.98] transition-all cursor-pointer border border-[#E2E8F0] bg-white hover:border-[#1E3A5F] hover:shadow-card"
                onClick={() => setActiveTab("checks")}
              >
                <CardContent className="p-5 flex items-center gap-4">
                  <div className="w-14 h-14 rounded-xl bg-[#F8FAFC] border border-[#E2E8F0] flex items-center justify-center shrink-0">
                    <CheckSquare className="h-7 w-7 text-[#475569]" strokeWidth={2} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-base text-[#0F172A]">Start Safety Check</p>
                    <p className="text-sm text-[#475569]">Pre-opening, daily, weekly, monthly & yearly</p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-2xl font-semibold text-[#0F172A]">
                      {rideStats.loading ? '...' : rideStats.todayChecks}
                    </p>
                    <p className="text-[10px] text-[#475569] uppercase font-medium">Today</p>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={(e) => {
                      e.stopPropagation();
                      setShowChecksGuide(true);
                    }}
                    className="h-10 w-10 shrink-0 text-[#475569] hover:text-primary hover:bg-primary/10"
                    aria-label="How checks work"
                  >
                    <HelpCircle className="h-5 w-5" strokeWidth={2} />
                  </Button>
                </CardContent>
              </Card>
            </FeatureGate>

            {/* Documents Quick Action */}
            <Card 
              className="active:scale-[0.98] transition-all cursor-pointer border border-[#E2E8F0] bg-white hover:border-[#1E3A5F] hover:shadow-card"
              onClick={() => setActiveTab("documents")}
            >
              <CardContent className="p-4 flex items-center gap-4">
                <div className="w-12 h-12 rounded-xl bg-[#F8FAFC] border border-[#E2E8F0] flex items-center justify-center shrink-0">
                  <FileText className="h-6 w-6 text-[#475569]" strokeWidth={2} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-sm text-[#0F172A]">Documents</p>
                  <p className="text-xs text-[#475569]">Upload and manage files</p>
                </div>
                <div className="text-right shrink-0">
                  <p className="text-2xl font-semibold text-[#0F172A]">
                    {rideStats.loading ? '...' : rideStats.docCount}
                  </p>
                  <p className="text-[10px] text-[#475569] uppercase font-medium">Files</p>
                </div>
              </CardContent>
            </Card>

            {/* Maintenance Quick Action */}
            <FeatureGate feature="Maintenance Logging">
              <Card 
                className="active:scale-[0.98] transition-all cursor-pointer border border-[#E2E8F0] bg-white hover:border-[#1E3A5F] hover:shadow-card"
                onClick={() => navigate(`/maintenance?rideId=${ride.id}`)}
              >
                <CardContent className="p-4 flex items-center gap-4">
                  <div className="w-12 h-12 rounded-xl bg-[#F8FAFC] border border-[#E2E8F0] flex items-center justify-center shrink-0">
                    <Wrench className="h-6 w-6 text-[#475569]" strokeWidth={2} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-sm text-[#0F172A]">Maintenance</p>
                    <p className="text-xs text-[#475569]">Log repairs and service</p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-2xl font-semibold text-[#0F172A]">
                      {rideStats.loading ? '...' : rideStats.maintenanceCount}
                    </p>
                    <p className="text-[10px] text-[#475569] uppercase font-medium">Records</p>
                  </div>
                </CardContent>
              </Card>
            </FeatureGate>
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
