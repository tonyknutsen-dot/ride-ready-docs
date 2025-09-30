import { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { CheckCircle, Circle, FolderPlus, FileText, CalendarDays } from 'lucide-react';
import RideForm from '@/components/RideForm';

export default function OnboardingGuide() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [rideCount, setRideCount] = useState<number | null>(null);
  const [docCount, setDocCount] = useState<number | null>(null);
  const [openAdd, setOpenAdd] = useState(false);

  useEffect(() => {
    async function load() {
      if (!user) return;
      const ridesRes = await supabase
        .from('rides')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', user.id);
      setRideCount(ridesRes.count ?? 0);

      const docsRes = await supabase
        .from('documents')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', user.id);
      setDocCount(docsRes.count ?? 0);
    }
    load();
  }, [user]);

  const Step = ({ done, text }: { done: boolean; text: string }) => (
    <div className="flex items-center gap-2">
      {done ? <CheckCircle className="text-success" /> : <Circle className="text-muted-foreground" />}
      <span className="font-medium">{text}</span>
    </div>
  );

  return (
    <Card className="border-2">
      <CardHeader>
        <CardTitle className="text-2xl">Start here</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm text-muted-foreground">
          Two steps to get going. We'll keep it simple and tell you what to do next.
        </p>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Step 1 */}
          <div className="p-4 rounded-xl bg-secondary space-y-3">
            <Step done={(rideCount ?? 0) > 0} text="Add a ride, stall, or generator" />
            <Button className="btn-bold-primary" onClick={() => setOpenAdd(true)}>
              <FolderPlus className="w-4 h-4 mr-2" />
              Add a ride or generator
            </Button>
            <p className="text-xs text-muted-foreground">
              You can add stalls later via "Request a type" if needed.
            </p>
          </div>

          {/* Step 2 */}
          <div className="p-4 rounded-xl bg-secondary space-y-3">
            <Step done={(docCount ?? 0) > 0} text="Put your documents in it" />
            <Button
              variant="outline"
              onClick={() => {
                const el = document.getElementById('workspace');
                if (el) el.scrollIntoView({ behavior: 'smooth' });
              }}
            >
              <FileText className="w-4 h-4 mr-2" />
              Go to documents
            </Button>
            <p className="text-xs text-muted-foreground">
              Risk Assessments, Method Statements, Insurance, Certificates.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3 text-sm">
          <CalendarDays className="w-4 h-4" />
          <span>Turn on reminders in the ride workspace (Checks, Inspections, Calendar).</span>
        </div>
      </CardContent>

      {/* Add Ride dialog (uses your existing RideForm) */}
      <Dialog open={openAdd} onOpenChange={setOpenAdd}>
        <DialogContent className="max-w-2xl">
          <RideForm
            onCancel={() => setOpenAdd(false)}
            onSuccess={() => {
              setOpenAdd(false);
              toast({ title: 'Ride added', description: 'Now add your documents.' });
              const el = document.getElementById('workspace');
              if (el) setTimeout(() => el.scrollIntoView({ behavior: 'smooth' }), 250);
            }}
          />
        </DialogContent>
      </Dialog>
    </Card>
  );
}
