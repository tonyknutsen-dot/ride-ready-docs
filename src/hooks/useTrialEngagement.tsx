import { useCallback, useRef } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

/**
 * Hook that checks engagement milestones and auto-extends trial to 21 days.
 * Milestones: ≥3 rides, ≥5 documents, or first checklist created.
 * Call `checkEngagementExtension()` after ride creation, doc upload, or template creation.
 */
export const useTrialEngagement = () => {
  const { user } = useAuth();
  const hasShownToast = useRef(false);

  const checkEngagementExtension = useCallback(async () => {
    if (!user || hasShownToast.current) return;

    try {
      const { data, error } = await supabase.rpc('check_trial_engagement_extension');
      
      if (error) {
        console.error('[TRIAL-ENGAGEMENT] Error checking extension:', error);
        return;
      }

      const result = data as unknown as { extended: boolean; reason: string; new_trial_ends_at?: string };

      if (result?.extended) {
        hasShownToast.current = true;
        console.log('[TRIAL-ENGAGEMENT] Trial extended!', result.reason);
        
        const reasonMessages: Record<string, string> = {
          added_3_rides: "You've added 3 rides",
          uploaded_5_docs: "You've uploaded 5 documents",
          created_first_checklist: "You've created your first checklist",
        };

        const reason = reasonMessages[result.reason] || "You've been actively using the platform";

        toast.success("🎉 Bonus: 7 extra days added to your trial!", {
          description: `${reason} — so we've extended your free access to 21 days. Keep exploring!`,
          duration: 8000,
        });
      }
    } catch (err) {
      console.error('[TRIAL-ENGAGEMENT] Unexpected error:', err);
    }
  }, [user]);

  return { checkEngagementExtension };
};
