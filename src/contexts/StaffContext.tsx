import React, { createContext, useContext, useEffect, useState, useMemo, useCallback } from 'react';
import { useAuth } from './AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Database } from '@/integrations/supabase/types';

type StaffRole = Database['public']['Enums']['staff_role'];

interface FeaturePermissions {
  calendar: boolean;
  documents: boolean;
  checks: boolean;
  maintenance: boolean;
  risk_assessments: boolean;
  send_documents: boolean;
}

interface StaffMembership {
  organisationId: string;
  organisationName: string;
  permissionLevel: StaffRole;
  memberId: string;
  ownerId: string;
  featurePermissions: FeaturePermissions;
}

interface StaffContextType {
  isStaff: boolean;
  isOwner: boolean;
  staffMembership: StaffMembership | null;
  permissionLevel: StaffRole | null;
  featurePermissions: FeaturePermissions | null;
  loading: boolean;
  // Permission check helpers
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

// Default permissions for owners (everything enabled)
const OWNER_PERMISSIONS: FeaturePermissions = {
  calendar: true,
  documents: true,
  checks: true,
  maintenance: true,
  risk_assessments: true,
  send_documents: true,
};

export function StaffProvider({ children }: { children: React.ReactNode }) {
  const { user, loading: authLoading } = useAuth();
  const [isStaff, setIsStaff] = useState(false);
  const [isOwner, setIsOwner] = useState(true); // Default to owner for non-staff
  const [staffMembership, setStaffMembership] = useState<StaffMembership | null>(null);
  const [permissionLevel, setPermissionLevel] = useState<StaffRole | null>(null);
  const [featurePermissions, setFeaturePermissions] = useState<FeaturePermissions | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchStaffStatus = useCallback(async () => {
    if (authLoading) {
      return;
    }

    if (!user) {
      setIsStaff(false);
      setIsOwner(true);
      setStaffMembership(null);
      setPermissionLevel(null);
      setFeaturePermissions(null);
      setLoading(false);
      return;
    }

    setLoading(true);

    try {
      // Check if user is a staff member of any organisation
      const { data: membership, error } = await supabase
        .from('organisation_members')
        .select(`
          id,
          permission_level,
          organisation_id,
          can_access_calendar,
          can_access_documents,
          can_access_checks,
          can_access_maintenance,
          can_access_risk_assessments,
          can_access_send_documents,
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
        
        // Check if user is the owner of this organisation
        const userIsOwner = org.owner_id === user.id;
        
        // Build feature permissions from database columns
        const permissions: FeaturePermissions = {
          calendar: membership.can_access_calendar ?? true,
          documents: membership.can_access_documents ?? false,
          checks: membership.can_access_checks ?? true,
          maintenance: membership.can_access_maintenance ?? false,
          risk_assessments: membership.can_access_risk_assessments ?? false,
          send_documents: membership.can_access_send_documents ?? false,
        };

        setIsStaff(!userIsOwner);
        setIsOwner(userIsOwner);
        setPermissionLevel(membership.permission_level);
        setFeaturePermissions(userIsOwner ? OWNER_PERMISSIONS : permissions);
        setStaffMembership({
          organisationId: org.id,
          organisationName: org.name,
          permissionLevel: membership.permission_level,
          memberId: membership.id,
          ownerId: org.owner_id,
          featurePermissions: userIsOwner ? OWNER_PERMISSIONS : permissions,
        });
      } else {
        // User is not a staff member - default state is owner
        setIsStaff(false);
        setIsOwner(true);
        setStaffMembership(null);
        setPermissionLevel(null);
        setFeaturePermissions(OWNER_PERMISSIONS);
      }
    } catch (error) {
      console.error('Error in fetchStaffStatus:', error);
    } finally {
      setLoading(false);
    }
  }, [authLoading, user]);

  useEffect(() => {
    if (authLoading) {
      setLoading(true);
      return;
    }

    let timeoutId: ReturnType<typeof setTimeout> | null = null;
    let idleCallbackId: number | null = null;

    // Defer staff status check to not block initial render
    if (user) {
      if ('requestIdleCallback' in window) {
        idleCallbackId = (window as any).requestIdleCallback(() => {
          void fetchStaffStatus();
        }, { timeout: 2000 });
      } else {
        timeoutId = setTimeout(() => {
          void fetchStaffStatus();
        }, 100);
      }
    } else {
      void fetchStaffStatus();
    }

    return () => {
      if (timeoutId) {
        clearTimeout(timeoutId);
      }

      if (idleCallbackId !== null && 'cancelIdleCallback' in window) {
        (window as any).cancelIdleCallback(idleCallbackId);
      }
    };
  }, [authLoading, user, fetchStaffStatus]);

  // Permission helpers using granular permissions
  const canAccessCalendar = isOwner || (isStaff && (featurePermissions?.calendar ?? false));
  const canAccessChecks = isOwner || (isStaff && (featurePermissions?.checks ?? false));
  const canAccessMaintenance = isOwner || (isStaff && (featurePermissions?.maintenance ?? false));
  const canAccessDocuments = isOwner || (isStaff && (featurePermissions?.documents ?? false));
  const canAccessRiskAssessments = isOwner || (isStaff && (featurePermissions?.risk_assessments ?? false));
  const canAccessSendDocuments = isOwner || (isStaff && (featurePermissions?.send_documents ?? false));
  const canAccessBilling = isOwner && !isStaff;
  const canAccessSettings = isOwner && !isStaff;
  const canManageStaff = isOwner && !isStaff;

  // Memoize context value to prevent unnecessary re-renders
  const value = useMemo(() => ({
    isStaff,
    isOwner,
    staffMembership,
    permissionLevel,
    featurePermissions,
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
    isStaff, isOwner, staffMembership, permissionLevel, featurePermissions, loading,
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
