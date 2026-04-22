import { useState, useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { CheckSquare, HelpCircle } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useStaff } from '@/contexts/StaffContext';
import { useEffectiveUserId } from '@/hooks/useEffectiveUserId';
import PageHeader from '@/components/PageHeader';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import StaffAccountBanner from '@/components/StaffAccountBanner';
import ChecksHistory from '@/components/ChecksHistory';
import { Tables } from '@/integrations/supabase/types';

type Ride = Tables<'rides'> & {
  ride_categories: {
    name: string;
    description: string | null;
    category_group: string;
  };
};

const ChecksRegister = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { isStaff } = useStaff();
  const { effectiveUserId } = useEffectiveUserId();
  const [searchParams] = useSearchParams();
  const rideId = searchParams.get('rideId');

  const [ride, setRide] = useState<Ride | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadRide = async () => {
      if (!rideId || !user || !effectiveUserId) {
        setLoading(false);
        return;
      }

      try {
        let query = supabase
          .from('rides')
          .select('*, ride_categories(name, description, category_group)')
          .eq('id', rideId);

        if (!isStaff) {
          query = query.eq('user_id', effectiveUserId);
        }

        const { data, error } = await query.single();
        if (error) throw error;
        setRide(data as Ride);
      } catch (error) {
        console.error('Error loading ride:', error);
        navigate('/checks');
      } finally {
        setLoading(false);
      }
    };

    loadRide();
  }, [rideId, user?.id, isStaff, effectiveUserId]);

  if (loading) {
    return (
      <div className="space-y-3 px-4 md:px-0 pb-[calc(env(safe-area-inset-bottom)+5.5rem)] md:pb-8">
        <Skeleton className="h-12 w-64" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (!ride || !rideId) {
    navigate('/checks');
    return null;
  }

  return (
    <div className="space-y-3 px-4 md:px-0 pb-[calc(env(safe-area-inset-bottom)+5.5rem)] md:pb-8">
      <StaffAccountBanner />

      <PageHeader
        icon={<CheckSquare className="h-5 w-5 text-primary" />}
        iconBgClass="from-primary/20 to-primary/10"
        title={ride.ride_name}
        subtitle="Check Records"
        showBackButton
        backTo="/checks"
      />

      <ChecksHistory rideId={rideId} rideName={ride.ride_name} onStartCheck={() => navigate(`/checks/${rideId}/daily/execute?from=checks`)} />
    </div>
  );
};

export default ChecksRegister;
