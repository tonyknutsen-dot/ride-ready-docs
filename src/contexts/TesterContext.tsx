import { createContext, useContext, useState, useEffect, useCallback, useMemo, ReactNode } from 'react';
import { useAuth } from './AuthContext';
import { supabase } from '@/integrations/supabase/client';

interface TesterContextType {
  isTester: boolean;
  isLoading: boolean;
  recheckTesterStatus: () => Promise<void>;
}

const TesterContext = createContext<TesterContextType>({
  isTester: false,
  isLoading: true,
  recheckTesterStatus: async () => {},
});

export const useTester = () => {
  const context = useContext(TesterContext);
  if (!context) {
    throw new Error('useTester must be used within TesterProvider');
  }
  return context;
};

export const TesterProvider = ({ children }: { children: ReactNode }) => {
  const { user, loading: authLoading } = useAuth();
  const [isTester, setIsTester] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  // Track which user ID we've already checked to prevent redundant fetches
  const [checkedUserId, setCheckedUserId] = useState<string | null>(null);

  const checkTesterStatus = useCallback(async (force = false) => {
    if (authLoading) {
      return;
    }

    // No user - not tester, done loading immediately
    if (!user) {
      setIsTester(false);
      setIsLoading(false);
      setCheckedUserId(null);
      return;
    }

    // Skip if we already checked for this user (unless forced)
    if (!force && checkedUserId === user.id) {
      return;
    }

    // Keep loading true until we complete the check
    // This prevents race conditions with useSubscription
    setIsLoading(true);

    try {
      const { data, error } = await supabase
        .from('user_roles')
        .select('role, expires_at')
        .eq('user_id', user.id)
        .eq('role', 'tester')
        .maybeSingle();

      if (error) {
        console.error('[TesterContext] Error checking tester status:', error);
        setIsTester(false);
        setIsLoading(false);
        return;
      }

      // Check if role exists and hasn't expired
      if (data) {
        const isExpired = data.expires_at ? new Date(data.expires_at) < new Date() : false;
        setIsTester(!isExpired);
      } else {
        setIsTester(false);
      }
    } catch (error) {
      console.error('[TesterContext] Error checking tester status:', error);
      setIsTester(false);
    } finally {
      // Only set loading false after check is complete
      setCheckedUserId(user.id);
      setIsLoading(false);
    }
  }, [authLoading, user?.id, checkedUserId]);

  // Initial check
  useEffect(() => {
    if (authLoading) {
      setIsLoading(true);
      return;
    }

    void checkTesterStatus();
  }, [authLoading, checkTesterStatus]);

  // Subscribe to realtime changes on user_roles table
  useEffect(() => {
    if (authLoading || !user) return;

    console.log('[TesterContext] Setting up realtime subscription for user:', user.id);

    const channel = supabase
      .channel(`user_roles_${user.id}`)
      .on(
        'postgres_changes',
        {
          event: '*', // Listen to INSERT, UPDATE, DELETE
          schema: 'public',
          table: 'user_roles',
          filter: `user_id=eq.${user.id}`,
        },
        (payload) => {
          console.log('[TesterContext] Realtime role change detected:', payload);
          // Re-check tester status when roles change
          checkTesterStatus();
        }
      )
      .subscribe((status) => {
        console.log('[TesterContext] Realtime subscription status:', status);
      });

    return () => {
      console.log('[TesterContext] Cleaning up realtime subscription');
      supabase.removeChannel(channel);
    };
  }, [authLoading, user, checkTesterStatus]);

  // Recheck on window focus only after extended absence (5+ minutes)
  // This reduces unnecessary API calls while still catching role changes
  useEffect(() => {
    if (authLoading || !user) return;
    
    let lastCheck = Date.now();
    
    const handleFocus = () => {
      const now = Date.now();
      // Only recheck if more than 5 minutes have passed
      if (now - lastCheck > 5 * 60 * 1000) {
        lastCheck = now;
        checkTesterStatus();
      }
    };

    window.addEventListener('focus', handleFocus);
    return () => window.removeEventListener('focus', handleFocus);
  }, [authLoading, user, checkTesterStatus]);

  // Memoize context value to prevent unnecessary re-renders
  const value = useMemo(() => ({
    isTester,
    isLoading,
    recheckTesterStatus: checkTesterStatus
  }), [isTester, isLoading, checkTesterStatus]);

  return (
    <TesterContext.Provider value={value}>
      {children}
    </TesterContext.Provider>
  );
};
