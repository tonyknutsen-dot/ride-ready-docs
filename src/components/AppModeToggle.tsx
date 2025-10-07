import { FileText, Cog } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useAppMode } from '@/hooks/useAppMode';
import { toast } from 'sonner';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { PlanSelection } from './PlanSelection';
import { useState } from 'react';

interface AppModeToggleProps {
  variant?: 'default' | 'compact';
}

export const AppModeToggle: React.FC<AppModeToggleProps> = ({ variant = 'default' }) => {
  const { appMode, setAppMode, canAccessOperations, loading } = useAppMode();
  const [upgradeDialogOpen, setUpgradeDialogOpen] = useState(false);

  const handleToggle = async (mode: 'documents' | 'operations') => {
    if (mode === appMode) return;

    if (mode === 'operations' && !canAccessOperations) {
      setUpgradeDialogOpen(true);
      return;
    }

    const success = await setAppMode(mode);
    if (success) {
      toast.success(
        mode === 'documents' 
          ? 'Switched to Documents Mode' 
          : 'Switched to Operations Mode'
      );
    } else {
      toast.error('Failed to switch mode');
    }
  };

  if (loading) return null;

  if (variant === 'compact') {
    return (
      <>
        <div className="flex items-center gap-1 bg-muted rounded-lg p-1">
          <Button
            size="sm"
            variant={appMode === 'documents' ? 'default' : 'ghost'}
            onClick={() => handleToggle('documents')}
            className="gap-2"
          >
            <FileText className="h-4 w-4" />
            <span className="hidden sm:inline">Docs</span>
          </Button>
          <Button
            size="sm"
            variant={appMode === 'operations' ? 'default' : 'ghost'}
            onClick={() => handleToggle('operations')}
            className="gap-2"
            disabled={!canAccessOperations}
          >
            <Cog className="h-4 w-4" />
            <span className="hidden sm:inline">Ops</span>
          </Button>
        </div>

        <Dialog open={upgradeDialogOpen} onOpenChange={setUpgradeDialogOpen}>
          <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Upgrade to Advanced Plan</DialogTitle>
              <DialogDescription>
                Operations Mode includes checks, maintenance, inspections, and more advanced features.
              </DialogDescription>
            </DialogHeader>
            <PlanSelection onClose={() => setUpgradeDialogOpen(false)} />
          </DialogContent>
        </Dialog>
      </>
    );
  }

  return (
    <>
      <div className="flex flex-col sm:flex-row items-start sm:items-center gap-2 p-4 bg-muted/50 rounded-lg">
        <div className="flex-1">
          <h3 className="font-semibold text-sm">App Mode</h3>
          <p className="text-xs text-muted-foreground">
            {appMode === 'documents' 
              ? 'Document management & compliance tracking' 
              : 'Operations, maintenance & advanced features'}
          </p>
        </div>
        <div className="flex items-center gap-2 bg-background rounded-lg p-1">
          <Button
            size="sm"
            variant={appMode === 'documents' ? 'default' : 'ghost'}
            onClick={() => handleToggle('documents')}
            className="gap-2"
          >
            <FileText className="h-4 w-4" />
            Documents
          </Button>
          <Button
            size="sm"
            variant={appMode === 'operations' ? 'default' : 'ghost'}
            onClick={() => handleToggle('operations')}
            className="gap-2"
            disabled={!canAccessOperations}
          >
            <Cog className="h-4 w-4" />
            Operations
          </Button>
        </div>
      </div>

      <Dialog open={upgradeDialogOpen} onOpenChange={setUpgradeDialogOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Upgrade to Advanced Plan</DialogTitle>
            <DialogDescription>
              Operations Mode includes checks, maintenance, inspections, and more advanced features.
            </DialogDescription>
          </DialogHeader>
          <PlanSelection onClose={() => setUpgradeDialogOpen(false)} />
        </DialogContent>
      </Dialog>
    </>
  );
};
