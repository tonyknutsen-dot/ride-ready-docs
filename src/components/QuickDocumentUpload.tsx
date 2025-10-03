import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Tables } from '@/integrations/supabase/types';
import DocumentUpload from './DocumentUpload';
import { FolderOpen } from 'lucide-react';

type Ride = Tables<'rides'> & {
  ride_categories: {
    name: string;
  };
};

interface QuickDocumentUploadProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function QuickDocumentUpload({ open, onOpenChange }: QuickDocumentUploadProps) {
  const { user } = useAuth();
  const [rides, setRides] = useState<Ride[]>([]);
  const [selectedRideId, setSelectedRideId] = useState<string>('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user && open) {
      loadRides();
    }
  }, [user, open]);

  const loadRides = async () => {
    try {
      const { data, error } = await supabase
        .from('rides')
        .select(`
          *,
          ride_categories (
            name
          )
        `)
        .eq('user_id', user?.id)
        .order('ride_name', { ascending: true });

      if (!error && data) {
        setRides(data as Ride[]);
        // Auto-select first ride if only one exists
        if (data.length === 1) {
          setSelectedRideId(data[0].id);
        }
      }
    } catch (error) {
      console.error('Error loading rides:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleUploadSuccess = () => {
    onOpenChange(false);
    setSelectedRideId('');
  };

  const selectedRide = rides.find(r => r.id === selectedRideId);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Add Document</DialogTitle>
          <DialogDescription>
            Select equipment and upload a document
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          {/* Ride Selector */}
          <div className="space-y-2">
            <Label htmlFor="ride-select" className="flex items-center gap-2">
              <FolderOpen className="h-4 w-4" />
              Select Equipment
            </Label>
            {loading ? (
              <p className="text-sm text-muted-foreground">Loading equipment...</p>
            ) : rides.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No equipment found. Please add equipment first from the Rides page.
              </p>
            ) : (
              <Select value={selectedRideId} onValueChange={setSelectedRideId}>
                <SelectTrigger id="ride-select">
                  <SelectValue placeholder="Choose equipment..." />
                </SelectTrigger>
                <SelectContent>
                  {rides.map((ride) => (
                    <SelectItem key={ride.id} value={ride.id}>
                      {ride.ride_name} - {ride.ride_categories.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>

          {/* Document Upload Form */}
          {selectedRideId && selectedRide && (
            <DocumentUpload
              rideId={selectedRideId}
              rideName={selectedRide.ride_name}
              onUploadSuccess={handleUploadSuccess}
            />
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
