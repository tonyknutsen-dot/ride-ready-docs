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
  // Use user.id directly (stable string) to avoid effect re-runs on token refresh
  const userId = user?.id;
  useEffect(() => {
    if (authLoading || !userId) return;

    

    const channel = supabase
      .channel(`user_roles_${userId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'user_roles',
          filter: `user_id=eq.${userId}`,
        },
        (payload) => {
          
          checkTesterStatus(true);
        }
      )
      .subscribe((status) => {
        
      });

    return () => {
      console.log('[TesterContext] Cleaning up realtime subscription');
      supabase.removeChannel(channel);
    };
  }, [authLoading, userId]); // eslint-disable-line react-hooks/exhaustive-deps

  // Recheck on window focus only after extended absence (5+ minutes)
  useEffect(() => {
    if (authLoading || !userId) return;
    
    let lastCheck = Date.now();
    
    const handleFocus = () => {
      const now = Date.now();
      if (now - lastCheck > 5 * 60 * 1000) {
        lastCheck = now;
        checkTesterStatus(true);
      }
    };

    window.addEventListener('focus', handleFocus);
    return () => window.removeEventListener('focus', handleFocus);
  }, [authLoading, userId]); // eslint-disable-line react-hooks/exhaustive-deps

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
