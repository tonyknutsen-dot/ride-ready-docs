import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { FolderPlus, ArrowRight, Sparkles } from 'lucide-react';

export function WelcomeModal() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function checkFirstVisit() {
      if (!user) {
        setLoading(false);
        return;
      }

      try {
        // Check if user has any rides - if not, this is likely their first real visit
        const { count: rideCount } = await supabase
          .from('rides')
          .select('*', { count: 'exact', head: true })
          .eq('user_id', user.id);

        // Check if we've already shown this modal (stored in localStorage)
        const hasSeenWelcome = localStorage.getItem(`welcome_modal_seen_${user.id}`);

        // Show modal if: no rides AND haven't seen welcome modal before
        if (rideCount === 0 && !hasSeenWelcome) {
          setOpen(true);
        }
      } catch (error) {
        console.error('Error checking first visit:', error);
      } finally {
        setLoading(false);
      }
    }

    checkFirstVisit();
  }, [user]);

  const handleDismiss = () => {
    if (user) {
      localStorage.setItem(`welcome_modal_seen_${user.id}`, 'true');
    }
    setOpen(false);
  };

  const handleAddEquipment = () => {
    if (user) {
      localStorage.setItem(`welcome_modal_seen_${user.id}`, 'true');
    }
    setOpen(false);
    navigate('/rides?action=add');
  };

  if (loading) return null;

  return (
    <Dialog open={open} onOpenChange={(isOpen) => {
      if (!isOpen) handleDismiss();
    }}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader className="text-center sm:text-left">
          <div className="flex items-center gap-2 mb-2">
            <Sparkles className="h-5 w-5 text-primary" />
            <DialogTitle>Welcome to Ride Ready!</DialogTitle>
          </div>
          <DialogDescription className="text-base">
            Let's get you started by adding your first piece of equipment — whether it's a ride, stall, or show attraction.
          </DialogDescription>
        </DialogHeader>

        <div className="py-4">
          <div className="bg-muted/50 rounded-lg p-4 border border-border/50">
            <h4 className="font-medium text-sm mb-2">Quick setup takes just 2 minutes:</h4>
            <ul className="text-sm text-muted-foreground space-y-1">
              <li>• Add your equipment details</li>
              <li>• Select a category for tailored checklists</li>
              <li>• Upload certificates & documents</li>
            </ul>
          </div>
        </div>

        <DialogFooter className="flex-col sm:flex-row gap-2">
          <Button
            variant="ghost"
            onClick={handleDismiss}
            className="sm:order-1"
          >
            I'll do this later
            <ArrowRight className="h-4 w-4 ml-1" />
          </Button>
          <Button
            onClick={handleAddEquipment}
            className="sm:order-2"
          >
            <FolderPlus className="h-4 w-4 mr-2" />
            Add My First Equipment
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
