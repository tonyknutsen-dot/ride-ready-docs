import { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { CheckCircle, Circle, FolderPlus, FileText, CalendarDays, Plus } from 'lucide-react';
import RideForm from '@/components/RideForm';
import { RequestRideTypeDialog } from '@/components/RequestRideTypeDialog';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { APP_FLAVOR } from '@/config/appFlavor';

export default function OnboardingGuide() {
  const { user } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
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

  const Step = ({ done, text, number }: { done: boolean; text: string; number: number }) => (
    <div className="flex items-start gap-3">
      <div className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center font-semibold text-sm ${
        done ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'
      }`}>
        {done ? <CheckCircle className="w-4 h-4" /> : number}
      </div>
      <span className="font-medium text-base mt-1">{text}</span>
    </div>
  );

  return (
    <Card>
      <CardHeader className="pb-4">
        <CardTitle className="text-xl">Quick Start Guide</CardTitle>
        <p className="text-sm text-muted-foreground mt-2">
          Get up and running in two simple steps
        </p>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="space-y-6">
          {/* Step 1 */}
          <div className="space-y-4">
            <Step done={(rideCount ?? 0) > 0 && (categorizedCount ?? 0) > 0} text="Add equipment and select category" number={1} />
            <div className="ml-11 space-y-3">
              <Button className="w-full" onClick={() => setOpenAdd(true)}>
                <FolderPlus className="w-4 h-4" />
                Add Equipment
              </Button>
              <Button variant="ghost" size="sm" onClick={() => setOpenRequest(true)} className="w-full">
                <Plus className="w-4 h-4" />
                Request category
              </Button>
              <p className="text-xs text-muted-foreground">
                Categories help match relevant bulletins to your equipment
              </p>
            </div>
          </div>

          <div className="h-px bg-border" />

          {/* Step 2 */}
          <TooltipProvider>
            <div className="space-y-4">
              <Step done={(docCount ?? 0) > 0} text="Upload your documents" number={2} />
              <div className="ml-11 space-y-3">
                <Tooltip>
                  <TooltipTrigger asChild>
                    <div>
                      <Button
                        variant="default"
                        disabled={(rideCount ?? 0) === 0 || (categorizedCount ?? 0) === 0}
                        onClick={() => {
                          navigate('/dashboard?tab=workspace');
                          setTimeout(() => {
                            const el = document.getElementById('workspace');
                            if (el) el.scrollIntoView({ behavior: 'smooth' });
                          }, 100);
                        }}
                        className="w-full"
                      >
                        <FileText className="w-4 h-4" />
                        {APP_FLAVOR === 'docs' ? 'Go to Documents' : 'Go to Checks'}
                      </Button>
                    </div>
                  </TooltipTrigger>
                  {((rideCount ?? 0) === 0 || (categorizedCount ?? 0) === 0) && (
                    <TooltipContent>
                      <p>Complete step 1 first</p>
                    </TooltipContent>
                  )}
                </Tooltip>
                <p className="text-xs text-muted-foreground">
                  Add risk assessments, certificates, insurance, and more
                </p>
              </div>
            </div>
          </TooltipProvider>
        </div>

        <div className="pt-4 border-t">
          <div className="flex items-start gap-3 text-sm">
            <CalendarDays className="w-5 h-5 text-muted-foreground flex-shrink-0 mt-0.5" />
            <p className="text-muted-foreground">
              <span className="font-medium text-foreground">Pro tip:</span> Enable reminders in the workspace for checks, inspections, and maintenance schedules
            </p>
          </div>
        </div>
      </CardContent>

      {/* Add Ride dialog */}
      <Dialog open={openAdd} onOpenChange={setOpenAdd}>
        <DialogContent className="w-[92vw] max-w-3xl max-h-[85vh] overflow-y-auto p-0">
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
