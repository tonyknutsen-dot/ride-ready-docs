import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Search, ShieldAlert, Shield } from "lucide-react";

type ItemType = "hazard" | "control";
type FilterTab = "specific" | "general" | "all";

interface RiskLibraryItem {
  id: string;
  label: string;
  item_type: string;
  equipment_group: string;
  category: string | null;
  sort_index: number;
  is_active: boolean;
}

interface RiskLibraryDialogProps {
  trigger: React.ReactNode;
  itemType: ItemType;
  equipmentGroup: string;
  groupLabel: string;
  onSelect: (label: string) => void;
}

export default function RiskLibraryDialog({
  trigger,
  itemType,
  equipmentGroup,
  groupLabel,
  onSelect,
}: RiskLibraryDialogProps) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const [rows, setRows] = useState<RiskLibraryItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [tab, setTab] = useState<FilterTab>("specific");

  useEffect(() => {
    if (!open) return;
    (async () => {
      setLoading(true);
      try {
        const { data, error } = await supabase
          .from("risk_library_items")
          .select("id,label,item_type,equipment_group,category,sort_index,is_active")
          .eq("item_type", itemType)
          .eq("is_active", true)
          .in("equipment_group", ["general", equipmentGroup])
          .order("category", { ascending: true })
          .order("sort_index", { ascending: true });

        if (error) throw error;
        setRows(data || []);

        // Default to group-specific if it has items, otherwise General
        const specificCount = (data || []).filter(r => r.equipment_group === equipmentGroup).length;
        setTab(specificCount > 0 ? "specific" : "general");
      } catch (err: any) {
        console.error("Error loading risk library:", err);
        setRows([]);
      } finally {
        setLoading(false);
      }
    })();
  }, [open, itemType, equipmentGroup]);

  const generalItems = useMemo(() => rows.filter(r => r.equipment_group === "general"), [rows]);
  const specificItems = useMemo(() => rows.filter(r => r.equipment_group === equipmentGroup), [rows, equipmentGroup]);

  const tabFiltered = useMemo(() => {
    if (tab === "general") return generalItems;
    if (tab === "specific") return specificItems;
    return rows;
  }, [tab, generalItems, specificItems, rows]);

  const filtered = useMemo(() => {
    if (!q.trim()) return tabFiltered;
    const s = q.trim().toLowerCase();
    return tabFiltered.filter(r => (r.label || "").toLowerCase().includes(s));
  }, [q, tabFiltered]);

  // Group by category
  const grouped = useMemo(() => {
    const map = new Map<string, RiskLibraryItem[]>();
    for (const item of filtered) {
      const cat = item.category || "Other";
      if (!map.has(cat)) map.set(cat, []);
      map.get(cat)!.push(item);
    }
    return Array.from(map.entries());
  }, [filtered]);

  const handleSelect = (label: string) => {
    onSelect(label);
    setOpen(false);
    setQ("");
  };

  const tabs: { key: FilterTab; label: string; count: number }[] = [
    ...(specificItems.length > 0
      ? [{ key: "specific" as FilterTab, label: groupLabel, count: specificItems.length }]
      : []),
    { key: "general", label: "General", count: generalItems.length },
    { key: "all", label: "All", count: rows.length },
  ];

  const icon = itemType === "hazard"
    ? <ShieldAlert className="h-5 w-5 flex-shrink-0" />
    : <Shield className="h-5 w-5 flex-shrink-0" />;

  return (
    <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) setQ(""); }}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="w-[95vw] max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader className="pb-0">
          <DialogTitle className="flex items-center gap-2 text-base">
            {icon}
            {itemType === "hazard" ? "Hazard Library" : "Control Library"}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-3">
          {/* Search */}
          <div className="relative">
            <Input
              placeholder={`Search ${itemType}s…`}
              value={q}
              onChange={(e) => setQ(e.target.value)}
              className="pl-8 h-9"
            />
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          </div>

          <p className="text-xs text-muted-foreground">
            Tap an item to select it
          </p>

          {/* Segmented tabs */}
          {!loading && rows.length > 0 && (
            <div className="flex gap-1 p-0.5 rounded-lg bg-muted/50">
              {tabs.map(t => (
                <button
                  key={t.key}
                  onClick={() => setTab(t.key)}
                  className={`flex-1 text-xs font-medium py-1.5 px-2 rounded-md transition-colors ${
                    tab === t.key
                      ? 'bg-background text-foreground shadow-sm'
                      : 'text-muted-foreground hover:text-foreground'
                  }`}
                >
                  {t.label} ({t.count})
                </button>
              ))}
            </div>
          )}

          {/* Item list grouped by category */}
          <div className="space-y-1 max-h-[50vh] overflow-y-auto">
            {loading ? (
              <div className="text-sm text-muted-foreground py-8 text-center">Loading…</div>
            ) : grouped.length === 0 ? (
              <div className="text-sm text-muted-foreground py-8 text-center">
                {rows.length === 0 ? `No ${itemType} items found in library.` : "No items match your search."}
              </div>
            ) : (
              grouped.map(([category, items]) => (
                <div key={category}>
                  <div className="sticky top-0 bg-background/95 backdrop-blur-sm z-10 px-1 py-1.5">
                    <span className="text-xs font-semibold text-primary uppercase tracking-wide">
                      {category}
                    </span>
                  </div>
                  {items.map(item => (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => handleSelect(item.label)}
                      className="w-full text-left text-sm px-3 py-2.5 rounded-xl hover:bg-muted/30 transition-colors cursor-pointer border border-transparent hover:border-border"
                    >
                      {item.label}
                    </button>
                  ))}
                </div>
              ))
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
