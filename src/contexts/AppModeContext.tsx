import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './AuthContext';
import { useSubscription } from '@/hooks/useSubscription';

export type AppMode = 'documents' | 'operations';

interface AppModeContextType {
  appMode: AppMode;
  setAppMode: (mode: AppMode) => Promise<boolean>;
  loading: boolean;
  canAccessOperations: boolean;
  isDocumentsMode: boolean;
  isOperationsMode: boolean;
}

const AppModeContext = createContext<AppModeContextType | undefined>(undefined);

export const useAppMode = () => {
  const context = useContext(AppModeContext);
  if (!context) {
    throw new Error('useAppMode must be used within AppModeProvider');
  }
  return context;
};

export const AppModeProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const { user } = useAuth();
  const { subscription } = useSubscription();
  const [appMode, setAppModeState] = useState<AppMode>('documents');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) {
      setLoading(false);
      return;
    }

    const fetchAppMode = async () => {
      try {
        const { data, error } = await supabase
          .from('profiles')
          .select('app_mode')
          .eq('user_id', user.id)
          .single();

        if (error) {
          console.error('Error fetching app mode:', error);
          return;
        }

        if (data) {
          setAppModeState(data.app_mode as AppMode);
        }
      } catch (error) {
        console.error('Error fetching app mode:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchAppMode();

    // Subscribe to realtime changes
    const channel = supabase
      .channel('profile-app-mode-changes')
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'profiles',
          filter: `user_id=eq.${user.id}`
        },
        (payload) => {
          if (payload.new && 'app_mode' in payload.new) {
            const newMode = payload.new.app_mode as AppMode;
            console.log('[AppModeContext] Setting mode from realtime:', newMode);
            setAppModeState(newMode);
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user]);

  const setAppMode = async (mode: AppMode) => {
    if (!user) {
      return false;
    }

    // Check if trying to switch to operations mode without advanced plan
    if (mode === 'operations' && subscription?.subscriptionStatus !== 'advanced') {
      return false;
    }

    try {
      const { error } = await supabase
        .from('profiles')
        .update({ app_mode: mode })
        .eq('user_id', user.id);

      if (error) throw error;

      setAppModeState(mode);
      
      return true;
    } catch (error) {
      console.error('[AppModeContext] Error updating app mode:', error);
      return false;
    }
  };

  const canAccessOperations = subscription?.subscriptionStatus === 'advanced';

  const value = {
    appMode,
    setAppMode,
    loading,
    canAccessOperations,
    isDocumentsMode: appMode === 'documents',
    isOperationsMode: appMode === 'operations'
  };

  return (
    <AppModeContext.Provider value={value}>
      {children}
    </AppModeContext.Provider>
  );
};
