import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Link2, Loader2, Check, X } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useStaff } from '@/contexts/StaffContext';
import { useEffectiveUserId } from '@/hooks/useEffectiveUserId';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { Tables } from '@/integrations/supabase/types';
import { Ride } from '@/types/ride';

type Document = Tables<'documents'>;

interface DocumentRideAssignmentDialogProps {
  document: Document | null;
  isOpen: boolean;
  onClose: () => void;
  onAssignmentsChanged?: () => void;
}

interface RideAssignment {
  rideId: string;
  rideName: string;
  categoryName: string;
  isAssigned: boolean;
}

const DocumentRideAssignmentDialog = ({ 
  document, 
  isOpen, 
  onClose,
  onAssignmentsChanged 
}: DocumentRideAssignmentDialogProps) => {
  const { user } = useAuth();
  const { isStaff } = useStaff();
  const { effectiveUserId } = useEffectiveUserId();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [rides, setRides] = useState<RideAssignment[]>([]);
  const [originalAssignments, setOriginalAssignments] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (isOpen && document && user && effectiveUserId) {
      loadRidesAndAssignments();
    }
  }, [isOpen, document, user, effectiveUserId]);

  const loadRidesAndAssignments = async () => {
    if (!document || !user) return;
    
    setLoading(true);
    try {
      // Fetch all rides (for owners, filter by user_id; for staff, RLS handles it)
      let ridesQuery = supabase
        .from('rides')
        .select('id, ride_name, ride_categories(name)')
        .order('ride_name');

      // Always scope to the current operator.
      ridesQuery = ridesQuery.eq('user_id', effectiveUserId);

      const { data: ridesData, error: ridesError } = await ridesQuery;

      if (ridesError) throw ridesError;

      // Fetch existing assignments for this document
      const { data: assignmentsData, error: assignmentsError } = await supabase
        .from('document_ride_assignments')
        .select('ride_id')
        .eq('document_id', document.id)
        .eq('user_id', user.id);

      if (assignmentsError) throw assignmentsError;

      const assignedRideIds = new Set(assignmentsData?.map(a => a.ride_id) || []);
      setOriginalAssignments(assignedRideIds);

      const rideAssignments: RideAssignment[] = (ridesData || []).map((ride: any) => ({
        rideId: ride.id,
        rideName: ride.ride_name,
        categoryName: ride.ride_categories?.name || 'Unknown',
        isAssigned: assignedRideIds.has(ride.id),
      }));

      setRides(rideAssignments);
    } catch (error: any) {
      console.error('Error loading rides:', error);
      toast({
        title: "Error loading rides",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const toggleRide = (rideId: string) => {
    setRides(prev => prev.map(r => 
      r.rideId === rideId ? { ...r, isAssigned: !r.isAssigned } : r
    ));
  };

  const handleSave = async () => {
    if (!document || !user) return;

    setSaving(true);
    try {
      const currentAssignments = new Set(rides.filter(r => r.isAssigned).map(r => r.rideId));
      
      // Find rides to add and remove
      const toAdd = [...currentAssignments].filter(id => !originalAssignments.has(id));
      const toRemove = [...originalAssignments].filter(id => !currentAssignments.has(id));

      // Remove assignments
      if (toRemove.length > 0) {
        const { error: removeError } = await supabase
          .from('document_ride_assignments')
          .delete()
          .eq('document_id', document.id)
          .eq('user_id', user.id)
          .in('ride_id', toRemove);

        if (removeError) throw removeError;
      }

      // Add new assignments
      if (toAdd.length > 0) {
        const newAssignments = toAdd.map(rideId => ({
          document_id: document.id,
          ride_id: rideId,
          user_id: user.id,
        }));

        const { error: addError } = await supabase
          .from('document_ride_assignments')
          .insert(newAssignments);

        if (addError) throw addError;
      }

      const assignedCount = currentAssignments.size;
      toast({
        title: "Assignments updated",
        description: assignedCount > 0 
          ? `Document assigned to ${assignedCount} ${assignedCount === 1 ? 'item' : 'items'}`
          : 'All assignments removed',
      });

      onAssignmentsChanged?.();
      onClose();
    } catch (error: any) {
      console.error('Error saving assignments:', error);
      toast({
        title: "Error saving assignments",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  const assignedCount = rides.filter(r => r.isAssigned).length;
  const hasChanges = (() => {
    const currentSet = new Set(rides.filter(r => r.isAssigned).map(r => r.rideId));
    if (currentSet.size !== originalAssignments.size) return true;
    for (const id of currentSet) {
      if (!originalAssignments.has(id)) return true;
    }
    return false;
  })();

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="w-[95vw] max-w-[95vw] sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Link2 className="h-5 w-5 text-primary" />
            Assign to Items
          </DialogTitle>
          <DialogDescription>
            Select which items this document covers. 
            <span className="block mt-1 text-xs">
              "{document?.document_name}"
            </span>
          </DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="py-8 flex items-center justify-center">
            <Loader2 className="h-6 w-6 animate-spin text-primary" />
          </div>
        ) : rides.length === 0 ? (
          <div className="py-8 text-center text-muted-foreground">
            <p>No items found.</p>
            <p className="text-sm mt-1">Add some items first to assign documents.</p>
          </div>
        ) : (
          <>
            <div className="flex items-center justify-between text-sm text-muted-foreground mb-2">
              <span>{rides.length} items available</span>
              <Badge variant="secondary" className="font-medium">
                {assignedCount} selected
              </Badge>
            </div>
            
            <ScrollArea className="h-[300px] pr-4">
              <div className="space-y-2">
                {rides.map((ride) => (
                  <label
                    key={ride.rideId}
                    className={`flex items-center gap-3 p-3 rounded-xl border-2 cursor-pointer transition-all ${
                      ride.isAssigned 
                        ? 'border-primary bg-primary/5' 
                        : 'border-border hover:border-primary/30 hover:bg-muted/50'
                    }`}
                  >
                    <Checkbox
                      checked={ride.isAssigned}
                      onCheckedChange={() => toggleRide(ride.rideId)}
                      className="data-[state=checked]:bg-primary data-[state=checked]:border-primary"
                    />
                    <div className="flex-1 min-w-0">
                      <div className="font-medium truncate">{ride.rideName}</div>
                      <div className="text-xs text-muted-foreground">{ride.categoryName}</div>
                    </div>
                    {ride.isAssigned && (
                      <Check className="h-4 w-4 text-primary shrink-0" />
                    )}
                  </label>
                ))}
              </div>
            </ScrollArea>
          </>
        )}

        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="outline" onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <Button 
            onClick={handleSave} 
            disabled={saving || !hasChanges}
            className="gap-2"
          >
            {saving ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Saving...
              </>
            ) : (
              <>
                <Check className="h-4 w-4" />
                Save Assignments
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default DocumentRideAssignmentDialog;
