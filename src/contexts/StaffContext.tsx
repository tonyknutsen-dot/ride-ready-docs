import React, { createContext, useContext, useEffect, useState } from 'react';
import { useAuth } from './AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Database } from '@/integrations/supabase/types';

type StaffPermission = Database['public']['Enums']['staff_permission'];

interface StaffMembership {
  organisationId: string;
  organisationName: string;
  permissionLevel: StaffPermission;
  memberId: string;
  ownerId: string;
}

interface StaffContextType {
  isStaff: boolean;
  isOwner: boolean;
  staffMembership: StaffMembership | null;
  permissionLevel: StaffPermission | null;
  loading: boolean;
  // Permission check helpers
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
  const { user } = useAuth();
  const [isStaff, setIsStaff] = useState(false);
  const [isOwner, setIsOwner] = useState(true); // Default to owner for non-staff
  const [staffMembership, setStaffMembership] = useState<StaffMembership | null>(null);
  const [permissionLevel, setPermissionLevel] = useState<StaffPermission | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchStaffStatus = async () => {
    if (!user) {
      setIsStaff(false);
      setIsOwner(true);
      setStaffMembership(null);
      setPermissionLevel(null);
      setLoading(false);
      return;
    }

    try {
      // Check if user is a staff member of any organisation
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
        setLoading(false);
        return;
      }

      if (membership && membership.organisations) {
        const org = membership.organisations as { id: string; name: string; owner_id: string };
        
        // Check if user is the owner of this organisation
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
        // User is not a staff member, check if they own an organisation
        const { data: ownedOrg } = await supabase
          .from('organisations')
          .select('id')
          .eq('owner_id', user.id)
          .maybeSingle();
        
        setIsStaff(false);
        setIsOwner(true); // If no organisation, they're effectively an owner (can create one)
        setStaffMembership(null);
        setPermissionLevel(null);
      }
    } catch (error) {
      console.error('Error in fetchStaffStatus:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStaffStatus();
  }, [user]);

  // Permission helpers based on permission level
  const canAccessChecks = isOwner || (isStaff && permissionLevel !== null);
  const canAccessMaintenance = isOwner || (isStaff && (permissionLevel === 'checks_maintenance' || permissionLevel === 'full_access'));
  const canAccessDocuments = isOwner || (isStaff && permissionLevel === 'full_access');
  const canAccessRiskAssessments = isOwner || (isStaff && permissionLevel === 'full_access');
  const canAccessSendDocuments = isOwner || (isStaff && permissionLevel === 'full_access');
  const canAccessBilling = isOwner && !isStaff;
  const canAccessSettings = isOwner && !isStaff;
  const canManageStaff = isOwner && !isStaff;

  return (
    <StaffContext.Provider
      value={{
        isStaff,
        isOwner,
        staffMembership,
        permissionLevel,
        loading,
        canAccessChecks,
        canAccessMaintenance,
        canAccessDocuments,
        canAccessRiskAssessments,
        canAccessSendDocuments,
        canAccessBilling,
        canAccessSettings,
        canManageStaff,
        refetch: fetchStaffStatus,
      }}
    >
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
