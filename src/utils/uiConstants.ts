/**
 * Shared UI constants for consistent sizing across the app.
 * 
 * All pages and components should reference these constants
 * to maintain visual consistency.
 */

/* ─── Button heights ─── */
export const BTN_HEIGHT_SM = 'h-8';          // Compact utility buttons (View, Download, filter chips)
export const BTN_HEIGHT_MD = 'h-10';         // Standard form buttons
export const BTN_HEIGHT_LG = 'h-11';         // Primary CTA buttons
export const BTN_HEIGHT_XL = 'min-h-[48px]'; // Large mobile tap targets (upload, submit)

/* ─── Icon sizes ─── */
export const ICON_SM = 'h-3.5 w-3.5';    // Inside compact buttons
export const ICON_MD = 'h-4 w-4';         // Standard inline icons
export const ICON_LG = 'h-5 w-5';         // Page header icons, nav icons

/* ─── Text sizes ─── */
export const TEXT_TITLE = 'text-2xl font-bold tracking-tight';
export const TEXT_SUBTITLE = 'text-sm text-muted-foreground';
export const TEXT_SECTION = 'text-[13px] font-bold uppercase tracking-[1px]';
export const TEXT_METADATA = 'text-[10px] text-muted-foreground';
export const TEXT_LABEL = 'text-xs font-bold uppercase tracking-wider text-foreground/70';
export const TEXT_BODY = 'text-sm';

/* ─── Row action spacing ─── */
export const ROW_ACTIONS_GAP = 'gap-1';
export const ROW_PADDING = 'p-3';

/* ─── Card / row patterns ─── */
export const CARD_RADIUS = 'rounded-xl';
export const CARD_BORDER = 'border border-border/60';
export const ROW_HOVER = 'hover:bg-accent/50 transition-colors';

/* ─── Register page layout constants ─── */
export const REGISTER_MAX_WIDTH = 'max-w-4xl';

/* ─── Export action order ─── */
// CSV first, then PDF — consistent across all registers
export const EXPORT_ORDER = ['csv', 'pdf'] as const;

/* ─── Viewer launch behaviour ─── */
// PDF → in-app PdfCanvasViewer
// Image → in-app ImageViewer/lightbox
// Other → window.open fallback
export type ViewerType = 'pdf' | 'image' | 'fallback';

export const getViewerType = (filePath: string): ViewerType => {
  const fp = filePath.toLowerCase();
  if (/\.pdf$/i.test(fp)) return 'pdf';
  if (/\.(jpg|jpeg|png|gif|webp|bmp|tiff?)$/i.test(fp)) return 'image';
  return 'fallback';
};

/* ─── Defect severity config (shared across DefectsList, DefectRegister, notifications) ─── */

export const DEFECT_SEVERITY_CONFIG = {
  stop_operation: {
    label: 'Stop Use',
    badgeClass: 'bg-destructive text-destructive-foreground',
    operationalClass: 'bg-destructive/10 text-destructive',
    operational: 'Do not operate',
    operationalIcon: '⛔',
    sort: 0,
  },
  urgent: {
    label: 'Important',
    badgeClass: 'bg-orange-500 text-white dark:bg-orange-600',
    operationalClass: 'bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-300',
    operational: 'Repair required',
    operationalIcon: '🔧',
    sort: 1,
  },
  non_urgent: {
    label: 'Low',
    badgeClass: 'bg-yellow-500 text-white dark:bg-yellow-600',
    operationalClass: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/40 dark:text-yellow-300',
    operational: 'Monitor',
    operationalIcon: '👁',
    sort: 2,
  },
} as const;

export type DefectSeverity = keyof typeof DEFECT_SEVERITY_CONFIG;
