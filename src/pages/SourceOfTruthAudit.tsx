import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useEffectiveUserId } from '@/hooks/useEffectiveUserId';
import { useDefectSummary } from '@/hooks/useDefectSummary';
import { useOverdueCompliance } from '@/hooks/useOverdueCompliance';
import { useUnreadNotifications } from '@/hooks/useUnreadNotifications';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import PageHeader from '@/components/PageHeader';
import { Bug } from 'lucide-react';

const StatusBadge = ({ status }: { status: string }) => {
  const colors: Record<string, string> = {
    completed: 'bg-green-100 text-green-800',
    open: 'bg-yellow-100 text-yellow-800',
    scheduled: 'bg-blue-100 text-blue-800',
    resolved: 'bg-gray-100 text-gray-600',
    active: 'bg-green-100 text-green-800',
    superseded: 'bg-gray-100 text-gray-600',
  };
  return <Badge className={`text-[10px] ${colors[status] || 'bg-muted text-muted-foreground'}`}>{status}</Badge>;
};

const SourceOfTruthAudit = () => {
  const { user } = useAuth();
  const { effectiveUserId } = useEffectiveUserId();
  const defectSummary = useDefectSummary();
  const overdueCount = useOverdueCompliance();
  const unreadNotifications = useUnreadNotifications();

  const [loading, setLoading] = useState(true);
  const [compliance, setCompliance] = useState<any[]>([]);
  const [rideDocs, setRideDocs] = useState<any[]>([]);
  const [defects, setDefects] = useState<any[]>([]);
  const [maintenance, setMaintenance] = useState<any[]>([]);
  const [pressure, setPressure] = useState<any[]>([]);
  const [docCount, setDocCount] = useState(0);

  useEffect(() => {
    if (!user || !effectiveUserId) return;
    loadAll();
  }, [user, effectiveUserId]);

  const loadAll = async () => {
    setLoading(true);
    const thirtyDaysStr = new Date(Date.now() + 30 * 86400000).toISOString().split('T')[0];

    const [compRes, rideDocRes, defectRes, maintRes, pressRes, expDocsRes] = await Promise.all([
      supabase.from('compliance_events').select('id, ride_id, category, event_type, event_name, status, due_date, completed_at, full_document_id, next_event_id, source_event_id, rides(ride_name)').eq('user_id', effectiveUserId!).order('created_at', { ascending: false }).limit(20),
      supabase.from('ride_documents').select('id, ride_id, document_type, document_id, version, status, title, file_url, related_event_id, created_at').order('created_at', { ascending: false }).limit(20),
      supabase.from('defects').select('id, ride_id, severity, status, description, created_at, resolved_at, check_id, rides(ride_name)').eq('user_id', effectiveUserId!).order('created_at', { ascending: false }).limit(20),
      supabase.from('maintenance_records').select('id, ride_id, maintenance_type, description, maintenance_date, created_at, next_maintenance_due, rides(ride_name)').eq('user_id', effectiveUserId!).order('created_at', { ascending: false }).limit(20),
      supabase.from('pressure_sessions').select('id, ride_id, session_date, is_complete, rides(ride_name)').eq('user_id', effectiveUserId!).order('created_at', { ascending: false }).limit(10),
      supabase.from('documents').select('id', { count: 'exact', head: true }).eq('user_id', effectiveUserId!).eq('is_latest_version', true).not('expires_at', 'is', null).lte('expires_at', thirtyDaysStr).is('expiry_acknowledged_at', null),
    ]);

    setCompliance(compRes.data || []);
    setRideDocs(rideDocRes.data || []);
    setDefects(defectRes.data || []);
    setMaintenance(maintRes.data || []);
    setDocCount(expDocsRes.count || 0);

    const sessions = pressRes.data || [];
    if (sessions.length > 0) {
      const sessionIds = sessions.map((s: any) => s.id);
      const rideIds = [...new Set(sessions.map((s: any) => s.ride_id))];
      const [linesRes, configRes] = await Promise.all([
        supabase.from('pressure_session_lines').select('session_id, section_number, pressure_value').in('session_id', sessionIds),
        supabase.from('rides').select('id, section_config').in('id', rideIds as string[]),
      ]);
      const lines = linesRes.data || [];
      const configMap = new Map((configRes.data || []).map((r: any) => [r.id, r.section_config || []]));

      setPressure(sessions.map((s: any) => {
        const sLines = lines.filter((l: any) => l.session_id === s.id).sort((a: any, b: any) => a.section_number - b.section_number);
        const cfg = configMap.get(s.ride_id) || [];
        let outOfRange = false;
        sLines.forEach((l: any, idx: number) => {
          if (l.pressure_value == null) return;
          const limits = (cfg as any[])[idx];
          if (!limits) return;
          if (limits.min_pressure != null && l.pressure_value < limits.min_pressure) outOfRange = true;
          if (limits.max_pressure != null && l.pressure_value > limits.max_pressure) outOfRange = true;
        });
        return { ...s, lines: sLines, rideConfig: cfg, isOutOfRange: outOfRange };
      }));
    } else {
      setPressure([]);
    }

    setLoading(false);
  };

  if (loading) return <div className="space-y-4 p-4"><Skeleton className="h-8 w-48" /><Skeleton className="h-64 w-full" /></div>;

  const inspectionsDue = compliance.filter((c: any) => (c.status === 'open' || c.status === 'scheduled') && (c.category === 'inspection' || c.category === 'ndt'));
  const pressureActionNeeded = pressure.filter((p: any) => p.isOutOfRange && p.is_complete);

  return (
    <div className="space-y-4 px-4 md:px-0 pb-[calc(env(safe-area-inset-bottom)+5.5rem)] md:pb-8">
      <PageHeader
        icon={<Bug className="h-5 w-5 text-destructive" />}
        iconBgClass="from-destructive/20 to-destructive/10"
        title="Source of Truth Audit"
        subtitle="Live data — temporary debug page"
        showBackButton backTo="/overview"
      />

      {/* KPI Sources */}
      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-sm">Dashboard KPI Sources</CardTitle></CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-2 text-xs">
            <div className="p-2 rounded bg-muted/50">
              <p className="text-muted-foreground">Open Defects</p>
              <p className="text-lg font-bold">{defectSummary.data?.totalOpen ?? '—'}</p>
              <p className="text-[10px]">Critical: {defectSummary.data?.criticalOpen ?? 0}</p>
              <p className="text-[10px] text-muted-foreground">defects WHERE status != resolved</p>
            </div>
            <div className="p-2 rounded bg-muted/50">
              <p className="text-muted-foreground">Overdue Compliance</p>
              <p className="text-lg font-bold">{overdueCount}</p>
              <p className="text-[10px] text-muted-foreground">events(regulatory,open/sched,past) + docs(expired,unack)</p>
            </div>
            <div className="p-2 rounded bg-muted/50">
              <p className="text-muted-foreground">Docs Expiring</p>
              <p className="text-lg font-bold">{docCount}</p>
            </div>
            <div className="p-2 rounded bg-muted/50">
              <p className="text-muted-foreground">Notifications</p>
              <p className="text-lg font-bold">{unreadNotifications}</p>
            </div>
            <div className="p-2 rounded bg-muted/50">
              <p className="text-muted-foreground">Inspections Due</p>
              <p className="text-lg font-bold">{inspectionsDue.length}</p>
            </div>
            <div className="p-2 rounded bg-muted/50">
              <p className="text-muted-foreground">Pressure Action</p>
              <p className="text-lg font-bold">{pressureActionNeeded.length}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Compliance Events */}
      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-sm">Compliance Events</CardTitle></CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-[10px]">
              <thead><tr className="border-b text-left">
                <th className="p-1">Event</th><th className="p-1">Ride</th><th className="p-1">Cat</th><th className="p-1">Type</th><th className="p-1">Status</th><th className="p-1">Due</th><th className="p-1">Completed</th><th className="p-1">full_doc_id</th><th className="p-1">ride_doc?</th>
              </tr></thead>
              <tbody>{compliance.map((c: any) => {
                const hasRideDoc = rideDocs.some((rd: any) => rd.related_event_id === c.id);
                return (
                  <tr key={c.id} className="border-b border-border/30">
                    <td className="p-1 max-w-[100px] truncate">{c.event_name}</td>
                    <td className="p-1">{c.rides?.ride_name || '—'}</td>
                    <td className="p-1">{c.category}</td>
                    <td className="p-1">{c.event_type}</td>
                    <td className="p-1"><StatusBadge status={c.status} /></td>
                    <td className="p-1">{c.due_date}</td>
                    <td className="p-1">{c.completed_at ? new Date(c.completed_at).toLocaleDateString() : '—'}</td>
                    <td className="p-1 font-mono text-[9px]">{c.full_document_id || <span className="text-destructive">null</span>}</td>
                    <td className="p-1">{c.status === 'completed' ? (hasRideDoc ? <span className="text-green-600 font-bold">✓</span> : <span className="text-destructive font-bold">✗</span>) : '—'}</td>
                  </tr>
                );
              })}</tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Ride Documents */}
      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-sm">Ride Documents — {rideDocs.length === 0 ? <span className="text-destructive">EMPTY</span> : `${rideDocs.length} rows`}</CardTitle></CardHeader>
        <CardContent>
          {rideDocs.length === 0 ? (
            <p className="text-xs text-destructive font-medium p-2 bg-destructive/10 rounded">
              ⚠ ride_documents table empty. RPC was failing due to missing columns (updated_at, updated_by). Migration applied — new completions should now work.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-[10px]">
                <thead><tr className="border-b text-left">
                  <th className="p-1">Title</th><th className="p-1">type</th><th className="p-1">doc_id</th><th className="p-1">ver</th><th className="p-1">status</th><th className="p-1">event_id</th><th className="p-1">file</th>
                </tr></thead>
                <tbody>{rideDocs.map((rd: any) => (
                  <tr key={rd.id} className="border-b border-border/30">
                    <td className="p-1 max-w-[120px] truncate">{rd.title}</td>
                    <td className="p-1">{rd.document_type}</td>
                    <td className="p-1 font-mono text-[9px]">{rd.document_id}</td>
                    <td className="p-1">{rd.version}</td>
                    <td className="p-1"><StatusBadge status={rd.status} /></td>
                    <td className="p-1 font-mono text-[9px]">{rd.related_event_id || '—'}</td>
                    <td className="p-1">{rd.file_url ? '✓' : '✗'}</td>
                  </tr>
                ))}</tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Defects */}
      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-sm">Defects</CardTitle></CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-[10px]">
              <thead><tr className="border-b text-left">
                <th className="p-1">Desc</th><th className="p-1">Ride</th><th className="p-1">Severity</th><th className="p-1">Status</th><th className="p-1">Created</th><th className="p-1">Resolved</th>
              </tr></thead>
              <tbody>{defects.map((d: any) => (
                <tr key={d.id} className="border-b border-border/30">
                  <td className="p-1 max-w-[150px] truncate">{d.description}</td>
                  <td className="p-1">{d.rides?.ride_name || '—'}</td>
                  <td className="p-1"><Badge className={`text-[10px] ${d.severity === 'stop_operation' ? 'bg-red-100 text-red-800' : 'bg-yellow-100 text-yellow-800'}`}>{d.severity}</Badge></td>
                  <td className="p-1"><StatusBadge status={d.status} /></td>
                  <td className="p-1">{new Date(d.created_at).toLocaleDateString()}</td>
                  <td className="p-1">{d.resolved_at ? new Date(d.resolved_at).toLocaleDateString() : '—'}</td>
                </tr>
              ))}</tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Maintenance */}
      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-sm">Maintenance</CardTitle></CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-[10px]">
              <thead><tr className="border-b text-left">
                <th className="p-1">Desc</th><th className="p-1">Ride</th><th className="p-1">Type</th><th className="p-1">Date</th><th className="p-1">Next Due</th>
              </tr></thead>
              <tbody>{maintenance.map((m: any) => (
                <tr key={m.id} className="border-b border-border/30">
                  <td className="p-1 max-w-[150px] truncate">{m.description}</td>
                  <td className="p-1">{m.rides?.ride_name || '—'}</td>
                  <td className="p-1">{m.maintenance_type}</td>
                  <td className="p-1">{m.maintenance_date}</td>
                  <td className="p-1">{m.next_maintenance_due || '—'}</td>
                </tr>
              ))}</tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Pressure */}
      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-sm">Pressure Sessions</CardTitle></CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-[10px]">
              <thead><tr className="border-b text-left">
                <th className="p-1">Ride</th><th className="p-1">Date</th><th className="p-1">Complete</th><th className="p-1">Out of Range</th><th className="p-1">Defect?</th><th className="p-1">Readings</th>
              </tr></thead>
              <tbody>{pressure.map((p: any) => {
                const linkedDefect = defects.find((d: any) => d.description?.includes(p.session_date) && d.ride_id === p.ride_id);
                return (
                  <tr key={p.id} className="border-b border-border/30">
                    <td className="p-1">{p.rides?.ride_name || '—'}</td>
                    <td className="p-1">{p.session_date}</td>
                    <td className="p-1">{p.is_complete ? '✓' : '✗'}</td>
                    <td className="p-1">{p.isOutOfRange ? <span className="text-destructive font-bold">⚠ Yes</span> : <span className="text-green-600">No</span>}</td>
                    <td className="p-1">{linkedDefect ? <span className="text-green-600">✓</span> : 'No (manual)'}</td>
                    <td className="p-1">{p.lines?.map((l: any) => `S${l.section_number}:${l.pressure_value}`).join(', ')}</td>
                  </tr>
                );
              })}</tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Root Cause */}
      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-sm">Root Cause Analysis</CardTitle></CardHeader>
        <CardContent className="space-y-2 text-xs">
          <div className="p-2 bg-destructive/10 rounded">
            <p className="font-bold text-destructive">Document Linking Failure — ROOT CAUSE</p>
            <p>The <code>upsert_ride_document</code> RPC references <code>updated_at</code> and <code>updated_by</code> columns that did NOT exist on the <code>ride_documents</code> table. Every <code>storeRideDocument()</code> call silently failed. PDFs + documents table rows were created, but ride_documents linkage was never established.</p>
            <p className="mt-1 font-medium text-green-700">✓ Migration applied — columns added. New completions should now create ride_documents rows.</p>
          </div>
          <div className="p-2 bg-muted/50 rounded">
            <p className="font-bold">Checks Page "No Schedule" — Design, Not Bug</p>
            <p>EquipmentSelector shows maintenance schedule status from <code>maintenance_records</code>. Ride-level checks show templates from <code>daily_check_templates</code> + <code>checks</code>. Different data sources = different labels. Not a data mismatch.</p>
          </div>
          <div className="p-2 bg-muted/50 rounded">
            <p className="font-bold">Pressure → Defects — Correct By Design</p>
            <p>Out-of-range pressure = dashboard action item (manual "Raise defect"). Does NOT auto-create defect rows. Open Defects KPI correctly unchanged.</p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default SourceOfTruthAudit;
