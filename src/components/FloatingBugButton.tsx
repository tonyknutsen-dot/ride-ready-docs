import { Bug } from 'lucide-react';
import { Button } from '@/components/ui/button';
import BugReportDialog from './BugReportDialog';

export const FloatingBugButton = () => {
  return (
    <div className="fixed bottom-20 md:bottom-6 right-4 z-40">
      <BugReportDialog
        trigger={
          <Button
            size="icon"
            variant="outline"
            className="h-10 w-10 rounded-full shadow-lg bg-background/95 backdrop-blur-sm border-2 hover:border-destructive hover:bg-destructive/10 transition-all"
            title="Report a Bug"
          >
            <Bug className="h-4 w-4" />
          </Button>
        }
      />
    </div>
  );
};

export default FloatingBugButton;
