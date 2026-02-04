import { useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import {
  cacheRidesForOffline,
  cacheTemplatesForOffline,
  type CachedRide,
  type CachedTemplate,
} from '@/lib/offlineDb';

export function useOfflineDataCache() {
  const { user } = useAuth();
  const userId = user?.id;
  const hasCachedRef = useRef(false);

  const cacheData = useCallback(async () => {
    if (!userId) return;

    try {
      // Fetch rides the user has access to
      const { data: rides, error: ridesError } = await supabase
        .from('rides')
        .select('id, ride_name, category_id, manufacturer, serial_number');

      if (ridesError) throw ridesError;

      if (rides && rides.length > 0) {
        const cachedRides: CachedRide[] = rides.map(r => ({
          id: r.id,
          rideName: r.ride_name,
          categoryId: r.category_id,
          manufacturer: r.manufacturer || undefined,
          serialNumber: r.serial_number || undefined,
          cachedAt: new Date().toISOString(),
        }));

        await cacheRidesForOffline(cachedRides);

        // Fetch templates for each ride
        const rideIds = rides.map(r => r.id);
        const { data: templates, error: templatesError } = await supabase
          .from('daily_check_templates')
          .select(`
            id,
            ride_id,
            template_name,
            check_frequency,
            is_active,
            daily_check_template_items (
              id,
              check_item_text,
              category,
              is_required,
              sort_order
            )
          `)
          .in('ride_id', rideIds)
          .eq('is_active', true)
          .eq('is_archived', false);

        if (templatesError) throw templatesError;

        if (templates && templates.length > 0) {
          const cachedTemplates: CachedTemplate[] = templates.map(t => ({
            id: t.id,
            rideId: t.ride_id,
            templateName: t.template_name,
            checkFrequency: t.check_frequency,
            isActive: t.is_active ?? true,
            items: (t.daily_check_template_items || []).map((item: any) => ({
              id: item.id,
              checkItemText: item.check_item_text,
              category: item.category,
              isRequired: item.is_required ?? true,
              sortOrder: item.sort_order ?? 0,
            })),
            cachedAt: new Date().toISOString(),
          }));

          await cacheTemplatesForOffline(cachedTemplates);
        }

        console.log(`Cached ${rides.length} rides and ${templates?.length || 0} templates for offline use`);
      }
    } catch (error) {
      console.error('Failed to cache data for offline use:', error);
    }
  }, [userId]);

  // Cache data once when user logs in - use ref to prevent duplicate calls
  useEffect(() => {
    if (userId && !hasCachedRef.current) {
      hasCachedRef.current = true;
      cacheData();
    }
    
    // Reset when user changes
    if (!userId) {
      hasCachedRef.current = false;
    }
  }, [userId, cacheData]);

  return { cacheData };
}
