import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, AlertTriangle, CheckCircle2, ShieldAlert } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { Tables } from '@/integrations/supabase/types';
import { useEffectiveUserId } from '@/hooks/useEffectiveUserId';
import { useStaff } from '@/contexts/StaffContext';
import { useAuth } from '@/contexts/AuthContext';
import InspectionChecklist from '@/components/InspectionChecklist';
import StaffAccountBanner from '@/components/StaffAccountBanner';
import { Checkbox } from '@/components/ui/checkbox';
import { Button } from '@/components/ui/button';

type Ride = Tables<'rides'> & {
  ride_categories: {
    name: string;
    description: string | null;
  };
};

const FREQUENCY_LABELS: Record<string, string> = {
  preopening: 'Pre-Opening',
  daily: 'Daily',
  weekly: 'Weekly',
  monthly: 'Monthly',
  yearly: 'Yearly',
};

const ChecklistExecutionPage = () => {
  const { rideId, frequency } = useParams<{ rideId: string; frequency: string }>();
  const navigate = useNavigate();
  const { effectiveUserId } = useEffectiveUserId();
  const { isStaff } = useStaff();
  const { user } = useAuth();
  const [ride, setRide] = useState<Ride | null>(null);
  const [loading, setLoading] = useState(true);

  // Start notice state
  const [startNoticeText, setStartNoticeText] = useState<string | null>(null);
  const [startNoticeRequired, setStartNoticeRequired] = useState(false);
  const [noticeAcknowledged, setNoticeAcknowledged] = useState(false);
  const [noticeDismissed, setNoticeDismissed] = useState(false);

  useEffect(() => {
    if (effectiveUserId && rideId) {
      loadRide();
      loadStartNotice();
    }
  }, [effectiveUserId, rideId, frequency]);

  const loadRide = async () => {
    try {
      let query = supabase
        .from('rides')
        .select(`*, ride_categories (name, description)`)
        .eq('id', rideId!);

      if (!isStaff) {
        query = query.eq('user_id', effectiveUserId);
      }

      const { data, error } = await query.single();
      if (error) throw error;
      setRide(data as Ride);
    } catch (err) {
      console.error('Error loading ride:', err);
      navigate('/checks');
    } finally {
      setLoading(false);
    }
  };

  const loadStartNotice = async () => {
    try {
      let query = supabase
        .from('daily_check_templates')
        .select('start_notice_text, start_notice_required')
        .eq('ride_id', rideId!)
        .eq('check_frequency', frequency ?? 'daily')
        .eq('is_active', true)
        .eq('is_archived', false)
        .maybeSingle();

      const { data } = await query;
      if (data) {
        const noticeText = (data as any).start_notice_text;
        const noticeReq = (data as any).start_notice_required;
        setStartNoticeText(noticeText || null);
        setStartNoticeRequired(!!noticeReq);
      }
    } catch (err) {
      console.error('Error loading start notice:', err);
    }
  };

  const freqLabel = FREQUENCY_LABELS[frequency ?? ''] ?? (frequency ?? '');

  const handleBack = () => {
    navigate(`/rides/${rideId}?tab=checks`);
  };

  // Determine if we need to show the notice gate
  const showNoticeGate = startNoticeText && startNoticeRequired && !noticeDismissed;

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center space-y-3">
          <CheckCircle2 className="mx-auto h-10 w-10 text-primary animate-pulse" />
          <p className="text-sm text-muted-foreground">Loading checklist…</p>
        </div>
      </div>
    );
  }

  if (!ride) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center px-4">
        <div className="text-center space-y-4">
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
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <StaffAccountBanner />

      {/* ── STICKY HEADER ─────────────────────────────────── */}
      <header className="sticky top-0 z-40 bg-card/95 backdrop-blur-sm border-b border-border">
        <div className="px-4 py-3 flex items-start gap-3">
          <button
            onClick={handleBack}
            className="shrink-0 h-9 w-9 flex items-center justify-center rounded-xl border border-border bg-card hover:bg-muted/40 transition-colors mt-0.5"
            aria-label="Back"
          >
            <ArrowLeft className="h-4 w-4 text-foreground" />
          </button>

          <div className="flex-1 min-w-0">
            <p className="text-xs text-muted-foreground truncate">
              {ride.ride_name} · {ride.ride_categories.name}
            </p>
            <h1 className="text-base font-bold text-foreground leading-tight truncate">
              {freqLabel} Safety Check
            </h1>
          </div>
        </div>
      </header>

      {/* ── START NOTICE GATE ─────────────────────────────── */}
      {showNoticeGate ? (
        <main className="px-4 pt-6 pb-10 max-w-xl mx-auto">
          <div className="rounded-2xl border border-warning/30 bg-warning/5 p-5 space-y-4">
            <div className="flex items-start gap-3">
              <ShieldAlert className="h-6 w-6 text-warning shrink-0 mt-0.5" />
              <div>
                <h2 className="font-bold text-foreground text-base">Start Notice</h2>
                <p className="text-xs text-muted-foreground mt-0.5">You must acknowledge before starting</p>
              </div>
            </div>

            <div className="rounded-xl bg-card border border-border p-4 text-sm text-foreground whitespace-pre-wrap leading-relaxed">
              {startNoticeText}
            </div>

            <label className="flex items-start gap-3 cursor-pointer">
              <Checkbox
                checked={noticeAcknowledged}
                onCheckedChange={(v) => setNoticeAcknowledged(v === true)}
                className="mt-0.5"
              />
              <span className="text-sm font-medium text-foreground">
                I have read and understood this notice
              </span>
            </label>

            <Button
              className="w-full"
              disabled={!noticeAcknowledged}
              onClick={() => setNoticeDismissed(true)}
            >
              Continue to Check
            </Button>
          </div>
        </main>
      ) : (
        /* ── MAIN CONTENT ──────────────────────────────────── */
        <main className="px-4 pt-4 pb-10 max-w-xl mx-auto">
          <InspectionChecklist
            ride={ride}
            frequency={frequency ?? 'daily'}
            onChecklistSaved={() => navigate(`/rides/${rideId}?tab=checks`)}
            startImmediately
            startNoticeSnapshot={startNoticeText && startNoticeRequired ? startNoticeText : undefined}
            startNoticeAcknowledgedBy={startNoticeText && startNoticeRequired ? user?.id : undefined}
          />
        </main>
      )}
    </div>
  );
};

export default ChecklistExecutionPage;
