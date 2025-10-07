import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { useSubscription } from './useSubscription';

export type AppMode = 'documents' | 'operations';

export const useAppMode = () => {
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
  }, [user]);

  const setAppMode = async (mode: AppMode) => {
    if (!user) return;

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
      console.error('Error updating app mode:', error);
      return false;
    }
  };

  const canAccessOperations = subscription?.subscriptionStatus === 'advanced';

  return {
    appMode,
    setAppMode,
    loading,
    canAccessOperations,
    isDocumentsMode: appMode === 'documents',
    isOperationsMode: appMode === 'operations'
  };
};
