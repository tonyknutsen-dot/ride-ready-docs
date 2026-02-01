import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Loader2, Package } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';

interface Ride {
  id: string;
  ride_name: string;
}

interface StaffEquipmentDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  memberId: string;
  memberEmail: string;
  currentAssignments: string[];
  onSuccess: () => void;
}

export function StaffEquipmentDialog({
  open,
  onOpenChange,
  memberId,
  memberEmail,
  currentAssignments,
  onSuccess,
}: StaffEquipmentDialogProps) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [rides, setRides] = useState<Ride[]>([]);
  const [selectedRides, setSelectedRides] = useState<string[]>(currentAssignments);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  // Avoid infinite loops: parent passes a new array instance each render.
  // Using a stable key (by value) prevents this effect from re-triggering endlessly.
  const currentAssignmentsKey = [...currentAssignments].sort().join('|');

  useEffect(() => {
    if (!open || !user) return;
    fetchRides();
    setSelectedRides(currentAssignments);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, user, memberId, currentAssignmentsKey]);

  const fetchRides = async () => {
    if (!user) return;
    setLoading(true);

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
      setLoading(false);
    }
  };

  const toggleRide = (rideId: string) => {
    setSelectedRides((prev) =>
      prev.includes(rideId)
        ? prev.filter((id) => id !== rideId)
        : [...prev, rideId]
    );
  };

  const selectAll = () => {
    setSelectedRides(rides.map((r) => r.id));
  };

  const selectNone = () => {
    setSelectedRides([]);
  };

  const handleSave = async () => {
    setSaving(true);

    try {
      // Delete existing assignments
      const { error: deleteError } = await supabase
        .from('staff_equipment_assignments')
        .delete()
        .eq('member_id', memberId);

      if (deleteError) throw deleteError;

      // Insert new assignments (if any selected)
      if (selectedRides.length > 0 && user) {
        const assignments = selectedRides.map((rideId) => ({
          member_id: memberId,
          ride_id: rideId,
          assigned_by: user.id,
        }));

        const { error: insertError } = await supabase
          .from('staff_equipment_assignments')
          .insert(assignments);

        if (insertError) throw insertError;
      }

      toast({
        title: 'Equipment updated',
        description: selectedRides.length === 0
          ? 'Staff member now has access to all equipment'
          : `Staff member assigned to ${selectedRides.length} item${selectedRides.length === 1 ? '' : 's'}`,
      });

      onSuccess();
      onOpenChange(false);
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Package className="h-5 w-5 text-primary" />
            Manage Equipment Access
          </DialogTitle>
          <DialogDescription>
            Choose which equipment <span className="font-medium">{memberEmail}</span> can access.
            If none are selected, they'll have access to all your equipment.
          </DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-primary" />
          </div>
        ) : rides.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <Package className="h-10 w-10 mx-auto mb-3 opacity-50" />
            <p>No equipment found</p>
            <p className="text-sm">Add equipment first to assign access</p>
          </div>
        ) : (
          <>
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm text-muted-foreground">
                {selectedRides.length === 0 
                  ? 'Access to all equipment' 
                  : `${selectedRides.length} of ${rides.length} selected`}
              </span>
              <div className="flex gap-2">
                <Button variant="ghost" size="sm" onClick={selectAll}>
                  All
                </Button>
                <Button variant="ghost" size="sm" onClick={selectNone}>
                  None
                </Button>
              </div>
            </div>

            <ScrollArea className="max-h-[300px] border rounded-lg p-1">
              <div className="space-y-1">
                {rides.map((ride) => (
                  <div
                    key={ride.id}
                    className="flex items-center gap-3 p-2 rounded-md hover:bg-muted/50 cursor-pointer"
                    onClick={() => toggleRide(ride.id)}
                  >
                    <Checkbox
                      id={ride.id}
                      checked={selectedRides.includes(ride.id)}
                      onCheckedChange={() => toggleRide(ride.id)}
                    />
                    <Label
                      htmlFor={ride.id}
                      className="flex-1 cursor-pointer font-normal"
                    >
                      {ride.ride_name}
                    </Label>
                  </div>
                ))}
              </div>
            </ScrollArea>

            <p className="text-xs text-muted-foreground bg-muted/50 rounded-lg p-3">
              <strong>Tip:</strong> Selecting "None" gives access to <em>all</em> equipment. 
              Only select specific items if you want to restrict access.
            </p>
          </>
        )}

        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={saving || loading}>
            {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Save Changes
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
