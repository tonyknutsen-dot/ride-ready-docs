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
}

export interface OfflineCheckResult {
  templateItemId: string;
  isChecked: boolean;
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

// Dexie database class
class OfflineDatabase extends Dexie {
  offlineChecks!: EntityTable<OfflineCheck, 'id'>;
  offlineDefects!: EntityTable<OfflineDefect, 'id'>;
  cachedRides!: EntityTable<CachedRide, 'id'>;
  cachedTemplates!: EntityTable<CachedTemplate, 'id'>;

  constructor() {
    super('RideReadyOfflineDB');
    
    this.version(1).stores({
      offlineChecks: '++id, localId, rideId, syncStatus, createdAt',
      offlineDefects: '++id, localId, rideId, checkLocalId, syncStatus',
      cachedRides: 'id, cachedAt',
      cachedTemplates: 'id, rideId, cachedAt'
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
