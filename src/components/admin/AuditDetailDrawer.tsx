import { Badge } from '@/components/ui/badge';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Separator } from '@/components/ui/separator';
import { format } from 'date-fns';
import { User, Clock, Globe, FileText, ArrowRight, Building2, Wrench, MessageSquare, HelpCircle } from 'lucide-react';
import { useState } from 'react';

export interface AuditEntry {
  id: string;
  user_id: string;
  action: string;
  resource_type: string;
  resource_id: string | null;
  details: Record<string, any> | null;
  ip_address: string | null;
  user_agent: string | null;
  created_at: string;
  before_data?: Record<string, any> | null;
  after_data?: Record<string, any> | null;
  changed_fields?: string[] | null;
  organisation_name?: string | null;
  equipment_id?: string | null;
  equipment_name?: string | null;
  result?: string | null;
  context_hint?: string | null;
  reason?: string | null;
  actor_name?: string;
  actor_email?: string;
}

// ── Event Families ──

export const EVENT_FAMILIES: Record<string, string> = {
  session: 'Authentication',
  document: 'Documents',
  documents: 'Documents',
  document_share: 'Documents',
  check: 'Checks',
  check_template: 'Checks',
  check_library_item: 'Libraries',
  check_intake: 'Libraries',
  risk_assessment: 'Checks',
  risk_library: 'Libraries',
  risk_intake: 'Libraries',
  inspection_record: 'Checks',
  marketing_contact: 'Marketing',
  marketing_campaign: 'Marketing',
  document_type: 'Libraries',
  document_type_request: 'Requests',
  equipment_type: 'Libraries',
  equipment_type_request: 'Requests',
  ride: 'Equipment',
  ride_category: 'Requests',
  defect: 'Checks',
  maintenance: 'Checks',
  staff: 'Security',
  profile: 'Security',
  support_access: 'Security',
  compliance_event: 'Compliance',
  subscription: 'Billing',
  blocked_ip: 'Security',
  wind_log: 'Checks',
  pressure_reading: 'Checks',
};

export const ACTION_VERBS: Record<string, string> = {
  login: 'logged in',
  logout: 'logged out',
  lock: 'locked screen',
  unlock: 'unlocked screen',
  failed_unlock: 'failed unlock attempt',
  view: 'viewed',
  download: 'downloaded',
  share: 'shared',
  export: 'exported',
  create: 'created',
  update: 'updated',
  delete: 'deleted',
  archive: 'archived',
  unarchive: 'restored',
  support_view: 'viewed via support access',
  approve: 'approved',
  reject: 'rejected',
  import: 'imported',
  send: 'sent',
  subscribe: 'subscribed',
  unsubscribe: 'unsubscribed',
  upload: 'uploaded',
  replace: 'replaced',
  complete: 'completed',
  close: 'closed',
  reopen: 'reopened',
  grant: 'granted',
  revoke: 'revoked',
  request: 'requested',
  reset_password: 'requested password reset',
  link: 'linked',
  block: 'blocked',
  unblock: 'unblocked',
};

export const RESULT_VARIANTS: Record<string, { label: string; className: string }> = {
  success: { label: 'Success', className: 'bg-emerald-500/10 text-emerald-700 border-emerald-500/20' },
  failed: { label: 'Failed', className: 'bg-red-500/10 text-red-700 border-red-500/20' },
  blocked: { label: 'Blocked', className: 'bg-red-500/10 text-red-700 border-red-500/20' },
  denied: { label: 'Denied', className: 'bg-amber-500/10 text-amber-700 border-amber-500/20' },
  warning: { label: 'Warning', className: 'bg-amber-500/10 text-amber-700 border-amber-500/20' },
  info: { label: 'Info', className: 'bg-blue-500/10 text-blue-700 border-blue-500/20' },
};

/**
 * HIGH-RISK ACTIONS: Actions that represent destructive, privileged,
 * or security-sensitive operations. These receive a red left-edge accent
 * in the list view and count toward the "High-Risk Actions" KPI.
 *
 * Criteria for inclusion:
 * - Irreversible data loss: delete
 * - Access escalation: grant, revoke, block, unblock
 * - Approval gate decisions: approve, reject
 * - Security-sensitive: support_view, failed_unlock
 */
export const HIGH_PRIORITY_ACTIONS = new Set([
  'delete',
  'failed_unlock',
  'support_view',
  'approve',
  'reject',
  'grant',
  'revoke',
  'block',
  'unblock',
]);

/**
 * HIGH-RISK RESULTS: Any event with these results is flagged
 * regardless of action type.
 */
export const HIGH_PRIORITY_RESULTS = new Set(['failed', 'blocked', 'denied']);

/**
 * TRIGGER TYPE LABELS: Classifies how/why the event was initiated.
 * Replaces the old "Source" concept for clarity.
 *
 * - User action: a real user clicked/submitted something
 * - Admin action: an admin performed an administrative operation
 * - Automation: system-triggered (webhook, cron, edge function)
 * - Workflow: part of an approval/processing pipeline
 * - Bulk import: CSV or batch import
 * - Seeded proof: manually inserted for testing/validation
 */
const TRIGGER_TYPE_MAP: Record<string, string> = {
  // Manual user actions
  'RideForm': 'User action',
  'DefectClosureDialog': 'User action',
  'DefectReportDialog': 'User action',
  'ContactManager': 'User action',
  'SupportAccessManager': 'User action',
  'GlobalDocumentView': 'User action',
  'RideDocumentView': 'User action',
  'CampaignBuilder': 'User action',
  'DocumentUpload': 'User action',
  'MaintenanceLogger': 'User action',
  // Admin actions
  'CheckItemSubmissions': 'Admin action',
  'RiskItemSubmissions': 'Admin action',
  'RideTypeRequests': 'Admin action',
  'DocumentTypeLibrary': 'Admin action',
  'EquipmentTypeLibrary': 'Admin action',
  'RiskLibrary': 'Admin action',
  'CheckLibrary': 'Admin action',
  'admin': 'Admin action',
  // Workflow / automated
  'early_access': 'Automation',
  'csv_import': 'Bulk import',
  'request_approval': 'Workflow',
  'campaign': 'Automation',
  'manual': 'User action',
  // System
  'stripe_webhook': 'Automation',
  'edge_function': 'Automation',
  'system': 'Automation',
  // Seeded
  'seeded_proof': 'Seeded proof',
};

export function getEventResult(entry: AuditEntry): string {
  if (entry.result && entry.result !== 'success') return entry.result;
  if (entry.action === 'failed_unlock') return 'failed';
  if (entry.details?.result) return entry.details.result;
  if (entry.details?.blocked) return 'blocked';
  if (entry.result) return entry.result;
  return 'success';
}

export function getTargetName(entry: AuditEntry): string {
  const d = entry.details || {};
  return d.document_name || d.name || d.email || d.ride_name || d.ride || d.title || d.label || d.type || d.check_item_text || entry.resource_id?.slice(0, 8) || '—';
}

export function getEventFamily(entry: AuditEntry): string {
  return EVENT_FAMILIES[entry.resource_type] || 'System';
}

export function getResourceLabel(type: string): string {
  return type.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
}

/**
 * Get the trigger type — how the event was initiated.
 * Replaces the old getSourceCategory for clarity.
 */
export function getTriggerType(entry: AuditEntry): string {
  const source = entry.details?.source;
  // Check for seeded proof events
  if (source === 'seeded_proof' || entry.details?.seeded) return 'Seeded proof';
  if (source && TRIGGER_TYPE_MAP[source]) return TRIGGER_TYPE_MAP[source];
  // Infer from action/resource
  if (['login', 'logout', 'lock', 'unlock', 'failed_unlock'].includes(entry.action)) return 'Automation';
  if (entry.resource_type === 'subscription') return 'Automation';
  return 'User action';
}

/** @deprecated Use getTriggerType instead */
export function getSourceCategory(entry: AuditEntry): string {
  return getTriggerType(entry);
}

/**
 * Get the source page/process — where in the app the action occurred.
 */
export function getSourcePage(entry: AuditEntry): string | null {
  if (entry.context_hint) return entry.context_hint;
  const d = entry.details || {};
  const source = d.source;
  // Map component names to friendly page names
  const PAGE_MAP: Record<string, string> = {
    'RideForm': 'Equipment detail',
    'DefectClosureDialog': 'Defect register',
    'DefectReportDialog': 'Defect register',
    'ContactManager': 'Marketing contacts',
    'SupportAccessManager': 'Settings / Support access',
    'GlobalDocumentView': 'Documents',
    'RideDocumentView': 'Equipment documents',
    'CampaignBuilder': 'Marketing campaigns',
    'DocumentUpload': 'Document upload',
    'MaintenanceLogger': 'Maintenance log',
    'CheckItemSubmissions': 'Admin / Check intake',
    'RiskItemSubmissions': 'Admin / Risk intake',
    'RideTypeRequests': 'Admin / Equipment type requests',
    'DocumentTypeLibrary': 'Admin / Document type library',
    'EquipmentTypeLibrary': 'Admin / Equipment type library',
    'RiskLibrary': 'Admin / Risk library',
    'CheckLibrary': 'Admin / Check library',
    'admin': 'Admin panel',
  };
  if (source && PAGE_MAP[source]) return PAGE_MAP[source];
  if (source) return source;
  if (d.module) return d.module;
  if (entry.action === 'failed_unlock') return 'Lock screen';
  if (entry.action === 'support_view') return 'Support access session';
  return null;
}

/** @deprecated Use getSourcePage instead */
export function getContextHint(entry: AuditEntry): string | null {
  return getSourcePage(entry);
}

function parseBrowser(ua: string | null): string {
  if (!ua) return '—';
  if (ua.includes('Chrome') && !ua.includes('Edg')) return 'Chrome';
  if (ua.includes('Edg')) return 'Edge';
  if (ua.includes('Safari') && !ua.includes('Chrome')) return 'Safari';
  if (ua.includes('Firefox')) return 'Firefox';
  return ua.slice(0, 40);
}

function isEmptyValue(value: unknown): boolean {
  return value === null || value === undefined || value === '';
}

function formatValue(value: unknown): string {
  if (value === null || value === undefined) return '—';
  if (typeof value === 'boolean') return value ? 'Yes' : 'No';
  if (typeof value === 'string') return value || '—';
  if (typeof value === 'number') return String(value);
  if (Array.isArray(value)) return value.length ? value.map(formatValue).join(', ') : '—';
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
}

function getChangedKeys(entry: AuditEntry): string[] {
  if (entry.changed_fields?.length) return entry.changed_fields;
  const before = entry.before_data || entry.details?.before || {};
  const after = entry.after_data || entry.details?.after || {};
  const allKeys = [...new Set([...Object.keys(before), ...Object.keys(after)])];
  return allKeys.filter((key) => JSON.stringify(before?.[key]) !== JSON.stringify(after?.[key]));
}

function getSnapshotRows(data?: Record<string, any> | null, preferredKeys?: string[]) {
  if (!data) return [];
  const keys = preferredKeys?.length
    ? preferredKeys.filter((key) => key in data)
    : Object.keys(data);
  return keys
    .filter((key) => !isEmptyValue(data[key]))
    .map((key) => ({ key, label: key.replace(/_/g, ' '), value: formatValue(data[key]) }));
}

function SnapshotSection({ title, data, keys }: { title: string; data?: Record<string, any> | null; keys?: string[] }) {
  const rows = getSnapshotRows(data, keys);
  if (rows.length === 0) return null;
  return (
    <div className="space-y-2">
      <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">{title}</h4>
      <div className="rounded-lg border bg-muted/20 divide-y divide-border/60">
        {rows.map((row) => (
          <div key={row.key} className="flex items-start justify-between gap-3 px-3 py-2 text-sm">
            <span className="text-xs text-muted-foreground capitalize">{row.label}</span>
            <span className="text-xs font-medium text-right whitespace-pre-wrap break-all max-w-[65%]">{row.value}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function ChangesTable({ entry }: { entry: AuditEntry }) {
  const before = entry.before_data || entry.details?.before;
  const after = entry.after_data || entry.details?.after;
  const changedKeys = getChangedKeys(entry);
  if (changedKeys.length === 0) return null;

  return (
    <div className="space-y-2">
      <h4 className="text-[11px] font-bold text-foreground uppercase tracking-[0.08em] border-b-2 border-primary/20 pb-1 inline-block">
        What changed · {changedKeys.length} field{changedKeys.length !== 1 ? 's' : ''}
      </h4>
      <div className="rounded-lg border overflow-hidden">
        {/* Table header */}
        <div className="grid grid-cols-[1fr_1fr_1fr] bg-muted/60 border-b text-[10px] font-semibold text-muted-foreground uppercase tracking-wide">
          <div className="px-2.5 py-1.5">Field</div>
          <div className="px-2.5 py-1.5">Before</div>
          <div className="px-2.5 py-1.5">After</div>
        </div>
        {/* Table rows */}
        {changedKeys.map((key, i) => (
          <div key={key} className={`grid grid-cols-[1fr_1fr_1fr] text-xs ${i % 2 === 0 ? '' : 'bg-muted/20'} ${i < changedKeys.length - 1 ? 'border-b border-border/50' : ''}`}>
            <div className="px-2.5 py-2 font-medium text-foreground/80 capitalize break-all">
              {key.replace(/_/g, ' ')}
            </div>
            <div className="px-2.5 py-2 text-destructive/70 line-through break-all">
              {formatValue(before?.[key])}
            </div>
            <div className="px-2.5 py-2 text-foreground font-medium break-all">
              {formatValue(after?.[key])}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function Section({ icon: Icon, title, children }: { icon: React.ElementType; title: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <h4 className="text-[10px] font-bold text-foreground/50 uppercase tracking-[0.08em] flex items-center gap-1.5 border-b border-border/40 pb-1">
        <Icon className="h-3 w-3" /> {title}
      </h4>
      {children}
    </div>
  );
}

function DetailRow({ label, value }: { label: string; value: React.ReactNode }) {
  if (value === null || value === undefined || value === '—' || value === '') return null;
  return (
    <div className="flex justify-between gap-3 py-1 text-sm">
      <span className="text-muted-foreground text-xs flex-shrink-0">{label}</span>
      <span className="text-right font-medium text-xs break-all">{value}</span>
    </div>
  );
}

// ── Legend Dialog ──

function AuditLegend() {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-1 text-[11px] text-muted-foreground hover:text-foreground transition-colors"
      >
        <HelpCircle className="h-3.5 w-3.5" />
        <span>Legend</span>
      </button>
      {open && (
        <div className="rounded-lg border bg-card p-3 space-y-3 text-xs animate-in fade-in-0 slide-in-from-top-1">
          <div>
            <p className="font-semibold text-foreground mb-1">Results</p>
            <div className="space-y-0.5 text-muted-foreground">
              <p><span className="text-emerald-600 font-medium">Success</span> — Action completed normally</p>
              <p><span className="text-red-600 font-medium">Failed</span> — Action attempted but did not succeed</p>
              <p><span className="text-red-600 font-medium">Blocked</span> — Action was prevented by a security rule</p>
              <p><span className="text-amber-600 font-medium">Denied</span> — Action was rejected due to permissions</p>
            </div>
          </div>
          <div>
            <p className="font-semibold text-foreground mb-1">High-Risk Actions</p>
            <p className="text-muted-foreground">
              Events with a <span className="text-destructive font-medium">red left edge</span> are high-risk: 
              delete, approve, reject, grant, revoke, block, unblock, failed unlock, or support access views.
            </p>
          </div>
          <div>
            <p className="font-semibold text-foreground mb-1">Trigger Types</p>
            <div className="space-y-0.5 text-muted-foreground">
              <p><span className="font-medium text-foreground">User action</span> — A logged-in user performed this</p>
              <p><span className="font-medium text-foreground">Admin action</span> — An admin performed this in the admin panel</p>
              <p><span className="font-medium text-foreground">Automation</span> — System-triggered (webhook, cron, login flow)</p>
              <p><span className="font-medium text-foreground">Workflow</span> — Part of an approval or processing pipeline</p>
              <p><span className="font-medium text-foreground">Bulk import</span> — CSV or batch data import</p>
              <p><span className="font-medium text-foreground">Seeded proof</span> — Manually inserted for audit validation</p>
            </div>
          </div>
          <div>
            <p className="font-semibold text-foreground mb-1">Change Tracking</p>
            <p className="text-muted-foreground">
              Events with <span className="font-medium text-foreground">"X fields changed"</span> contain 
              field-level before/after data. Open the detail drawer to see exactly what changed.
            </p>
          </div>
        </div>
      )}
    </>
  );
}

export { AuditLegend };

// ── Drawer ──

interface Props {
  entry: AuditEntry | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function AuditDetailDrawer({ entry, open, onOpenChange }: Props) {
  if (!entry) return null;

  const result = getEventResult(entry);
  const rv = RESULT_VARIANTS[result] || RESULT_VARIANTS.success;
  const family = getEventFamily(entry);
  const targetName = getTargetName(entry);
  const details = entry.details || {};
  const changedKeys = getChangedKeys(entry);
  const before = entry.before_data || details.before;
  const after = entry.after_data || details.after;
  const siteContext = details.site_name || details.site || details.location || details.site_id;
  const triggerType = getTriggerType(entry);
  const sourcePage = getSourcePage(entry);

  // Determine if the actor is a real user vs system/automation
  const isRealUser = entry.actor_name && entry.actor_name !== 'System' && entry.actor_name !== 'Unknown';
  const performedBy = isRealUser ? entry.actor_name : (triggerType === 'Automation' ? 'System (automated)' : entry.actor_name || 'System');

  const knownKeys = new Set([
    'name', 'document_name', 'email', 'ride_name', 'ride', 'title',
    'label', 'type', 'check_item_text', 'source', 'result', 'blocked',
    'before', 'after', 'skipped', 'imported', 'site_name', 'site', 'location', 'site_id',
    'module', 'seeded',
  ]);
  const extraDetails = Object.entries(details).filter(([k]) => !knownKeys.has(k));

  const referenceEntries = [
    ['Record ID', entry.resource_id],
    ['Equipment ID', entry.equipment_id],
    ...Object.entries(details)
      .filter(([key, value]) => key !== 'site_id' && /(_id|Id)$/.test(key) && !isEmptyValue(value))
      .map(([key, value]) => [key.replace(/_/g, ' '), formatValue(value)] as const),
  ].filter(([, value]) => !isEmptyValue(value));

  const hasContext = entry.organisation_name || entry.equipment_name || siteContext;
  const hasChanges = before || after || changedKeys.length > 0;

  const isHighPriority = HIGH_PRIORITY_ACTIONS.has(entry.action) || HIGH_PRIORITY_RESULTS.has(result);

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-md overflow-y-auto">
        <SheetHeader className="pb-0">
          <SheetTitle className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Audit Record</SheetTitle>
        </SheetHeader>

        <div className="space-y-4 pt-2">
          {/* ── Summary Card ── */}
          <div className={`rounded-xl border-2 p-4 space-y-2.5 ${
            result === 'failed' || result === 'blocked' || result === 'denied'
              ? 'border-destructive/40 bg-destructive/[0.06]'
              : isHighPriority
                ? 'border-destructive/25 bg-destructive/[0.04]'
                : 'border-border bg-muted/30'
          }`}>
            {isHighPriority && (
              <div className="flex items-center gap-1.5 mb-1">
                <div className="w-1.5 h-1.5 rounded-full bg-destructive animate-pulse" />
                <span className="text-[10px] font-bold text-destructive uppercase tracking-widest">High-risk event</span>
              </div>
            )}
            <p className="text-base font-bold leading-snug tracking-tight">
              <span className={isRealUser ? 'text-foreground' : 'text-muted-foreground italic'}>{performedBy}</span>{' '}
              <span className="text-foreground/60 font-medium">{ACTION_VERBS[entry.action] || entry.action}</span>{' '}
              <span className="text-foreground/80">{getResourceLabel(entry.resource_type).toLowerCase()}</span>
            </p>
            {targetName !== '—' && (
              <p className="text-sm font-semibold text-foreground/85">"{targetName}"</p>
            )}
            {sourcePage && (
              <p className="text-xs text-muted-foreground">
                via <span className="font-semibold text-foreground/70">{sourcePage}</span>
              </p>
            )}
            <div className="flex items-center gap-1.5 flex-wrap pt-1.5">
              <Badge variant="outline" className={`${rv.className} text-[10px]`}>{rv.label}</Badge>
              <Badge variant="secondary" className="text-[10px]">{family}</Badge>
              {changedKeys.length > 0 && (
                <Badge variant="outline" className="text-[10px] border-primary/20 bg-primary/5 text-primary">
                  {changedKeys.length} field{changedKeys.length !== 1 ? 's' : ''} changed
                </Badge>
              )}
            </div>
            <p className="text-[11px] text-muted-foreground pt-0.5">
              {format(new Date(entry.created_at), "dd MMM yyyy 'at' HH:mm:ss")}
            </p>
          </div>

          {/* ── Performed by ── */}
          <Section icon={User} title="Performed by">
            <DetailRow label="Name" value={performedBy} />
            {entry.actor_email && <DetailRow label="Email" value={entry.actor_email} />}
            <DetailRow label="Trigger type" value={triggerType} />
          </Section>

          {/* ── Event ── */}
          <Section icon={Clock} title="Event">
            <DetailRow label="Action" value={ACTION_VERBS[entry.action] || entry.action} />
            <DetailRow label="Family" value={family} />
          </Section>

          {/* ── Target ── */}
          <Section icon={FileText} title="Target">
            <DetailRow label="Type" value={getResourceLabel(entry.resource_type)} />
            <DetailRow label="Name" value={targetName} />
          </Section>

          {/* ── Reason ── */}
          {entry.reason && (
            <Section icon={MessageSquare} title="Why this happened">
              <p className="text-xs bg-muted/30 rounded-md border p-2.5 leading-relaxed">{entry.reason}</p>
            </Section>
          )}

          {/* ── What changed (most prominent) ── */}
          {hasChanges && (
            <>
              <Separator className="my-1" />
              <ChangesTable entry={entry} />
              {/* Show before/after snapshots only if no structured change table */}
              {changedKeys.length === 0 && (
                <div className="space-y-3">
                  <SnapshotSection title="Before" data={before} keys={changedKeys} />
                  <SnapshotSection title="After" data={after} keys={changedKeys} />
                </div>
              )}
            </>
          )}

          {/* ── Context ── */}
          {hasContext && (
            <Section icon={Building2} title="Context">
              <DetailRow label="Organisation" value={entry.organisation_name} />
              <DetailRow label="Site" value={siteContext} />
              <DetailRow label="Equipment" value={entry.equipment_name} />
            </Section>
          )}

          {/* ── Security ── */}
          {(entry.ip_address || entry.user_agent) && (
            <Section icon={Globe} title="Security">
              <DetailRow label="IP Address" value={entry.ip_address} />
              <DetailRow label="Browser" value={parseBrowser(entry.user_agent)} />
            </Section>
          )}

          {/* ── References ── */}
          {referenceEntries.length > 0 && (
            <div className="space-y-1 pt-1">
              <h4 className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider">References</h4>
              <div className="rounded-md border bg-muted/10 divide-y divide-border/40">
                {referenceEntries.map(([label, value]) => (
                  <div key={label} className="flex justify-between gap-2 px-2.5 py-1.5">
                    <span className="text-[11px] text-muted-foreground">{label}</span>
                    <span className="text-[11px] font-mono text-foreground/70 text-right break-all">{value}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ── Extra metadata ── */}
          {extraDetails.length > 0 && (
            <div className="space-y-1 pt-1">
              <h4 className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider">Metadata</h4>
              {extraDetails.map(([key, value]) => (
                <DetailRow key={key} label={key.replace(/_/g, ' ')} value={formatValue(value)} />
              ))}
            </div>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
