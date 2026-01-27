import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Loader2, Mail, UserPlus, FolderOpen } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Database } from '@/integrations/supabase/types';

type StaffPermission = Database['public']['Enums']['staff_permission'];

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
  const [permissionLevel, setPermissionLevel] = useState<StaffPermission>('checks_only');
  const [selectedRides, setSelectedRides] = useState<string[]>([]);
  const [rides, setRides] = useState<Ride[]>([]);
  const [loading, setLoading] = useState(false);
  const [fetchingRides, setFetchingRides] = useState(false);

  useEffect(() => {
    if (open && user) {
      fetchRides();
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

    setLoading(true);
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      if (!sessionData.session) {
        throw new Error('Not authenticated');
      }

      const response = await supabase.functions.invoke('send-staff-invite', {
        body: {
          email: email.trim().toLowerCase(),
          permissionLevel,
          assignedRides: selectedRides.length > 0 ? selectedRides : null,
        },
      });

      if (response.error) {
        throw new Error(response.error.message || 'Failed to send invite');
      }

      toast({
        title: 'Invitation Sent',
        description: `An invite has been sent to ${email}`,
      });

      // Reset form
      setEmail('');
      setPermissionLevel('checks_only');
      setSelectedRides([]);
      onOpenChange(false);
      onSuccess?.();
    } catch (error: any) {
      console.error('Error sending invite:', error);
      toast({
        title: 'Error',
        description: error.message || 'Failed to send invitation',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const toggleRide = (rideId: string) => {
    setSelectedRides(prev => 
      prev.includes(rideId) 
        ? prev.filter(id => id !== rideId)
        : [...prev, rideId]
    );
  };

  const permissionDescriptions: Record<StaffPermission, string> = {
    'checks_only': 'Pre-opening, daily, monthly, yearly checks only',
    'checks_maintenance': 'Checks plus maintenance logging',
    'full_access': 'Checks, maintenance, documents, risk assessments',
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <UserPlus className="h-5 w-5 text-primary" />
            Invite Staff Member
          </DialogTitle>
          <DialogDescription>
            Send an invitation to join your team. They'll create their own account.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
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

          {/* Permission Level */}
          <div className="space-y-2">
            <Label>Permission Level</Label>
            <Select value={permissionLevel} onValueChange={(v) => setPermissionLevel(v as StaffPermission)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="checks_only">
                  <div className="flex flex-col items-start">
                    <span>Checks Only</span>
                  </div>
                </SelectItem>
                <SelectItem value="checks_maintenance">
                  <div className="flex flex-col items-start">
                    <span>Checks & Maintenance</span>
                  </div>
                </SelectItem>
                <SelectItem value="full_access">
                  <div className="flex flex-col items-start">
                    <span>Full Access</span>
                  </div>
                </SelectItem>
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              {permissionDescriptions[permissionLevel]}
            </p>
          </div>

          {/* Equipment Assignment */}
          <div className="space-y-2">
            <Label className="flex items-center gap-2">
              <FolderOpen className="h-4 w-4" />
              Assign Equipment (Optional)
            </Label>
            <p className="text-xs text-muted-foreground mb-2">
              Leave empty to allow access to all equipment
            </p>
            
            {fetchingRides ? (
              <div className="flex items-center justify-center py-4">
                <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
              </div>
            ) : rides.length === 0 ? (
              <p className="text-sm text-muted-foreground py-2">
                No equipment found. Add some rides first.
              </p>
            ) : (
              <ScrollArea className="h-[140px] border rounded-lg p-3">
                <div className="space-y-2">
                  {rides.map((ride) => (
                    <div key={ride.id} className="flex items-center space-x-2">
                      <Checkbox
                        id={ride.id}
                        checked={selectedRides.includes(ride.id)}
                        onCheckedChange={() => toggleRide(ride.id)}
                      />
                      <label
                        htmlFor={ride.id}
                        className="text-sm cursor-pointer flex-1"
                      >
                        {ride.ride_name}
                      </label>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            )}

            {selectedRides.length > 0 && (
              <div className="flex flex-wrap gap-1 mt-2">
                {selectedRides.map(id => {
                  const ride = rides.find(r => r.id === id);
                  return ride ? (
                    <Badge key={id} variant="secondary" className="text-xs">
                      {ride.ride_name}
                    </Badge>
                  ) : null;
                })}
              </div>
            )}
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={loading || !email.trim()}>
              {loading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Sending...
                </>
              ) : (
                'Send Invitation'
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
