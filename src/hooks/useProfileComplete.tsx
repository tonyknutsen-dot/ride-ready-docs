import { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { getOfflineIdentity, saveOfflineIdentity } from '@/lib/offlineIdentity';

export function useProfileComplete() {
  const { user, isOfflineMode } = useAuth();
  const [isProfileComplete, setIsProfileComplete] = useState<boolean | null>(null);
  const [isStaffMember, setIsStaffMember] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) {
      setIsProfileComplete(null);
      setIsStaffMember(false);
      setLoading(false);
      return;
    }

    // Offline mode: use cached identity instead of querying Supabase
    if (isOfflineMode || !navigator.onLine) {
      const cached = getOfflineIdentity();
      if (cached && cached.userId === user.id) {
        setIsProfileComplete(cached.profileComplete);
        setIsStaffMember(cached.isStaff);
        setLoading(false);
        return;
      }
      // No cached identity – treat as complete to avoid onboarding redirect
      setIsProfileComplete(true);
      setLoading(false);
      return;
    }

    const checkProfile = async () => {
      try {
        // First check if user is a staff member (part of an organisation they don't own)
        const { data: memberData } = await supabase
          .from('organisation_members')
          .select('id, organisation_id, organisations!inner(owner_id)')
          .eq('user_id', user.id)
          .eq('is_active', true)
          .maybeSingle();

        // User is a staff member if they're in an org they don't own
        const isStaff = memberData && (memberData.organisations as any)?.owner_id !== user.id;
        setIsStaffMember(!!isStaff);

        // Staff members don't need to complete profile setup - they're part of an existing company
        if (isStaff) {
          setIsProfileComplete(true);
          saveOfflineIdentity({ userId: user.id, email: user.email ?? null, profileComplete: true, isStaff: true, lastSyncedAt: new Date().toISOString() });
          setLoading(false);
          return;
        }

        // For non-staff (owners), check profile completion
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
          // Persist for offline boot
          saveOfflineIdentity({ userId: user.id, email: user.email ?? null, profileComplete: isComplete, isStaff: false, lastSyncedAt: new Date().toISOString() });
        }
      } catch (error) {
        console.error('Error checking profile:', error);
        // If fetch failed (possibly offline), try cached identity
        if (!navigator.onLine) {
          const cached = getOfflineIdentity();
          if (cached && cached.userId === user.id) {
            setIsProfileComplete(cached.profileComplete);
            setIsStaffMember(cached.isStaff);
            setLoading(false);
            return;
          }
        }
        setIsProfileComplete(false);
      } finally {
        setLoading(false);
      }
    };

    checkProfile();
  }, [user, isOfflineMode]);

  return { isProfileComplete, isStaffMember, loading };
}
