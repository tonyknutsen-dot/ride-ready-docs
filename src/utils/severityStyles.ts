/**
 * APP-WIDE SEVERITY COLOUR POLICY
 * ================================
 * This is the SINGLE SOURCE OF TRUTH for severity styling across the entire app.
 *
 * TIER 1 — CRITICAL (Red / Destructive)
 *   Safety-critical. Equipment must not operate.
 *   Stop Use defects, critical unresolved defects,
 *   failed checks with linked defects, pressure out of range.
 *
 * TIER 2 — WARNING (Amber)
 *   Requires attention but not a safety emergency.
 *   Open defects (non-critical), overdue inspections,
 *   expired/expiring documents, missed checks, warnings.
 *
 * TIER 3 — INFO (Blue / Primary)
 *   Standard actions, review states, operational items.
 *   Upcoming inspections, available checks, due-soon items.
 *
 * TIER 4 — NEUTRAL (Grey / Muted)
 *   History, read items, inactive/closed/archived, metadata.
 *   Maintenance logged, documents sent, resolved defects.
 *
 * RULES:
 *   - Red is reserved for the HIGHEST severity only. Do not overuse.
 *   - Wording and colour must match the actual severity level.
 *   - All colours use semantic CSS variables (no hardcoded hex/rgb).
 */

export type SeverityTier = 'critical' | 'warning' | 'info' | 'neutral';

/* ── Strip (left-edge accent bar) ── */

export const SEVERITY_STRIP: Record<SeverityTier, string> = {
  critical: 'bg-destructive',
  warning:  'bg-warning',
  info:     'bg-info',
  neutral:  'bg-border',
};

/* ── Icon container background ── */

export const SEVERITY_ICON_BG: Record<SeverityTier, string> = {
  critical: 'bg-destructive/10',
  warning:  'bg-warning/10',
  info:     'bg-info/10',
  neutral:  'bg-muted/60',
};

/* ── Icon colour ── */

export const SEVERITY_ICON_COLOR: Record<SeverityTier, string> = {
  critical: 'text-destructive',
  warning:  'text-warning',
  info:     'text-info',
  neutral:  'text-muted-foreground',
};

/* ── Card / row border + background tint ── */

export const SEVERITY_CARD: Record<SeverityTier, string> = {
  critical: 'border-destructive/30 bg-destructive/[0.03] hover:border-destructive/50',
  warning:  'border-warning/20 bg-warning/[0.02] hover:border-warning/30',
  info:     'border-info/20 bg-info/[0.02] hover:border-info/20',
  neutral:  'hover:border-primary/20',
};

/* ── Title text colour ── */

export const SEVERITY_TITLE: Record<SeverityTier, string> = {
  critical: 'text-destructive',
  warning:  'text-foreground',
  info:     'text-foreground',
  neutral:  'text-muted-foreground',
};

/* ── Badge styling ── */

export const SEVERITY_BADGE: Record<SeverityTier, string> = {
  critical: 'bg-destructive text-destructive-foreground',
  warning:  'bg-warning text-warning-foreground',
  info:     'bg-info text-info-foreground',
  neutral:  'bg-muted text-muted-foreground',
};

/* ── Operational status classes (for defect cards, etc.) ── */

export const SEVERITY_OPERATIONAL: Record<SeverityTier, string> = {
  critical: 'bg-destructive/10 text-destructive',
  warning:  'bg-warning/10 text-warning',
  info:     'bg-info/10 text-info',
  neutral:  'bg-muted text-muted-foreground',
};

/* ── Section header styles (for grouped lists like NeedsAttentionPanel) ── */

export const SEVERITY_HEADER: Record<SeverityTier, { bg: string; border: string; iconColor: string; text: string }> = {
  critical: {
    bg: 'bg-destructive/5',
    border: 'border-destructive/30',
    iconColor: 'text-destructive',
    text: 'text-destructive',
  },
  warning: {
    bg: 'bg-warning/5',
    border: 'border-warning/30',
    iconColor: 'text-warning',
    text: 'text-foreground',
  },
  info: {
    bg: 'bg-info/5',
    border: 'border-info/20',
    iconColor: 'text-info',
    text: 'text-foreground',
  },
  neutral: {
    bg: 'bg-card',
    border: 'border-border',
    iconColor: 'text-muted-foreground',
    text: 'text-foreground',
  },
};

/* ── Row background tint (for attention item rows) ── */

export const SEVERITY_ROW: Record<SeverityTier, string> = {
  critical: 'bg-destructive/5 border-destructive/20',
  warning:  'bg-warning/5 border-warning/20',
  info:     'bg-card border-border',
  neutral:  'bg-card border-border',
};

/* ── Defect severity → tier mapping ── */

export const DEFECT_SEVERITY_TIER: Record<string, SeverityTier> = {
  stop_operation: 'critical',
  urgent: 'warning',
  non_urgent: 'info',
};

/** Map a defect severity string to a SeverityTier */
export const getDefectTier = (severity: string): SeverityTier =>
  DEFECT_SEVERITY_TIER[severity] ?? 'neutral';

/* ── Defect display config (labels + operational text) ── */

export const DEFECT_DISPLAY: Record<string, { label: string; operational: string; operationalIcon: string }> = {
  stop_operation: { label: 'Stop Use', operational: 'Do not operate', operationalIcon: '⛔' },
  urgent:         { label: 'Important', operational: 'Repair required', operationalIcon: '🔧' },
  non_urgent:     { label: 'Low', operational: 'Monitor', operationalIcon: '👁' },
};
