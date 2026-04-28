import { useEffect, useState } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { AlertTriangle, ArrowLeft, CheckCircle2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { Tables } from '@/integrations/supabase/types';
import { useEffectiveUserId } from '@/hooks/useEffectiveUserId';
import { useStaff } from '@/contexts/StaffContext';
import InspectionChecklist from '@/components/InspectionChecklist';
import StaffAccountBanner from '@/components/StaffAccountBanner';
import { Button } from '@/components/ui/button';
import { markCheckDebug, setCheckDebugValue } from '@/utils/checkDebug';

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

  // Origin-aware back target. Both paths now return to the canonical hub
  // (`/rides/:id?tab=checks`); the `from=checks` suffix lets the hub bounce
  // Back to `/checks` instead of `/rides`.
  const fromParam = searchParams.get('from');
  const isFromChecks = fromParam === 'checks';
  const backTo = isFromChecks
    ? `/rides/${rideId}?tab=checks&from=checks`
    : `/rides/${rideId}?tab=checks`;

  const handleChecklistSaved = (inspectionRecordId?: string) => {
    if (!inspectionRecordId) {
      setCheckDebugValue('any redirect target', backTo);
      navigate(backTo);
      return;
    }

    const params = new URLSearchParams();
    if (rideId) params.set('rideId', rideId);
    if (isFromChecks) params.set('from', 'checks');
    if (searchParams.get('checkDebug') === '1') params.set('checkDebug', '1');

    const target = `/inspection-record/${inspectionRecordId}${params.toString() ? `?${params.toString()}` : ''}`;
    setCheckDebugValue('any redirect target', target);
    navigate(target);
  };

  useEffect(() => {
    markCheckDebug('execution route mounted');
    setCheckDebugValue('any redirect target', backTo);
    markCheckDebug('back target ready');
  }, [backTo]);

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
      setCheckDebugValue('any blocking error text', err instanceof Error ? err.message : 'execution ride query failed');
      setCheckDebugValue('any redirect target', backTo);
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
              onClick={() => navigate(backTo)}
              className="text-primary text-sm font-semibold"
            >
              {isFromChecks ? 'Back to Checks' : 'Back to Equipment'}
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-2 px-4 md:px-0 pb-8">
      <StaffAccountBanner />

      <div className="flex items-center gap-2 min-h-10">
        <Button variant="ghost" size="icon" className="h-10 w-10 shrink-0 -ml-2" onClick={() => navigate(backTo)} aria-label="Back">
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div className="min-w-0">
          <h1 className="truncate text-sm font-semibold text-foreground">{ride.ride_name}</h1>
          <p className="truncate text-xs text-muted-foreground">{freqLabel}</p>
        </div>
      </div>

      <InspectionChecklist
        ride={ride}
        frequency={frequency ?? 'daily'}
        onChecklistSaved={handleChecklistSaved}
        executionMode="execute"
      />
    </div>
  );
};

export default ChecklistExecutionPage;
