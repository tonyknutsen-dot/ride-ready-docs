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

  // Grant advanced access to both 'advanced' plan users AND testers
  const isAdvanced = subscription?.subscriptionStatus === 'advanced' || subscription?.isTesterAccount;

  useEffect(() => {
    loadRideStatistics();
    loadRidePhoto();
  }, [ride.id, user]);

  const loadRideStatistics = async () => {
    if (!user) return;

    try {
      const { count: docCount } = await supabase
        .from('documents')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', user.id)
        .eq('ride_id', ride.id);

      const today = new Date().toISOString().split('T')[0];
      const { count: todayChecks } = await supabase
        .from('checks')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', user.id)
        .eq('ride_id', ride.id)
        .eq('check_date', today);

      const { count: maintenanceCount } = await supabase
        .from('maintenance_records')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', user.id)
        .eq('ride_id', ride.id);

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
    if (!user) return;

    try {
      // Get the device photo document
      const { data: photoDoc } = await supabase
        .from('documents')
        .select('file_path')
        .eq('user_id', user.id)
        .eq('ride_id', ride.id)
        .eq('document_type', 'photo')
        .eq('is_latest_version', true)
        .order('uploaded_at', { ascending: false })
        .limit(1)
        .maybeSingle();

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
            <div className="p-3 rounded-xl bg-gradient-to-br from-primary/5 to-primary/10 border border-primary/10 space-y-1">
              <span className="text-[10px] text-primary/70 uppercase tracking-wide font-semibold">Category</span>
              <p className="text-sm font-semibold text-foreground">{ride.ride_categories.name}</p>
            </div>
            <div className="p-3 rounded-xl bg-gradient-to-br from-accent/5 to-accent/10 border border-accent/10 space-y-1">
              <span className="text-[10px] text-accent/80 uppercase tracking-wide font-semibold">Manufacturer</span>
              <p className="text-sm font-semibold text-foreground truncate">{ride.manufacturer || '—'}</p>
            </div>
            <div className="p-3 rounded-xl bg-gradient-to-br from-info/5 to-info/10 border border-info/10 space-y-1">
              <span className="text-[10px] text-info/80 uppercase tracking-wide font-semibold">Year</span>
              <p className="text-sm font-semibold text-foreground">{ride.year_manufactured || '—'}</p>
            </div>
            <div className="p-3 rounded-xl bg-gradient-to-br from-success/5 to-success/10 border border-success/10 space-y-1">
              <span className="text-[10px] text-success/80 uppercase tracking-wide font-semibold">Serial</span>
              <p className="text-sm font-semibold text-foreground truncate">{ride.serial_number || '—'}</p>
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
            <FeatureGate
              requiredPlan="advanced" 
              feature="Inspections"
              fallback={
                <RestrictedFeatureCard
                  title="Safety Checks"
                  description="Perform daily, monthly & yearly checks"
                  icon={<CheckSquare className="h-5 w-5" />}
                  requiredPlan="advanced"
                />
              }
            >
              <Card 
                className="active:scale-[0.98] transition-all cursor-pointer border-2 border-success/50 bg-gradient-to-r from-success/10 via-success/15 to-success/20 hover:shadow-elegant"
                onClick={() => setActiveTab("checks")}
              >
                <CardContent className="p-5 flex items-center gap-4">
                  <div className="w-16 h-16 rounded-2xl bg-success/25 flex items-center justify-center shrink-0 shadow-sm">
                    <CheckSquare className="h-8 w-8 text-success" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-bold text-base text-success">Start Safety Check</p>
                    <p className="text-sm text-muted-foreground">Daily, monthly or yearly inspections</p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-2xl font-bold text-success">
                      {rideStats.loading ? '...' : rideStats.todayChecks}
                    </p>
                    <p className="text-[10px] text-muted-foreground uppercase font-semibold">Today</p>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={(e) => {
                      e.stopPropagation();
                      setShowChecksGuide(true);
                    }}
                    className="h-10 w-10 shrink-0 text-success/70 hover:text-success hover:bg-success/10"
                    aria-label="How checks work"
                  >
                    <HelpCircle className="h-5 w-5" />
                  </Button>
                </CardContent>
              </Card>
            </FeatureGate>

            {/* Documents Quick Action */}
            <Card 
              className="active:scale-[0.98] transition-all cursor-pointer border-primary/30 bg-gradient-to-r from-primary/5 to-primary/10 hover:shadow-elegant"
              onClick={() => setActiveTab("documents")}
            >
              <CardContent className="p-4 flex items-center gap-4">
                <div className="w-14 h-14 rounded-2xl bg-primary/15 flex items-center justify-center shrink-0 shadow-sm">
                  <FileText className="h-7 w-7 text-primary" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-sm text-foreground">Documents</p>
                  <p className="text-xs text-muted-foreground">Upload and manage files</p>
                </div>
                <div className="text-right shrink-0">
                  <p className="text-2xl font-bold text-primary">
                    {rideStats.loading ? '...' : rideStats.docCount}
                  </p>
                  <p className="text-[10px] text-muted-foreground uppercase font-semibold">Files</p>
                </div>
              </CardContent>
            </Card>

            {/* Maintenance Quick Action - Navigate to dedicated Maintenance page */}
            <FeatureGate 
              requiredPlan="advanced" 
              feature="Maintenance Logging"
              fallback={
                <RestrictedFeatureCard
                  title="Maintenance"
                  description="Log maintenance activities"
                  icon={<Wrench className="h-5 w-5" />}
                  requiredPlan="advanced"
                />
              }
            >
              <Card 
                className="active:scale-[0.98] transition-all cursor-pointer border-accent/30 bg-gradient-to-r from-accent/5 to-accent/10 hover:shadow-elegant"
                onClick={() => navigate(`/maintenance?rideId=${ride.id}`)}
              >
                <CardContent className="p-4 flex items-center gap-4">
                  <div className="w-14 h-14 rounded-2xl bg-accent/20 flex items-center justify-center shrink-0 shadow-sm">
                    <Wrench className="h-7 w-7 text-accent" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-sm text-foreground">Maintenance</p>
                    <p className="text-xs text-muted-foreground">Log repairs and service</p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-2xl font-bold text-accent">
                      {rideStats.loading ? '...' : rideStats.maintenanceCount}
                    </p>
                    <p className="text-[10px] text-muted-foreground uppercase font-semibold">Records</p>
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
          <FeatureGate requiredPlan="advanced" feature="Safety Checks">
            <InspectionManager ride={ride} />
          </FeatureGate>
        </TabsContent>

      </Tabs>
    </div>
  );
};

export default RideDetail;
