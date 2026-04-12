import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { invalidateComplianceQueries } from "@/utils/queryInvalidation";
import { useOfflineQuery } from "@/hooks/useOfflineQuery";
import { supabase } from "@/integrations/supabase/client";
import { useEffectiveUserId } from "@/hooks/useEffectiveUserId";
import {
  AlertTriangle, FileText, ClipboardCheck, ChevronRight,
  Clock, CheckCircle, Wrench, Zap, RefreshCw, Search,
  CheckSquare, Eye
} from "lucide-react";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { formatDateUK } from "@/utils/dateFormat";
import CompletedComplianceTab from "@/components/CompletedComplianceTab";
import { OfflineStaleAlert } from "@/components/OfflineStaleAlert";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { format } from "date-fns";
import MarkCompleteSheet from "@/components/MarkCompleteSheet";

type FilterType = "all" | "overdue" | "expired" | "expiring";
type CategoryFilter = "all" | "inspection" | "maintenance" | "doc_expiry" | "ndt";
type StatusFilter = "open" | "completed" | "all";

interface ComplianceItem {
  id: string;
  title: string;
  rideName: string;
  rideId: string | null;
  dueDate: string;
  daysValue: number;
  category: string;
  eventType?: string;
  severity: FilterType;
  isRecurring: boolean;
  recurrenceRule?: string | null;
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
    supabase
      .from("compliance_events")
      .select("id, event_name, event_type, ride_id, due_date, category, is_recurring, recurrence_rule, status")
      .eq("user_id", userId)
      .eq("status", "open")
      .lt("due_date", todayStr)
      .order("due_date", { ascending: true }),
    supabase
      .from("compliance_events")
      .select("id, event_name, event_type, ride_id, due_date, category, is_recurring, recurrence_rule, status")
      .eq("user_id", userId)
      .eq("status", "open")
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
      eventType: e.event_type,
      severity,
      isRecurring: e.is_recurring,
      recurrenceRule: e.recurrence_rule,
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
      eventType: e.event_type,
      severity: "expiring",
      isRecurring: e.is_recurring,
      recurrenceRule: e.recurrence_rule,
    });
  });

  // Get unique ride list for ride filter
  const rideList = Array.from(rideMap.entries()).map(([id, name]) => ({ id, name }));

  return { items, rideList, fetchedAt: new Date().toISOString() };
}


function getExpiringBadgeClasses(daysLeft: number): string {
  if (daysLeft <= 7) return "bg-warning/15 text-warning border-warning/30 font-semibold";
  return "bg-warning/8 text-warning/70 border-warning/15";
}

const Compliance = () => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { effectiveUserId, loading: staffLoading } = useEffectiveUserId();
  const [activeTab, setActiveTab] = useState<"open" | "completed">("open");
  const [filter, setFilter] = useState<FilterType>("all");
  const [categoryFilter, setCategoryFilter] = useState<CategoryFilter>("all");
  const [rideFilter, setRideFilter] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [openRideKeys, setOpenRideKeys] = useState<Set<string>>(new Set());
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkMode, setBulkMode] = useState(false);

  // Mark complete sheet state
  const [markCompleteOpen, setMarkCompleteOpen] = useState(false);
  const [markCompleteEvent, setMarkCompleteEvent] = useState<ComplianceItem | null>(null);

  const { data, isLoading, dataUpdatedAt, isOfflineData, cachedAt } = useOfflineQuery({
    queryKey: ["compliance", effectiveUserId],
    queryFn: () => fetchComplianceData(effectiveUserId!),
    enabled: !!effectiveUserId && !staffLoading,
    staleTime: 1000 * 60 * 2,
    offlineCacheKey: `compliance_open:${effectiveUserId}`,
  });

  const items = data?.items ?? [];
  const rideList = data?.rideList ?? [];

  const filtered = items.filter((i) => {
    if (categoryFilter !== "all" && i.category !== categoryFilter) return false;
    if (rideFilter !== "all" && i.rideId !== rideFilter) return false;
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

  const getFilteredItems = (): ComplianceItem[] => {
    let result: ComplianceItem[] = [];
    if (filter === "all" || filter === "overdue") result = [...result, ...sortWorstFirst(overdueItems)];
    if (filter === "all" || filter === "expired") result = [...result, ...sortWorstFirst(expiredItems)];
    if (filter === "all" || filter === "expiring") result = [...result, ...sortSoonestFirst(expiringItems)];
    return result;
  };

  const filteredItems = getFilteredItems();

  // Group by ride with per-severity breakdowns
  const groupedByRide = (() => {
    const groups = new Map<string, {
      rideName: string; rideId: string | null;
      overdue: ComplianceItem[]; expired: ComplianceItem[]; expiring: ComplianceItem[];
      oldestDue: string;
    }>();

    filteredItems.forEach((item) => {
      const key = item.rideId || "global";
      if (!groups.has(key)) groups.set(key, { rideName: item.rideName, rideId: item.rideId, overdue: [], expired: [], expiring: [], oldestDue: item.dueDate });
      const g = groups.get(key)!;
      if (item.severity === "overdue") g.overdue.push(item);
      else if (item.severity === "expired") g.expired.push(item);
      else g.expiring.push(item);
      if (item.dueDate < g.oldestDue) g.oldestDue = item.dueDate;
    });

    // Sort each sub-list
    for (const g of groups.values()) {
      g.overdue.sort((a, b) => b.daysValue - a.daysValue);   // longest overdue first
      g.expired.sort((a, b) => a.daysValue - b.daysValue);    // most recently expired first
      g.expiring.sort((a, b) => a.daysValue - b.daysValue);   // soonest due first
    }

    // Sort rides: overdue first (by count desc), then expired-only, then expiring-only
    return Array.from(groups.values()).sort((a, b) => {
      const aO = a.overdue.length, bO = b.overdue.length;
      const aE = a.expired.length, bE = b.expired.length;
      // Priority: has overdue > has expired > has expiring
      const aPri = aO > 0 ? 0 : aE > 0 ? 1 : 2;
      const bPri = bO > 0 ? 0 : bE > 0 ? 1 : 2;
      if (aPri !== bPri) return aPri - bPri;
      if (aPri === 0) return bO - aO || a.oldestDue.localeCompare(b.oldestDue);
      if (aPri === 1) return bE - aE;
      return a.oldestDue.localeCompare(b.oldestDue);
    });
  })();

  const allClear = filtered.length === 0;

  const handleRowClick = (item: ComplianceItem) => {
    if (bulkMode) {
      toggleSelection(item.id);
      return;
    }
    // Open mark complete sheet
    setMarkCompleteEvent(item);
    setMarkCompleteOpen(true);
  };

  const handleNavigate = (item: ComplianceItem) => {
    if (item.category === "doc_expiry") navigate("/documents");
    else if (item.rideId) navigate(`/rides/${item.rideId}`);
  };

  const handleTileClick = (key: FilterType) => {
    setFilter(filter === key ? "all" : key);
  };

  const toggleSelection = (id: string) => {
    const next = new Set(selectedIds);
    if (next.has(id)) next.delete(id); else next.add(id);
    setSelectedIds(next);
  };

  const handleBulkComplete = () => {
    // For bulk, we'll just mark them one-by-one via the first selected
    // This is a simplified approach; for now open sheet for the first item
    const firstId = Array.from(selectedIds)[0];
    const item = filteredItems.find(i => i.id === firstId);
    if (item) {
      setMarkCompleteEvent(item);
      setMarkCompleteOpen(true);
    }
  };

  const handleCompleted = () => {
    invalidateComplianceQueries(queryClient);
    setSelectedIds(new Set());
    setBulkMode(false);
  };

  const renderItemRow = (item: ComplianceItem) => {
    const config = CATEGORY_CONFIG[item.category] || CATEGORY_CONFIG.inspection;
    const Icon = config.icon;
    const iconColor = item.severity !== "expiring" ? "text-destructive" : "text-warning";

    let badgeLabel: string;
    let badgeClasses: string = "";
    if (item.severity === "overdue") {
      badgeLabel = `${item.daysValue}d overdue`;
    } else if (item.severity === "expired") {
      badgeLabel = `${item.daysValue}d expired`;
    } else {
      badgeLabel = item.daysValue === 0 ? "Due today" : `${item.daysValue}d left`;
      badgeClasses = getExpiringBadgeClasses(item.daysValue);
    }

    return (
      <button
        key={`${item.severity}-${item.id}`}
        onClick={() => handleRowClick(item)}
        className="w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg border border-border bg-card hover:border-primary/40 active:scale-[0.98] transition-all text-left"
      >
        {bulkMode && (
          <Checkbox
            checked={selectedIds.has(item.id)}
            onCheckedChange={() => toggleSelection(item.id)}
            onClick={(e) => e.stopPropagation()}
            className="shrink-0"
          />
        )}
        <span className="flex-shrink-0">
          <Icon className={`h-4 w-4 ${iconColor}`} />
        </span>
        <div className="flex-1 min-w-0">
          <p className="text-[13px] font-semibold text-foreground truncate leading-tight">{item.title}</p>
          <div className="flex items-center gap-1 mt-px">
            <span className="text-[10px] text-muted-foreground/70">{config.label}</span>
            <span className="text-[10px] text-muted-foreground/40">·</span>
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
        <ChevronRight className="h-4.5 w-4.5 text-muted-foreground flex-shrink-0" />
      </button>
    );
  };

  if (isLoading) {
    return (
      <div className="container mx-auto py-6 pb-24 md:pb-8 max-w-3xl space-y-4">
        <div className="h-7 w-48 bg-muted rounded animate-pulse" />
        <div className="h-5 w-64 bg-muted rounded animate-pulse" />
        <div className="space-y-3 mt-6">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-20 bg-muted rounded-xl animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-3 pb-24 md:pb-8 max-w-3xl space-y-3">
      {/* Offline staleness alert */}
      <OfflineStaleAlert />

      {/* Header */}
      <div>
        <div className="flex items-center gap-3">
          <AlertTriangle className="h-5 w-5 text-destructive" />
          <h1 className="text-lg font-semibold text-foreground">Compliance</h1>
          {activeTab === "open" && counts.overdue > 0 && (
            <Badge variant="destructive" className="text-xs">{counts.overdue} overdue</Badge>
          )}
        </div>
        <p className="text-xs text-muted-foreground mt-0.5">
          {activeTab === "open"
            ? `${totalIssues} active issue${totalIssues !== 1 ? "s" : ""}`
            : "Completed events"}
        </p>
      </div>

      {/* Open / Completed toggle */}
      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as "open" | "completed")}>
        <TabsList className="w-full">
          <TabsTrigger value="open" className="flex-1 gap-1.5">
            <AlertTriangle className="h-3.5 w-3.5" /> Open
          </TabsTrigger>
          <TabsTrigger value="completed" className="flex-1 gap-1.5">
            <CheckCircle className="h-3.5 w-3.5" /> Completed
          </TabsTrigger>
        </TabsList>
      </Tabs>

      {/* ===== OPEN TAB ===== */}
      {activeTab === "open" && (
        <>
          {/* Stat pills */}
          <div className="flex items-center gap-1.5 flex-wrap">
            {([
              { key: "overdue" as const, label: "Overdue", count: counts.overdue, color: "destructive" as const },
              { key: "expired" as const, label: "Expired", count: counts.expired, color: "destructive" as const },
              { key: "expiring" as const, label: "Expiring", count: counts.expiring, color: "warning" as const },
            ]).map((pill) => {
              const isActive = filter === pill.key;
              const hasItems = pill.count > 0;
              const baseClasses = pill.color === "destructive"
                ? hasItems ? "bg-destructive/10 text-destructive border-destructive/30" : "bg-muted/50 text-muted-foreground border-border"
                : hasItems ? "bg-warning/10 text-warning border-warning/30" : "bg-muted/50 text-muted-foreground border-border";
              const activeClasses = isActive
                ? pill.color === "destructive" ? "ring-1 ring-destructive/40 border-destructive" : "ring-1 ring-warning/40 border-warning"
                : "";

              return (
                <button
                  key={pill.key}
                  onClick={() => handleTileClick(pill.key)}
                  className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md border text-[11px] font-semibold transition-all ${baseClasses} ${activeClasses}`}
                >
                  {pill.label}: <span className="font-bold">{pill.count}</span>
                </button>
              );
            })}
            {dataUpdatedAt > 0 && (
              <span className="text-[10px] text-muted-foreground/50 ml-auto">
                {format(new Date(dataUpdatedAt), "HH:mm")}
              </span>
            )}
          </div>

          {/* Search + filters */}
          <div className="flex gap-2">
            <div className="flex-1 relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
              <Input
                placeholder="Search ride or event…"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-8 h-9 text-sm"
              />
            </div>
            <Select value={categoryFilter} onValueChange={(v) => setCategoryFilter(v as CategoryFilter)}>
              <SelectTrigger className="w-[120px] h-9 text-sm">
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
            {rideList.length > 1 && (
              <Select value={rideFilter} onValueChange={setRideFilter}>
                <SelectTrigger className="w-[110px] h-9 text-sm">
                  <SelectValue placeholder="All Rides" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Rides</SelectItem>
                  {rideList.map(r => <SelectItem key={r.id} value={r.id}>{r.name}</SelectItem>)}
                </SelectContent>
              </Select>
            )}
            <button
              onClick={() => { setBulkMode(!bulkMode); setSelectedIds(new Set()); }}
              title="Bulk select"
              className={`h-9 w-9 flex items-center justify-center rounded-lg border transition-colors flex-shrink-0 ${bulkMode ? 'bg-primary text-primary-foreground border-primary' : 'border-border text-muted-foreground hover:text-foreground hover:bg-muted'}`}
            >
              <CheckSquare className="h-3.5 w-3.5" />
            </button>
          </div>

          {/* Bulk actions bar */}
          {bulkMode && selectedIds.size > 0 && (
            <div className="flex items-center gap-2 rounded-lg border border-primary/30 bg-primary/5 px-3 py-2">
              <span className="text-sm font-medium text-foreground">{selectedIds.size} selected</span>
              <div className="flex-1" />
              <Button size="sm" className="gap-1.5" onClick={handleBulkComplete}>
                <CheckCircle className="h-3.5 w-3.5" /> Mark Complete
              </Button>
              <Button size="sm" variant="outline" onClick={() => { setSelectedIds(new Set()); setBulkMode(false); }}>
                Cancel
              </Button>
            </div>
          )}

          {/* All clear */}
          {allClear && (
            <div className="border border-border rounded-lg p-5 text-center space-y-1.5">
              <CheckCircle className="h-7 w-7 text-success mx-auto" />
              <p className="text-sm font-semibold text-foreground">All Clear</p>
              <p className="text-xs text-muted-foreground">No compliance issues found</p>
            </div>
          )}

          {/* Grouped by ride — always */}
          {!allClear && groupedByRide.length > 0 && (
            <div className="space-y-4">
              {groupedByRide.map((group) => {
                const rideKey = group.rideId || "global";
                const isOpen = openRideKeys.has(rideKey);
                const oCount = group.overdue.length;
                const eCount = group.expired.length;
                const xCount = group.expiring.length;

                const sections: { key: string; label: string; items: ComplianceItem[]; dot: string }[] = [];
                if (oCount > 0) sections.push({ key: "overdue", label: "OVERDUE", items: group.overdue, dot: "bg-destructive" });
                if (eCount > 0) sections.push({ key: "expired", label: "EXPIRED", items: group.expired, dot: "bg-destructive" });
                if (xCount > 0) sections.push({ key: "expiring", label: "EXPIRING SOON", items: group.expiring, dot: "bg-warning" });

                return (
                  <Collapsible
                    key={rideKey}
                    open={isOpen}
                    onOpenChange={open => {
                      setOpenRideKeys(prev => {
                        const next = new Set(prev);
                        if (open) next.add(rideKey); else next.delete(rideKey);
                        return next;
                      });
                    }}
                  >
                    <CollapsibleTrigger className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg border border-border bg-card hover:bg-muted/40 transition-colors text-left ${oCount > 0 ? 'border-l-4 border-l-destructive' : eCount > 0 ? 'border-l-4 border-l-[#D97706]' : xCount > 0 ? 'border-l-4 border-l-[#F59E0B]' : ''}`}>
                      <ChevronRight className="h-4.5 w-4.5 text-muted-foreground transition-transform [[data-state=open]>&]:rotate-90 shrink-0" />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="text-sm font-bold text-foreground truncate">{group.rideName}</span>
                          {oCount > 0 && (
                            <Badge variant="destructive" className="text-[10px] font-semibold flex-shrink-0">
                              Overdue: {oCount}
                            </Badge>
                          )}
                          {eCount > 0 && (
                            <Badge variant="destructive" className="text-[10px] font-semibold flex-shrink-0">
                              Expired: {eCount}
                            </Badge>
                          )}
                          {xCount > 0 && (
                            <Badge className="text-[10px] font-semibold bg-warning/15 text-warning border-0 flex-shrink-0">
                              Expiring: {xCount}
                            </Badge>
                          )}
                        </div>
                      </div>
                    </CollapsibleTrigger>
                    <CollapsibleContent className="mt-1 ml-7 space-y-1.5">
                      {sections.map((sec, idx) => (
                        <div key={sec.key}>
                          {idx > 0 && <div className="border-t border-border/40 my-1" />}
                          <div className="flex items-center gap-1.5 mb-0.5 px-1">
                            <span className={`w-1.5 h-1.5 rounded-full ${sec.dot}`} />
                            <span className="text-[10px] font-bold tracking-wider text-muted-foreground uppercase">{sec.label}</span>
                            <span className="text-[9px] text-muted-foreground/60">{sec.items.length}</span>
                          </div>
                          <div className="space-y-0.5">
                            {sec.items.map(item => renderItemRow(item))}
                          </div>
                        </div>
                      ))}
                    </CollapsibleContent>
                  </Collapsible>
                );
              })}
            </div>
          )}

          {/* Empty filter state */}
          {!allClear && groupedByRide.length === 0 && (
            <div className="border border-border rounded-lg p-5 text-center space-y-1.5">
              <CheckCircle className="h-6 w-6 text-success mx-auto" />
              <p className="text-sm font-medium text-foreground">No {filter !== "all" ? filter : "matching"} items</p>
              <button onClick={() => { setFilter("all"); setSearchQuery(""); setCategoryFilter("all"); setRideFilter("all"); }} className="text-xs text-primary font-semibold hover:underline">
                Clear filters
              </button>
            </div>
          )}
        </>
      )}

      {/* ===== COMPLETED TAB ===== */}
      {activeTab === "completed" && effectiveUserId && (
        <CompletedComplianceTab effectiveUserId={effectiveUserId} />
      )}

      {/* Mark Complete Sheet */}
      {markCompleteEvent && (
        <MarkCompleteSheet
          open={markCompleteOpen}
          onOpenChange={(open) => { setMarkCompleteOpen(open); if (!open) setMarkCompleteEvent(null); }}
          eventId={markCompleteEvent.id}
          eventName={markCompleteEvent.title}
          eventCategory={markCompleteEvent.category}
          eventType={markCompleteEvent.eventType}
          rideId={markCompleteEvent.rideId}
          rideName={markCompleteEvent.rideName}
          dueDate={markCompleteEvent.dueDate}
          isRecurring={markCompleteEvent.isRecurring}
          recurrenceRule={markCompleteEvent.recurrenceRule}
          onCompleted={handleCompleted}
        />
      )}
    </div>
  );
};

export default Compliance;
