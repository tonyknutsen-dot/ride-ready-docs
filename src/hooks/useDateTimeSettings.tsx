import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { format } from 'date-fns';
import { COUNTRY_TIMEZONES, COUNTRY_DATE_FORMATS } from '@/components/DateTimeSettings';

export interface DateTimeSettings {
  dateFormat: string;
  timezone: string;
  isUK: boolean;
}

const DEFAULT_SETTINGS: DateTimeSettings = {
  dateFormat: 'DD/MM/YYYY',
  timezone: 'Europe/London',
  isUK: true,
};

export function useDateTimeSettings() {
  const { user } = useAuth();
  const [settings, setSettings] = useState<DateTimeSettings>(DEFAULT_SETTINGS);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadSettings = async () => {
      if (!user) {
        setLoading(false);
        return;
      }

      try {
        const { data, error } = await supabase
          .from('profiles')
          .select('date_format, timezone, country')
          .eq('user_id', user.id)
          .maybeSingle();

        if (!error && data) {
          const country = data.country || 'GB';
          setSettings({
            dateFormat: data.date_format || COUNTRY_DATE_FORMATS[country] || 'DD/MM/YYYY',
            timezone: data.timezone || COUNTRY_TIMEZONES[country] || 'Europe/London',
            isUK: country === 'GB',
          });
        }
      } catch (error) {
        console.error('Error loading date/time settings:', error);
      } finally {
        setLoading(false);
      }
    };

    loadSettings();
  }, [user]);

  // Format a date according to user preferences
  const formatDate = useCallback((date: Date | string): string => {
    const d = typeof date === 'string' ? new Date(date) : date;
    
    switch (settings.dateFormat) {
      case 'DD/MM/YYYY':
        return format(d, 'dd/MM/yyyy');
      case 'MM/DD/YYYY':
        return format(d, 'MM/dd/yyyy');
      case 'YYYY-MM-DD':
        return format(d, 'yyyy-MM-dd');
      case 'D MMM YYYY':
        return format(d, 'd MMM yyyy');
      case 'MMM D, YYYY':
        return format(d, 'MMM d, yyyy');
      default:
        return format(d, 'dd/MM/yyyy');
    }
  }, [settings.dateFormat]);

  // Format date with time
  const formatDateTime = useCallback((date: Date | string): string => {
    const d = typeof date === 'string' ? new Date(date) : date;
    const dateStr = formatDate(d);
    
    try {
      const timeStr = d.toLocaleTimeString('en-GB', { 
        timeZone: settings.timezone,
        hour: '2-digit', 
        minute: '2-digit',
        hour12: false 
      });
      return `${dateStr} ${timeStr}`;
    } catch {
      return `${dateStr} ${format(d, 'HH:mm')}`;
    }
  }, [formatDate, settings.timezone]);

  // Get date-fns format string based on user preference
  const getFormatString = useCallback((): string => {
    switch (settings.dateFormat) {
      case 'DD/MM/YYYY':
        return 'dd/MM/yyyy';
      case 'MM/DD/YYYY':
        return 'MM/dd/yyyy';
      case 'YYYY-MM-DD':
        return 'yyyy-MM-dd';
      case 'D MMM YYYY':
        return 'd MMM yyyy';
      case 'MMM D, YYYY':
        return 'MMM d, yyyy';
      default:
        return 'dd/MM/yyyy';
    }
  }, [settings.dateFormat]);

  return { 
    settings, 
    loading, 
    formatDate, 
    formatDateTime, 
    getFormatString,
  };
}
