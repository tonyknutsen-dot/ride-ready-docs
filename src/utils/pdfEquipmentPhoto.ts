/**
 * Shared utility for fetching ride/equipment photos for PDF headers.
 * Reusable across all PDF generators (wind, checks, maintenance, risk, etc.)
 */
import { supabase } from '@/integrations/supabase/client';
import { blobToDataUrl, getImageDimensions, fitImage } from './pdfUtils';

export interface EquipmentPhotoResult {
  dataUrl: string;
  naturalW: number;
  naturalH: number;
}

/**
 * Fetches the equipment photo for a ride from documents storage.
 * Returns null if no photo is found or on error.
 */
export async function fetchEquipmentPhoto(rideId: string): Promise<EquipmentPhotoResult | null> {
  try {
    const { data: doc } = await supabase
      .from('documents')
      .select('file_path')
      .eq('ride_id', rideId)
      .eq('document_type', 'Equipment Photo')
      .order('uploaded_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (!doc?.file_path) return null;

    const { data: blob } = await supabase.storage
      .from('ride-documents')
      .download(doc.file_path);

    if (!blob) return null;

    const dataUrl = await blobToDataUrl(blob);
    const dims = await getImageDimensions(dataUrl);

    return { dataUrl, naturalW: dims.w, naturalH: dims.h };
  } catch {
    return null;
  }
}

/**
 * Draws the equipment photo in a PDF at specified position.
 * Returns the height consumed, or 0 if no photo.
 */
export function drawEquipmentPhotoInHeader(
  doc: any,
  photo: EquipmentPhotoResult,
  x: number,
  y: number,
  maxW = 28,
  maxH = 20,
): { w: number; h: number } {
  const fit = fitImage(photo.naturalW, photo.naturalH, maxW, maxH);
  try {
    doc.setDrawColor(226, 232, 240);
    doc.setLineWidth(0.3);
    doc.rect(x - 0.5, y - 0.5, fit.w + 1, fit.h + 1);
    doc.addImage(photo.dataUrl, 'JPEG', x, y, fit.w, fit.h);
  } catch { /* ignore */ }
  return fit;
}
