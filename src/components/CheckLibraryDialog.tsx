import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { CheckSquare, Plus, Search, AlertTriangle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
type Frequency = "daily" | "monthly" | "yearly" | "preuse";

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
  onAdd
}: {
  trigger: React.ReactNode;
  frequency: Frequency;
  rideCategoryId?: string | null;
  onAdd: (labels: string[]) => Promise<void> | void;
}) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const [rows, setRows] = useState<CheckLibraryItem[]>([]);
  const [sel, setSel] = useState<Record<string, boolean>>({});
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    if (!open) return;
    (async () => {
      setLoading(true);
      try {
        const cat = (rideCategoryId && rideCategoryId !== "null") ? rideCategoryId : null;
        
        // Load generic items (ride_category_id is null) + category-specific for this frequency
        let query = supabase
          .from("check_library_items")
          .select("id,label,frequency,ride_category_id,hint,risk_level,sort_index,is_active")
          .eq("frequency", frequency)
          .eq("is_active", true)
          .order("sort_index", { ascending: true });

        // Filter to get generic items OR items matching this ride's category
        if (cat) {
          query = query.or(`ride_category_id.is.null,ride_category_id.eq.${cat}`);
        } else {
          query = query.is("ride_category_id", null);
        }

        const { data, error } = await query;
        if (error) throw error;

        // Sort: category-specific items first, then generic
        const specific = (data || []).filter((r: CheckLibraryItem) => r.ride_category_id === cat);
        const generic = (data || []).filter((r: CheckLibraryItem) => !r.ride_category_id);
        setRows([...specific, ...generic]);
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
  }, [open, frequency, rideCategoryId, toast]);

  const filtered = useMemo(() => {
    if (!q.trim()) return rows;
    const s = q.trim().toLowerCase();
    return rows.filter(r =>
      (r.label || "").toLowerCase().includes(s)
      || (r.hint || "").toLowerCase().includes(s)
      || (r.risk_level || "").toLowerCase().includes(s)
    );
  }, [q, rows]);

  const selectedLabels = useMemo(
    () => filtered.filter(r => sel[r.id]).map(r => r.label),
    [sel, filtered]
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

  return (
    <Dialog open={open} onOpenChange={(v) => { 
      setOpen(v); 
      if (!v) { 
        setSel({}); 
        setQ(""); 
      } 
    }}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="w-[95vw] max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <CheckSquare className="h-5 w-5" />
            Add from library — {frequency.charAt(0).toUpperCase() + frequency.slice(1)} Checks
          </DialogTitle>
          <DialogDescription>
            Select pre-built safety check items to add to your template
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <div className="relative flex-1">
              <Input
                placeholder="Search items (e.g., restraints, fencing, electrics)…"
                value={q}
                onChange={(e) => setQ(e.target.value)}
                className="pl-8"
              />
              <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
            </div>
          </div>

          <div className="rounded-md border p-3 bg-muted/20">
            <div className="text-xs text-muted-foreground">
              <b>Tip:</b> Select multiple items and add them all at once.
              <div className="flex flex-wrap gap-2 mt-2">
                <Badge variant="outline" className="text-[10px]">Generic</Badge>
                <span>= General safety checks for all equipment</span>
              </div>
              <div className="flex flex-wrap gap-2 mt-1">
                <Badge variant="default" className="text-[10px]">Ride-specific</Badge>
                <span>= Tailored to your equipment type</span>
              </div>
            </div>
          </div>

          {/* Summary counts */}
          {!loading && rows.length > 0 && (
            <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
              <span>
                <strong className="text-foreground">{rows.filter(r => !r.ride_category_id).length}</strong> generic items
              </span>
              {rows.filter(r => r.ride_category_id).length > 0 && (
                <span>
                  • <strong className="text-foreground">{rows.filter(r => r.ride_category_id).length}</strong> ride-specific items
                </span>
              )}
            </div>
          )}

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
                    <div className="flex flex-wrap items-center gap-2 mt-2">
                      {r.risk_level && (
                        <Badge className={`text-xs ${getRiskBadgeColor(r.risk_level)}`}>
                          {r.risk_level.toUpperCase()} RISK
                        </Badge>
                      )}
                      {r.ride_category_id ? (
                        <Badge variant="default" className="text-xs">Ride-specific</Badge>
                      ) : (
                        <Badge variant="outline" className="text-xs">Generic</Badge>
                      )}
                    </div>
                  </div>
                </label>
              ))
            )}
          </div>

          <div className="flex flex-wrap items-center justify-between gap-2 pt-3 border-t">
            <div className="text-sm text-muted-foreground">
              {selectedLabels.length ? (
                <span className="font-medium text-foreground">
                  {selectedLabels.length} item{selectedLabels.length > 1 ? 's' : ''} selected
                </span>
              ) : (
                "Choose items to add to your template"
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
