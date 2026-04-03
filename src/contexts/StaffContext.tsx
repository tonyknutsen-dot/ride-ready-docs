import React, { createContext, useContext, useEffect, useState, useMemo, useCallback } from 'react';
import { useAuth } from './AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Database } from '@/integrations/supabase/types';

type StaffRole = Database['public']['Enums']['staff_role'];

interface StaffMembership {
  organisationId: string;
  organisationName: string;
  permissionLevel: StaffRole;
  memberId: string;
  ownerId: string;
}

interface StaffContextType {
  isStaff: boolean;
  isOwner: boolean;
  staffMembership: StaffMembership | null;
  permissionLevel: StaffRole | null;
  loading: boolean;
  // Simplified permission helpers — staff get rides/checks/maintenance only
  canAccessCalendar: boolean;
  canAccessChecks: boolean;
  canAccessMaintenance: boolean;
  canAccessDocuments: boolean;
  canAccessRiskAssessments: boolean;
  canAccessSendDocuments: boolean;
  canAccessBilling: boolean;
  canAccessSettings: boolean;
  canManageStaff: boolean;
  refetch: () => Promise<void>;
}

const StaffContext = createContext<StaffContextType | undefined>(undefined);

export function StaffProvider({ children }: { children: React.ReactNode }) {
  const { user, loading: authLoading } = useAuth();
  const [isStaff, setIsStaff] = useState(false);
  const [isOwner, setIsOwner] = useState(true);
  const [staffMembership, setStaffMembership] = useState<StaffMembership | null>(null);
  const [permissionLevel, setPermissionLevel] = useState<StaffRole | null>(null);
  const [loading, setLoading] = useState(true);
  const [fetchedForUserId, setFetchedForUserId] = useState<string | null>(null);

  const fetchStaffStatus = useCallback(async (force = false) => {
    if (authLoading) return;

    if (!user) {
      setIsStaff(false);
      setIsOwner(true);
      setStaffMembership(null);
      setPermissionLevel(null);
      setFetchedForUserId(null);
      setLoading(false);
      return;
    }

    if (!force && fetchedForUserId === user.id) return;

    setLoading(true);

    try {
      const { data: membership, error } = await supabase
        .from('organisation_members')
        .select(`
          id,
          permission_level,
          organisation_id,
          organisations (
            id,
            name,
            owner_id
          )
        `)
        .eq('user_id', user.id)
        .eq('is_active', true)
        .maybeSingle();

      if (error) {
        console.error('Error fetching staff status:', error);
        return;
      }

      if (membership && membership.organisations) {
        const org = membership.organisations as { id: string; name: string; owner_id: string };
        const userIsOwner = org.owner_id === user.id;

        setIsStaff(!userIsOwner);
        setIsOwner(userIsOwner);
        setPermissionLevel(membership.permission_level);
        setStaffMembership({
          organisationId: org.id,
          organisationName: org.name,
          permissionLevel: membership.permission_level,
          memberId: membership.id,
          ownerId: org.owner_id,
        });
      } else {
        setIsStaff(false);
        setIsOwner(true);
        setStaffMembership(null);
        setPermissionLevel(null);
      }
    } catch (error) {
      console.error('Error in fetchStaffStatus:', error);
    } finally {
      setFetchedForUserId(user.id);
      setLoading(false);
    }
  }, [authLoading, user?.id, fetchedForUserId]);

  const userId = user?.id;
  useEffect(() => {
    if (authLoading) {
      setLoading(true);
      return;
    }

    if (!userId) {
      void fetchStaffStatus();
      return;
    }

    let timeoutId: ReturnType<typeof setTimeout> | null = null;
    let idleCallbackId: number | null = null;

    if ('requestIdleCallback' in window) {
      idleCallbackId = (window as any).requestIdleCallback(() => {
        void fetchStaffStatus();
      }, { timeout: 2000 });
    } else {
      timeoutId = setTimeout(() => {
        void fetchStaffStatus();
      }, 100);
    }

    return () => {
      if (timeoutId) clearTimeout(timeoutId);
      if (idleCallbackId !== null && 'cancelIdleCallback' in window) {
        (window as any).cancelIdleCallback(idleCallbackId);
      }
    };
  }, [authLoading, userId, fetchStaffStatus]);

  // Simplified: staff get rides + checks + maintenance only
  const canAccessCalendar = isOwner && !isStaff;
  const canAccessChecks = true; // both roles
  const canAccessMaintenance = true; // both roles
  const canAccessDocuments = isOwner && !isStaff;
  const canAccessRiskAssessments = isOwner && !isStaff;
  const canAccessSendDocuments = isOwner && !isStaff;
  const canAccessBilling = isOwner && !isStaff;
  const canAccessSettings = isOwner && !isStaff;
  const canManageStaff = isOwner && !isStaff;

  const value = useMemo(() => ({
    isStaff,
    isOwner,
    staffMembership,
    permissionLevel,
    loading,
    canAccessCalendar,
    canAccessChecks,
    canAccessMaintenance,
    canAccessDocuments,
    canAccessRiskAssessments,
    canAccessSendDocuments,
    canAccessBilling,
    canAccessSettings,
    canManageStaff,
    refetch: fetchStaffStatus,
  }), [
    isStaff, isOwner, staffMembership, permissionLevel, loading,
    canAccessCalendar, canAccessChecks, canAccessMaintenance, canAccessDocuments,
    canAccessRiskAssessments, canAccessSendDocuments, canAccessBilling, canAccessSettings,
    canManageStaff, fetchStaffStatus
  ]);

  return (
    <StaffContext.Provider value={value}>
      {children}
    </StaffContext.Provider>
  );
}

export function useStaff() {
  const context = useContext(StaffContext);
  if (context === undefined) {
    throw new Error('useStaff must be used within a StaffProvider');
  }
  return context;
}
