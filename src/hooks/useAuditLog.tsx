import { useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

type AuditAction = 
  | 'view' | 'download' | 'create' | 'update' | 'delete'
  | 'share' | 'export' | 'login' | 'logout'
  | 'archive' | 'unarchive' | 'approve' | 'reject' | 'link'
  | 'send' | 'import' | 'upload' | 'replace'
  | 'complete' | 'close' | 'reopen'
  | 'grant' | 'revoke' | 'request' | 'reset_password'
  | 'subscribe' | 'unsubscribe' | 'block' | 'unblock';

type ResourceType = 
  | 'document' | 'ride' | 'check' | 'check_template'
  | 'defect' | 'maintenance' | 'risk_assessment' | 'risk_library'
  | 'profile' | 'staff' | 'session' | 'ride_category'
  | 'check_library_item' | 'marketing_contact' | 'marketing_campaign'
  | 'document_type' | 'equipment_type' | 'equipment_type_request'
  | 'document_type_request' | 'check_intake' | 'risk_intake'
  | 'support_access' | 'compliance_event' | 'inspection_record'
  | 'wind_log' | 'pressure_reading' | 'document_share'
  | 'subscription' | 'blocked_ip';

interface AuditDetails {
  [key: string]: any;
}

interface AuditOptions {
  /** Data before the change */
  before?: Record<string, any>;
  /** Data after the change */
  after?: Record<string, any>;
  /** Explicitly list changed field names */
  changedFields?: string[];
  /** Organisation name for context */
  organisationName?: string;
  /** Equipment UUID for context */
  equipmentId?: string;
  /** Equipment name for context */
  equipmentName?: string;
  /** Event result: success | failed | blocked | denied */
  result?: 'success' | 'failed' | 'blocked' | 'denied';
  /** Short context hint shown in list view */
  contextHint?: string;
  /** Reason / comment for approvals, rejections, closures */
  reason?: string;
}

/**
 * Compute changed fields automatically from before/after objects.
 */
function computeChangedFields(before?: Record<string, any>, after?: Record<string, any>): string[] | null {
  if (!before || !after) return null;
  const allKeys = new Set([...Object.keys(before), ...Object.keys(after)]);
  const changed: string[] = [];
  for (const key of allKeys) {
    if (JSON.stringify(before[key]) !== JSON.stringify(after[key])) {
      changed.push(key);
    }
  }
  return changed.length > 0 ? changed : null;
}

export function useAuditLog() {
  const { user } = useAuth();

  const logEvent = useCallback(async (
    action: AuditAction,
    resourceType: ResourceType,
    resourceId?: string,
    details?: AuditDetails,
    options?: AuditOptions
  ) => {
    if (!user) return;

    try {
      const changedFields = options?.changedFields
        || computeChangedFields(options?.before, options?.after);

      const params: Record<string, any> = {
        p_action: action,
        p_resource_type: resourceType,
        p_resource_id: resourceId || null,
        p_details: details || {},
      };

      // Only pass extended params if provided (avoids issues with old function signature during deployment)
      if (options?.before) params.p_before_data = options.before;
      if (options?.after) params.p_after_data = options.after;
      if (changedFields) params.p_changed_fields = changedFields;
      if (options?.organisationName) params.p_organisation_name = options.organisationName;
      if (options?.equipmentId) params.p_equipment_id = options.equipmentId;
      if (options?.equipmentName) params.p_equipment_name = options.equipmentName;
      if (options?.result) params.p_result = options.result;
      if (options?.contextHint) params.p_context_hint = options.contextHint;
      if (options?.reason) params.p_reason = options.reason;

      const { error } = await supabase.rpc('log_audit_event', params);

      if (error) {
        console.error('Failed to log audit event:', error);
      }
    } catch (err) {
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
