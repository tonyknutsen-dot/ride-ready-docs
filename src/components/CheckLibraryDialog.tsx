import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { CheckSquare, Plus, Search } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { ChecklistItemRow, ChecklistSegmentedTabs } from "./checks/ChecklistItemRow";

type Frequency = "daily" | "weekly" | "monthly" | "yearly" | "preopening";
type FilterTab = "all" | "general" | "specific";

interface CheckLibraryItem {
  id: string;
  label: string;
  frequency: Frequency;
  ride_category_id: string | null;
  hint: string | null;
  risk_level: string | null;
  is_active: boolean;
  sort_index: number;
}

export interface AddedLibraryItem {
  label: string;
  source: "specific" | "general";
}

const getLibraryFrequencies = (value: Frequency): Frequency[] => {
  return value === "daily" || value === "preopening" ? ["daily", "preopening"] : [value];
};

export default function CheckLibraryDialog({
  trigger,
  frequency,
  rideCategoryId,
  equipmentGroup,
  categoryGroupLabel,
  onAdd
}: {
  trigger: React.ReactNode;
  frequency: Frequency;
  rideCategoryId?: string | null;
  equipmentGroup?: string | null;
  categoryGroupLabel?: string;
  onAdd: (items: AddedLibraryItem[]) => Promise<void> | void;
}) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const [rows, setRows] = useState<CheckLibraryItem[]>([]);
  const [sel, setSel] = useState<Record<string, boolean>>({});
  const [loading, setLoading] = useState(false);
  const [tab, setTab] = useState<FilterTab>("specific");
  const { toast } = useToast();

  const resolvedGroup = equipmentGroup || 'rides'; // fallback only for legacy rides without equipmentGroup prop
  const specificLabel = categoryGroupLabel || (resolvedGroup === 'inflatables' ? 'Inflatables' : 'Equipment-specific');

  useEffect(() => {
    if (!open) return;
    (async () => {
      setLoading(true);
      try {
        const cat = (rideCategoryId && rideCategoryId !== "null") ? rideCategoryId : null;
        
        let query = supabase
          .from("check_library_items")
          .select("id,label,frequency,ride_category_id,hint,risk_level,sort_index,is_active")
          .in("frequency", getLibraryFrequencies(frequency))
          .eq("is_active", true)
          .eq("equipment_group", resolvedGroup)
          .eq("item_kind", "operational") // exclude compliance/document items from operational checklists
          .order("sort_index", { ascending: true });

        if (cat) {
          query = query.or(`ride_category_id.is.null,ride_category_id.eq.${cat}`);
        } else {
          query = query.is("ride_category_id", null);
        }

        const { data, error } = await query;
        if (error) throw error;

        const specific = (data || []).filter((r: CheckLibraryItem) => r.ride_category_id === cat);
        const generic = (data || []).filter((r: CheckLibraryItem) => !r.ride_category_id);
        setRows([...specific, ...generic]);

        // Default to ride-specific tab when items exist; otherwise show General
        setTab(specific.length > 0 ? "specific" : "general");
      } catch (error: any) {
        console.error("Error loading library items:", error);
        toast({
          title: "Error loading library",
          description: error.message,
          variant: "destructive"
        });
        setRows([]);
      } finally {
        setLoading(false);
      }
    })();
  }, [open, frequency, rideCategoryId, resolvedGroup, toast]);

  const generalCount = useMemo(() => rows.filter(r => !r.ride_category_id).length, [rows]);
  const specificCount = useMemo(() => rows.filter(r => r.ride_category_id).length, [rows]);
  const hasSpecific = specificCount > 0;

  const tabFiltered = useMemo(() => {
    if (tab === "general") return rows.filter(r => !r.ride_category_id);
    if (tab === "specific") return rows.filter(r => r.ride_category_id);
    return rows;
  }, [tab, rows]);

  const filtered = useMemo(() => {
    if (!q.trim()) return tabFiltered;
    const s = q.trim().toLowerCase();
    return tabFiltered.filter(r =>
      (r.label || "").toLowerCase().includes(s)
      || (r.hint || "").toLowerCase().includes(s)
      || (r.risk_level || "").toLowerCase().includes(s)
    );
  }, [q, tabFiltered]);

  const selectedItems = useMemo<AddedLibraryItem[]>(
    () => rows.filter(r => sel[r.id]).map(r => ({ label: r.label, source: r.ride_category_id ? "specific" : "general" })),
    [sel, rows]
  );

  const handleAddSelected = async () => {
    if (selectedItems.length === 0) return;
    try {
      await onAdd(selectedItems);
      toast({
        title: "Items added",
        description: `${selectedItems.length} check item${selectedItems.length > 1 ? 's' : ''} added to template`
      });
      setOpen(false);
      setSel({});
      setQ("");
      setTab("all");
    } catch (error: any) {
      console.error("Error adding items:", error);
      toast({
        title: "Error adding items",
        description: error.message,
        variant: "destructive"
      });
    }
  };

  const tabs: { key: FilterTab; label: string; count: number }[] = [
    ...(hasSpecific ? [{ key: "specific" as FilterTab, label: specificLabel, count: specificCount }] : []),
    { key: "general", label: "General", count: generalCount },
    { key: "all", label: "All", count: rows.length },
  ];

  return (
    <Dialog open={open} onOpenChange={(v) => { 
      setOpen(v); 
      if (!v) { 
        setSel({}); 
        setQ(""); 
        setTab("specific");
      } 
    }}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="w-[95vw] max-w-2xl max-h-[90vh] md:max-h-[85vh] overflow-y-auto p-3 md:p-6">
        <DialogHeader className="pb-1 md:pb-2">
          <DialogTitle className="flex items-center gap-2 text-sm md:text-base">
            <CheckSquare className="h-4 w-4 md:h-5 md:w-5 flex-shrink-0" />
            <span className="md:hidden">{frequency.charAt(0).toUpperCase() + frequency.slice(1)} checks</span>
            <span className="hidden md:inline">{frequency.charAt(0).toUpperCase() + frequency.slice(1)} Check Items</span>
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-2 md:space-y-3">
          {/* Search */}
          <div className="relative">
            <Input
              placeholder="Search items…"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              className="pl-8 h-9"
            />
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          </div>

          {/* Helper line — desktop only (mobile uses tabs as primary signal) */}
          <p className="hidden md:block text-xs text-muted-foreground">Select items to add to your checklist</p>

          {/* Segmented tabs — tighter on mobile */}
          {!loading && rows.length > 0 && (
            <ChecklistSegmentedTabs options={tabs} value={tab} onChange={(next) => setTab(next as FilterTab)} />
          )}

          {/* Item list — tighter rows on mobile, inline source pill */}
          <div className="space-y-1.5 md:space-y-2 max-h-[55vh] md:max-h-[50vh] overflow-y-auto pb-14 md:pb-0">
            {loading ? (
              <div className="text-sm text-muted-foreground py-8 text-center">Loading check items…</div>
            ) : filtered.length === 0 ? (
              <div className="text-sm text-muted-foreground py-8 text-center space-y-2">
                {rows.length === 0 ? (
                  <p>No {frequency} check items found in library.</p>
                ) : tab === "specific" && !q.trim() ? (
                  <>
                    <p className="font-medium text-foreground">No items specific to {specificLabel} yet.</p>
                    <p className="text-xs">Try the <button type="button" onClick={() => setTab("general")} className="underline text-primary">General</button> tab or add your own.</p>
                  </>
                ) : (
                  <p>No items match your search.</p>
                )}
              </div>
            ) : (
              filtered.map((r) => (
                <ChecklistItemRow
                  key={r.id}
                  text={r.label}
                  hint={r.hint}
                  source={r.ride_category_id ? "specific" : "general"}
                  rideTypeName={categoryGroupLabel}
                  riskLevel={r.risk_level}
                  selected={!!sel[r.id]}
                  onSelectedChange={(checked) => setSel(prev => ({ ...prev, [r.id]: checked }))}
                />
              ))
            )}
          </div>

          {/* Footer — sticky compact bar on mobile, inline on desktop */}
          <div className="fixed md:static bottom-0 left-0 right-0 md:bottom-auto z-10 bg-background border-t md:border-t-0 px-3 py-2 md:px-0 md:py-0 md:pt-3 flex flex-wrap items-center justify-between gap-2 md:border-t md:border-border">
            <div className="text-xs md:text-sm text-muted-foreground">
              {selectedItems.length ? (
                <span className="font-medium text-foreground">
                  {selectedItems.length} selected
                </span>
              ) : (
                "Choose items to add"
              )}
            </div>
            <Button
              disabled={selectedItems.length === 0}
              onClick={handleAddSelected}
              size="sm"
              className="gap-1.5 h-9"
            >
              <Plus className="w-4 h-4" /> Add{selectedItems.length > 0 && ` (${selectedItems.length})`}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
