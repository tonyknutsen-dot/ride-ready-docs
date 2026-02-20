import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useEffectiveUserId } from "@/hooks/useEffectiveUserId";
import {
  AlertTriangle, FileText, ClipboardCheck, ChevronRight,
  Clock, CheckCircle, Wrench, Zap, RefreshCw, Search, Filter,
  List, Layers, CheckSquare, Eye
} from "lucide-react";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { formatDateUK } from "@/utils/dateFormat";
import CompletedComplianceTab from "@/components/CompletedComplianceTab";
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
  const [groupByRide, setGroupByRide] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkMode, setBulkMode] = useState(false);

  // Mark complete sheet state
  const [markCompleteOpen, setMarkCompleteOpen] = useState(false);
  const [markCompleteEvent, setMarkCompleteEvent] = useState<ComplianceItem | null>(null);

  const { data, isLoading, dataUpdatedAt } = useQuery({
    queryKey: ["compliance", effectiveUserId],
    queryFn: () => fetchComplianceData(effectiveUserId!),
    enabled: !!effectiveUserId && !staffLoading,
    staleTime: 1000 * 60 * 2,
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

  // Group by ride (collapsible)
  const groupedByRide = (() => {
    const groups = new Map<string, { rideName: string; rideId: string | null; items: ComplianceItem[] }>();
    filteredItems.forEach((item) => {
      const key = item.rideId || "global";
      if (!groups.has(key)) groups.set(key, { rideName: item.rideName, rideId: item.rideId, items: [] });
      groups.get(key)!.items.push(item);
    });
    return Array.from(groups.values()).sort((a, b) => {
      const aWorst = Math.max(...a.items.map(i => i.severity === "expiring" ? -i.daysValue : i.daysValue));
      const bWorst = Math.max(...b.items.map(i => i.severity === "expiring" ? -i.daysValue : i.daysValue));
      return bWorst - aWorst;
    });
  })();

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
    queryClient.invalidateQueries({ queryKey: ["compliance"] });
    queryClient.invalidateQueries({ queryKey: ["compliance-completed"] });
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
        className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl border border-border bg-card hover:border-primary/50 active:scale-[0.98] transition-all text-left"
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
          <p className="text-sm font-medium text-foreground truncate">{item.title}</p>
          <div className="flex items-center gap-1.5 mt-0.5">
            {!groupByRide && (
              <>
                <span className="text-xs text-muted-foreground truncate max-w-[120px]">{item.rideName}</span>
                <span className="text-[10px] text-muted-foreground/50">·</span>
              </>
            )}
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
    <div className="container mx-auto py-4 pb-24 md:pb-8 max-w-3xl space-y-4">
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
          {/* Last checked */}
          {dataUpdatedAt > 0 && (
            <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground/70">
              <RefreshCw className="h-3 w-3" />
              <span>Last checked: {format(new Date(dataUpdatedAt), "dd MMM yyyy, HH:mm")}</span>
            </div>
          )}

          {/* Filter tiles */}
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
                  className={`rounded-xl border-2 bg-card p-2.5 text-center space-y-0.5 transition-all active:scale-[0.97] ${activeBorder} ${activeRing}`}
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

          {/* Search + Category + Ride + View toggle */}
          <div className="flex flex-wrap gap-2">
            <div className="flex-1 min-w-[140px] relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
              <Input
                placeholder="Search ride or event…"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9 h-9 text-sm"
              />
            </div>
            <Select value={categoryFilter} onValueChange={(v) => setCategoryFilter(v as CategoryFilter)}>
              <SelectTrigger className="w-[120px] h-9 text-sm">
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
            {rideList.length > 1 && (
              <Select value={rideFilter} onValueChange={setRideFilter}>
                <SelectTrigger className="w-[120px] h-9 text-sm">
                  <SelectValue placeholder="All Rides" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Rides</SelectItem>
                  {rideList.map(r => <SelectItem key={r.id} value={r.id}>{r.name}</SelectItem>)}
                </SelectContent>
              </Select>
            )}
            <div className="flex gap-1">
              <Button
                variant={groupByRide ? "default" : "outline"}
                size="icon"
                className="h-9 w-9 flex-shrink-0"
                onClick={() => setGroupByRide(!groupByRide)}
                title={groupByRide ? "Flat list" : "Group by ride"}
              >
                {groupByRide ? <Layers className="h-4 w-4" /> : <List className="h-4 w-4" />}
              </Button>
              <Button
                variant={bulkMode ? "default" : "outline"}
                size="icon"
                className="h-9 w-9 flex-shrink-0"
                onClick={() => { setBulkMode(!bulkMode); setSelectedIds(new Set()); }}
                title="Bulk select"
              >
                <CheckSquare className="h-4 w-4" />
              </Button>
            </div>
          </div>

          {/* Bulk actions bar */}
          {bulkMode && selectedIds.size > 0 && (
            <div className="flex items-center gap-2 rounded-xl border border-primary/30 bg-primary/5 px-3 py-2">
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
            <div className="bg-card border border-border rounded-xl p-6 text-center space-y-2">
              <CheckCircle className="h-10 w-10 text-success mx-auto" />
              <p className="text-sm font-semibold text-foreground">All Clear</p>
              <p className="text-xs text-muted-foreground">No compliance issues found</p>
            </div>
          )}

          {/* Grouped view (collapsible) */}
          {groupByRide && !allClear && (
            <div className="space-y-3">
              {groupedByRide.map((group) => (
                <Collapsible key={group.rideId || "global"} defaultOpen>
                  <CollapsibleTrigger className="w-full flex items-center gap-2 px-1 py-1 hover:bg-muted/30 rounded-lg transition-colors">
                    <ChevronRight className="h-4 w-4 text-muted-foreground transition-transform [[data-state=open]>&]:rotate-90" />
                    <h3 className="text-sm font-bold text-foreground">{group.rideName}</h3>
                    <Badge variant="outline" className="text-[10px]">{group.items.length}</Badge>
                  </CollapsibleTrigger>
                  <CollapsibleContent>
                    <div className="space-y-1.5 mt-1.5">
                      {group.items.map((item) => renderItemRow(item))}
                    </div>
                  </CollapsibleContent>
                </Collapsible>
              ))}
            </div>
          )}

          {/* Flat view (sections by severity) */}
          {!groupByRide && filteredSections.map((section) => {
            const dotColor = section.color === "destructive" ? "bg-destructive" : "bg-warning";
            return (
              <div key={section.title}>
                <div className="flex items-center gap-2 mb-1.5">
                  <span className={`w-2 h-2 rounded-full ${dotColor}`} />
                  <h2 className="text-[13px] font-bold text-foreground uppercase tracking-[1px]">{section.title}</h2>
                  <span className="text-xs text-muted-foreground">({section.items.length})</span>
                </div>
                <div className="space-y-1.5">
                  {section.items.map((item) => renderItemRow(item))}
                </div>
              </div>
            );
          })}

          {/* Empty filter state */}
          {!allClear && !groupByRide && filteredSections.length === 0 && (
            <div className="bg-card border border-border rounded-xl p-6 text-center space-y-2">
              <CheckCircle className="h-8 w-8 text-success mx-auto" />
              <p className="text-sm font-medium text-foreground">No {filter} items</p>
              <button onClick={() => setFilter("all")} className="text-xs text-primary font-semibold hover:underline">
                Show all
              </button>
            </div>
          )}

          {!allClear && groupByRide && groupedByRide.length === 0 && (
            <div className="bg-card border border-border rounded-xl p-6 text-center space-y-2">
              <CheckCircle className="h-8 w-8 text-success mx-auto" />
              <p className="text-sm font-medium text-foreground">No matching items</p>
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
