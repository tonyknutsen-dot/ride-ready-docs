import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useEffectiveUserId } from "@/hooks/useEffectiveUserId";
import {
  AlertTriangle, FileText, ClipboardCheck, ChevronRight,
  Clock, CheckCircle, Wrench, Zap, RefreshCw, Search, Filter
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { format } from "date-fns";

type FilterType = "all" | "overdue" | "expired" | "expiring";
type CategoryFilter = "all" | "inspection" | "maintenance" | "doc_expiry" | "ndt";

interface ComplianceItem {
  id: string;
  title: string;
  rideName: string;
  rideId: string | null;
  dueDate: string;
  daysValue: number;
  category: string; // inspection | maintenance | doc_expiry | ndt
  severity: FilterType; // overdue | expired | expiring
  isRecurring: boolean;
}

const CATEGORY_CONFIG: Record<string, { icon: typeof ClipboardCheck; label: string }> = {
  inspection: { icon: ClipboardCheck, label: "Inspection" },
  ndt: { icon: Zap, label: "NDT" },
  maintenance: { icon: Wrench, label: "Maintenance" },
  doc_expiry: { icon: FileText, label: "Document" },
};

async function fetchComplianceData(userId: string) {
  const today = new Date();
  const todayStr = today.toISOString().split("T")[0];
  const thirtyDaysStr = new Date(Date.now() + 30 * 86400000).toISOString().split("T")[0];

  const [ridesRes, overdueRes, expiringRes] = await Promise.all([
    supabase.from("rides").select("id, ride_name").eq("user_id", userId),
    // Overdue/expired: due_date < today, still scheduled
    supabase
      .from("compliance_events")
      .select("id, event_name, ride_id, due_date, category, is_recurring, status")
      .eq("user_id", userId)
      .eq("status", "scheduled")
      .lt("due_date", todayStr)
      .order("due_date", { ascending: true }),
    // Expiring soon: due_date between today and +30 days, still scheduled
    supabase
      .from("compliance_events")
      .select("id, event_name, ride_id, due_date, category, is_recurring, status")
      .eq("user_id", userId)
      .eq("status", "scheduled")
      .gte("due_date", todayStr)
      .lte("due_date", thirtyDaysStr)
      .order("due_date", { ascending: true }),
  ]);

  const rideMap = new Map<string, string>();
  ridesRes.data?.forEach((r) => rideMap.set(r.id, r.ride_name));

  const items: ComplianceItem[] = [];
  const ms = 86400000;

  (overdueRes.data || []).forEach((e) => {
    const severity: FilterType = e.category === "doc_expiry" ? "expired" : "overdue";
    items.push({
      id: e.id,
      title: e.event_name,
      rideName: e.ride_id ? rideMap.get(e.ride_id) || "Unknown" : "Global",
      rideId: e.ride_id,
      dueDate: e.due_date,
      daysValue: Math.ceil((today.getTime() - new Date(e.due_date).getTime()) / ms),
      category: e.category,
      severity,
      isRecurring: e.is_recurring,
    });
  });

  (expiringRes.data || []).forEach((e) => {
    items.push({
      id: e.id,
      title: e.event_name,
      rideName: e.ride_id ? rideMap.get(e.ride_id) || "Unknown" : "Global",
      rideId: e.ride_id,
      dueDate: e.due_date,
      daysValue: Math.ceil((new Date(e.due_date).getTime() - today.getTime()) / ms),
      category: e.category,
      severity: "expiring",
      isRecurring: e.is_recurring,
    });
  });

  return { items, fetchedAt: new Date().toISOString() };
}

function getExpiringBadgeClasses(daysLeft: number): string {
  if (daysLeft <= 7) return "bg-warning/15 text-warning border-warning/30 font-semibold";
  return "bg-warning/8 text-warning/70 border-warning/15";
}

const Compliance = () => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { effectiveUserId, loading: staffLoading } = useEffectiveUserId();
  const [filter, setFilter] = useState<FilterType>("all");
  const [categoryFilter, setCategoryFilter] = useState<CategoryFilter>("all");
  const [searchQuery, setSearchQuery] = useState("");

  const { data, isLoading, dataUpdatedAt } = useQuery({
    queryKey: ["compliance", effectiveUserId],
    queryFn: () => fetchComplianceData(effectiveUserId!),
    enabled: !!effectiveUserId && !staffLoading,
    staleTime: 1000 * 60 * 2,
  });

  const items = data?.items ?? [];

  // Apply search + category filter
  const filtered = items.filter((i) => {
    if (categoryFilter !== "all" && i.category !== categoryFilter) return false;
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      if (!i.title.toLowerCase().includes(q) && !i.rideName.toLowerCase().includes(q)) return false;
    }
    return true;
  });

  const overdueItems = filtered.filter((i) => i.severity === "overdue");
  const expiredItems = filtered.filter((i) => i.severity === "expired");
  const expiringItems = filtered.filter((i) => i.severity === "expiring");

  const counts = { overdue: overdueItems.length, expired: expiredItems.length, expiring: expiringItems.length };
  const totalIssues = counts.overdue + counts.expired + counts.expiring;

  const sortWorstFirst = (arr: ComplianceItem[]) => [...arr].sort((a, b) => b.daysValue - a.daysValue);
  const sortSoonestFirst = (arr: ComplianceItem[]) => [...arr].sort((a, b) => a.daysValue - b.daysValue);

  const filteredSections = (() => {
    const sections: { title: string; items: ComplianceItem[]; color: "destructive" | "warning" }[] = [];
    if (filter === "all" || filter === "overdue") {
      if (overdueItems.length > 0) sections.push({ title: "Overdue", items: sortWorstFirst(overdueItems), color: "destructive" });
    }
    if (filter === "all" || filter === "expired") {
      if (expiredItems.length > 0) sections.push({ title: "Expired Documents", items: sortWorstFirst(expiredItems), color: "destructive" });
    }
    if (filter === "all" || filter === "expiring") {
      if (expiringItems.length > 0) sections.push({ title: "Expiring Soon", items: sortSoonestFirst(expiringItems), color: "warning" });
    }
    return sections;
  })();

  const allClear = filtered.length === 0;

  const handleRowClick = (item: ComplianceItem) => {
    if (item.category === "doc_expiry") {
      navigate("/documents");
    } else if (item.rideId) {
      navigate(`/rides/${item.rideId}`);
    }
  };

  const handleTileClick = (key: FilterType) => {
    setFilter(filter === key ? "all" : key);
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
    <div className="container mx-auto py-4 pb-24 md:pb-8 max-w-3xl space-y-4">
      {/* Header - tighter */}
      <div>
        <div className="flex items-center gap-3">
          <AlertTriangle className="h-5 w-5 text-destructive" />
          <h1 className="text-lg font-semibold text-foreground">Compliance</h1>
          {counts.overdue > 0 && (
            <Badge variant="destructive" className="text-xs">
              {counts.overdue} overdue
            </Badge>
          )}
        </div>
        <p className="text-xs text-muted-foreground mt-0.5">
          {totalIssues} active issue{totalIssues !== 1 ? "s" : ""}
        </p>
      </div>

      {/* Last checked */}
      {dataUpdatedAt > 0 && (
        <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground/70">
          <RefreshCw className="h-3 w-3" />
          <span>Last checked: {format(new Date(dataUpdatedAt), "dd MMM yyyy, HH:mm")}</span>
        </div>
      )}

      {/* Tappable filter tiles - shorter */}
      <div className="grid grid-cols-3 gap-2">
        {([
          { key: "overdue" as const, label: "Overdue", count: counts.overdue, icon: <ClipboardCheck className="h-3.5 w-3.5" />, color: "destructive" as const },
          { key: "expired" as const, label: "Expired", count: counts.expired, icon: <FileText className="h-3.5 w-3.5" />, color: "destructive" as const },
          { key: "expiring" as const, label: "Expiring", count: counts.expiring, icon: <Clock className="h-3.5 w-3.5" />, color: "warning" as const },
        ]).map((tile) => {
          const isActive = filter === tile.key;
          const bg = tile.color === "destructive" ? "bg-destructive/10" : "bg-warning/10";
          const text = tile.color === "destructive" ? "text-destructive" : "text-warning";
          const numColor = tile.count > 0 ? text : "text-muted-foreground";
          const activeBorder = isActive ? (tile.color === "destructive" ? "border-destructive" : "border-warning") : "border-border";
          const activeRing = isActive ? "ring-2 ring-offset-1 " + (tile.color === "destructive" ? "ring-destructive/30" : "ring-warning/30") : "";

          return (
            <button
              key={tile.key}
              onClick={() => handleTileClick(tile.key)}
              className={`rounded-2xl border-2 bg-card p-2.5 text-center space-y-0.5 transition-all active:scale-[0.97] ${activeBorder} ${activeRing}`}
            >
              <div className={`mx-auto w-7 h-7 rounded-lg flex items-center justify-center ${bg} ${text}`}>
                {tile.icon}
              </div>
              <div className={`text-xl font-bold ${numColor}`}>{tile.count}</div>
              <div className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">{tile.label}</div>
            </button>
          );
        })}
      </div>

      {/* Search + Category filter */}
      <div className="flex gap-2">
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <Input
            placeholder="Search ride or event…"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9 h-9 text-sm"
          />
        </div>
        <Select value={categoryFilter} onValueChange={(v) => setCategoryFilter(v as CategoryFilter)}>
          <SelectTrigger className="w-[130px] h-9 text-sm">
            <Filter className="h-3.5 w-3.5 mr-1" />
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Types</SelectItem>
            <SelectItem value="inspection">Inspection</SelectItem>
            <SelectItem value="maintenance">Maintenance</SelectItem>
            <SelectItem value="doc_expiry">Doc Expiry</SelectItem>
            <SelectItem value="ndt">NDT</SelectItem>
          </SelectContent>
        </Select>
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
            <div className="flex items-center gap-2 mb-1.5">
              <span className={`w-2 h-2 rounded-full ${dotColor}`} />
              <h2 className="text-[13px] font-bold text-foreground uppercase tracking-[1px]">{section.title}</h2>
              <span className="text-xs text-muted-foreground">({section.items.length})</span>
            </div>
            <div className="space-y-1.5">
              {section.items.map((item) => {
                const config = CATEGORY_CONFIG[item.category] || CATEGORY_CONFIG.inspection;
                const Icon = config.icon;
                const iconColor = section.color === "destructive" ? "text-destructive" : "text-warning";

                let badgeLabel: string;
                let badgeClasses: string;
                if (item.severity === "overdue") {
                  badgeLabel = `${item.daysValue}d overdue`;
                  badgeClasses = "";
                } else if (item.severity === "expired") {
                  badgeLabel = `${item.daysValue}d expired`;
                  badgeClasses = "";
                } else {
                  badgeLabel = item.daysValue === 0 ? "Due today" : `${item.daysValue}d left`;
                  badgeClasses = getExpiringBadgeClasses(item.daysValue);
                }

                return (
                  <button
                    key={`${item.severity}-${item.id}`}
                    onClick={() => handleRowClick(item)}
                    className="w-full flex items-center gap-3 px-3 py-2.5 rounded-2xl border border-border bg-card hover:border-primary/50 active:scale-[0.98] transition-all text-left"
                    style={{ boxShadow: "0 1px 4px rgba(0,0,0,0.03)" }}
                  >
                    <span className="flex-shrink-0">
                      <Icon className={`h-4 w-4 ${iconColor}`} />
                    </span>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-foreground truncate">{item.title}</p>
                      <div className="flex items-center gap-1.5 mt-0.5">
                        <span className="text-xs text-muted-foreground truncate max-w-[120px]">{item.rideName}</span>
                        <span className="text-[10px] text-muted-foreground/50">·</span>
                        <span className="text-[10px] text-muted-foreground whitespace-nowrap">
                          {format(new Date(item.dueDate), "dd MMM yyyy")}
                        </span>
                      </div>
                    </div>
                    <Badge
                      variant={item.severity !== "expiring" ? "destructive" : "secondary"}
                      className={`text-[10px] flex-shrink-0 whitespace-nowrap ${badgeClasses}`}
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
