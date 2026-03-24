import { useEffect, useState, useRef } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { saveIdentityCache, type IdentityCacheEntry } from '@/lib/offlineDb';

export function useProfileComplete() {
  const { user, isOfflineMode, cachedIdentity } = useAuth();
  const [isProfileComplete, setIsProfileComplete] = useState<boolean | null>(null);
  const [isStaffMember, setIsStaffMember] = useState(false);
  const [loading, setLoading] = useState(true);
  // Track which user we've already checked to prevent re-runs on cachedIdentity changes
  const checkedUserIdRef = useRef<string | null>(null);

  useEffect(() => {
    if (!user) {
      setIsProfileComplete(null);
      setIsStaffMember(false);
      setLoading(false);
      checkedUserIdRef.current = null;
      return;
    }

    // If we already successfully checked this user online, don't re-run
    if (checkedUserIdRef.current === user.id && isProfileComplete !== null) {
      return;
    }

    // Offline mode: use cached identity from IndexedDB (already loaded in AuthContext)
    if (isOfflineMode || !navigator.onLine) {
      if (cachedIdentity && cachedIdentity.userId === user.id) {
        setIsProfileComplete(cachedIdentity.setupComplete);
        setIsStaffMember(cachedIdentity.role === 'employee');
        setLoading(false);
        return;
      }
      // No cached identity – treat as complete to avoid onboarding redirect
      // ProfileGuard will show the "needs internet" screen instead
      setIsProfileComplete(null);
      setLoading(false);
      return;
    }

    const checkProfile = async () => {
      try {
        // First check if user is a staff member
        const { data: memberData } = await supabase
          .from('organisation_members')
          .select('id, organisation_id, permission_level, can_access_checks, can_access_documents, can_access_maintenance, can_access_calendar, can_access_risk_assessments, can_access_send_documents, organisations!inner(owner_id)')
          .eq('user_id', user.id)
          .eq('is_active', true)
          .maybeSingle();

        const isStaff = memberData && (memberData.organisations as any)?.owner_id !== user.id;
        setIsStaffMember(!!isStaff);

        if (isStaff) {
          setIsProfileComplete(true);
          const orgId = memberData?.organisation_id ?? null;
          const perms = memberData ? {
            checks: memberData.can_access_checks,
            documents: memberData.can_access_documents,
            maintenance: memberData.can_access_maintenance,
            calendar: memberData.can_access_calendar,
            riskAssessments: memberData.can_access_risk_assessments,
            sendDocuments: memberData.can_access_send_documents,
          } : {};

          // Write to IndexedDB identity cache
          const cacheEntry: IdentityCacheEntry = {
            userId: user.id,
            email: user.email ?? '',
            role: memberData?.permission_level ?? 'employee',
            organisationId: orgId,
            permissions: perms,
            setupComplete: true,
            lastProfileSyncAt: new Date().toISOString(),
            lastVisitedRoute: cachedIdentity?.lastVisitedRoute ?? '/overview',
          };
          saveIdentityCache(cacheEntry).catch(console.warn);

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
          setIsProfileComplete(false);
        } else {
          const isComplete = !!(data.company_name && data.controller_name);
          setIsProfileComplete(isComplete);

          // Write to IndexedDB identity cache
          if (isComplete) {
            const cacheEntry: IdentityCacheEntry = {
              userId: user.id,
              email: user.email ?? '',
              role: 'controller',
              organisationId: null,
              permissions: {},
              setupComplete: true,
              lastProfileSyncAt: new Date().toISOString(),
              lastVisitedRoute: cachedIdentity?.lastVisitedRoute ?? '/overview',
            };
            saveIdentityCache(cacheEntry).catch(console.warn);
          }
        }
      } catch (error) {
        console.error('Error checking profile:', error);
        // If fetch failed (possibly offline), use cached identity
        if (cachedIdentity && cachedIdentity.userId === user.id) {
          setIsProfileComplete(cachedIdentity.setupComplete);
          setIsStaffMember(cachedIdentity.role === 'employee');
          setLoading(false);
          return;
        }
        // If offline with no cache, don't force onboarding – treat as null (unknown)
        if (!navigator.onLine) {
          setIsProfileComplete(null);
        } else {
          setIsProfileComplete(false);
        }
      } finally {
        setLoading(false);
      }
    };

    checkProfile();
  }, [user, isOfflineMode, cachedIdentity]);

  return { isProfileComplete, isStaffMember, loading };
}
