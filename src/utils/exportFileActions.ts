import { supabase } from '@/integrations/supabase/client';

const STORAGE_BUCKET = 'ride-documents';
const PDF_SIGNATURE = '%PDF-';

export function isPdfByMeta(fileName?: string, mimeType?: string | null): boolean {
  if (mimeType?.toLowerCase() === 'application/pdf') return true;
  return (fileName || '').toLowerCase().endsWith('.pdf');
}

export function isCsvByMeta(fileName?: string, mimeType?: string | null): boolean {
  if (mimeType?.toLowerCase().includes('csv')) return true;
  return (fileName || '').toLowerCase().endsWith('.csv');
}

export function downloadBlob(blob: Blob, fileName: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export function revokeObjectUrl(url?: string | null) {
  if (url && url.startsWith('blob:')) {
    URL.revokeObjectURL(url);
  }
}

export async function getStorageFileBlob(filePath: string): Promise<Blob> {
  if (/^https?:\/\//i.test(filePath)) {
    const response = await fetch(filePath);
    if (!response.ok) throw new Error(`Failed to fetch file (${response.status})`);
    return response.blob();
  }

  const { data, error } = await supabase.storage.from(STORAGE_BUCKET).download(filePath);
  if (error || !data) throw error || new Error('Could not download file from storage');
  return data;
}

export async function getSignedStorageUrl(filePath: string, expiresInSeconds = 3600): Promise<string | null> {
  if (/^https?:\/\//i.test(filePath)) return filePath;

  const { data, error } = await supabase.storage
    .from(STORAGE_BUCKET)
    .createSignedUrl(filePath, expiresInSeconds);

  if (error || !data?.signedUrl) return null;
  return data.signedUrl;
}

export async function isValidPdfBlob(blob: Blob): Promise<boolean> {
  if (blob.size < 5) return false;
  const signature = await blob.slice(0, 5).text();
  return signature === PDF_SIGNATURE;
}

export async function createPdfViewerUrlFromBlob(blob: Blob): Promise<{ url: string; signature: string; validPdf: boolean; normalizedBlob: Blob }> {
  const signature = await blob.slice(0, 8).text();
  const validPdf = signature.startsWith(PDF_SIGNATURE);
  const normalizedBlob = blob.type === 'application/pdf'
    ? blob
    : new Blob([blob], { type: 'application/pdf' });

  return {
    url: URL.createObjectURL(normalizedBlob),
    signature,
    validPdf,
    normalizedBlob,
  };
}

export async function createPdfViewerUrlFromStorage(filePath: string): Promise<{
  url: string;
  signature: string;
  validPdf: boolean;
  blobSize: number;
  blobType: string;
  normalizedBlobType: string;
}> {
  const blob = await getStorageFileBlob(filePath);
  const prepared = await createPdfViewerUrlFromBlob(blob);

  return {
    url: prepared.url,
    signature: prepared.signature,
    validPdf: prepared.validPdf,
    blobSize: blob.size,
    blobType: blob.type || '(empty)',
    normalizedBlobType: prepared.normalizedBlob.type,
  };
}

export function isLikelyMobileOrTablet(): boolean {
  const coarsePointer = typeof window !== 'undefined' && window.matchMedia?.('(pointer: coarse)').matches;
  const mobileUserAgent = typeof navigator !== 'undefined' && /android|iphone|ipad|ipod|mobile|tablet/i.test(navigator.userAgent);
  return Boolean(coarsePointer || mobileUserAgent);
}

export async function shareBlobOrFallback(blob: Blob, fileName: string): Promise<'shared' | 'downloaded' | 'cancelled'> {
  const canUseNativeShare = typeof navigator !== 'undefined' && typeof navigator.share === 'function';
  const isMobile = isLikelyMobileOrTablet();

  if (canUseNativeShare && isMobile) {
    try {
      const file = new File([blob], fileName, { type: blob.type || 'application/octet-stream' });
      const canShareFiles = typeof navigator.canShare !== 'function' || navigator.canShare({ files: [file] });
      if (canShareFiles) {
        await navigator.share({ files: [file], title: fileName });
        return 'shared';
      }
    } catch (error: any) {
      if (error?.name === 'AbortError') return 'cancelled';
    }
  }

  downloadBlob(blob, fileName);
  return 'downloaded';
}

export async function shareStoredFileOrFallback(filePath: string, fileName: string): Promise<'shared' | 'copied' | 'downloaded' | 'cancelled'> {
  const blob = await getStorageFileBlob(filePath);
  const canUseNativeShare = typeof navigator !== 'undefined' && typeof navigator.share === 'function';
  const isMobile = isLikelyMobileOrTablet();

  if (canUseNativeShare && isMobile) {
    try {
      const file = new File([blob], fileName, { type: blob.type || 'application/octet-stream' });
      const canShareFiles = typeof navigator.canShare !== 'function' || navigator.canShare({ files: [file] });
      if (canShareFiles) {
        await navigator.share({ files: [file], title: fileName });
        return 'shared';
      }
    } catch (error: any) {
      if (error?.name === 'AbortError') return 'cancelled';
    }
  }

  const signedUrl = await getSignedStorageUrl(filePath);
  if (signedUrl && navigator.clipboard?.writeText) {
    try {
      await navigator.clipboard.writeText(signedUrl);
      return 'copied';
    } catch {
      // Clipboard can fail in insecure context; fall through to download.
    }
  }

  downloadBlob(blob, fileName);
  return 'downloaded';
}

