/**
 * Service for creating and managing immutable Inspection Records.
 * Each completed check creates a permanent, versioned record.
 */
import { supabase } from '@/integrations/supabase/client';

export interface InspectionRecord {
  id: string;
  check_id: string;
  ride_id: string;
  user_id: string;
  version: number;
  amended_from_id: string | null;
  amendment_reason: string | null;
  amended_by: string | null;
  superseded_by_id: string | null;
  inspector_name: string;
  completed_at: string;
  check_date: string;
  check_frequency: string;
  template_id: string;
  template_name: string | null;
  overall_result: string;
  item_results: ItemResultSnapshot[];
  notes: string | null;
  weather_conditions: string | null;
  location: string | null;
  environment_notes: string | null;
  compliance_officer: string | null;
  signature_data: string | null;
  defect_ids: string[];
  photo_paths: string[];
  pdf_file_path: string | null;
  document_id: string | null;
  is_locked: boolean;
  created_at: string;
  source_check_only?: boolean;
}

/** Check if a record is still within its 24-hour amendment window */
export function isWithinAmendmentWindow(record: InspectionRecord): boolean {
  const completedAt = new Date(record.completed_at).getTime();
  const now = Date.now();
  const twentyFourHours = 24 * 60 * 60 * 1000;
  return now <= completedAt + twentyFourHours;
}

export interface ItemResultSnapshot {
  template_item_id: string;
  check_item_text: string;
  category: string | null;
  result: 'pass' | 'fail' | 'na';
  notes: string | null;
  is_required: boolean;
}

interface CreateInspectionRecordParams {
  checkId: string;
  rideId: string;
  userId: string;
  inspectorName: string;
  checkDate: string;
  checkFrequency: string;
  templateId: string;
  templateName: string;
  overallResult: string;
  itemResults: ItemResultSnapshot[];
  notes?: string | null;
  weatherConditions?: string | null;
  location?: string | null;
  environmentNotes?: string | null;
  complianceOfficer?: string | null;
  signatureData?: string | null;
  defectIds?: string[];
  photoPaths?: string[];
}

/**
 * Create a new v1 inspection record from a completed check.
 */
export async function createInspectionRecord(
  params: CreateInspectionRecordParams
): Promise<string | null> {
  try {
    const { data, error } = await supabase
      .from('inspection_records')
      .insert({
        check_id: params.checkId,
        ride_id: params.rideId,
        user_id: params.userId,
        version: 1,
        inspector_name: params.inspectorName,
        check_date: params.checkDate,
        check_frequency: params.checkFrequency,
        template_id: params.templateId,
        template_name: params.templateName,
        overall_result: params.overallResult,
        item_results: params.itemResults as any,
        notes: params.notes || null,
        weather_conditions: params.weatherConditions || null,
        location: params.location || null,
        environment_notes: params.environmentNotes || null,
        compliance_officer: params.complianceOfficer || null,
        signature_data: params.signatureData || null,
        defect_ids: params.defectIds || [],
        photo_paths: params.photoPaths || [],
      })
      .select('id')
      .single();

    if (error) {
      console.error('Failed to create inspection record:', error);
      return null;
    }

    return data.id;
  } catch (err) {
    console.error('Error creating inspection record:', err);
    return null;
  }
}

/**
 * Look up the current record for a completed check.
 * Used as a post-save recovery path when the check row exists but the UI did
 * not receive the record-create response cleanly.
 */
export async function findInspectionRecordIdByCheckId(checkId: string): Promise<string | null> {
  const { data, error } = await supabase
    .from('inspection_records')
    .select('id')
    .eq('check_id', checkId)
    .order('version', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    console.error('Failed to look up inspection record by check id:', error);
    return null;
  }

  return data?.id ?? null;
}

/**
 * Update the PDF reference on a newly created inspection record.
 * Must be called within 60 seconds of creation.
 */
export async function updateInspectionRecordPdf(
  recordId: string,
  pdfFilePath: string,
  documentId: string
): Promise<boolean> {
  const { error } = await supabase
    .from('inspection_records')
    .update({ pdf_file_path: pdfFilePath, document_id: documentId })
    .eq('id', recordId);

  if (error) {
    console.error('Failed to update inspection record PDF:', error);
    return false;
  }
  return true;
}

/**
 * Create an amendment (new version) of an existing inspection record.
 * Only Controllers should call this.
 */
export async function createAmendment(
  originalRecordId: string,
  amendedBy: string,
  amendmentReason: string,
  updates: Partial<Pick<CreateInspectionRecordParams, 
    'inspectorName' | 'notes' | 'overallResult' | 'itemResults' | 
    'weatherConditions' | 'location' | 'environmentNotes' | 'complianceOfficer'
  >>
): Promise<string | null> {
  try {
    // Fetch the original record
    const { data: original, error: fetchError } = await supabase
      .from('inspection_records')
      .select('*')
      .eq('id', originalRecordId)
      .single();

    if (fetchError || !original) {
      console.error('Failed to fetch original record:', fetchError);
      return null;
    }

    // Get the max version for this check
    const { data: versions, error: versionError } = await supabase
      .from('inspection_records')
      .select('version')
      .eq('check_id', original.check_id)
      .order('version', { ascending: false })
      .limit(1);

    if (versionError) {
      console.error('Failed to get version:', versionError);
      return null;
    }

    const nextVersion = (versions?.[0]?.version || 1) + 1;

    // Enforce 24-hour amendment window
    const completedAt = new Date(original.completed_at).getTime();
    const now = Date.now();
    if (now > completedAt + 24 * 60 * 60 * 1000) {
      console.error('Amendment window expired (24 hours)');
      return null;
    }

    const { data: newRecord, error: insertError } = await supabase
      .from('inspection_records')
      .insert({
        check_id: original.check_id,
        ride_id: original.ride_id,
        user_id: original.user_id,
        version: nextVersion,
        amended_from_id: originalRecordId,
        amendment_reason: amendmentReason,
        amended_by: amendedBy,
        inspector_name: updates.inspectorName || original.inspector_name,
        check_date: original.check_date,
        check_frequency: original.check_frequency,
        template_id: original.template_id,
        template_name: original.template_name,
        overall_result: updates.overallResult || original.overall_result,
        item_results: (updates.itemResults || original.item_results) as any,
        notes: updates.notes !== undefined ? updates.notes : original.notes,
        weather_conditions: updates.weatherConditions !== undefined ? updates.weatherConditions : original.weather_conditions,
        location: updates.location !== undefined ? updates.location : original.location,
        environment_notes: updates.environmentNotes !== undefined ? updates.environmentNotes : original.environment_notes,
        compliance_officer: updates.complianceOfficer !== undefined ? updates.complianceOfficer : original.compliance_officer,
        signature_data: original.signature_data,
        defect_ids: original.defect_ids || [],
        photo_paths: original.photo_paths || [],
      } as any)
      .select('id')
      .single();

    if (insertError) {
      console.error('Failed to create amendment:', insertError);
      return null;
    }

    // Set superseded_by_id on the original record
    await supabase
      .from('inspection_records')
      .update({ superseded_by_id: newRecord.id } as any)
      .eq('id', originalRecordId);

    return newRecord.id;
  } catch (err) {
    console.error('Error creating amendment:', err);
    return null;
  }
}

export interface FetchRecordsFilters {
  frequency?: string;
  allVersions?: boolean;
  limit?: number;
  offset?: number;
  dateFrom?: string;
  dateTo?: string;
  result?: string;
  inspectorName?: string;
  hasDefects?: boolean;
  issueOnly?: boolean;
  searchQuery?: string;
}

export interface PaginatedRecords {
  records: InspectionRecord[];
  totalCount: number;
  hasMore: boolean;
}

const CHECKS_TABLE_FREQUENCIES = new Set(['daily', 'preopening', 'weekly', 'monthly', 'yearly']);

/**
 * Fetch inspection records for a ride with server-side pagination and filtering.
 */
export async function fetchInspectionRecords(
  rideId: string,
  options: FetchRecordsFilters = {}
): Promise<InspectionRecord[]> {
  const result = await fetchInspectionRecordsPaginated(rideId, options);
  return result.records;
}

/**
 * Fetch inspection records with pagination metadata.
 */
export async function fetchInspectionRecordsPaginated(
  rideId: string,
  options: FetchRecordsFilters = {}
): Promise<PaginatedRecords> {
  const limit = options.limit || 1000;
  const offset = options.offset || 0;

  let query = supabase
    .from('inspection_records')
    .select('*', { count: 'exact' })
    .eq('ride_id', rideId)
    .order('completed_at', { ascending: false })
    .order('created_at', { ascending: false });

  if (options.frequency && options.frequency !== 'all') {
    if (options.frequency === 'daily') {
      query = query.in('check_frequency', ['daily', 'preopening']);
    } else {
      query = query.eq('check_frequency', options.frequency);
    }
  }

  if (options.dateFrom) {
    query = query.gte('check_date', options.dateFrom);
  }
  if (options.dateTo) {
    query = query.lte('check_date', options.dateTo);
  }

  if (options.result && options.result !== 'all') {
    if (options.result === 'passed') {
      query = query.in('overall_result', ['passed', 'completed']);
    } else if (options.result === 'na') {
      query = query.in('overall_result', ['na', 'n/a', 'not_applicable']);
    } else {
      query = query.eq('overall_result', options.result);
    }
  }

  if (options.inspectorName) {
    query = query.ilike('inspector_name', `%${options.inspectorName}%`);
  }

  if (options.issueOnly) {
    query = query.or('overall_result.eq.failed,defect_ids.neq.{}');
  } else if (options.hasDefects === true) {
    query = query.not('defect_ids', 'eq', '{}');
  } else if (options.hasDefects === false) {
    query = query.or('defect_ids.eq.{},defect_ids.is.null');
  }

  if (options.searchQuery) {
    const escaped = options.searchQuery.replace(/[%_]/g, '\\$&');
    query = query.or(`inspector_name.ilike.%${escaped}%,location.ilike.%${escaped}%,notes.ilike.%${escaped}%,environment_notes.ilike.%${escaped}%,template_name.ilike.%${escaped}%`);
  }

  // Apply range for pagination
  query = query.range(offset, offset + limit - 1);

  const { data, error, count } = await query;

  if (error) {
    console.error('Error fetching inspection records:', error);
    return { records: [], totalCount: 0, hasMore: false };
  }

  let records = (data || []) as unknown as InspectionRecord[];
  let totalCount = count || 0;

  const includeSourceChecks = !options.frequency || options.frequency === 'all' || CHECKS_TABLE_FREQUENCIES.has(options.frequency);

  let checksQuery = supabase
    .from('checks')
    .select('*')
    .eq('ride_id', rideId)
    .order('created_at', { ascending: false });

  if (options.frequency && options.frequency !== 'all') {
    checksQuery = options.frequency === 'daily'
      ? checksQuery.in('check_frequency', ['daily', 'preopening'])
      : checksQuery.eq('check_frequency', options.frequency);
  }
  if (options.dateFrom) checksQuery = checksQuery.gte('check_date', options.dateFrom);
  if (options.dateTo) checksQuery = checksQuery.lte('check_date', options.dateTo);
  if (options.inspectorName) checksQuery = checksQuery.ilike('inspector_name', `%${options.inspectorName}%`);

  const { data: checksData, error: checksError } = includeSourceChecks
    ? await checksQuery.limit(limit)
    : { data: null, error: null };
  if (!checksError && checksData?.length) {
    const sourceChecks = checksData as Array<Record<string, unknown>>;
    const checkIds = sourceChecks.map((check) => String(check.id));
    const { data: existingRecords } = await supabase
      .from('inspection_records')
      .select('check_id')
      .in('check_id', checkIds);
    const recordedCheckIds = new Set((existingRecords || []).map((r) => r.check_id));
    const missingRecordChecks = sourceChecks.filter((check) => !recordedCheckIds.has(String(check.id)));
    const fallbackRecords = missingRecordChecks.map((check) => ({
        id: `check-${String(check.id)}`,
        check_id: String(check.id),
        ride_id: String(check.ride_id),
        user_id: String(check.user_id),
        version: 1,
        amended_from_id: null,
        amendment_reason: null,
        amended_by: null,
        superseded_by_id: null,
        inspector_name: String(check.inspector_name || 'Inspector'),
        completed_at: String(check.created_at),
        check_date: String(check.check_date),
        check_frequency: String(check.check_frequency),
        template_id: String(check.template_id),
        template_name: null,
        overall_result: String(check.status),
        item_results: [],
        notes: check.notes ? String(check.notes) : null,
        weather_conditions: check.weather_conditions ? String(check.weather_conditions) : null,
        location: check.location ? String(check.location) : null,
        environment_notes: check.environment_notes ? String(check.environment_notes) : null,
        compliance_officer: check.compliance_officer ? String(check.compliance_officer) : null,
        signature_data: check.signature_data ? String(check.signature_data) : null,
        defect_ids: [],
        photo_paths: [],
        pdf_file_path: null,
        document_id: null,
        is_locked: true,
        created_at: String(check.created_at),
        source_check_only: true,
      } as InspectionRecord));

    totalCount += Math.max(0, fallbackRecords.length - records.filter(r => fallbackRecords.some(f => f.check_id === r.check_id)).length);
    records = [
      ...fallbackRecords,
      ...records,
    ].sort((a, b) => new Date(b.completed_at).getTime() - new Date(a.completed_at).getTime());
  }

  // Filter by defects client-side (can't do array length check in PostgREST easily)
  if (includeSourceChecks && options.issueOnly) {
    records = records.filter(r => r.overall_result === 'failed' || (r.defect_ids?.length || 0) > 0);
  } else if (includeSourceChecks && options.hasDefects === true) {
    records = records.filter(r => (r.defect_ids?.length || 0) > 0);
  } else if (includeSourceChecks && options.hasDefects === false) {
    records = records.filter(r => (r.defect_ids?.length || 0) === 0);
  }

  // Search fallback for generated source-check rows.
  if (options.searchQuery) {
    const q = options.searchQuery.toLowerCase();
    records = records.filter(r =>
      r.inspector_name.toLowerCase().includes(q) ||
      (r.location?.toLowerCase().includes(q)) ||
      (r.notes?.toLowerCase().includes(q)) ||
      (r.environment_notes?.toLowerCase().includes(q)) ||
      (r.template_name?.toLowerCase().includes(q))
    );
  }

  // If not showing all versions, only return the latest version per check
  if (!options.allVersions) {
    const latestByCheck = new Map<string, InspectionRecord>();
    for (const record of records) {
      const existing = latestByCheck.get(record.check_id);
      if (!existing || record.version > existing.version) {
        latestByCheck.set(record.check_id, record);
      }
    }
    records = Array.from(latestByCheck.values()).sort(
      (a, b) => new Date(b.completed_at).getTime() - new Date(a.completed_at).getTime()
    );
  }

  return {
    records,
    totalCount,
    hasMore: offset + limit < totalCount,
  };
}

/**
 * Fetch all versions of a specific inspection record chain.
 */
export async function fetchRecordVersions(checkId: string): Promise<InspectionRecord[]> {
  const { data, error } = await supabase
    .from('inspection_records')
    .select('*')
    .eq('check_id', checkId)
    .order('version', { ascending: true });

  if (error) {
    console.error('Error fetching record versions:', error);
    return [];
  }

  return (data || []) as unknown as InspectionRecord[];
}
