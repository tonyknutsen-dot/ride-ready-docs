import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Loader2, Mail, UserPlus, FolderOpen, ShieldAlert, Check, X } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { STAFF_ACCESS_SUMMARY } from '@/utils/permissions';

interface Ride {
  id: string;
  ride_name: string;
}

interface StaffInviteDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
}

export function StaffInviteDialog({ open, onOpenChange, onSuccess }: StaffInviteDialogProps) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [email, setEmail] = useState('');
  const [selectedRides, setSelectedRides] = useState<string[]>([]);
  const [rides, setRides] = useState<Ride[]>([]);
  const [loading, setLoading] = useState(false);
  const [fetchingRides, setFetchingRides] = useState(false);
  const [showFullAccessConfirm, setShowFullAccessConfirm] = useState(false);

  useEffect(() => {
    if (open && user) {
      fetchRides();
      setEmail('');
      setSelectedRides([]);
    }
  }, [open, user]);

  const fetchRides = async () => {
    if (!user) return;
    setFetchingRides(true);
    try {
      const { data, error } = await supabase
        .from('rides')
        .select('id, ride_name')
        .eq('user_id', user.id)
        .order('ride_name');
      if (error) throw error;
      setRides(data || []);
    } catch (error) {
      console.error('Error fetching rides:', error);
    } finally {
      setFetchingRides(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !email.trim()) return;

    if (selectedRides.length === 0 && rides.length > 0) {
      setShowFullAccessConfirm(true);
      return;
    }

    await sendInvite();
  };

  const sendInvite = async () => {
    if (!user || !email.trim()) return;

    setLoading(true);
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      if (!sessionData.session) throw new Error('Not authenticated');

      const response = await supabase.functions.invoke('send-staff-invite', {
        body: {
          email: email.trim().toLowerCase(),
          permissionLevel: 'staff',
          assignedRides: selectedRides.length > 0 ? selectedRides : null,
          featurePermissions: {
            checks: true,
            maintenance: true,
            calendar: false,
            documents: false,
            risk_assessments: false,
            send_documents: false,
          },
        },
      });

      if (response.error) throw new Error(response.error.message || 'Failed to send invite');

      toast({ title: 'Invitation Sent', description: `An invite has been sent to ${email}` });
      onOpenChange(false);
      onSuccess?.();
    } catch (error: any) {
      console.error('Error sending invite:', error);
      toast({ title: 'Error', description: error.message || 'Failed to send invitation', variant: 'destructive' });
    } finally {
      setLoading(false);
      setShowFullAccessConfirm(false);
    }
  };

  const toggleRide = (rideId: string) => {
    setSelectedRides(prev =>
      prev.includes(rideId) ? prev.filter(id => id !== rideId) : [...prev, rideId]
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg max-h-[85vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <UserPlus className="h-5 w-5 text-primary" />
            Invite Staff Member
          </DialogTitle>
          <DialogDescription>
            Staff can access assigned rides, complete checks, and log maintenance. They cannot access controller areas.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="flex-1 overflow-hidden flex flex-col">
          <div className="flex-1 overflow-y-auto pr-2">
            <div className="space-y-5 pb-4">
              {/* Email */}
              <div className="space-y-2">
                <Label htmlFor="email">Email Address</Label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="email"
                    type="email"
                    placeholder="staff@example.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="pl-10"
                    required
                  />
                </div>
              </div>

              <Separator />

              {/* Read-only access summary */}
              <div className="space-y-2">
                <Label>Staff Access (Fixed)</Label>
                <div className="rounded-lg border border-border p-3 space-y-1.5">
                  {STAFF_ACCESS_SUMMARY.map(item => (
                    <div key={item.label} className="flex items-center gap-2">
                      {item.granted ? (
                        <Check className="h-3.5 w-3.5 text-green-600 flex-shrink-0" />
                      ) : (
                        <X className="h-3.5 w-3.5 text-muted-foreground/30 flex-shrink-0" />
                      )}
                      <span className={`text-xs ${item.granted ? 'text-foreground' : 'text-muted-foreground/40'}`}>
                        {item.label}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              <Separator />

              {/* Equipment Assignment */}
              <div className="space-y-3">
                <Label className="flex items-center gap-2">
                  <FolderOpen className="h-4 w-4" />
                  Equipment Access
                </Label>

                {selectedRides.length === 0 && rides.length > 0 && (
                  <p className="text-xs text-amber-700 bg-amber-50 dark:bg-amber-950/30 rounded-lg p-2.5 border border-amber-200">
                    No equipment selected — this staff member will be able to see <strong>all {rides.length} items</strong>.
                    Select specific items below to restrict access.
                  </p>
                )}

                {selectedRides.length > 0 && (
                  <p className="text-xs text-muted-foreground">
                    Access restricted to {selectedRides.length} selected item{selectedRides.length !== 1 ? 's' : ''}
                  </p>
                )}

                {fetchingRides ? (
                  <div className="flex items-center justify-center py-4">
                    <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                  </div>
                ) : rides.length === 0 ? (
                  <p className="text-sm text-muted-foreground py-2">No equipment found. Add some rides first.</p>
                ) : (
                  <div className="border rounded-lg p-3 max-h-[140px] overflow-y-auto">
                    <div className="space-y-2">
                      {rides.map((ride) => (
                        <div key={ride.id} className="flex items-center space-x-2">
                          <input
                            id={ride.id}
                            type="checkbox"
                            checked={selectedRides.includes(ride.id)}
                            onChange={() => toggleRide(ride.id)}
                            className="h-4 w-4 rounded border border-input bg-background accent-primary"
                          />
                          <label htmlFor={ride.id} className="text-sm cursor-pointer flex-1">
                            {ride.ride_name}
                          </label>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {selectedRides.length > 0 && (
                  <div className="flex flex-wrap gap-1 mt-2">
                    {selectedRides.map(id => {
                      const ride = rides.find(r => r.id === id);
                      return ride ? (
                        <Badge key={id} variant="secondary" className="text-xs">{ride.ride_name}</Badge>
                      ) : null;
                    })}
                  </div>
                )}
              </div>
            </div>
          </div>

          <DialogFooter className="gap-2 sm:gap-0 pt-4 border-t">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button type="submit" disabled={loading || !email.trim()}>
              {loading ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Sending...</> : 'Send Invitation'}
            </Button>
          </DialogFooter>
        </form>

        {/* Full Access Confirmation Dialog */}
        <AlertDialog open={showFullAccessConfirm} onOpenChange={setShowFullAccessConfirm}>
          <AlertDialogContent className="w-[95vw] max-w-[95vw] sm:max-w-md">
            <AlertDialogHeader>
              <AlertDialogTitle className="flex items-center gap-2">
                <ShieldAlert className="h-5 w-5 text-amber-600" />
                Confirm Full Equipment Access
              </AlertDialogTitle>
              <AlertDialogDescription asChild>
                <div className="space-y-3">
                  <p>You haven't selected any specific equipment.</p>
                  <p><strong>{email}</strong> will have access to <strong>ALL {rides.length} items</strong> in your equipment list.</p>
                  <p className="text-muted-foreground">Is this what you want?</p>
                </div>
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter className="gap-2 sm:gap-0">
              <AlertDialogCancel disabled={loading}>Go Back</AlertDialogCancel>
              <AlertDialogAction onClick={sendInvite} disabled={loading} className="bg-amber-600 hover:bg-amber-700">
                {loading ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Sending...</> : 'Yes, Grant Full Access'}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </DialogContent>
    </Dialog>
  );
}
