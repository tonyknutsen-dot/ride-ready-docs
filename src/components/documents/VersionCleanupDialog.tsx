/**
 * Version cleanup dialog for DocumentList.
 * Extracted for maintainability — no UI change.
 */
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { formatFileSize } from '@/utils/documentHelpers';

interface VersionCleanupDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  olderVersionsCount: number;
  olderVersionsSize: number;
  cleaningUp: boolean;
  onCleanup: () => void;
}

const VersionCleanupDialog = ({
  open,
  onOpenChange,
  olderVersionsCount,
  olderVersionsSize,
  cleaningUp,
  onCleanup,
}: VersionCleanupDialogProps) => {
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent className="w-[95vw] max-w-[95vw] sm:max-w-lg">
        <AlertDialogHeader>
          <AlertDialogTitle>Clean Up Old Versions</AlertDialogTitle>
          <AlertDialogDescription>
            This will permanently delete {olderVersionsCount} older document version{olderVersionsCount !== 1 ? 's' : ''}, 
            freeing up {formatFileSize(olderVersionsSize)} of storage. Latest versions will be kept.
            This action cannot be undone.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={cleaningUp}>Cancel</AlertDialogCancel>
          <AlertDialogAction
            onClick={onCleanup}
            disabled={cleaningUp}
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
          >
            {cleaningUp ? 'Cleaning up...' : 'Delete Old Versions'}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
};

export default VersionCleanupDialog;
