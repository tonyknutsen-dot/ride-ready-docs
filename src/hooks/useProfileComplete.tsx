import { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';

export function useProfileComplete() {
  const { user } = useAuth();
  const [isProfileComplete, setIsProfileComplete] = useState<boolean | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) {
      setIsProfileComplete(null);
      setLoading(false);
      return;
    }

    const checkProfile = async () => {
      try {
        const { data, error } = await supabase
          .from('profiles')
          .select('company_name, controller_name')
          .eq('user_id', user.id)
          .maybeSingle();

        if (error) {
          console.error('Error checking profile:', error);
          setIsProfileComplete(false);
        } else if (!data) {
          // No profile exists yet
          setIsProfileComplete(false);
        } else {
          // Profile exists - check if required fields are filled
          const isComplete = !!(data.company_name && data.controller_name);
          setIsProfileComplete(isComplete);
        }
      } catch (error) {
        console.error('Error checking profile:', error);
        setIsProfileComplete(false);
      } finally {
        setLoading(false);
      }
    };

    checkProfile();
  }, [user]);

  return { isProfileComplete, loading };
}
