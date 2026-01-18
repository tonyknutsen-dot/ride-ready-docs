import { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
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
  const { user } = useAuth();
  const [isTester, setIsTester] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  const checkTesterStatus = useCallback(async () => {
    // No user - not tester, done loading
    if (!user) {
      setIsTester(false);
      setIsLoading(false);
      return;
    }

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
        return;
      }

      // Check if role exists and hasn't expired
      if (data) {
        const isExpired = data.expires_at ? new Date(data.expires_at) < new Date() : false;
        console.log('[TesterContext] Status check:', { 
          userId: user.id, 
          hasRole: true, 
          expiresAt: data.expires_at, 
          isExpired 
        });
        setIsTester(!isExpired);
      } else {
        console.log('[TesterContext] No tester role found for user:', user.id);
        setIsTester(false);
      }
    } catch (error) {
      console.error('[TesterContext] Error checking tester status:', error);
      setIsTester(false);
    } finally {
      setIsLoading(false);
    }
  }, [user]);

  // Initial check
  useEffect(() => {
    checkTesterStatus();
  }, [checkTesterStatus]);

  // Subscribe to realtime changes on user_roles table
  useEffect(() => {
    if (!user) return;

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
  }, [user, checkTesterStatus]);

  // Also recheck on window focus (backup for realtime issues)
  useEffect(() => {
    const handleFocus = () => {
      if (user) {
        console.log('[TesterContext] Window focused, rechecking status');
        checkTesterStatus();
      }
    };

    window.addEventListener('focus', handleFocus);
    return () => window.removeEventListener('focus', handleFocus);
  }, [user, checkTesterStatus]);

  return (
    <TesterContext.Provider value={{ isTester, isLoading, recheckTesterStatus: checkTesterStatus }}>
      {children}
    </TesterContext.Provider>
  );
};
