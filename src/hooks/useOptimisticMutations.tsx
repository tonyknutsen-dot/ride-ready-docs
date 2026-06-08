import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useEffectiveUserId } from "@/hooks/useEffectiveUserId";
import { useToast } from "@/hooks/use-toast";
import type { CheckItemResult } from '@/lib/offlineDb';
import { invalidateCheckRecordQueries } from '@/utils/queryInvalidation';
import { validateClientFile, sanitizeFilename } from '@/lib/uploadValidation';

// Types for optimistic document
interface OptimisticDocument {
  id: string;
  document_name: string;
  document_type: string;
  file_path: string;
  file_size: number;
  mime_type: string;
  is_global: boolean;
  expires_at: string | null;
  notes: string | null;
  uploaded_at: string;
  user_id: string;
  ride_id: string | null;
  version_number: string;
  is_latest_version: boolean;
  _optimistic?: boolean;
}

interface UploadDocumentParams {
  file: File;
  documentName: string;
  documentType: string;
  rideId: string | null;
  rideName?: string;
  isGlobal: boolean;
  expiryDate?: string;
  notes?: string;
  versionNumber?: string;
  versionNotes?: string;
  replacingDocumentId?: string | null;
  repeatAnnually?: boolean;
}

export function useOptimisticDocumentUpload() {
  const { user } = useAuth();
  const { effectiveUserId } = useEffectiveUserId();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (params: UploadDocumentParams) => {
      const { file, documentName, documentType, rideId, isGlobal, expiryDate, notes, versionNumber, versionNotes, replacingDocumentId, repeatAnnually } = params;
      
      if (!user || !effectiveUserId) throw new Error("Not authenticated");

      // Client-side allowlist + magic-extension check (server re-validates)
      const validation = validateClientFile(file, { mode: 'document' });
      if (!validation.ok) {
        throw new Error(validation.reason || 'This file type is not currently supported.');
      }
      const originalFilename = validation.sanitizedName || sanitizeFilename(file.name);

      // Use effectiveUserId (operator's ID) for data storage so staff data syncs with operator
      const storageUserId = effectiveUserId;

      // Use app-generated UUID for the stored object — never trust user filename
      const ext = (originalFilename.split('.').pop() || 'bin').toLowerCase();
      const storedId = (typeof crypto !== 'undefined' && 'randomUUID' in crypto)
        ? crypto.randomUUID()
        : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
      const fileName = `${storedId}.${ext}`;
      const filePath = isGlobal 
        ? `${storageUserId}/global/${fileName}`
        : `${storageUserId}/${rideId}/${fileName}`;

      // Upload file to storage
      const { error: uploadError } = await supabase.storage
        .from('ride-documents')
        .upload(filePath, file, { contentType: file.type || undefined });

      if (uploadError) throw uploadError;

      // Save document metadata - quarantined as pending_scan until scanner clears it
      const documentData: Record<string, any> = {
        user_id: storageUserId,
        ride_id: isGlobal ? null : rideId,
        document_name: documentName,
        document_type: documentType,
        file_path: filePath,
        file_size: file.size,
        mime_type: file.type,
        is_global: isGlobal,
        expires_at: expiryDate || null,
        notes: notes || null,
        version_number: versionNumber || '1.0',
        is_latest_version: true,
        version_notes: versionNotes || null,
        replaced_document_id: replacingDocumentId || null,
        repeat_annually: repeatAnnually || false,
        upload_status: 'pending_scan',
        original_filename: originalFilename,
        stored_path: filePath,
      };

      const { data, error: dbError } = await supabase
        .from('documents')
        .insert(documentData as any)
        .select()
        .single();

      if (dbError) throw dbError;

      // Audit: upload received (best effort)
      try {
        await (supabase as any).rpc('log_audit_event', {
          p_action: 'document_uploaded',
          p_resource_type: 'document',
          p_resource_id: data.id,
          p_details: { file_size: file.size, original_filename: originalFilename, mime_type: file.type },
        });
      } catch (e) {
        console.warn('audit upload failed', e);
      }

      // Mark old document as not latest if replacing
      if (replacingDocumentId) {
        await supabase
          .from('documents')
          .update({ is_latest_version: false })
          .eq('id', replacingDocumentId);
      }

      // Kick off server-side validation + virus scan. Don't block the UI
      // forever — fire and refresh queries when it returns.
      void (async () => {
        try {
          const { data: scanRes } = await supabase.functions.invoke('validate-and-scan-document', {
            body: { documentId: data.id },
          });
          if (scanRes?.status === 'rejected') {
            // Refresh so the UI shows the blocked state and removes optimistic row
            queryClient.invalidateQueries({ queryKey: ['documents'] });
            queryClient.invalidateQueries({ queryKey: ['overview'] });
          } else {
            queryClient.invalidateQueries({ queryKey: ['documents'] });
            queryClient.invalidateQueries({ queryKey: ['overview'] });
          }
        } catch (e) {
          console.warn('scan invoke failed', e);
          queryClient.invalidateQueries({ queryKey: ['documents'] });
        }
      })();

      return data;
    },
    onMutate: async (params) => {
      // Cancel outgoing refetches
      await queryClient.cancelQueries({ queryKey: ['overview'] });
      await queryClient.cancelQueries({ queryKey: ['documents'] });

      // Snapshot previous values
      const previousOverview = queryClient.getQueryData(['overview', user?.id]);

      // Optimistically update overview stats
      queryClient.setQueryData(['overview', user?.id], (old: any) => {
        if (!old) return old;
        return {
          ...old,
          stats: {
            ...old.stats,
            totalDocuments: old.stats.totalDocuments + 1
          },
          recentDocs: [
            {
              name: params.documentName,
              date: new Date().toLocaleDateString('en-GB'),
              type: params.documentType,
              _optimistic: true
            },
            ...old.recentDocs.slice(0, 3)
          ]
        };
      });

      return { previousOverview };
    },
    onError: (err, params, context) => {
      // Rollback on error
      if (context?.previousOverview) {
        queryClient.setQueryData(['overview', user?.id], context.previousOverview);
      }
      toast({
        title: "Upload failed",
        description: err.message || "Failed to upload document",
        variant: "destructive",
      });
    },
    onSuccess: (data, params) => {
      toast({
        title: params.isGlobal ? "Global document uploaded" : `Uploaded to ${params.rideName || 'equipment'}`,
        description: "This document is being checked before it can be used.",
      });
    },
    onSettled: () => {
      // Refetch to ensure consistency
      queryClient.invalidateQueries({ queryKey: ['overview'] });
      queryClient.invalidateQueries({ queryKey: ['documents'] });
    },
  });
}


// Types for optimistic check
interface CompleteCheckParams {
  rideId: string;
  rideName: string;
  templateId: string;
  inspectorName: string;
  frequency: string;
  itemResults: Record<string, CheckItemResult>;
  notes: Record<string, string>;
  templateItems: Array<{ id: string }>;
  weatherConditions?: string;
  environmentNotes?: string;
  complianceOfficer?: string;
  signatureData?: string;
  inspectorNotes?: string;
}

export function useOptimisticCheckComplete() {
  const { user } = useAuth();
  const { effectiveUserId } = useEffectiveUserId();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (params: CompleteCheckParams) => {
      if (!user || !effectiveUserId) throw new Error("Not authenticated");

      // Use effectiveUserId (operator's ID) so staff data syncs with operator
      const storageUserId = effectiveUserId;

      const results = params.templateItems.map(item => {
        const result = params.itemResults[item.id] || 'na';
        return {
          template_item_id: item.id,
          is_checked: result === 'pass',
          result: result,
          notes: params.notes[item.id]?.trim() || null
        };
      });

      const { data: checkId, error: saveError } = await supabase.rpc('submit_check_atomic' as any, {
        p_user_id: storageUserId,
        p_ride_id: params.rideId,
        p_template_id: params.templateId,
        p_inspector_name: params.inspectorName.trim(),
        p_check_date: new Date().toISOString().split('T')[0],
        p_check_frequency: params.frequency,
        p_status: 'completed',
        p_notes: params.inspectorNotes?.trim() || null,
        p_weather_conditions: params.weatherConditions?.trim() || null,
        p_location: null,
        p_signature_data: params.signatureData?.trim() || null,
        p_compliance_officer: params.complianceOfficer?.trim() || null,
        p_environment_notes: params.environmentNotes?.trim() || null,
        p_results: results,
      });

      if (saveError) throw saveError;

      return { id: checkId };
    },
    onMutate: async (params) => {
      // Cancel outgoing refetches
      await queryClient.cancelQueries({ queryKey: ['overview'] });
      await queryClient.cancelQueries({ queryKey: ['checks'] });

      // Snapshot previous values
      const previousOverview = queryClient.getQueryData(['overview', user?.id]);

      // Optimistically update overview stats
      queryClient.setQueryData(['overview', user?.id], (old: any) => {
        if (!old) return old;
        return {
          ...old,
          stats: {
            ...old.stats,
            recentChecks: old.stats.recentChecks + 1
          },
          recentActivity: [
            {
              type: 'check',
              title: `Safety check completed - ${params.rideName}`,
              time: new Date().toLocaleDateString('en-GB'),
              _optimistic: true
            },
            ...old.recentActivity.slice(0, 3)
          ]
        };
      });

      return { previousOverview };
    },
    onError: (err, params, context) => {
      // Rollback on error
      if (context?.previousOverview) {
        queryClient.setQueryData(['overview', user?.id], context.previousOverview);
      }
      toast({
        title: "Check submission failed",
        description: err.message || "Failed to save check",
        variant: "destructive",
      });
    },
    onSuccess: (data, params) => {
      const frequencyLabel = params.frequency.charAt(0).toUpperCase() + params.frequency.slice(1);
      toast({
        title: "Check completed ✓",
        description: `${frequencyLabel} check saved for ${params.rideName}`,
      });
    },
    onSettled: () => {
      // Refetch to ensure consistency
      invalidateCheckRecordQueries(queryClient);
    },
  });
}
