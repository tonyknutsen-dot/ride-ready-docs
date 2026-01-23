import { Bug } from 'lucide-react';
import { Button } from '@/components/ui/button';
import BugReportDialog from './BugReportDialog';
import { useTester } from '@/contexts/TesterContext';

export const FloatingBugButton = () => {
  const { isTester, isLoading } = useTester();

  // Only show for testers
  if (isLoading || !isTester) {
    return null;
  }

  const handleClick = (e: React.MouseEvent) => {
    // Stop propagation to prevent closing other open dialogs/sheets
    e.stopPropagation();
  };

  return (
    <div 
      className="fixed bottom-20 md:bottom-6 right-4 z-40" 
      data-hide-from-screenshot
      onClick={handleClick}
      onPointerDown={handleClick}
    >
      <BugReportDialog
        trigger={
          <Button
            size="icon"
            variant="outline"
            className="h-10 w-10 rounded-full shadow-lg bg-background/95 backdrop-blur-sm border-2 hover:border-destructive hover:bg-destructive/10 transition-all"
            title="Report a Bug"
            onClick={handleClick}
            onPointerDown={handleClick}
          >
            <Bug className="h-4 w-4" />
          </Button>
        }
      />
    </div>
  );
};

export default FloatingBugButton;
