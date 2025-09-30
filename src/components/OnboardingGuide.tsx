import { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { CheckCircle, Circle, FolderPlus, FileText, CalendarDays, Plus } from 'lucide-react';
import RideForm from '@/components/RideForm';
import { RequestRideTypeDialog } from '@/components/RequestRideTypeDialog';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

export default function OnboardingGuide() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [rideCount, setRideCount] = useState<number | null>(null);
  const [categorizedCount, setCategorizedCount] = useState<number | null>(null);
  const [docCount, setDocCount] = useState<number | null>(null);
  const [openAdd, setOpenAdd] = useState(false);
  const [openRequest, setOpenRequest] = useState(false);

  useEffect(() => {
    async function load() {
      if (!user) return;
      const ridesRes = await supabase
        .from('rides')
        .select('id, category_id', { count: 'exact' })
        .eq('user_id', user.id);
      const categorized = (ridesRes.data ?? []).filter(r => !!r.category_id).length;
      setRideCount(ridesRes.count ?? 0);
      setCategorizedCount(categorized);

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
            <Step done={(rideCount ?? 0) > 0 && (categorizedCount ?? 0) > 0} text="Add a ride or generator and pick its category" />
            <div className="flex flex-col gap-2">
              <Button className="btn-bold-primary" onClick={() => setOpenAdd(true)}>
                <FolderPlus className="w-4 h-4 mr-2" />
                Add a ride or generator
              </Button>
              <Button variant="outline" size="sm" onClick={() => setOpenRequest(true)}>
                <Plus className="w-4 h-4 mr-2" />
                Can't find my category
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              Categories help us match relevant bulletins to your equipment.
            </p>
          </div>

          {/* Step 2 */}
          <TooltipProvider>
            <div className="p-4 rounded-xl bg-secondary space-y-3">
              <Step done={(docCount ?? 0) > 0} text="Put your documents in it" />
              <Tooltip>
                <TooltipTrigger asChild>
                  <div>
                    <Button
                      variant="outline"
                      disabled={(rideCount ?? 0) === 0 || (categorizedCount ?? 0) === 0}
                      onClick={() => {
                        const el = document.getElementById('workspace');
                        if (el) el.scrollIntoView({ behavior: 'smooth' });
                      }}
                      className="w-full"
                    >
                      <FileText className="w-4 h-4 mr-2" />
                      Go to documents
                    </Button>
                  </div>
                </TooltipTrigger>
                {((rideCount ?? 0) === 0 || (categorizedCount ?? 0) === 0) && (
                  <TooltipContent>
                    <p>Add a ride and choose a category first.</p>
                  </TooltipContent>
                )}
              </Tooltip>
              <p className="text-xs text-muted-foreground">
                Risk Assessments, Method Statements, Insurance, Certificates.
              </p>
            </div>
          </TooltipProvider>
        </div>

        <div className="flex items-center gap-3 text-sm">
          <CalendarDays className="w-4 h-4" />
          <span>Turn on reminders in the ride workspace (Checks, Inspections, Calendar).</span>
        </div>
      </CardContent>

      {/* Add Ride dialog */}
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

      {/* Request Category dialog */}
      <RequestRideTypeDialog open={openRequest} onOpenChange={setOpenRequest} />
    </Card>
  );
}
