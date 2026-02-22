import { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Power, ChevronDown, Clock } from 'lucide-react';
import { useDailyStatus } from '@/hooks/useDailyStatus';
import { format } from 'date-fns';

interface OperatingTodayCardProps {
  rideId: string;
}

const OperatingTodayCard = ({ rideId }: OperatingTodayCardProps) => {
  const { isOperating, isLoading, canToggle, toggling, toggleOperating, logEntries } = useDailyStatus(rideId);
  const [showConfirmOff, setShowConfirmOff] = useState(false);
  const [reason, setReason] = useState('');
  const [logOpen, setLogOpen] = useState(false);

  const handleToggle = (checked: boolean) => {
    if (!canToggle || toggling) return;

    if (!checked && isOperating) {
      // Toggling OFF — show confirm modal
      setShowConfirmOff(true);
      return;
    }

    // Toggling ON — no reason needed
    toggleOperating();
  };

  const handleConfirmOff = () => {
    toggleOperating(reason.trim() || undefined);
    setShowConfirmOff(false);
    setReason('');
  };

  if (isLoading) {
    return (
      <Card className="border-2 border-border/60 bg-muted/20 animate-pulse">
        <CardContent className="p-5">
          <div className="h-12 bg-muted rounded" />
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <Card className={`border-2 transition-colors ${
        isOperating
          ? 'border-green-300 bg-green-50/50 dark:border-green-700 dark:bg-green-950/20'
          : 'border-orange-200 bg-orange-50/30 dark:border-orange-800 dark:bg-orange-950/10'
      }`}>
        <CardContent className="p-5 space-y-3">
          {/* Main row */}
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-3 min-w-0">
              <div className={`p-2 rounded-lg ${
                isOperating ? 'bg-green-100 dark:bg-green-900/30' : 'bg-orange-100 dark:bg-orange-900/30'
              }`}>
                <Power className={`h-5 w-5 ${isOperating ? 'text-green-600' : 'text-orange-500'}`} />
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <h3 className="font-semibold text-base">Operating Today</h3>
                  <Badge
                    variant="outline"
                    className={`text-xs font-semibold ${
                      isOperating
                        ? 'bg-green-100 text-green-700 border-green-300 dark:bg-green-900/40 dark:text-green-300'
                        : 'bg-orange-100 text-orange-700 border-orange-300 dark:bg-orange-900/40 dark:text-orange-300'
                    }`}
                  >
                    {isOperating ? 'Yes' : 'No'}
                  </Badge>
                </div>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {isOperating
                    ? 'Daily checks required'
                    : 'Daily checks not required'}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              {canToggle ? (
                <Switch
                  checked={isOperating}
                  onCheckedChange={handleToggle}
                  disabled={toggling}
                  className={isOperating ? 'data-[state=checked]:bg-green-600' : ''}
                />
              ) : (
                <Badge
                  variant="secondary"
                  className="text-xs"
                >
                  {isOperating ? 'Yes' : 'No'}
                </Badge>
              )}
            </div>
          </div>

          {/* Read-only hint for non-managers */}
          {!canToggle && (
            <p className="text-xs text-muted-foreground italic">
              Only the Controller or Manager can change this.
            </p>
          )}

          {/* Audit log collapsible */}
          {logEntries.length > 0 && (
            <Collapsible open={logOpen} onOpenChange={setLogOpen}>
              <CollapsibleTrigger className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors w-full">
                <Clock className="h-3 w-3" />
                <span>Today's status log ({logEntries.length})</span>
                <ChevronDown className={`h-3 w-3 ml-auto transition-transform ${logOpen ? 'rotate-180' : ''}`} />
              </CollapsibleTrigger>
              <CollapsibleContent className="mt-2">
                <div className="space-y-1.5 pl-1">
                  {logEntries.map((entry) => (
                    <div key={entry.id} className="flex items-start gap-2 text-xs text-muted-foreground">
                      <span className="font-mono text-[10px] mt-0.5 shrink-0 tabular-nums">
                        {format(new Date(entry.changed_at), 'HH:mm')}
                      </span>
                      <span>
                        <span className="font-medium text-foreground">{entry.changed_by_name || 'Unknown'}</span>
                        {' set Operating Today: '}
                        <span className={entry.new_is_operating ? 'text-green-600 font-semibold' : 'text-orange-600 font-semibold'}>
                          {entry.new_is_operating ? 'ON' : 'OFF'}
                        </span>
                        {entry.reason && (
                          <span className="italic"> ({entry.reason})</span>
                        )}
                      </span>
                    </div>
                  ))}
                </div>
              </CollapsibleContent>
            </Collapsible>
          )}
        </CardContent>
      </Card>

      {/* Confirm OFF modal */}
      <Dialog open={showConfirmOff} onOpenChange={setShowConfirmOff}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Mark ride as NOT operating today?</DialogTitle>
            <DialogDescription>
              This will pause Daily check due/overdue tracking for today.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2 py-2">
            <label className="text-sm font-medium">Reason (optional)</label>
            <Input
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="e.g. Weather, Breakdown, Staffing, Event cancelled"
              className="h-10"
            />
          </div>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" onClick={() => { setShowConfirmOff(false); setReason(''); }}>
              Cancel
            </Button>
            <Button onClick={handleConfirmOff} disabled={toggling}>
              {toggling ? 'Updating…' : 'Confirm'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default OperatingTodayCard;
