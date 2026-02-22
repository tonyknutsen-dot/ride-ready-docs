import { CheckCircle2, XCircle, HardHat } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface OperatingTodayPromptProps {
  onYes: () => void;
  onNo: () => void;
  isLoading?: boolean;
}

export function OperatingTodayPrompt({ onYes, onNo, isLoading }: OperatingTodayPromptProps) {
  return (
    <div className="bg-card border border-border rounded-2xl p-6 text-center space-y-4"
         style={{ boxShadow: '0 4px 16px rgba(0,0,0,0.06)' }}>
      <div className="flex justify-center">
        <span className="flex items-center justify-center w-12 h-12 rounded-xl bg-primary/10">
          <HardHat className="h-6 w-6 text-primary" strokeWidth={2} />
        </span>
      </div>
      <div>
        <h2 className="text-lg font-bold text-foreground">Are you operating today?</h2>
        <p className="text-sm text-muted-foreground mt-1">
          This will create your daily and pre-opening safety checks.
        </p>
      </div>
      <div className="flex items-center justify-center gap-3">
        <Button
          onClick={onYes}
          disabled={isLoading}
          className="gap-2 min-w-[140px]"
        >
          <CheckCircle2 className="h-4 w-4" />
          Yes – Start Checks
        </Button>
        <Button
          variant="outline"
          onClick={onNo}
          disabled={isLoading}
          className="gap-2 min-w-[140px]"
        >
          <XCircle className="h-4 w-4" />
          Not Operating Today
        </Button>
      </div>
    </div>
  );
}
