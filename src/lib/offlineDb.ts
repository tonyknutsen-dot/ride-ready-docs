import Dexie, { type EntityTable } from 'dexie';

// Types for offline-queued checks
export interface OfflineCheck {
  id?: number;
  localId: string; // UUID generated locally
  rideId: string;
  templateId: string;
  inspectorName: string;
  checkDate: string;
  checkFrequency: string;
  status: string;
  notes?: string;
  weatherConditions?: string;
  location?: string;
  signatureData?: string;
  complianceOfficer?: string;
  environmentNotes?: string;
  results: OfflineCheckResult[];
  createdAt: string;
  syncStatus: 'pending' | 'syncing' | 'synced' | 'failed';
  syncError?: string;
  syncAttempts: number;
  lastSyncAttempt?: string;
  // GPS coordinate fields for deferred address resolution
  rawLatitude?: number;
  rawLongitude?: number;
  needsAddressResolution?: boolean;
}

export type CheckItemResult = 'pass' | 'fail' | 'na';

export interface OfflineCheckResult {
  templateItemId: string;
  isChecked: boolean; // Keep for backward compatibility
  result: CheckItemResult; // New pass/fail/na field
  notes?: string;
}

export interface OfflineDefect {
  id?: number;
  localId: string;
  rideId: string;
  checkLocalId?: string; // Links to offline check
  description: string;
  severity: 'urgent' | 'non_urgent' | 'safety_critical';
  locationOnRide?: string;
  photoPaths?: string[];
  createdAt: string;
  syncStatus: 'pending' | 'syncing' | 'synced' | 'failed';
  syncError?: string;
  syncAttempts: number;
}

// Cached data for offline use
export interface CachedRide {
  id: string;
  rideName: string;
  categoryId: string;
  manufacturer?: string;
  serialNumber?: string;
  cachedAt: string;
}

export interface CachedTemplate {
  id: string;
  rideId: string;
  templateName: string;
  checkFrequency: string;
  isActive: boolean;
  items: CachedTemplateItem[];
  cachedAt: string;
}

export interface CachedTemplateItem {
  id: string;
  checkItemText: string;
  category?: string;
  isRequired: boolean;
  sortOrder: number;
}

// Cached location for offline address lookup
export interface CachedLocation {
  id?: number;
  latitude: number;
  longitude: number;
  address: string;
  usageCount: number;
  lastUsed: string;
  cachedAt: string;
}

// Offline compliance completion queued for sync
export interface OfflineComplianceCompletion {
  id?: number;
  localId: string;
  eventId: string;
  eventName: string;
  eventCategory: string;
  eventType?: string;
  rideId: string | null;
  rideName: string;
  dueDate: string;
  completionDate: string;
  notes?: string;
  inspectorCompany?: string;
  certificateReference?: string;
  isRecurring: boolean;
  recurrenceRule?: string | null;
  // Evidence file blobs stored locally for upload on sync
  evidenceBlobs: { name: string; type: string; data: ArrayBuffer }[];
  createdAt: string;
  syncStatus: 'pending' | 'syncing' | 'synced' | 'failed';
  syncError?: string;
  syncAttempts: number;
  lastSyncAttempt?: string;
}

// Cached PDF for offline document viewing
export interface CachedPdf {
  documentId: string;
  version: number;
  fileUrl: string;
  blob: Blob;
  title: string;
  cachedAt: string;
}

// Dexie database class
class OfflineDatabase extends Dexie {
  offlineChecks!: EntityTable<OfflineCheck, 'id'>;
  offlineDefects!: EntityTable<OfflineDefect, 'id'>;
  cachedRides!: EntityTable<CachedRide, 'id'>;
  cachedTemplates!: EntityTable<CachedTemplate, 'id'>;
  cachedLocations!: EntityTable<CachedLocation, 'id'>;
  cachedPdfs!: EntityTable<CachedPdf, 'documentId'>;
  offlineComplianceCompletions!: EntityTable<OfflineComplianceCompletion, 'id'>;

  constructor() {
    super('RideReadyOfflineDB');
    
    this.version(1).stores({
      offlineChecks: '++id, localId, rideId, syncStatus, createdAt',
      offlineDefects: '++id, localId, rideId, checkLocalId, syncStatus',
      cachedRides: 'id, cachedAt',
      cachedTemplates: 'id, rideId, cachedAt'
    });

    // Version 2: Add GPS coordinate fields for deferred address resolution
    this.version(2).stores({
      offlineChecks: '++id, localId, rideId, syncStatus, createdAt, needsAddressResolution',
      offlineDefects: '++id, localId, rideId, checkLocalId, syncStatus',
      cachedRides: 'id, cachedAt',
      cachedTemplates: 'id, rideId, cachedAt'
    });

    // Version 3: Add cached locations for offline address lookup
    this.version(3).stores({
      offlineChecks: '++id, localId, rideId, syncStatus, createdAt, needsAddressResolution',
      offlineDefects: '++id, localId, rideId, checkLocalId, syncStatus',
      cachedRides: 'id, cachedAt',
      cachedTemplates: 'id, rideId, cachedAt',
      cachedLocations: '++id, latitude, longitude, lastUsed'
    });

    // Version 4: Add cached PDFs for offline document viewing
    this.version(4).stores({
      offlineChecks: '++id, localId, rideId, syncStatus, createdAt, needsAddressResolution',
      offlineDefects: '++id, localId, rideId, checkLocalId, syncStatus',
      cachedRides: 'id, cachedAt',
      cachedTemplates: 'id, rideId, cachedAt',
      cachedLocations: '++id, latitude, longitude, lastUsed',
      cachedPdfs: 'documentId, version, cachedAt'
    });

    // Version 5: Add offline compliance completions
    this.version(5).stores({
      offlineChecks: '++id, localId, rideId, syncStatus, createdAt, needsAddressResolution',
      offlineDefects: '++id, localId, rideId, checkLocalId, syncStatus',
      cachedRides: 'id, cachedAt',
      cachedTemplates: 'id, rideId, cachedAt',
      cachedLocations: '++id, latitude, longitude, lastUsed',
      cachedPdfs: 'documentId, version, cachedAt',
      offlineComplianceCompletions: '++id, localId, eventId, syncStatus, createdAt'
    });
  }
}

export const offlineDb = new OfflineDatabase();

// Helper functions
export async function getPendingChecks(): Promise<OfflineCheck[]> {
  return offlineDb.offlineChecks
    .where('syncStatus')
    .anyOf(['pending', 'failed'])
    .toArray();
}

export async function getPendingDefects(): Promise<OfflineDefect[]> {
  return offlineDb.offlineDefects
    .where('syncStatus')
    .anyOf(['pending', 'failed'])
    .toArray();
}

export async function markCheckSynced(localId: string, serverCheckId?: string): Promise<void> {
  await offlineDb.offlineChecks
    .where('localId')
    .equals(localId)
    .modify({ syncStatus: 'synced' });
}

export async function markCheckFailed(localId: string, error: string): Promise<void> {
  const check = await offlineDb.offlineChecks.where('localId').equals(localId).first();
  if (check) {
    await offlineDb.offlineChecks.update(check.id!, {
      syncStatus: 'failed',
      syncError: error,
      syncAttempts: (check.syncAttempts || 0) + 1,
      lastSyncAttempt: new Date().toISOString()
    });
  }
}

export async function clearSyncedData(olderThanDays = 7): Promise<void> {
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - olderThanDays);
  const cutoffStr = cutoff.toISOString();

  await offlineDb.offlineChecks
    .where('syncStatus')
    .equals('synced')
    .filter(c => c.createdAt < cutoffStr)
    .delete();

  await offlineDb.offlineDefects
    .where('syncStatus')
    .equals('synced')
    .filter(d => d.createdAt < cutoffStr)
    .delete();
}

export async function cacheRidesForOffline(rides: CachedRide[]): Promise<void> {
  await offlineDb.cachedRides.bulkPut(rides);
}

export async function cacheTemplatesForOffline(templates: CachedTemplate[]): Promise<void> {
  await offlineDb.cachedTemplates.bulkPut(templates);
}

export async function getCachedRides(): Promise<CachedRide[]> {
  return offlineDb.cachedRides.toArray();
}

export async function getCachedTemplatesForRide(rideId: string): Promise<CachedTemplate[]> {
  return offlineDb.cachedTemplates.where('rideId').equals(rideId).toArray();
}

// Location caching helpers

// Calculate distance between two coordinates in meters (Haversine formula)
function calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371000; // Earth's radius in meters
  const φ1 = (lat1 * Math.PI) / 180;
  const φ2 = (lat2 * Math.PI) / 180;
  const Δφ = ((lat2 - lat1) * Math.PI) / 180;
  const Δλ = ((lon2 - lon1) * Math.PI) / 180;

  const a = Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
            Math.cos(φ1) * Math.cos(φ2) *
            Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return R * c;
}

// Find a cached address within proximity (default 150 meters)
export async function findCachedAddress(lat: number, lon: number, radiusMeters = 150): Promise<CachedLocation | null> {
  const allLocations = await offlineDb.cachedLocations.toArray();
  
  for (const loc of allLocations) {
    const distance = calculateDistance(lat, lon, loc.latitude, loc.longitude);
    if (distance <= radiusMeters) {
      // Update usage stats
      await offlineDb.cachedLocations.update(loc.id!, {
        usageCount: loc.usageCount + 1,
        lastUsed: new Date().toISOString()
      });
      return loc;
    }
  }
  
  return null;
}

// Cache a new location address
export async function cacheLocationAddress(lat: number, lon: number, address: string): Promise<void> {
  // Check if we already have this location cached (within 50m to avoid duplicates)
  const existing = await findCachedAddress(lat, lon, 50);
  if (existing) {
    // Update existing cache entry with potentially better address
    await offlineDb.cachedLocations.update(existing.id!, {
      address,
      lastUsed: new Date().toISOString()
    });
    return;
  }

  // Add new cached location
  await offlineDb.cachedLocations.add({
    latitude: lat,
    longitude: lon,
    address,
    usageCount: 1,
    lastUsed: new Date().toISOString(),
    cachedAt: new Date().toISOString()
  });

  // Limit cache size - keep only the 50 most recently used locations
  const allLocations = await offlineDb.cachedLocations.orderBy('lastUsed').toArray();
  if (allLocations.length > 50) {
    const toDelete = allLocations.slice(0, allLocations.length - 50);
    await offlineDb.cachedLocations.bulkDelete(toDelete.map(l => l.id!));
  }
}

// Get all cached locations (for UI display if needed)
export async function getCachedLocations(): Promise<CachedLocation[]> {
  return offlineDb.cachedLocations.orderBy('usageCount').reverse().toArray();
}

// ── Offline compliance completion helpers ──

export async function addOfflineComplianceCompletion(completion: Omit<OfflineComplianceCompletion, 'id'>): Promise<void> {
  await offlineDb.offlineComplianceCompletions.add(completion as OfflineComplianceCompletion);
}

export async function getPendingComplianceCompletions(): Promise<OfflineComplianceCompletion[]> {
  return offlineDb.offlineComplianceCompletions
    .where('syncStatus')
    .anyOf(['pending', 'failed'])
    .toArray();
}

export async function getAllOfflineComplianceCompletions(): Promise<OfflineComplianceCompletion[]> {
  return offlineDb.offlineComplianceCompletions.toArray();
}
