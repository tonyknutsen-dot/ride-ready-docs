import { useTester } from '@/contexts/TesterContext';
import { APP_VERSION } from '@/config/appVersion';
import { FlaskConical, Unlock } from 'lucide-react';

const TestModeBanner = () => {
  const { isTester, isLoading } = useTester();

  // Don't show while loading or if not a tester
  if (isLoading || !isTester) {
    return null;
  }

  return (
    <div className="fixed top-0 left-0 right-0 z-50 bg-warning/90 text-warning-foreground py-1.5 px-4 text-center backdrop-blur-sm border-b border-warning-foreground/20">
      <div className="flex items-center justify-center gap-2 text-xs font-medium">
        <FlaskConical className="h-3.5 w-3.5" />
        <span>TEST MODE – Paid features unlocked</span>
        <Unlock className="h-3 w-3" />
        <span className="opacity-75">({APP_VERSION})</span>
      </div>
    </div>
  );
};

export default TestModeBanner;
