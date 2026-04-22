import { useEffect, useState } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useStaff } from '@/contexts/StaffContext';
import { useEffectiveUserId } from '@/hooks/useEffectiveUserId';
import { useOnlineStatus } from '@/hooks/useOnlineStatus';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Settings, WifiOff } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { Tables } from '@/integrations/supabase/types';
import { setCache, getCache } from '@/lib/offlineCache';
import RideDetail from '@/components/RideDetail';
import PageBreadcrumb from '@/components/PageBreadcrumb';
import StaffAccountBanner from '@/components/StaffAccountBanner';
import { OfflineDataPlaceholder } from '@/components/OfflineDataPlaceholder';

type Ride = Tables<'rides'> & {
  ride_categories: {
    name: string;
    description: string | null;
    category_group: string;
  };
};

const RideDetailPage = () => {
  const { id } = useParams<{ id: string }>();
  const [searchParams] = useSearchParams();
  const initialTab = searchParams.get('tab') || 'overview';
  const fromParam = searchParams.get('from');
  // Origin-aware back: arrived via side-nav /checks launcher → return to /checks.
  const backTarget = fromParam === 'checks' ? '/checks' : '/rides';
  const navigate = useNavigate();
  const { user } = useAuth();
  const { isStaff } = useStaff();
  const { effectiveUserId } = useEffectiveUserId();
  const { isOnline } = useOnlineStatus();
  const [ride, setRide] = useState<Ride | null>(null);
  const [loading, setLoading] = useState(true);
  const [isOfflineData, setIsOfflineData] = useState(false);

  useEffect(() => {
    if (effectiveUserId && id) {
      loadRide();
    }
  }, [effectiveUserId, id]);

  const loadRide = async () => {
    try {
      let query = supabase
        .from('rides')
        .select(`
          *,
          ride_categories (
            name,
            description,
            category_group
          )
        `)
        .eq('id', id);
      
      if (!isStaff) {
        query = query.eq('user_id', effectiveUserId);
      }
      
      const { data, error } = await query.single();

      if (error) throw error;
      setRide(data as Ride);
      setIsOfflineData(false);
      // Cache individual ride for offline access
      setCache(`ride:${id}`, data).catch(console.error);
    } catch (error) {
      console.error('Error loading ride:', error);
      // Try offline cache fallback
      const cached = await getCache<Ride>(`ride:${id}`);
      if (cached) {
        setRide(cached.data);
        setIsOfflineData(true);
      } else if (!navigator.onLine) {
        // Offline with no cache — don't navigate away, show placeholder
        setRide(null);
      } else {
        navigate('/rides');
      }
    } finally {
      setLoading(false);
    }
  };

  // Build breadcrumb based on current tab
  const getBreadcrumbItems = () => {
    const items = [
      { label: 'Equipment', href: '/rides' },
      { label: ride?.ride_name || 'Loading...' }
    ];
    
    if (initialTab && initialTab !== 'overview' && ride) {
    const tabLabels: Record<string, string> = {
        documents: 'Documents',
        checks: 'Checks',
        inspections: 'Checks',
        activity: 'Activity',
        windlog: 'Wind Log',
        pressure: 'Pressure',
      };
      
      if (tabLabels[initialTab]) {
        items[1] = { label: ride.ride_name, href: `/rides/${id}` };
        items.push({ label: tabLabels[initialTab] });
      }
    }
    
    return items;
  };

  if (loading) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="flex items-center justify-center py-12">
          <div className="text-center space-y-4">
            <Settings className="mx-auto h-10 w-10 text-primary animate-spin" />
            <p className="text-sm text-muted-foreground">Loading equipment details...</p>
          </div>
        </div>
      </div>
    );
  }

  if (!ride) {
    // If offline and no cache, show a clear message
    if (!navigator.onLine) {
      return (
        <div className="container mx-auto px-4 py-8">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => navigate(backTarget)}
            className="h-9 w-9 -ml-2 mb-4 text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <OfflineDataPlaceholder message="This ride hasn't been cached yet. Open it once while online to access it offline." />
        </div>
      );
    }
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="text-center space-y-4">
          <p className="text-muted-foreground">Equipment not found</p>
          <Button onClick={() => navigate(backTarget)} className="h-11">
            <ArrowLeft className="h-4 w-4 mr-2" />
            {backTarget === '/checks' ? 'Checks' : 'Equipment'}
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-5 pb-28 md:pb-8">
      <StaffAccountBanner />
      {!isOnline && (
        <div className="flex items-center gap-2 px-3 py-2 mb-3 rounded-lg bg-warning/10 border border-warning/20 text-warning text-xs">
          <WifiOff className="h-3.5 w-3.5 shrink-0" />
          <span>
            {isOfflineData
              ? 'Showing cached data. Some sections may be missing until you reconnect.'
              : 'Limited offline data. Some sections may be missing until you reconnect.'}
          </span>
        </div>
      )}
      <PageBreadcrumb items={getBreadcrumbItems()} showHome className="text-[11px] opacity-60" />
      <RideDetail 
        ride={ride}
        onBack={() => navigate(backTarget)}
        onUpdate={loadRide}
        initialTab={initialTab}
      />
    </div>
  );
};

export default RideDetailPage;
