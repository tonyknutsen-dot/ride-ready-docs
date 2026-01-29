import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import type { CheckItemResult } from '@/lib/offlineDb';

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
}

export function useOptimisticDocumentUpload() {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (params: UploadDocumentParams) => {
      const { file, documentName, documentType, rideId, isGlobal, expiryDate, notes, versionNumber, versionNotes, replacingDocumentId } = params;
      
      if (!user) throw new Error("Not authenticated");

      // Create file path
      const fileName = `${Date.now()}-${file.name}`;
      const filePath = isGlobal 
        ? `${user.id}/global/${fileName}`
        : `${user.id}/${rideId}/${fileName}`;

      // Upload file to storage
      const { error: uploadError } = await supabase.storage
        .from('ride-documents')
        .upload(filePath, file);

      if (uploadError) throw uploadError;

      // Save document metadata
      const documentData = {
        user_id: user.id,
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
      };

      const { data, error: dbError } = await supabase
        .from('documents')
        .insert(documentData)
        .select()
        .single();

      if (dbError) throw dbError;

      // Mark old document as not latest if replacing
      if (replacingDocumentId) {
        await supabase
          .from('documents')
          .update({ is_latest_version: false })
          .eq('id', replacingDocumentId);
      }

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
        title: params.isGlobal ? "Global document saved" : `Saved to ${params.rideName || 'ride'}`,
        description: "Document uploaded successfully",
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
  const { toast } = useToast();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (params: CompleteCheckParams) => {
      if (!user) throw new Error("Not authenticated");

      // Create check record
      const { data: check, error: checkError } = await supabase
        .from('checks')
        .insert({
          user_id: user.id,
          ride_id: params.rideId,
          template_id: params.templateId,
          inspector_name: params.inspectorName.trim(),
          notes: params.inspectorNotes?.trim() || null,
          check_frequency: params.frequency,
          status: 'completed',
          weather_conditions: params.weatherConditions?.trim() || null,
          environment_notes: params.environmentNotes?.trim() || null,
          compliance_officer: params.complianceOfficer?.trim() || null,
          signature_data: params.signatureData?.trim() || null
        })
        .select()
        .single();

      if (checkError) throw checkError;

      // Create check results
      const results = params.templateItems.map(item => {
        const result = params.itemResults[item.id] || 'na';
        return {
          check_id: check.id,
          template_item_id: item.id,
          is_checked: result === 'pass',
          result: result,
          notes: params.notes[item.id]?.trim() || null
        };
      });

      const { error: resultsError } = await supabase
        .from('check_results')
        .insert(results);

      if (resultsError) throw resultsError;

      return check;
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
      queryClient.invalidateQueries({ queryKey: ['overview'] });
      queryClient.invalidateQueries({ queryKey: ['checks'] });
    },
  });
}
