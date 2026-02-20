import { offlineDb, type CachedPdf } from './offlineDb';

const MAX_CACHED_PDFS = 30;

/**
 * Get a cached PDF by document_id.
 * Returns null if not cached.
 */
export async function getCachedPdf(documentId: string): Promise<CachedPdf | null> {
  try {
    return (await offlineDb.cachedPdfs.get(documentId)) || null;
  } catch {
    return null;
  }
}

/**
 * Store a PDF blob in the cache, keyed by document_id + version.
 * Evicts oldest entries if cache exceeds MAX_CACHED_PDFS.
 */
export async function cachePdf(
  documentId: string,
  version: number,
  fileUrl: string,
  blob: Blob,
  title: string,
): Promise<void> {
  try {
    await offlineDb.cachedPdfs.put({
      documentId,
      version,
      fileUrl,
      blob,
      title,
      cachedAt: new Date().toISOString(),
    });

    // Evict oldest if over limit
    const count = await offlineDb.cachedPdfs.count();
    if (count > MAX_CACHED_PDFS) {
      const oldest = await offlineDb.cachedPdfs
        .orderBy('cachedAt')
        .limit(count - MAX_CACHED_PDFS)
        .toArray();
      await offlineDb.cachedPdfs.bulkDelete(oldest.map(p => p.documentId));
    }
  } catch (err) {
    console.warn('[pdfCache] Failed to cache PDF:', err);
  }
}

/**
 * Create an object URL from a cached PDF blob.
 * Caller is responsible for revoking the URL when done.
 */
export function createCachedPdfUrl(cached: CachedPdf): string {
  return URL.createObjectURL(cached.blob);
}

/**
 * Fetch the PDF blob from Supabase storage via a signed URL.
 * Returns the blob or null on failure.
 */
export async function fetchPdfBlob(signedUrl: string): Promise<Blob | null> {
  try {
    const res = await fetch(signedUrl);
    if (!res.ok) return null;
    return await res.blob();
  } catch {
    return null;
  }
}
