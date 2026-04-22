import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { CheckSquare, Plus, Search, AlertTriangle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

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
  onAdd: (labels: string[]) => Promise<void> | void;
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
          .eq("frequency", frequency)
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

  const selectedLabels = useMemo(
    () => rows.filter(r => sel[r.id]).map(r => r.label),
    [sel, rows]
  );

  const handleAddSelected = async () => {
    if (selectedLabels.length === 0) return;
    try {
      await onAdd(selectedLabels);
      toast({
        title: "Items added",
        description: `${selectedLabels.length} check item${selectedLabels.length > 1 ? 's' : ''} added to template`
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

  const getRiskBadgeColor = (level: string | null) => {
    switch (level) {
      case 'high': return 'bg-red-600 text-white hover:bg-red-700';
      case 'med': return 'bg-yellow-600 text-white hover:bg-yellow-700';
      case 'low': return 'bg-green-600 text-white hover:bg-green-700';
      default: return '';
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
      <DialogContent className="w-[95vw] max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader className="pb-0">
          <DialogTitle className="flex items-center gap-2 text-base">
            <CheckSquare className="h-5 w-5 flex-shrink-0" />
            {frequency.charAt(0).toUpperCase() + frequency.slice(1)} Check Items
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-3">
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

          {/* Helper line */}
          <p className="text-xs text-muted-foreground">Select items to add to your checklist</p>

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

          {/* Item list */}
          <div className="space-y-2 max-h-[50vh] overflow-y-auto">
            {loading ? (
              <div className="text-sm text-muted-foreground py-8 text-center">Loading check items…</div>
            ) : filtered.length === 0 ? (
              <div className="text-sm text-muted-foreground py-8 text-center">
                {rows.length === 0 
                  ? `No ${frequency} check items found in library.`
                  : "No items match your search."}
              </div>
            ) : (
              filtered.map((r) => (
                <label 
                  key={r.id} 
                  className="flex items-start gap-3 border rounded-xl p-3 hover:bg-muted/30 transition-colors cursor-pointer"
                >
                  <input
                    type="checkbox"
                    checked={!!sel[r.id]}
                    onChange={(e) => setSel(prev => ({ ...prev, [r.id]: e.target.checked }))}
                    className="mt-1 h-4 w-4 cursor-pointer"
                  />
                  <div className="min-w-0 flex-1">
                    <div className="font-medium break-any flex items-start gap-2">
                      {r.risk_level === 'high' && <AlertTriangle className="h-4 w-4 text-red-600 flex-shrink-0 mt-0.5" />}
                      <span>{r.label}</span>
                    </div>
                    {r.hint && (
                      <div className="text-xs text-muted-foreground mt-1 break-any">{r.hint}</div>
                    )}
                    {r.risk_level && (
                      <div className="mt-2">
                        <Badge className={`text-xs ${getRiskBadgeColor(r.risk_level)}`}>
                          {r.risk_level.toUpperCase()} RISK
                        </Badge>
                      </div>
                    )}
                  </div>
                </label>
              ))
            )}
          </div>

          {/* Footer */}
          <div className="flex flex-wrap items-center justify-between gap-2 pt-3 border-t">
            <div className="text-sm text-muted-foreground">
              {selectedLabels.length ? (
                <span className="font-medium text-foreground">
                  {selectedLabels.length} item{selectedLabels.length > 1 ? 's' : ''} selected
                </span>
              ) : (
                "Choose items to add"
              )}
            </div>
            <Button
              disabled={selectedLabels.length === 0}
              onClick={handleAddSelected}
              className="gap-2"
            >
              <Plus className="w-4 h-4" /> Add {selectedLabels.length > 0 && `(${selectedLabels.length})`}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
