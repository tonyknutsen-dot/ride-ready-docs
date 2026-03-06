import { useState, useMemo } from 'react';
import { Search, ChevronRight } from 'lucide-react';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/contexts/AuthContext';
import { useStaff } from '@/contexts/StaffContext';
import { useEffectiveUserId } from '@/hooks/useEffectiveUserId';
import { useOfflineQuery } from '@/hooks/useOfflineQuery';
import { supabase } from '@/integrations/supabase/client';
import { Tables } from '@/integrations/supabase/types';
import { cn } from '@/lib/utils';

type Ride = Tables<'rides'> & {
  ride_categories: {
    name: string;
    description: string | null;
  };
};

interface EquipmentPickerDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  subtitle?: string;
  onSelect: (ride: Ride) => void;
  filter?: (ride: Ride) => boolean;
}

const EquipmentPickerDialog = ({
  open,
  onOpenChange,
  title,
  subtitle,
  onSelect,
  filter,
}: EquipmentPickerDialogProps) => {
  const { user } = useAuth();
  const { isStaff } = useStaff();
  const { effectiveUserId } = useEffectiveUserId();
  const [search, setSearch] = useState('');

  const { data: equipment = [], isLoading } = useOfflineQuery<Ride[]>({
    queryKey: ['equipment-picker', effectiveUserId, isStaff],
    queryFn: async () => {
      let query = supabase
        .from('rides')
        .select('*, ride_categories(name, description)')
        .order('ride_name');
      if (!isStaff) {
        query = query.eq('user_id', effectiveUserId);
      }
      const { data, error } = await query;
      if (error) throw error;
      return (data || []) as Ride[];
    },
    enabled: !!user && !!effectiveUserId && open,
    staleTime: 1000 * 60 * 2,
    offlineCacheKey: `equipment-picker:${effectiveUserId}`,
  });

  const filtered = useMemo(() => {
    let list = filter ? equipment.filter(filter) : equipment;
    const t = search.trim().toLowerCase();
    if (t) {
      list = list.filter(e =>
        `${e.ride_name} ${e.ride_categories?.name || ''}`.toLowerCase().includes(t)
      );
    }
    return list;
  }, [equipment, search, filter]);

  const handleSelect = (ride: Ride) => {
    setSearch('');
    onSelect(ride);
  };

  const handleClose = (nextOpen: boolean) => {
    if (!nextOpen) setSearch('');
    onOpenChange(nextOpen);
  };

  return (
    <Sheet open={open} onOpenChange={handleClose}>
      <SheetContent side="bottom" className="max-h-[85vh] rounded-t-2xl">
        <SheetHeader>
          <SheetTitle className="text-base">{title}</SheetTitle>
          {subtitle && (
            <p className="text-xs text-muted-foreground -mt-1">{subtitle}</p>
          )}
        </SheetHeader>

        <div className="mt-3 space-y-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search equipment…"
              className="pl-9 h-10 rounded-xl"
              autoFocus
            />
          </div>

          <div className="space-y-2 overflow-auto pb-2" style={{ maxHeight: '55vh' }}>
            {isLoading ? (
              <div className="text-sm text-muted-foreground text-center py-8">Loading equipment…</div>
            ) : filtered.length === 0 ? (
              <div className="text-sm text-muted-foreground text-center py-8">
                {search ? 'No matching equipment.' : 'No equipment found.'}
              </div>
            ) : (
              filtered.map((ride) => (
                <button
                  key={ride.id}
                  type="button"
                  className={cn(
                    'w-full text-left rounded-xl border border-border p-3.5 flex items-center justify-between gap-3',
                    'hover:bg-muted/30 active:bg-muted/50 active:scale-[0.99] transition-all min-h-[52px]'
                  )}
                  onClick={() => handleSelect(ride)}
                >
                  <div className="min-w-0">
                    <div className="text-sm font-semibold text-foreground truncate">{ride.ride_name}</div>
                    <div className="text-xs text-muted-foreground">{ride.ride_categories?.name || 'Equipment'}</div>
                  </div>
                  <ChevronRight className="h-4 w-4 text-muted-foreground/40 shrink-0" />
                </button>
              ))
            )}
          </div>

          <Button variant="outline" className="w-full min-h-[44px]" onClick={() => handleClose(false)} type="button">
            Cancel
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
};

export default EquipmentPickerDialog;
