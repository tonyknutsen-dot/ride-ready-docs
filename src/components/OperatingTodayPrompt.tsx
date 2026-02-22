import { useState } from 'react';
import { HardHat, CheckCircle2, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import type { OperatingRide } from '@/hooks/useOperatingToday';

interface OperatingTodayPromptProps {
  rides: OperatingRide[];
  onConfirm: (selectedRideIds: string[]) => void;
  onCancel: () => void;
  submitting?: boolean;
}

export function OperatingTodayPrompt({ rides, onConfirm, onCancel, submitting }: OperatingTodayPromptProps) {
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const toggleRide = (rideId: string) => {
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(rideId)) next.delete(rideId);
      else next.add(rideId);
      return next;
    });
  };

  const selectAll = () => {
    if (selected.size === rides.length) {
      setSelected(new Set());
    } else {
      setSelected(new Set(rides.map(r => r.id)));
    }
  };

  return (
    <div className="bg-card border border-border rounded-2xl overflow-hidden"
         style={{ boxShadow: '0 4px 16px rgba(0,0,0,0.06)' }}>
      {/* Header */}
      <div className="px-5 pt-5 pb-3 text-center space-y-2">
        <div className="flex justify-center">
          <span className="flex items-center justify-center w-11 h-11 rounded-xl bg-primary/10">
            <HardHat className="h-5 w-5 text-primary" strokeWidth={2} />
          </span>
        </div>
        <h2 className="text-base font-bold text-foreground">Select rides operating today</h2>
        <p className="text-xs text-muted-foreground">
          Daily &amp; pre-opening checks will be created for selected rides.
        </p>
      </div>

      {/* Ride List */}
      <div className="px-4 pb-2">
        {rides.length > 1 && (
          <button
            onClick={selectAll}
            className="w-full text-left text-xs font-semibold text-primary px-2 py-1.5 mb-1 hover:underline"
          >
            {selected.size === rides.length ? 'Deselect All' : 'Select All'}
          </button>
        )}
        <div className="max-h-[280px] overflow-y-auto space-y-1 pr-1">
          {rides.map(ride => (
            <label
              key={ride.id}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-xl border cursor-pointer transition-colors ${
                selected.has(ride.id)
                  ? 'bg-primary/5 border-primary/30'
                  : 'bg-background border-border hover:bg-muted/50'
              }`}
            >
              <Checkbox
                checked={selected.has(ride.id)}
                onCheckedChange={() => toggleRide(ride.id)}
                className="shrink-0"
              />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-foreground truncate">{ride.ride_name}</p>
                <p className="text-[11px] text-muted-foreground">{ride.categoryName}</p>
              </div>
            </label>
          ))}
        </div>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-3 px-5 py-4 border-t border-border bg-muted/30">
        <Button
          onClick={() => onConfirm(Array.from(selected))}
          disabled={submitting || selected.size === 0}
          className="flex-1 gap-2"
        >
          <CheckCircle2 className="h-4 w-4" />
          Start Checks ({selected.size})
        </Button>
        <Button
          variant="outline"
          onClick={onCancel}
          disabled={submitting}
          className="gap-2"
        >
          <X className="h-4 w-4" />
          Cancel
        </Button>
      </div>
    </div>
  );
}
