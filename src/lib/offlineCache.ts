import { offlineDb } from './offlineDb';

/**
 * Generic offline cache for API responses.
 * Stores arbitrary JSON data keyed by a string identifier.
 */

export async function setCache(key: string, data: unknown): Promise<void> {
  const now = new Date().toISOString();
  await offlineDb.cacheStore.put({
    key,
    dataJson: JSON.stringify(data),
    updatedAt: now,
  });
}

export async function getCache<T = unknown>(key: string): Promise<{ data: T; updatedAt: string } | null> {
  const row = await offlineDb.cacheStore.get(key);
  if (!row) return null;
  try {
    return { data: JSON.parse(row.dataJson) as T, updatedAt: row.updatedAt };
  } catch {
    return null;
  }
}

export async function clearCache(key: string): Promise<void> {
  await offlineDb.cacheStore.delete(key);
}

export async function clearAllCache(): Promise<void> {
  await offlineDb.cacheStore.clear();
}

/** Get the most recent updatedAt across all cache entries */
export async function getLastSyncTime(): Promise<string | null> {
  const all = await offlineDb.cacheStore.orderBy('updatedAt').reverse().first();
  return all?.updatedAt ?? null;
}
