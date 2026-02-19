import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useEffectiveUserId } from "@/hooks/useEffectiveUserId";
import {
  AlertTriangle, FileText, ClipboardCheck, ChevronRight,
  Clock, CheckCircle, ExternalLink
} from "lucide-react";
import { Badge } from "@/components/ui/badge";

interface OverdueInspection {
  id: string;
  inspection_name: string;
  due_date: string;
  ride_id: string;
  rideName: string;
  daysOverdue: number;
}

interface ExpiredDocument {
  id: string;
  document_name: string;
  expires_at: string;
  ride_id: string | null;
  rideName: string;
  daysExpired: number;
}

interface ExpiringDocument {
  id: string;
  document_name: string;
  expires_at: string;
  ride_id: string | null;
  rideName: string;
  daysUntil: number;
}

async function fetchComplianceData(userId: string) {
  const today = new Date();
  const todayStr = today.toISOString().split("T")[0];
  const thirtyDaysStr = new Date(Date.now() + 30 * 86400000).toISOString().split("T")[0];

  const [ridesRes, overdueInspRes, expiredDocsRes, expiringDocsRes] = await Promise.all([
    supabase.from("rides").select("id, ride_name").eq("user_id", userId),
    supabase
      .from("inspection_schedules")
      .select("id, inspection_name, due_date, ride_id")
      .eq("user_id", userId)
      .lt("due_date", todayStr)
      .eq("is_active", true)
      .order("due_date", { ascending: true }),
    supabase
      .from("documents")
      .select("id, document_name, expires_at, ride_id")
      .eq("user_id", userId)
      .not("expires_at", "is", null)
      .eq("is_latest_version", true)
      .lt("expires_at", todayStr)
      .order("expires_at", { ascending: true }),
    supabase
      .from("documents")
      .select("id, document_name, expires_at, ride_id")
      .eq("user_id", userId)
      .not("expires_at", "is", null)
      .eq("is_latest_version", true)
      .gte("expires_at", todayStr)
      .lte("expires_at", thirtyDaysStr)
      .order("expires_at", { ascending: true }),
  ]);

  const rideMap = new Map<string, string>();
  ridesRes.data?.forEach((r) => rideMap.set(r.id, r.ride_name));

  const overdueInspections: OverdueInspection[] = (overdueInspRes.data || []).map((i) => ({
    id: i.id,
    inspection_name: i.inspection_name,
    due_date: i.due_date,
    ride_id: i.ride_id,
    rideName: rideMap.get(i.ride_id) || "Unknown",
    daysOverdue: Math.ceil((today.getTime() - new Date(i.due_date).getTime()) / 86400000),
  }));

  const expiredDocs: ExpiredDocument[] = (expiredDocsRes.data || []).map((d) => ({
    id: d.id,
    document_name: d.document_name,
    expires_at: d.expires_at!,
    ride_id: d.ride_id,
    rideName: d.ride_id ? rideMap.get(d.ride_id) || "" : "Global",
    daysExpired: Math.ceil((today.getTime() - new Date(d.expires_at!).getTime()) / 86400000),
  }));

  const expiringDocs: ExpiringDocument[] = (expiringDocsRes.data || []).map((d) => ({
    id: d.id,
    document_name: d.document_name,
    expires_at: d.expires_at!,
    ride_id: d.ride_id,
    rideName: d.ride_id ? rideMap.get(d.ride_id) || "" : "Global",
    daysUntil: Math.ceil((new Date(d.expires_at!).getTime() - today.getTime()) / 86400000),
  }));

  return { overdueInspections, expiredDocs, expiringDocs };
}

const Compliance = () => {
  const navigate = useNavigate();
  const { effectiveUserId, loading: staffLoading } = useEffectiveUserId();

  const { data, isLoading } = useQuery({
    queryKey: ["compliance", effectiveUserId],
    queryFn: () => fetchComplianceData(effectiveUserId!),
    enabled: !!effectiveUserId && !staffLoading,
    staleTime: 1000 * 60 * 2,
  });

  const overdueInspections = data?.overdueInspections ?? [];
  const expiredDocs = data?.expiredDocs ?? [];
  const expiringDocs = data?.expiringDocs ?? [];
  const totalIssues = overdueInspections.length + expiredDocs.length;
  const allClear = totalIssues === 0 && expiringDocs.length === 0;

  if (isLoading) {
    return (
      <div className="container mx-auto py-6 pb-24 md:pb-8 max-w-3xl space-y-4">
        <div className="h-7 w-48 bg-muted rounded animate-pulse" />
        <div className="h-5 w-64 bg-muted rounded animate-pulse" />
        <div className="space-y-3 mt-6">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-20 bg-muted rounded-2xl animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-6 pb-24 md:pb-8 max-w-3xl space-y-5">
      {/* Header */}
      <div>
        <div className="flex items-center gap-3">
          <AlertTriangle className="h-6 w-6 text-destructive" />
          <h1 className="text-[22px] font-semibold text-foreground">Compliance</h1>
          {totalIssues > 0 && (
            <Badge variant="destructive" className="text-xs">
              {totalIssues} issue{totalIssues !== 1 ? "s" : ""}
            </Badge>
          )}
        </div>
        <p className="text-sm text-muted-foreground mt-1">
          Overdue inspections, expired and expiring documents
        </p>
      </div>

      {/* Summary strip */}
      <div className="grid grid-cols-3 gap-3">
        <SummaryCard
          label="Overdue"
          count={overdueInspections.length}
          icon={<ClipboardCheck className="h-4 w-4" />}
          color="destructive"
        />
        <SummaryCard
          label="Expired"
          count={expiredDocs.length}
          icon={<FileText className="h-4 w-4" />}
          color="destructive"
        />
        <SummaryCard
          label="Expiring"
          count={expiringDocs.length}
          icon={<Clock className="h-4 w-4" />}
          color="warning"
        />
      </div>

      {/* All clear */}
      {allClear && (
        <div className="bg-card border border-border rounded-2xl p-6 text-center space-y-2">
          <CheckCircle className="h-10 w-10 text-success mx-auto" />
          <p className="text-sm font-semibold text-foreground">All Clear</p>
          <p className="text-xs text-muted-foreground">No compliance issues found</p>
        </div>
      )}

      {/* Overdue Inspections */}
      {overdueInspections.length > 0 && (
        <Section title="Overdue Inspections" count={overdueInspections.length} color="destructive">
          {overdueInspections.map((item) => (
            <ComplianceRow
              key={item.id}
              icon={<ClipboardCheck className="h-4 w-4 text-destructive" />}
              title={item.inspection_name}
              subtitle={item.rideName}
              badge={`${item.daysOverdue}d overdue`}
              badgeColor="destructive"
              onClick={() => navigate(`/rides/${item.ride_id}`)}
            />
          ))}
        </Section>
      )}

      {/* Expired Documents */}
      {expiredDocs.length > 0 && (
        <Section title="Expired Documents" count={expiredDocs.length} color="destructive">
          {expiredDocs.map((item) => (
            <ComplianceRow
              key={item.id}
              icon={<FileText className="h-4 w-4 text-destructive" />}
              title={item.document_name}
              subtitle={item.rideName}
              badge={`${item.daysExpired}d expired`}
              badgeColor="destructive"
              onClick={() => navigate("/documents")}
            />
          ))}
        </Section>
      )}

      {/* Expiring Soon */}
      {expiringDocs.length > 0 && (
        <Section title="Expiring Soon" count={expiringDocs.length} color="warning">
          {expiringDocs.map((item) => (
            <ComplianceRow
              key={item.id}
              icon={<FileText className="h-4 w-4 text-warning" />}
              title={item.document_name}
              subtitle={item.rideName}
              badge={item.daysUntil === 0 ? "Today" : `${item.daysUntil}d left`}
              badgeColor="warning"
              onClick={() => navigate("/documents")}
            />
          ))}
        </Section>
      )}
    </div>
  );
};

function SummaryCard({
  label,
  count,
  icon,
  color,
}: {
  label: string;
  count: number;
  icon: React.ReactNode;
  color: "destructive" | "warning";
}) {
  const bg = color === "destructive" ? "bg-destructive/10" : "bg-warning/10";
  const text = color === "destructive" ? "text-destructive" : "text-warning";
  const numColor = count > 0 ? text : "text-muted-foreground";

  return (
    <div className={`rounded-2xl border border-border bg-card p-3 text-center space-y-1`}>
      <div className={`mx-auto w-8 h-8 rounded-xl flex items-center justify-center ${bg} ${text}`}>
        {icon}
      </div>
      <div className={`text-2xl font-bold ${numColor}`}>{count}</div>
      <div className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">{label}</div>
    </div>
  );
}

function Section({
  title,
  count,
  color,
  children,
}: {
  title: string;
  count: number;
  color: "destructive" | "warning";
  children: React.ReactNode;
}) {
  const dotColor = color === "destructive" ? "bg-destructive" : "bg-warning";
  return (
    <div>
      <div className="flex items-center gap-2 mb-2">
        <span className={`w-2 h-2 rounded-full ${dotColor}`} />
        <h2 className="text-[13px] font-bold text-foreground uppercase tracking-[1px]">{title}</h2>
        <span className="text-xs text-muted-foreground">({count})</span>
      </div>
      <div className="space-y-2">{children}</div>
    </div>
  );
}

function ComplianceRow({
  icon,
  title,
  subtitle,
  badge,
  badgeColor,
  onClick,
}: {
  icon: React.ReactNode;
  title: string;
  subtitle: string;
  badge: string;
  badgeColor: "destructive" | "warning";
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="w-full flex items-center gap-3 px-4 py-3 rounded-2xl border border-border bg-card hover:border-primary/50 active:scale-[0.98] transition-all text-left"
      style={{ boxShadow: "0 2px 6px rgba(0,0,0,0.04)" }}
    >
      <span className="flex-shrink-0">{icon}</span>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-foreground truncate">{title}</p>
        {subtitle && <p className="text-xs text-muted-foreground truncate">{subtitle}</p>}
      </div>
      <Badge
        variant={badgeColor === "destructive" ? "destructive" : "secondary"}
        className={`text-[10px] flex-shrink-0 ${
          badgeColor === "warning" ? "bg-warning/10 text-warning border-warning/20" : ""
        }`}
      >
        {badge}
      </Badge>
      <ChevronRight className="h-4 w-4 text-muted-foreground flex-shrink-0" />
    </button>
  );
}

export default Compliance;
