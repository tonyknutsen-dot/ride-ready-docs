import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Tables } from '@/integrations/supabase/types';
import { useToast } from '@/hooks/use-toast';
import { getCachedTemplatesForRide, type CachedTemplate } from '@/lib/offlineDb';
import { markCheckDebug, setCheckDebugValue } from '@/utils/checkDebug';

export type ChecklistRide = Tables<'rides'> & {
  ride_categories: {
    name: string;
    description: string | null;
    category_group: string;
  };
};

export type ChecklistTemplate = Tables<'daily_check_templates'> & {
  daily_check_template_items: Tables<'daily_check_template_items'>[];
};

export type ChecklistCheck = Tables<'checks'>;

interface UseChecklistTemplateParams {
  ride: ChecklistRide;
  frequency: string;
  userId?: string | null;
  effectiveUserId?: string | null;
  isStaff: boolean;
}

export function useChecklistTemplate({ ride, frequency, userId, effectiveUserId, isStaff }: UseChecklistTemplateParams) {
  const { toast } = useToast();
  const [activeTemplate, setActiveTemplate] = useState<ChecklistTemplate | null>(null);
  const [recentChecks, setRecentChecks] = useState<ChecklistCheck[]>([]);
  const [loading, setLoading] = useState(true);
  const [usingCachedTemplate, setUsingCachedTemplate] = useState(false);

  const convertCachedToTemplate = useCallback((cached: CachedTemplate): ChecklistTemplate => ({
    id: cached.id,
    ride_id: cached.rideId,
    template_name: cached.templateName,
    check_frequency: cached.checkFrequency,
    is_active: cached.isActive,
    is_archived: false,
    user_id: userId || '',
    created_at: cached.cachedAt,
    updated_at: cached.cachedAt,
    description: null,
    template_type: cached.checkFrequency,
    custom_interval_days: null,
    start_notice_required: false,
    start_notice_text: null,
    finish_notice_required: false,
    finish_notice_text: null,
    daily_check_template_items: cached.items.map(item => ({
      id: item.id,
      template_id: cached.id,
      check_item_text: item.checkItemText,
      category: item.category || 'general',
      is_required: item.isRequired,
      sort_order: item.sortOrder,
      created_at: cached.cachedAt,
    })),
  }), [userId]);

  const loadActiveTemplate = useCallback(async () => {
    setUsingCachedTemplate(false);
    try {
      markCheckDebug('template query started');
      setCheckDebugValue('template query status', 'started');
      let query = supabase
        .from('daily_check_templates')
        .select(`*, daily_check_template_items (*)`)
        .eq('ride_id', ride.id)
        .eq('check_frequency', frequency)
        .eq('is_active', true)
        .eq('is_archived', false);

      if (!isStaff) query = query.eq('user_id', effectiveUserId);

      const { data, error } = await query.maybeSingle();
      if (error && error.code !== 'PGRST116') throw error;
      setActiveTemplate(data as ChecklistTemplate | null);
      setCheckDebugValue('template query status', data ? `finished: ${data.daily_check_template_items?.length ?? 0} items` : 'finished: no active template');
      markCheckDebug('template query finished');
    } catch (error) {
      console.error('Error loading active template:', error);
      setCheckDebugValue('template query status', 'error');
      setCheckDebugValue('any blocking error text', error instanceof Error ? error.message : 'template query failed');
      try {
        const cachedTemplates = await getCachedTemplatesForRide(ride.id);
        const matchingTemplate = cachedTemplates.find(t => t.checkFrequency === frequency && t.isActive);
        if (matchingTemplate) {
          setActiveTemplate(convertCachedToTemplate(matchingTemplate));
          setUsingCachedTemplate(true);
          toast({ title: 'Using cached template', description: "You're offline. Using previously cached template." });
        } else if (navigator.onLine) {
          toast({ title: 'Error', description: 'Failed to load template. No cached version available.', variant: 'destructive' });
        }
      } catch (cacheError) {
        console.error('Error loading cached template:', cacheError);
        if (navigator.onLine) {
          toast({ title: 'Error', description: 'Failed to load inspection template', variant: 'destructive' });
        }
      }
    } finally {
      setLoading(false);
    }
  }, [convertCachedToTemplate, effectiveUserId, frequency, isStaff, ride.id, toast]);

  const loadRecentChecks = useCallback(async () => {
    try {
      let query = supabase
        .from('checks')
        .select('*')
        .eq('ride_id', ride.id)
        .eq('check_frequency', frequency)
        .order('check_date', { ascending: false })
        .limit(5);

      if (!isStaff) query = query.eq('user_id', effectiveUserId);
      const { data, error } = await query;
      if (error) throw error;
      setRecentChecks((data || []) as ChecklistCheck[]);
    } catch (error) {
      console.error('Error loading recent checks:', error);
    }
  }, [effectiveUserId, frequency, isStaff, ride.id]);

  useEffect(() => {
    if (!userId) return;
    loadActiveTemplate();
    loadRecentChecks();
  }, [userId, ride.id, frequency, loadActiveTemplate, loadRecentChecks]);

  return {
    activeTemplate,
    setActiveTemplate,
    recentChecks,
    loading,
    usingCachedTemplate,
    loadActiveTemplate,
    loadRecentChecks,
  };
}
