import { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Power, ChevronDown, Clock, AlertCircle } from 'lucide-react';
import { useDailyStatus } from '@/hooks/useDailyStatus';
import { format } from 'date-fns';

interface OperatingTodayCardProps {
  rideId: string;
}

const OperatingTodayCard = ({ rideId }: OperatingTodayCardProps) => {
  const { isOperating, isLoading, canToggle, toggling, toggleOperating, logEntries } = useDailyStatus(rideId);
  const [showReasonInput, setShowReasonInput] = useState(false);
  const [reason, setReason] = useState('');
  const [logOpen, setLogOpen] = useState(false);

  const handleToggle = (checked: boolean) => {
    if (!canToggle || toggling) return;

    if (!checked && isOperating) {
      // Toggling OFF — prompt for optional reason
      setShowReasonInput(true);
      return;
    }

    // Toggling ON — no reason needed
    toggleOperating();
  };

  const handleConfirmOff = () => {
    toggleOperating(reason.trim() || undefined);
    setShowReasonInput(false);
    setReason('');
  };

  const handleCancelOff = () => {
    setShowReasonInput(false);
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
                  {isOperating ? 'Operating' : 'Not operating'}
                </Badge>
              </div>
              <p className="text-xs text-muted-foreground mt-0.5">
                {isOperating
                  ? 'Daily check required before operation.'
                  : 'This controls whether daily checks are required today.'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <Switch
              checked={isOperating}
              onCheckedChange={handleToggle}
              disabled={!canToggle || toggling}
              className={isOperating ? 'data-[state=checked]:bg-green-600' : ''}
            />
          </div>
        </div>

        {/* Reason input when toggling OFF */}
        {showReasonInput && (
          <div className="bg-background border border-border rounded-xl p-3 space-y-2">
            <div className="flex items-start gap-2">
              <AlertCircle className="h-4 w-4 text-orange-500 mt-0.5 shrink-0" />
              <p className="text-sm text-muted-foreground">
                Why is this ride not operating today? <span className="italic">(optional but recommended)</span>
              </p>
            </div>
            <Input
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="e.g. Weather, Breakdown, Staffing, Event cancelled"
              className="h-10"
            />
            <div className="flex gap-2 justify-end">
              <Button variant="outline" size="sm" onClick={handleCancelOff}>
                Cancel
              </Button>
              <Button size="sm" onClick={handleConfirmOff} disabled={toggling}>
                {toggling ? 'Updating…' : 'Confirm not operating'}
              </Button>
            </div>
          </div>
        )}

        {/* Not editable hint for non-managers */}
        {!canToggle && (
          <p className="text-xs text-muted-foreground italic">
            Only a controller or manager can change this status.
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
                        <span className="italic"> (Reason: {entry.reason})</span>
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
  );
};

export default OperatingTodayCard;
