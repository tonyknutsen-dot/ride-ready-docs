/**
 * Service for storing versioned PDF records in ride_documents table.
 * All system-generated PDFs should use this to register in the document register.
 */
import { supabase } from '@/integrations/supabase/client';

export type RideDocType = 'CR' | 'MR' | 'TL' | 'CH' | 'IC' | 'RA';

export const RIDE_DOC_TYPE_LABELS: Record<RideDocType, string> = {
  CR: 'Compliance Records',
  MR: 'Maintenance Reports',
  TL: 'Equipment Timeline',
  CH: 'Check Records',
  IC: 'Inspection Checklists',
  RA: 'Risk Assessments',
};

export const RIDE_DOC_TYPE_ICONS: Record<RideDocType, string> = {
  CR: '📋',
  MR: '🔧',
  TL: '📊',
  CH: '✅',
  IC: '📝',
  RA: '⚠️',
};

export const RIDE_DOC_GROUP_ORDER: RideDocType[] = ['CR', 'MR', 'TL', 'CH', 'IC', 'RA'];

export interface RideDocument {
  id: string;
  ride_id: string;
  ride_code: string;
  document_type: RideDocType;
  document_id: string;
  version: number;
  created_at: string;
  created_by: string;
  file_url: string;
  related_event_id: string | null;
  status: 'active' | 'superseded';
  title: string;
  metadata: Record<string, any>;
  archived_at: string | null;
  archived_by: string | null;
  archive_reason: string | null;
}

interface StoreRideDocumentParams {
  rideId: string;
  rideCode: string;
  documentType: RideDocType;
  documentId: string;
  fileUrl: string;
  title: string;
  relatedEventId?: string | null;
  metadata?: Record<string, any>;
}

/**
 * Store a generated PDF in the ride_documents register with automatic versioning.
 * Uses the upsert_ride_document RPC which handles:
 * - Marking existing active versions as superseded
 * - Incrementing version number
 * - Setting new version as active
 */
export async function storeRideDocument(params: StoreRideDocumentParams): Promise<string | null> {
  try {
    const { data, error } = await supabase.rpc('upsert_ride_document', {
      p_ride_id: params.rideId,
      p_ride_code: params.rideCode,
      p_document_type: params.documentType,
      p_document_id: params.documentId,
      p_file_url: params.fileUrl,
      p_title: params.title,
      p_related_event_id: params.relatedEventId || null,
      p_metadata: params.metadata || {},
    });

    if (error) {
      console.error('Failed to store ride document:', error);
      return null;
    }

    return data as string;
  } catch (err) {
    console.error('Error storing ride document:', err);
    return null;
  }
}

/**
 * Fetch ride documents for a specific ride, optionally filtered.
 */
export async function fetchRideDocuments(
  rideId: string,
  options: {
    includeArchived?: boolean;
    documentType?: RideDocType;
  } = {},
): Promise<RideDocument[]> {
  let query = supabase
    .from('ride_documents')
    .select('*')
    .eq('ride_id', rideId)
    .eq('status', 'active')
    .order('created_at', { ascending: false });

  if (!options.includeArchived) {
    query = query.is('archived_at', null);
  }

  if (options.documentType) {
    query = query.eq('document_type', options.documentType);
  }

  const { data, error } = await query;
  if (error) {
    console.error('Error fetching ride documents:', error);
    return [];
  }
  return (data || []) as RideDocument[];
}

/**
 * Fetch version history for a specific document_id.
 */
export async function fetchDocumentVersions(documentId: string): Promise<RideDocument[]> {
  const { data, error } = await supabase
    .from('ride_documents')
    .select('*')
    .eq('document_id', documentId)
    .order('version', { ascending: false });

  if (error) {
    console.error('Error fetching document versions:', error);
    return [];
  }
  return (data || []) as RideDocument[];
}

/**
 * Archive a ride document (soft-delete).
 */
export async function archiveRideDocument(
  id: string,
  userId: string,
  reason?: string,
): Promise<boolean> {
  const { error } = await supabase
    .from('ride_documents')
    .update({
      archived_at: new Date().toISOString(),
      archived_by: userId,
      archive_reason: reason || null,
    })
    .eq('id', id);

  if (error) {
    console.error('Error archiving ride document:', error);
    return false;
  }
  return true;
}

/**
 * Restore an archived ride document.
 */
export async function restoreRideDocument(id: string): Promise<boolean> {
  const { error } = await supabase
    .from('ride_documents')
    .update({
      archived_at: null,
      archived_by: null,
      archive_reason: null,
    })
    .eq('id', id);

  if (error) {
    console.error('Error restoring ride document:', error);
    return false;
  }
  return true;
}

/**
 * Helper to get ride_code for a ride. Falls back to first letters of ride name.
 */
export async function getRideCode(rideId: string): Promise<string> {
  const { data } = await supabase
    .from('rides')
    .select('ride_code, ride_name')
    .eq('id', rideId)
    .single();

  if (data?.ride_code) return data.ride_code;
  if (data?.ride_name) {
    return data.ride_name
      .split(' ')
      .map((w: string) => w[0])
      .join('')
      .toUpperCase()
      .slice(0, 4);
  }
  return 'XX';
}
