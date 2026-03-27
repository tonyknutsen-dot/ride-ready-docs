import { useState, useEffect } from 'react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Trash2, FileText, CheckSquare, Wrench, AlertTriangle, Shield, Loader2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { Ride } from '@/types/ride';
import { useAuditLog } from '@/hooks/useAuditLog';

interface DeleteRideDialogProps {
  ride: Ride;
  onDeleted: () => void;
  trigger?: React.ReactNode;
}

interface AssociatedData {
  documents: { id: string; document_name: string; file_path: string }[];
  checks: number;
  maintenanceRecords: number;
  defects: number;
  riskAssessments: number;
  inspectionReports: number;
  ndtSchedules: number;
  loading: boolean;
}

export const DeleteRideDialog = ({ ride, onDeleted, trigger }: DeleteRideDialogProps) => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [associatedData, setAssociatedData] = useState<AssociatedData>({
    documents: [],
    checks: 0,
    maintenanceRecords: 0,
    defects: 0,
    riskAssessments: 0,
    inspectionReports: 0,
    ndtSchedules: 0,
    loading: true,
  });

  useEffect(() => {
    if (open && user) {
      loadAssociatedData();
    }
  }, [open, user, ride.id]);

  const loadAssociatedData = async () => {
    if (!user) return;

    setAssociatedData(prev => ({ ...prev, loading: true }));

    try {
      const [
        documentsResult,
        checksResult,
        maintenanceResult,
        defectsResult,
        riskResult,
        inspectionResult,
        ndtResult,
      ] = await Promise.all([
        // Get documents with details
        supabase
          .from('documents')
          .select('id, document_name, file_path')
          .eq('user_id', user.id)
          .eq('ride_id', ride.id),
        // Count checks
        supabase
          .from('checks')
          .select('*', { count: 'exact', head: true })
          .eq('user_id', user.id)
          .eq('ride_id', ride.id),
        // Count maintenance records
        supabase
          .from('maintenance_records')
          .select('*', { count: 'exact', head: true })
          .eq('user_id', user.id)
          .eq('ride_id', ride.id),
        // Count defects
        supabase
          .from('defects')
          .select('*', { count: 'exact', head: true })
          .eq('user_id', user.id)
          .eq('ride_id', ride.id),
        // Count risk assessments
        supabase
          .from('risk_assessments')
          .select('*', { count: 'exact', head: true })
          .eq('user_id', user.id)
          .eq('ride_id', ride.id),
        // Count annual inspection reports
        supabase
          .from('annual_inspection_reports')
          .select('*', { count: 'exact', head: true })
          .eq('user_id', user.id)
          .eq('ride_id', ride.id),
        // Count NDT schedules
        supabase
          .from('ndt_schedules')
          .select('*', { count: 'exact', head: true })
          .eq('user_id', user.id)
          .eq('ride_id', ride.id),
      ]);

      setAssociatedData({
        documents: documentsResult.data || [],
        checks: checksResult.count || 0,
        maintenanceRecords: maintenanceResult.count || 0,
        defects: defectsResult.count || 0,
        riskAssessments: riskResult.count || 0,
        inspectionReports: inspectionResult.count || 0,
        ndtSchedules: ndtResult.count || 0,
        loading: false,
      });
    } catch (error) {
      console.error('Error loading associated data:', error);
      setAssociatedData(prev => ({ ...prev, loading: false }));
    }
  };

  const handleDelete = async () => {
    if (!user) return;

    setDeleting(true);

    try {
      // 1. Delete files from storage
      if (associatedData.documents.length > 0) {
        const filePaths = associatedData.documents.map(d => d.file_path);
        const { error: storageError } = await supabase.storage
          .from('ride-documents')
          .remove(filePaths);
        
        if (storageError) {
          console.error('Error deleting files from storage:', storageError);
          // Continue with deletion even if storage fails
        }
      }

      // 2. Delete the ride (cascade will handle related records due to FK constraints)
      const { error } = await supabase
        .from('rides')
        .delete()
        .eq('id', ride.id)
        .eq('user_id', user.id);

      if (error) throw error;

      toast({
        title: "Equipment deleted",
        description: `${ride.ride_name} and all associated data have been permanently deleted.`,
      });

      setOpen(false);
      onDeleted();
    } catch (error: any) {
      console.error('Error deleting ride:', error);
      toast({
        title: "Delete failed",
        description: error.message || "Failed to delete equipment. Please try again.",
        variant: "destructive",
      });
    } finally {
      setDeleting(false);
    }
  };

  const totalItems = 
    associatedData.documents.length + 
    associatedData.checks + 
    associatedData.maintenanceRecords +
    associatedData.defects +
    associatedData.riskAssessments +
    associatedData.inspectionReports +
    associatedData.ndtSchedules;

  return (
    <AlertDialog open={open} onOpenChange={setOpen}>
      <AlertDialogTrigger asChild>
        {trigger || (
          <Button variant="destructive" size="sm" className="gap-2">
            <Trash2 className="h-4 w-4" />
            Delete
          </Button>
        )}
      </AlertDialogTrigger>
      <AlertDialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
        <AlertDialogHeader>
          <div className="flex items-center gap-3 mb-2">
            <div className="w-12 h-12 rounded-full bg-destructive/15 flex items-center justify-center">
              <AlertTriangle className="h-6 w-6 text-destructive" />
            </div>
            <div>
              <AlertDialogTitle className="text-lg">Delete Equipment?</AlertDialogTitle>
              <p className="text-sm text-muted-foreground mt-0.5">{ride.ride_name}</p>
            </div>
          </div>
          <AlertDialogDescription className="text-left">
            This action <strong>cannot be undone</strong>. This will permanently delete the equipment and all associated records.
          </AlertDialogDescription>
        </AlertDialogHeader>

        {/* Associated Data Summary */}
        <div className="my-4 space-y-3">
          <p className="text-sm font-medium text-destructive">
            The following data will be permanently deleted:
          </p>

          {associatedData.loading ? (
            <div className="flex items-center justify-center py-6">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
              <span className="ml-2 text-sm text-muted-foreground">Loading...</span>
            </div>
          ) : (
            <div className="space-y-2 rounded-lg border border-destructive/20 bg-destructive/5 p-3">
              {/* Documents */}
              {associatedData.documents.length > 0 && (
                <div className="flex items-center gap-2">
                  <FileText className="h-4 w-4 text-destructive" />
                  <span className="text-sm flex-1">Documents</span>
                  <Badge variant="destructive" className="text-xs">
                    {associatedData.documents.length}
                  </Badge>
                </div>
              )}

              {/* Checks */}
              {associatedData.checks > 0 && (
                <div className="flex items-center gap-2">
                  <CheckSquare className="h-4 w-4 text-destructive" />
                  <span className="text-sm flex-1">Safety Checks</span>
                  <Badge variant="destructive" className="text-xs">
                    {associatedData.checks}
                  </Badge>
                </div>
              )}

              {/* Maintenance */}
              {associatedData.maintenanceRecords > 0 && (
                <div className="flex items-center gap-2">
                  <Wrench className="h-4 w-4 text-destructive" />
                  <span className="text-sm flex-1">Maintenance Records</span>
                  <Badge variant="destructive" className="text-xs">
                    {associatedData.maintenanceRecords}
                  </Badge>
                </div>
              )}

              {/* Defects */}
              {associatedData.defects > 0 && (
                <div className="flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4 text-destructive" />
                  <span className="text-sm flex-1">Defect Reports</span>
                  <Badge variant="destructive" className="text-xs">
                    {associatedData.defects}
                  </Badge>
                </div>
              )}

              {/* Risk Assessments */}
              {associatedData.riskAssessments > 0 && (
                <div className="flex items-center gap-2">
                  <Shield className="h-4 w-4 text-destructive" />
                  <span className="text-sm flex-1">Risk Assessments</span>
                  <Badge variant="destructive" className="text-xs">
                    {associatedData.riskAssessments}
                  </Badge>
                </div>
              )}

              {/* Inspection Reports */}
              {associatedData.inspectionReports > 0 && (
                <div className="flex items-center gap-2">
                  <FileText className="h-4 w-4 text-destructive" />
                  <span className="text-sm flex-1">Inspection Reports</span>
                  <Badge variant="destructive" className="text-xs">
                    {associatedData.inspectionReports}
                  </Badge>
                </div>
              )}

              {/* NDT Schedules */}
              {associatedData.ndtSchedules > 0 && (
                <div className="flex items-center gap-2">
                  <FileText className="h-4 w-4 text-destructive" />
                  <span className="text-sm flex-1">NDT Schedules</span>
                  <Badge variant="destructive" className="text-xs">
                    {associatedData.ndtSchedules}
                  </Badge>
                </div>
              )}

              {/* No data message */}
              {totalItems === 0 && (
                <p className="text-sm text-muted-foreground text-center py-2">
                  No associated records found
                </p>
              )}

              {/* Total */}
              {totalItems > 0 && (
                <div className="pt-2 mt-2 border-t border-destructive/20 flex items-center justify-between">
                  <span className="text-sm font-medium">Total items to delete</span>
                  <Badge variant="destructive">{totalItems}</Badge>
                </div>
              )}
            </div>
          )}

          {/* Document list preview (first 5) */}
          {associatedData.documents.length > 0 && (
            <div className="text-xs text-muted-foreground space-y-1">
              <p className="font-medium">Documents include:</p>
              <ul className="list-disc list-inside space-y-0.5 pl-1">
                {associatedData.documents.slice(0, 5).map((doc) => (
                  <li key={doc.id} className="truncate">{doc.document_name}</li>
                ))}
                {associatedData.documents.length > 5 && (
                  <li className="text-muted-foreground">
                    ...and {associatedData.documents.length - 5} more
                  </li>
                )}
              </ul>
            </div>
          )}
        </div>

        <AlertDialogFooter className="gap-2 sm:gap-0">
          <AlertDialogCancel disabled={deleting}>Cancel</AlertDialogCancel>
          <AlertDialogAction
            onClick={handleDelete}
            disabled={deleting || associatedData.loading}
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
          >
            {deleting ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
                Deleting...
              </>
            ) : (
              <>
                <Trash2 className="h-4 w-4 mr-2" />
                Delete Everything
              </>
            )}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
};
