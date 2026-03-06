import { useState, useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { CheckSquare, HelpCircle, Wrench } from 'lucide-react';
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
      <div className="min-h-screen bg-background pb-28 md:pb-8">
        <header className="sticky top-0 z-40 bg-card/95 backdrop-blur-sm border-b border-border">
          <div className="container mx-auto px-4 py-3 sm:py-4">
            <Skeleton className="h-12 w-64" />
          </div>
        </header>
        <main className="container mx-auto px-4 py-5">
          <Skeleton className="h-64 w-full" />
        </main>
      </div>
    );
  }

  if (!ride || !rideId) {
    navigate('/checks');
    return null;
  }

  return (
    <div className="min-h-screen bg-background pb-28 md:pb-8">
      <StaffAccountBanner />

      {/* ── PAGE HEADER ──────────────────────────── */}
      <header className="sticky top-0 z-40 bg-card/95 backdrop-blur-sm border-b border-border">
        <div className="container mx-auto px-4 py-3 sm:py-4">
          <PageHeader
            icon={<CheckSquare className="h-5 w-5 text-primary" />}
            iconBgClass="from-primary/20 to-primary/10"
            title={ride.ride_name}
            subtitle="Check Records"
            showBackButton
            backTo="/checks"
          />
        </div>
      </header>

      <main className="container mx-auto px-4 py-5">
        <ChecksHistory rideId={rideId} rideName={ride.ride_name} />
      </main>
    </div>
  );
};

export default ChecksRegister;
