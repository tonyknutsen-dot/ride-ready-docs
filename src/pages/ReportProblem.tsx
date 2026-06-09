import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { ArrowLeft, AlertCircle } from 'lucide-react';
import BugReportDialog from '@/components/BugReportDialog';

const ReportProblem = () => {
  const navigate = useNavigate();

  return (
    <div className="w-full max-w-2xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-4">
      <Button variant="ghost" size="sm" onClick={() => navigate(-1)} className="gap-1">
        <ArrowLeft className="h-4 w-4" /> Back
      </Button>

      <div className="rounded-xl border bg-card p-6 space-y-4">
        <div className="flex items-start gap-3">
          <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
            <AlertCircle className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h1 className="text-xl font-semibold">Report a problem</h1>
            <p className="text-sm text-muted-foreground mt-1">
              Tell us what happened and we'll look into it.
            </p>
          </div>
        </div>

        <p className="text-sm text-muted-foreground">
          Use the form to describe the issue. You can include a screenshot if it helps.
          Your report goes to our team — only you and the team can see it.
        </p>

        <BugReportDialog
          defaultOpen
          onAfterClose={() => navigate(-1)}
          trigger={
            <Button className="w-full sm:w-auto gap-2">
              <AlertCircle className="h-4 w-4" /> Open report form
            </Button>
          }
        />
      </div>
    </div>
  );
};

export default ReportProblem;
