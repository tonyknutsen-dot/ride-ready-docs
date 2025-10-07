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
          console.log('[useAppMode] Realtime update received:', payload);
          if (payload.new && 'app_mode' in payload.new) {
            const newMode = payload.new.app_mode as AppMode;
            console.log('[useAppMode] Setting mode from realtime:', newMode);
            setAppModeState(newMode);
          }
        }
      )
      .subscribe((status) => {
        console.log('[useAppMode] Realtime subscription status:', status);
      });

    return () => {
      console.log('[useAppMode] Cleaning up realtime subscription');
      supabase.removeChannel(channel);
    };
  }, [user]);

  const setAppMode = async (mode: AppMode) => {
    if (!user) {
      console.log('[useAppMode] No user, cannot switch mode');
      return false;
    }

    console.log('[useAppMode] Attempting to switch to:', mode, 'Current mode:', appMode);

    // Check if trying to switch to operations mode without advanced plan
    if (mode === 'operations' && subscription?.subscriptionStatus !== 'advanced') {
      console.log('[useAppMode] Cannot switch to operations - no advanced plan');
      return false;
    }

    try {
      console.log('[useAppMode] Updating database...');
      const { error } = await supabase
        .from('profiles')
        .update({ app_mode: mode })
        .eq('user_id', user.id);

      if (error) throw error;

      console.log('[useAppMode] Database updated, setting local state');
      setAppModeState(mode);
      
      // Force a re-render by dispatching a custom event
      window.dispatchEvent(new CustomEvent('app-mode-changed', { detail: { mode } }));
      
      return true;
    } catch (error) {
      console.error('[useAppMode] Error updating app mode:', error);
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
