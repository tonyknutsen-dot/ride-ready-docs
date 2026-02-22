import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { format } from 'date-fns';

/**
 * Returns the count of overdue compliance items (events + expired documents).
 * Updates automatically via react-query refetch.
 */
export function useOverdueCompliance() {
  const { user } = useAuth();

  const { data: overdueCount = 0 } = useQuery({
    queryKey: ['overdue-compliance-count', user?.id],
    queryFn: async () => {
      if (!user) return 0;
      const today = format(new Date(), 'yyyy-MM-dd');

      const [eventsResult, docsResult] = await Promise.all([
        // Overdue compliance events (regulatory only – operational never escalate)
        supabase
          .from('compliance_events')
          .select('id', { count: 'exact', head: true })
          .eq('user_id', user.id)
          .eq('status', 'scheduled')
          .eq('event_category', 'regulatory')
          .lt('due_date', today),
        // Expired documents (latest version, not archived)
        supabase
          .from('documents')
          .select('id', { count: 'exact', head: true })
          .eq('user_id', user.id)
          .eq('is_test_data', false)
          .eq('is_latest_version', true)
          .lt('expires_at', today)
          .not('expires_at', 'is', null),
      ]);

      return (eventsResult.count || 0) + (docsResult.count || 0);
    },
    enabled: !!user,
    refetchInterval: 60_000, // refresh every minute
    staleTime: 30_000,
  });

  return overdueCount;
}
