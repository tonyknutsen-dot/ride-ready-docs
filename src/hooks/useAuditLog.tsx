import { useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

type AuditAction = 
  | 'view'
  | 'download'
  | 'create'
  | 'update'
  | 'delete'
  | 'share'
  | 'export'
  | 'login'
  | 'logout';

type ResourceType = 
  | 'document'
  | 'ride'
  | 'check'
  | 'defect'
  | 'maintenance'
  | 'risk_assessment'
  | 'profile'
  | 'staff'
  | 'session';

interface AuditDetails {
  [key: string]: any;
}

export function useAuditLog() {
  const { user } = useAuth();

  const logEvent = useCallback(async (
    action: AuditAction,
    resourceType: ResourceType,
    resourceId?: string,
    details?: AuditDetails
  ) => {
    if (!user) return;

    try {
      // Use the RPC function to log the event
      const { error } = await supabase.rpc('log_audit_event', {
        p_action: action,
        p_resource_type: resourceType,
        p_resource_id: resourceId || null,
        p_details: details || {}
      });

      if (error) {
        console.error('Failed to log audit event:', error);
      }
    } catch (err) {
      // Don't throw - audit logging should never break the app
      console.error('Audit log error:', err);
    }
  }, [user]);

  const logDocumentView = useCallback((documentId: string, documentName?: string) => {
    return logEvent('view', 'document', documentId, { name: documentName });
  }, [logEvent]);

  const logDocumentDownload = useCallback((documentId: string, documentName?: string) => {
    return logEvent('download', 'document', documentId, { name: documentName });
  }, [logEvent]);

  const logDocumentShare = useCallback((documentId: string, recipientEmail: string) => {
    return logEvent('share', 'document', documentId, { recipient: recipientEmail });
  }, [logEvent]);

  const logRiskAssessmentExport = useCallback((assessmentId: string, rideName?: string) => {
    return logEvent('export', 'risk_assessment', assessmentId, { ride: rideName });
  }, [logEvent]);

  const logCheckComplete = useCallback((checkId: string, rideName?: string, checkType?: string) => {
    return logEvent('create', 'check', checkId, { ride: rideName, type: checkType });
  }, [logEvent]);

  return {
    logEvent,
    logDocumentView,
    logDocumentDownload,
    logDocumentShare,
    logRiskAssessmentExport,
    logCheckComplete,
  };
}
