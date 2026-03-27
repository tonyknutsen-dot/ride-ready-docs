import { Badge } from '@/components/ui/badge';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Separator } from '@/components/ui/separator';
import { format } from 'date-fns';
import { User, Clock, Globe, FileText, ArrowRight } from 'lucide-react';

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
  actor_name?: string;
  actor_email?: string;
}

// ── Helpers ──

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

/** Actions that deserve stronger visual treatment in the list */
export const HIGH_PRIORITY_ACTIONS = new Set([
  'delete', 'failed_unlock', 'support_view', 'approve', 'reject',
]);

export const HIGH_PRIORITY_RESULTS = new Set(['failed', 'blocked', 'denied']);

export function getEventResult(entry: AuditEntry): string {
  if (entry.action === 'failed_unlock') return 'failed';
  if (entry.details?.result) return entry.details.result;
  if (entry.details?.blocked) return 'blocked';
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

/** Derive a short context hint for the event */
export function getContextHint(entry: AuditEntry): string | null {
  const d = entry.details || {};
  if (d.source === 'early_access') return 'from early access signup';
  if (d.source === 'csv_import') return 'from CSV import';
  if (d.source === 'manual') return 'manual add';
  if (d.source === 'admin') return 'via admin panel';
  if (d.source === 'request_approval') return 'from request approval';
  if (d.source === 'campaign') return 'via marketing campaign';
  if (d.source) return `via ${d.source}`;
  if (entry.action === 'failed_unlock') return 'failed password';
  if (entry.action === 'support_view') return 'support access session';
  if (entry.resource_type === 'marketing_contact' && entry.action === 'create') return 'manual add';
  return null;
}

function parseBrowser(ua: string | null): string {
  if (!ua) return '—';
  if (ua.includes('Chrome') && !ua.includes('Edg')) return 'Chrome';
  if (ua.includes('Edg')) return 'Edge';
  if (ua.includes('Safari') && !ua.includes('Chrome')) return 'Safari';
  if (ua.includes('Firefox')) return 'Firefox';
  return ua.slice(0, 40);
}

// ── Before/After Display ──

function BeforeAfterSection({ details }: { details: Record<string, any> }) {
  const before = details?.before;
  const after = details?.after;
  if (!before && !after) return null;

  const allKeys = [...new Set([...Object.keys(before || {}), ...Object.keys(after || {})])];
  const changedKeys = allKeys.filter(k => JSON.stringify(before?.[k]) !== JSON.stringify(after?.[k]));

  if (changedKeys.length === 0) return null;

  return (
    <div className="space-y-2">
      <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Changes</h4>
      <div className="space-y-1.5">
        {changedKeys.map(key => (
          <div key={key} className="rounded-lg border p-2.5 bg-muted/30 text-sm">
            <p className="font-medium text-xs text-muted-foreground mb-1">{key.replace(/_/g, ' ')}</p>
            <div className="flex items-center gap-2 flex-wrap">
              <span className="line-through text-destructive/70 text-xs">{String(before?.[key] ?? '—')}</span>
              <ArrowRight className="h-3 w-3 text-muted-foreground flex-shrink-0" />
              <span className="font-medium text-xs">{String(after?.[key] ?? '—')}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Detail Row ──

function DetailRow({ label, value }: { label: string; value: React.ReactNode }) {
  if (!value || value === '—' || value === '') return null;
  return (
    <div className="flex justify-between gap-3 py-1.5 text-sm">
      <span className="text-muted-foreground text-xs flex-shrink-0">{label}</span>
      <span className="text-right font-medium text-xs break-all">{value}</span>
    </div>
  );
}

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
  const contextHint = getContextHint(entry);

  const knownKeys = new Set(['name', 'document_name', 'email', 'ride_name', 'ride', 'title', 'label', 'type', 'check_item_text', 'source', 'result', 'blocked', 'before', 'after', 'skipped', 'imported']);
  const extraDetails = Object.entries(details).filter(([k]) => !knownKeys.has(k));

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-md overflow-y-auto">
        <SheetHeader className="pb-2">
          <SheetTitle className="text-base">Audit Event Detail</SheetTitle>
        </SheetHeader>

        <div className="space-y-4 pt-2">
          {/* Summary banner */}
          <div className="rounded-lg border bg-muted/30 p-3 space-y-1">
            <div className="flex items-center gap-2 flex-wrap">
              <Badge variant="outline" className={rv.className}>{rv.label}</Badge>
              <Badge variant="secondary" className="text-xs">{family}</Badge>
            </div>
            <p className="text-sm font-medium mt-1.5">
              {entry.actor_name || 'Unknown user'}{' '}
              <span className="text-muted-foreground font-normal">{ACTION_VERBS[entry.action] || entry.action}</span>{' '}
              {getResourceLabel(entry.resource_type).toLowerCase()}{' '}
              <span className="font-semibold">"{targetName}"</span>
            </p>
            {contextHint && (
              <p className="text-xs text-muted-foreground italic">{contextHint}</p>
            )}
          </div>

          <Separator />

          {/* Actor */}
          <div className="space-y-1">
            <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide flex items-center gap-1.5">
              <User className="h-3 w-3" /> Actor
            </h4>
            <DetailRow label="Name" value={entry.actor_name} />
            <DetailRow label="Email" value={entry.actor_email} />
            <DetailRow label="User ID" value={entry.user_id?.slice(0, 12) + '…'} />
          </div>

          <Separator />

          {/* Event */}
          <div className="space-y-1">
            <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide flex items-center gap-1.5">
              <Clock className="h-3 w-3" /> Event
            </h4>
            <DetailRow label="Family" value={family} />
            <DetailRow label="Action" value={ACTION_VERBS[entry.action] || entry.action} />
            <DetailRow label="Result" value={<Badge variant="outline" className={`text-xs ${rv.className}`}>{rv.label}</Badge>} />
            <DetailRow label="Timestamp" value={format(new Date(entry.created_at), "dd MMM yyyy 'at' HH:mm:ss")} />
            <DetailRow label="Source" value={details.source} />
            {contextHint && <DetailRow label="Context" value={contextHint} />}
          </div>

          <Separator />

          {/* Target */}
          <div className="space-y-1">
            <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide flex items-center gap-1.5">
              <FileText className="h-3 w-3" /> Target
            </h4>
            <DetailRow label="Type" value={getResourceLabel(entry.resource_type)} />
            <DetailRow label="Name" value={targetName} />
            <DetailRow label="Record ID" value={entry.resource_id} />
          </div>

          {/* Security info */}
          {(entry.ip_address || entry.user_agent) && (
            <>
              <Separator />
              <div className="space-y-1">
                <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide flex items-center gap-1.5">
                  <Globe className="h-3 w-3" /> Security
                </h4>
                <DetailRow label="IP Address" value={entry.ip_address} />
                <DetailRow label="Browser" value={parseBrowser(entry.user_agent)} />
                <DetailRow label="User Agent" value={entry.user_agent} />
              </div>
            </>
          )}

          {/* Before/After */}
          {details.before || details.after ? (
            <>
              <Separator />
              <BeforeAfterSection details={details} />
            </>
          ) : null}

          {/* Extra details */}
          {extraDetails.length > 0 && (
            <>
              <Separator />
              <div className="space-y-1">
                <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Additional Details</h4>
                {extraDetails.map(([key, value]) => (
                  <DetailRow key={key} label={key.replace(/_/g, ' ')} value={typeof value === 'object' ? JSON.stringify(value) : String(value)} />
                ))}
              </div>
            </>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
