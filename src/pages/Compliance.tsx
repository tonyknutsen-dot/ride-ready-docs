import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useEffectiveUserId } from "@/hooks/useEffectiveUserId";
import {
  AlertTriangle, FileText, ClipboardCheck, ChevronRight,
  Clock, CheckCircle, Wrench, Zap
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { format } from "date-fns";

type FilterType = "all" | "overdue" | "expired" | "expiring";
type ItemType = "inspection" | "ndt" | "maintenance" | "document";

interface ComplianceItem {
  id: string;
  title: string;
  rideName: string;
  rideId: string | null;
  dueDate: string;
  daysValue: number; // positive = overdue/expired, negative = days remaining
  itemType: ItemType;
  category: FilterType; // which bucket it falls into
}

const TYPE_CONFIG: Record<ItemType, { icon: typeof ClipboardCheck; label: string }> = {
  inspection: { icon: ClipboardCheck, label: "Inspection" },
  ndt: { icon: Zap, label: "NDT" },
  maintenance: { icon: Wrench, label: "Maintenance" },
  document: { icon: FileText, label: "Document" },
};

async function fetchComplianceData(userId: string) {
  const today = new Date();
  const todayStr = today.toISOString().split("T")[0];
  const thirtyDaysStr = new Date(Date.now() + 30 * 86400000).toISOString().split("T")[0];

  const [ridesRes, overdueInspRes, overdueNdtRes, overdueMaintenanceRes, expiredDocsRes, expiringInspRes, expiringNdtRes, expiringMaintenanceRes, expiringDocsRes] = await Promise.all([
    supabase.from("rides").select("id, ride_name").eq("user_id", userId),
    // Overdue inspections
    supabase
      .from("inspection_schedules")
      .select("id, inspection_name, due_date, ride_id")
      .eq("user_id", userId)
      .lt("due_date", todayStr)
      .eq("is_active", true)
      .order("due_date", { ascending: true }),
    // Overdue NDT
    supabase
      .from("ndt_schedules")
      .select("id, schedule_name, next_inspection_due, ride_id")
      .eq("user_id", userId)
      .not("next_inspection_due", "is", null)
      .lt("next_inspection_due", todayStr)
      .eq("is_active", true)
      .order("next_inspection_due", { ascending: true }),
    // Overdue maintenance
    supabase
      .from("maintenance_records")
      .select("id, description, next_maintenance_due, ride_id")
      .eq("user_id", userId)
      .not("next_maintenance_due", "is", null)
      .lt("next_maintenance_due", todayStr)
      .order("next_maintenance_due", { ascending: true }),
    // Expired documents
    supabase
      .from("documents")
      .select("id, document_name, expires_at, ride_id")
      .eq("user_id", userId)
      .not("expires_at", "is", null)
      .eq("is_latest_version", true)
      .lt("expires_at", todayStr)
      .order("expires_at", { ascending: true }),
    // Expiring inspections (within 30 days)
    supabase
      .from("inspection_schedules")
      .select("id, inspection_name, due_date, ride_id")
      .eq("user_id", userId)
      .gte("due_date", todayStr)
      .lte("due_date", thirtyDaysStr)
      .eq("is_active", true)
      .order("due_date", { ascending: true }),
    // Expiring NDT
    supabase
      .from("ndt_schedules")
      .select("id, schedule_name, next_inspection_due, ride_id")
      .eq("user_id", userId)
      .not("next_inspection_due", "is", null)
      .gte("next_inspection_due", todayStr)
      .lte("next_inspection_due", thirtyDaysStr)
      .eq("is_active", true)
      .order("next_inspection_due", { ascending: true }),
    // Expiring maintenance
    supabase
      .from("maintenance_records")
      .select("id, description, next_maintenance_due, ride_id")
      .eq("user_id", userId)
      .not("next_maintenance_due", "is", null)
      .gte("next_maintenance_due", todayStr)
      .lte("next_maintenance_due", thirtyDaysStr)
      .order("next_maintenance_due", { ascending: true }),
    // Expiring documents (within 30 days)
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

  const items: ComplianceItem[] = [];
  const ms = 86400000;

  // Overdue inspections
  (overdueInspRes.data || []).forEach((i) => items.push({
    id: i.id, title: i.inspection_name, rideName: rideMap.get(i.ride_id) || "Unknown",
    rideId: i.ride_id, dueDate: i.due_date,
    daysValue: Math.ceil((today.getTime() - new Date(i.due_date).getTime()) / ms),
    itemType: "inspection", category: "overdue",
  }));

  // Overdue NDT
  (overdueNdtRes.data || []).forEach((n) => items.push({
    id: n.id, title: n.schedule_name, rideName: rideMap.get(n.ride_id) || "Unknown",
    rideId: n.ride_id, dueDate: n.next_inspection_due!,
    daysValue: Math.ceil((today.getTime() - new Date(n.next_inspection_due!).getTime()) / ms),
    itemType: "ndt", category: "overdue",
  }));

  // Overdue maintenance
  (overdueMaintenanceRes.data || []).forEach((m) => items.push({
    id: m.id, title: m.description, rideName: rideMap.get(m.ride_id) || "Unknown",
    rideId: m.ride_id, dueDate: m.next_maintenance_due!,
    daysValue: Math.ceil((today.getTime() - new Date(m.next_maintenance_due!).getTime()) / ms),
    itemType: "maintenance", category: "overdue",
  }));

  // Expired documents
  (expiredDocsRes.data || []).forEach((d) => items.push({
    id: d.id, title: d.document_name, rideName: d.ride_id ? rideMap.get(d.ride_id) || "" : "Global",
    rideId: d.ride_id, dueDate: d.expires_at!,
    daysValue: Math.ceil((today.getTime() - new Date(d.expires_at!).getTime()) / ms),
    itemType: "document", category: "expired",
  }));

  // Expiring inspections
  (expiringInspRes.data || []).forEach((i) => items.push({
    id: i.id, title: i.inspection_name, rideName: rideMap.get(i.ride_id) || "Unknown",
    rideId: i.ride_id, dueDate: i.due_date,
    daysValue: Math.ceil((new Date(i.due_date).getTime() - today.getTime()) / ms),
    itemType: "inspection", category: "expiring",
  }));

  // Expiring NDT
  (expiringNdtRes.data || []).forEach((n) => items.push({
    id: n.id, title: n.schedule_name, rideName: rideMap.get(n.ride_id) || "Unknown",
    rideId: n.ride_id, dueDate: n.next_inspection_due!,
    daysValue: Math.ceil((new Date(n.next_inspection_due!).getTime() - today.getTime()) / ms),
    itemType: "ndt", category: "expiring",
  }));

  // Expiring maintenance
  (expiringMaintenanceRes.data || []).forEach((m) => items.push({
    id: m.id, title: m.description, rideName: rideMap.get(m.ride_id) || "Unknown",
    rideId: m.ride_id, dueDate: m.next_maintenance_due!,
    daysValue: Math.ceil((new Date(m.next_maintenance_due!).getTime() - today.getTime()) / ms),
    itemType: "maintenance", category: "expiring",
  }));

  // Expiring documents
  (expiringDocsRes.data || []).forEach((d) => items.push({
    id: d.id, title: d.document_name, rideName: d.ride_id ? rideMap.get(d.ride_id) || "" : "Global",
    rideId: d.ride_id, dueDate: d.expires_at!,
    daysValue: Math.ceil((new Date(d.expires_at!).getTime() - today.getTime()) / ms),
    itemType: "document", category: "expiring",
  }));

  return items;
}

const Compliance = () => {
  const navigate = useNavigate();
  const { effectiveUserId, loading: staffLoading } = useEffectiveUserId();
  const [filter, setFilter] = useState<FilterType>("all");

  const { data: items = [], isLoading } = useQuery({
    queryKey: ["compliance", effectiveUserId],
    queryFn: () => fetchComplianceData(effectiveUserId!),
    enabled: !!effectiveUserId && !staffLoading,
    staleTime: 1000 * 60 * 2,
  });

  const overdueItems = items.filter((i) => i.category === "overdue");
  const expiredItems = items.filter((i) => i.category === "expired");
  const expiringItems = items.filter((i) => i.category === "expiring");

  const counts = {
    overdue: overdueItems.length,
    expired: expiredItems.length,
    expiring: expiringItems.length,
  };
  const totalIssues = counts.overdue + counts.expired;

  // Sort: worst first (highest daysValue = most overdue/expired)
  const sortItems = (arr: ComplianceItem[]) =>
    [...arr].sort((a, b) => b.daysValue - a.daysValue);

  // For expiring, sort soonest first (lowest daysValue)
  const sortExpiring = (arr: ComplianceItem[]) =>
    [...arr].sort((a, b) => a.daysValue - b.daysValue);

  const filteredSections = (() => {
    const sections: { title: string; items: ComplianceItem[]; color: "destructive" | "warning" }[] = [];
    if (filter === "all" || filter === "overdue") {
      if (overdueItems.length > 0) sections.push({ title: "Overdue", items: sortItems(overdueItems), color: "destructive" });
    }
    if (filter === "all" || filter === "expired") {
      if (expiredItems.length > 0) sections.push({ title: "Expired Documents", items: sortItems(expiredItems), color: "destructive" });
    }
    if (filter === "all" || filter === "expiring") {
      if (expiringItems.length > 0) sections.push({ title: "Expiring Soon", items: sortExpiring(expiringItems), color: "warning" });
    }
    return sections;
  })();

  const allClear = items.length === 0;

  const handleRowClick = (item: ComplianceItem) => {
    if (item.itemType === "document") {
      navigate("/documents");
    } else if (item.rideId) {
      navigate(`/rides/${item.rideId}`);
    }
  };

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
          <h1 className="text-[22px] font-semibold text-foreground">Compliance Issues</h1>
          {totalIssues > 0 && (
            <Badge variant="destructive" className="text-xs">
              {totalIssues} issue{totalIssues !== 1 ? "s" : ""}
            </Badge>
          )}
        </div>
        <p className="text-sm text-muted-foreground mt-1">
          Overdue inspections, expired &amp; expiring documents, NDT and maintenance
        </p>
      </div>

      {/* Tappable filter tiles */}
      <div className="grid grid-cols-3 gap-3">
        {([
          { key: "overdue" as const, label: "Overdue", count: counts.overdue, icon: <ClipboardCheck className="h-4 w-4" />, color: "destructive" as const },
          { key: "expired" as const, label: "Expired", count: counts.expired, icon: <FileText className="h-4 w-4" />, color: "destructive" as const },
          { key: "expiring" as const, label: "Expiring", count: counts.expiring, icon: <Clock className="h-4 w-4" />, color: "warning" as const },
        ]).map((tile) => {
          const isActive = filter === tile.key;
          const bg = tile.color === "destructive" ? "bg-destructive/10" : "bg-warning/10";
          const text = tile.color === "destructive" ? "text-destructive" : "text-warning";
          const numColor = tile.count > 0 ? text : "text-muted-foreground";
          const activeBorder = isActive ? (tile.color === "destructive" ? "border-destructive" : "border-warning") : "border-border";

          return (
            <button
              key={tile.key}
              onClick={() => setFilter(filter === tile.key ? "all" : tile.key)}
              className={`rounded-2xl border-2 bg-card p-3 text-center space-y-1 transition-all active:scale-[0.97] ${activeBorder}`}
            >
              <div className={`mx-auto w-8 h-8 rounded-xl flex items-center justify-center ${bg} ${text}`}>
                {tile.icon}
              </div>
              <div className={`text-2xl font-bold ${numColor}`}>{tile.count}</div>
              <div className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">{tile.label}</div>
            </button>
          );
        })}
      </div>

      {/* All clear */}
      {allClear && (
        <div className="bg-card border border-border rounded-2xl p-6 text-center space-y-2">
          <CheckCircle className="h-10 w-10 text-success mx-auto" />
          <p className="text-sm font-semibold text-foreground">All Clear</p>
          <p className="text-xs text-muted-foreground">No compliance issues found</p>
        </div>
      )}

      {/* Sections */}
      {filteredSections.map((section) => {
        const dotColor = section.color === "destructive" ? "bg-destructive" : "bg-warning";
        return (
          <div key={section.title}>
            <div className="flex items-center gap-2 mb-2">
              <span className={`w-2 h-2 rounded-full ${dotColor}`} />
              <h2 className="text-[13px] font-bold text-foreground uppercase tracking-[1px]">{section.title}</h2>
              <span className="text-xs text-muted-foreground">({section.items.length})</span>
            </div>
            <div className="space-y-2">
              {section.items.map((item) => {
                const config = TYPE_CONFIG[item.itemType];
                const Icon = config.icon;
                const iconColor = section.color === "destructive" ? "text-destructive" : "text-warning";
                const badgeLabel = item.category === "overdue"
                  ? `${item.daysValue}d overdue`
                  : item.category === "expired"
                    ? `${item.daysValue}d expired`
                    : item.daysValue === 0 ? "Today" : `${item.daysValue}d left`;

                return (
                  <button
                    key={`${item.category}-${item.id}`}
                    onClick={() => handleRowClick(item)}
                    className="w-full flex items-center gap-3 px-4 py-3 rounded-2xl border border-border bg-card hover:border-primary/50 active:scale-[0.98] transition-all text-left"
                    style={{ boxShadow: "0 2px 6px rgba(0,0,0,0.04)" }}
                  >
                    <span className="flex-shrink-0">
                      <Icon className={`h-4 w-4 ${iconColor}`} />
                    </span>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-foreground truncate">{item.title}</p>
                      <div className="flex items-center gap-2 mt-0.5">
                        {item.rideName && <span className="text-xs text-muted-foreground truncate">{item.rideName}</span>}
                        <span className="text-[10px] text-muted-foreground/70">·</span>
                        <span className="text-[10px] text-muted-foreground whitespace-nowrap">
                          Due: {format(new Date(item.dueDate), "dd MMM yyyy")}
                        </span>
                      </div>
                      <span className="text-[10px] text-muted-foreground/60 mt-0.5 block">{config.label}</span>
                    </div>
                    <Badge
                      variant={section.color === "destructive" ? "destructive" : "secondary"}
                      className={`text-[10px] flex-shrink-0 ${
                        section.color === "warning" ? "bg-warning/10 text-warning border-warning/20" : ""
                      }`}
                    >
                      {badgeLabel}
                    </Badge>
                    <ChevronRight className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                  </button>
                );
              })}
            </div>
          </div>
        );
      })}

      {/* Empty filter state */}
      {!allClear && filteredSections.length === 0 && (
        <div className="bg-card border border-border rounded-2xl p-6 text-center space-y-2">
          <CheckCircle className="h-8 w-8 text-success mx-auto" />
          <p className="text-sm font-medium text-foreground">No {filter} items</p>
          <button onClick={() => setFilter("all")} className="text-xs text-primary font-semibold hover:underline">
            Show all
          </button>
        </div>
      )}
    </div>
  );
};

export default Compliance;
