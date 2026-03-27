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
  | 'logout'
  | 'archive'
  | 'unarchive'
  | 'approve'
  | 'reject'
  | 'link'
  | 'send'
  | 'import'
  | 'upload'
  | 'replace'
  | 'complete'
  | 'close'
  | 'reopen'
  | 'grant'
  | 'revoke'
  | 'request'
  | 'reset_password'
  | 'subscribe'
  | 'unsubscribe'
  | 'block'
  | 'unblock';

type ResourceType = 
  | 'document'
  | 'ride'
  | 'check'
  | 'check_template'
  | 'defect'
  | 'maintenance'
  | 'risk_assessment'
  | 'risk_library'
  | 'profile'
  | 'staff'
  | 'session'
  | 'ride_category'
  | 'check_library_item'
  | 'marketing_contact'
  | 'marketing_campaign'
  | 'document_type'
  | 'equipment_type'
  | 'equipment_type_request'
  | 'document_type_request'
  | 'check_intake'
  | 'risk_intake'
  | 'support_access'
  | 'compliance_event'
  | 'inspection_record'
  | 'wind_log'
  | 'pressure_reading'
  | 'document_share'
  | 'subscription'
  | 'blocked_ip';

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
    return logEvent('complete', 'check', checkId, { ride: rideName, type: checkType });
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
