import { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { CheckCircle, Circle, ChevronDown, Clock, AlertOctagon } from 'lucide-react';
import { useDailyStatus } from '@/hooks/useDailyStatus';
import { useOpenCriticalDefects } from '@/hooks/useOpenCriticalDefects';
import { useAppRole } from '@/hooks/useAppRole';
import { useToast } from '@/hooks/use-toast';
import NotOperatingReasonDialog from '@/components/NotOperatingReasonDialog';
import { format } from 'date-fns';

interface OperatingTodayCardProps {
  rideId: string;
}

const OperatingTodayCard = ({ rideId }: OperatingTodayCardProps) => {
  const { isOperating, isLoading, canToggle, toggling, toggleOperating, logEntries } = useDailyStatus(rideId);
  const { hasCriticalDefects } = useOpenCriticalDefects(rideId);
  const role = useAppRole();
  const { toast } = useToast();
  const [showConfirmOff, setShowConfirmOff] = useState(false);
  const [logOpen, setLogOpen] = useState(false);
  const [showOverrideDialog, setShowOverrideDialog] = useState(false);
  const [overrideReason, setOverrideReason] = useState('');

  const isControllerOrManager = role === 'controller' || role === 'manager';

  const handleToggle = (checked: boolean) => {
    if (!canToggle || toggling) return;

    if (!checked && isOperating) {
      setShowConfirmOff(true);
      return;
    }

    // Trying to turn ON — block if critical defects exist
    if (checked && !isOperating && hasCriticalDefects) {
      if (isControllerOrManager) {
        setShowOverrideDialog(true);
      } else {
        toast({
          title: 'Cannot mark operating',
          description: 'This ride cannot be marked operating while an open critical defect exists.',
          variant: 'destructive',
        });
      }
      return;
    }

    toggleOperating();
  };

  const handleConfirmOff = (reason: string) => {
    toggleOperating(reason);
    setShowConfirmOff(false);
  };

  const handleOverrideConfirm = () => {
    if (!overrideReason.trim()) return;
    toggleOperating(`Override: ${overrideReason.trim()}`);
    setShowOverrideDialog(false);
    setOverrideReason('');
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
          ? 'border-green-300 bg-green-50/60 dark:border-green-700 dark:bg-green-950/20'
          : 'border-border bg-muted/30 dark:bg-muted/10'
      }`}>
        <CardContent className="p-5 space-y-3">
          {/* Main row */}
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-3 min-w-0">
              <div className={`p-2.5 rounded-full ${
                isOperating
                  ? 'bg-green-100 dark:bg-green-900/30'
                  : 'bg-muted dark:bg-muted/40'
              }`}>
                {isOperating ? (
                  <CheckCircle className="h-5 w-5 text-green-600 dark:text-green-400" />
                ) : (
                  <Circle className="h-5 w-5 text-muted-foreground" />
                )}
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <h3 className="font-semibold text-base">Operating Today</h3>
                  <Badge
                    variant="outline"
                    className={`text-xs font-semibold ${
                      isOperating
                        ? 'bg-green-100 text-green-700 border-green-300 dark:bg-green-900/40 dark:text-green-300'
                        : 'bg-muted text-muted-foreground border-border'
                    }`}
                  >
                    {isOperating ? 'Operating' : 'Not Operating'}
                  </Badge>
                </div>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {isOperating
                    ? 'Daily checks required before operation.'
                    : 'Daily checks not required today.'}
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
                <Badge variant="secondary" className="text-xs">
                  {isOperating ? 'Yes' : 'No'}
                </Badge>
              )}
            </div>
          </div>

          {/* Read-only hint for non-managers */}
          {!canToggle && (
            <p className="text-xs text-muted-foreground italic">
              Only Controller/Manager can change this.
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
                        <span className={entry.new_is_operating ? 'text-green-600 font-semibold' : 'text-muted-foreground font-semibold'}>
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

      {/* Confirm OFF modal with structured reason */}
      <NotOperatingReasonDialog
        open={showConfirmOff}
        onOpenChange={setShowConfirmOff}
        onConfirm={handleConfirmOff}
        disabled={toggling}
        preselectReason={hasCriticalDefects ? 'Critical defect (pre-opening/daily check)' : undefined}
      />

      {/* Override dialog — controller/manager only when critical defect blocks ON */}
      <Dialog open={showOverrideDialog} onOpenChange={setShowOverrideDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <div className="flex items-center gap-2 mb-1">
              <AlertOctagon className="h-5 w-5 text-destructive" />
              <DialogTitle className="text-destructive">Override — Open critical defect</DialogTitle>
            </div>
            <DialogDescription>
              You are overriding an open critical defect and marking this ride operating. This action must be justified and will be logged.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-1.5 py-2">
            <Label className="text-sm font-medium">Reason for override *</Label>
            <Textarea
              value={overrideReason}
              onChange={(e) => setOverrideReason(e.target.value)}
              placeholder="Explain why the ride can operate despite the critical defect…"
              rows={2}
              className="text-sm"
            />
          </div>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" onClick={() => { setShowOverrideDialog(false); setOverrideReason(''); }}>
              Cancel
            </Button>
            <Button onClick={handleOverrideConfirm} disabled={toggling || !overrideReason.trim()} className="bg-amber-600 hover:bg-amber-700 text-white">
              {toggling ? 'Updating…' : 'Override and mark operating'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default OperatingTodayCard;
