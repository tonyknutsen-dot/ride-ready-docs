import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTester } from '@/contexts/TesterContext';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { FlaskConical, Trash2, Loader2, AlertTriangle, Bug, ArrowRight } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { APP_VERSION } from '@/config/appVersion';

const TesterTools = () => {
  const { isTester } = useTester();
  const { user } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  const [showResetDialog, setShowResetDialog] = useState(false);
  const [isResetting, setIsResetting] = useState(false);

  if (!isTester) {
    return null;
  }

  const handleResetTestData = async () => {
    if (!user) return;

    setIsResetting(true);
    try {
      // Delete user's test data in reverse order of dependencies
      // 1. Delete check results first
      const { data: checks } = await supabase
        .from('checks')
        .select('id')
        .eq('user_id', user.id);
      
      if (checks && checks.length > 0) {
        const checkIds = checks.map(c => c.id);
        await supabase.from('check_results').delete().in('check_id', checkIds);
      }

      // 2. Delete checks
      await supabase.from('checks').delete().eq('user_id', user.id);

      // 3. Delete template items for user's templates
      const { data: templates } = await supabase
        .from('daily_check_templates')
        .select('id')
        .eq('user_id', user.id);
      
      if (templates && templates.length > 0) {
        const templateIds = templates.map(t => t.id);
        await supabase.from('daily_check_template_items').delete().in('template_id', templateIds);
      }

      // 4. Delete templates
      await supabase.from('daily_check_templates').delete().eq('user_id', user.id);

      // 5. Delete document assignments
      await supabase.from('document_ride_assignments').delete().eq('user_id', user.id);

      // 6. Delete documents
      await supabase.from('documents').delete().eq('user_id', user.id);

      // 7. Delete maintenance records
      await supabase.from('maintenance_records').delete().eq('user_id', user.id);

      // 8. Delete inspection schedules
      await supabase.from('inspection_schedules').delete().eq('user_id', user.id);

      // 9. Delete NDT schedules and reports
      const { data: ndtSchedules } = await supabase
        .from('ndt_schedules')
        .select('id')
        .eq('user_id', user.id);
      
      if (ndtSchedules && ndtSchedules.length > 0) {
        const scheduleIds = ndtSchedules.map(s => s.id);
        await supabase.from('ndt_reports').delete().in('ndt_schedule_id', scheduleIds);
      }
      await supabase.from('ndt_schedules').delete().eq('user_id', user.id);

      // 10. Delete annual inspection reports
      await supabase.from('annual_inspection_reports').delete().eq('user_id', user.id);

      // 11. Delete risk assessment items and assessments
      const { data: riskAssessments } = await supabase
        .from('risk_assessments')
        .select('id')
        .eq('user_id', user.id);
      
      if (riskAssessments && riskAssessments.length > 0) {
        const raIds = riskAssessments.map(r => r.id);
        await supabase.from('risk_assessment_items').delete().in('risk_assessment_id', raIds);
        await supabase.from('risk_assessment_audit_log').delete().in('risk_assessment_id', raIds);
      }
      await supabase.from('risk_assessments').delete().eq('user_id', user.id);

      // 12. Delete rides (this will cascade many things)
      await supabase.from('rides').delete().eq('user_id', user.id);

      // 13. Delete notifications
      await supabase.from('notifications').delete().eq('user_id', user.id);

      // 14. Delete saved recipients
      await supabase.from('saved_recipients').delete().eq('user_id', user.id);

      toast({
        title: "Test data reset",
        description: "All your test data has been deleted. You can start fresh!",
      });
    } catch (error) {
      console.error('Error resetting test data:', error);
      toast({
        title: "Error",
        description: "Failed to reset test data. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsResetting(false);
      setShowResetDialog(false);
    }
  };

  return (
    <>
      <Card className="border-2 border-warning/50 bg-gradient-to-br from-warning/10 to-transparent shadow-elegant">
        <CardHeader className="pb-3">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-full bg-warning/20 flex items-center justify-center">
              <FlaskConical className="h-4 w-4 text-warning-foreground" />
            </div>
            <CardTitle className="text-base">Tester Tools</CardTitle>
          </div>
          <CardDescription className="text-sm">
            Special tools for testers – Version {APP_VERSION}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Bug Reports Link */}
          <Button 
            variant="outline"
            className="w-full justify-between gap-2 h-12 border-primary/30 hover:bg-primary/5"
            onClick={() => navigate('/my-bug-reports')}
          >
            <div className="flex items-center gap-2">
              <Bug className="h-4 w-4 text-primary" />
              <span>My Bug Reports</span>
            </div>
            <ArrowRight className="h-4 w-4" />
          </Button>

          {/* Reset Section */}
          <div className="p-4 rounded-lg bg-secondary/50 border border-warning/20">
            <div className="flex items-start gap-3">
              <AlertTriangle className="h-5 w-5 text-warning-foreground shrink-0 mt-0.5" />
              <div className="space-y-1">
                <p className="text-sm font-medium">Reset Test Data</p>
                <p className="text-xs text-muted-foreground">
                  Delete all rides, documents, checks, and other data you've created. 
                  This cannot be undone.
                </p>
              </div>
            </div>
          </div>
          <Button 
            variant="destructive" 
            className="w-full gap-2"
            onClick={() => setShowResetDialog(true)}
            disabled={isResetting}
          >
            {isResetting ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Trash2 className="h-4 w-4" />
            )}
            Reset All My Test Data
          </Button>
        </CardContent>
      </Card>

      <AlertDialog open={showResetDialog} onOpenChange={setShowResetDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-destructive" />
              Reset All Test Data?
            </AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete all your test data including:
              <ul className="list-disc list-inside mt-2 space-y-1">
                <li>All rides and equipment</li>
                <li>All documents and certificates</li>
                <li>All inspection checks and templates</li>
                <li>All maintenance records</li>
                <li>All risk assessments</li>
                <li>All notifications</li>
              </ul>
              <p className="mt-3 font-medium text-destructive">
                This action cannot be undone.
              </p>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isResetting}>Cancel</AlertDialogCancel>
            <AlertDialogAction 
              onClick={handleResetTestData}
              disabled={isResetting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isResetting ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  Deleting...
                </>
              ) : (
                'Yes, Delete Everything'
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};

export default TesterTools;
