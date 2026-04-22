import { useEffect, useState } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { AlertTriangle, CheckCircle2, CheckSquare } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { Tables } from '@/integrations/supabase/types';
import { useEffectiveUserId } from '@/hooks/useEffectiveUserId';
import { useStaff } from '@/contexts/StaffContext';
import InspectionChecklist from '@/components/InspectionChecklist';
import StaffAccountBanner from '@/components/StaffAccountBanner';
import PageHeader from '@/components/PageHeader';

type Ride = Tables<'rides'> & {
  ride_categories: {
    name: string;
    description: string | null;
    category_group: string;
  };
};

const FREQUENCY_LABELS: Record<string, string> = {
  preopening: 'Pre-Opening Check',
  daily: 'Daily / Pre-Opening Check',
  weekly: 'Weekly Check',
  monthly: 'Monthly Check',
  yearly: 'Yearly Check',
};

const ChecklistExecutionPage = () => {
  const { rideId, frequency } = useParams<{ rideId: string; frequency: string }>();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { effectiveUserId } = useEffectiveUserId();
  const { isStaff } = useStaff();
  const [ride, setRide] = useState<Ride | null>(null);
  const [loading, setLoading] = useState(true);

  // Origin-aware back target: 'equipment' → Equipment hub, anything else → side /checks flow
  const fromParam = searchParams.get('from');
  const isFromEquipment = fromParam === 'equipment';
  const backTo = isFromEquipment
    ? `/rides/${rideId}?tab=checks`
    : `/checks/register?rideId=${rideId}`;

  useEffect(() => {
    if (effectiveUserId && rideId) {
      loadRide();
    }
  }, [effectiveUserId, rideId, frequency]);

  const loadRide = async () => {
    try {
      let query = supabase
        .from('rides')
        .select(`*, ride_categories (name, description, category_group)`)
        .eq('id', rideId!);

      if (!isStaff) {
        query = query.eq('user_id', effectiveUserId);
      }

      const { data, error } = await query.single();
      if (error) throw error;
      setRide(data as Ride);
    } catch (err) {
      console.error('Error loading ride:', err);
      navigate(backTo);
    } finally {
      setLoading(false);
    }
  };

  const freqLabel = FREQUENCY_LABELS[frequency ?? ''] ?? `${frequency ?? ''} Check`;

  if (loading) {
    return (
      <div className="space-y-3 px-4 md:px-0 pb-[calc(env(safe-area-inset-bottom)+5.5rem)] md:pb-8">
        <div className="min-h-[40vh] flex items-center justify-center">
          <div className="text-center space-y-3">
            <CheckCircle2 className="mx-auto h-10 w-10 text-primary animate-pulse" />
            <p className="text-sm text-muted-foreground">Loading checklist…</p>
          </div>
        </div>
      </div>
    );
  }

  if (!ride) {
    return (
      <div className="space-y-3 px-4 md:px-0 pb-[calc(env(safe-area-inset-bottom)+5.5rem)] md:pb-8">
        <div className="min-h-[40vh] flex items-center justify-center text-center">
          <div className="space-y-4">
            <AlertTriangle className="mx-auto h-10 w-10 text-destructive" />
            <p className="text-muted-foreground">Equipment not found.</p>
            <button
              onClick={() => navigate('/checks')}
              className="text-primary text-sm font-semibold"
            >
              Back to Checks
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3 px-4 md:px-0 pb-[calc(env(safe-area-inset-bottom)+5.5rem)] md:pb-8">
      <StaffAccountBanner />

      <PageHeader
        icon={<CheckSquare className="h-5 w-5 text-primary" />}
        iconBgClass="from-primary/20 to-primary/10"
        title={ride.ride_name}
        subtitle={freqLabel}
        showBackButton
        backTo={`/checks/register?rideId=${rideId}`}
      />

      <InspectionChecklist
        ride={ride}
        frequency={frequency ?? 'daily'}
        onChecklistSaved={() => navigate(`/checks/register?rideId=${rideId}`)}
        startImmediately
      />
    </div>
  );
};

export default ChecklistExecutionPage;
