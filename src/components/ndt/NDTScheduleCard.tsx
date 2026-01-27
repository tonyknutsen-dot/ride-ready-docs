import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { TestTube, Edit, Trash2, Calendar, FileText, Upload, Eye } from 'lucide-react';
import { Tables } from '@/integrations/supabase/types';
import { format } from 'date-fns';
import NDTDocumentLink from './NDTDocumentLink';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

type NDTSchedule = Tables<'ndt_schedules'>;
type Document = Tables<'documents'>;

interface NDTScheduleCardProps {
  schedule: NDTSchedule;
  scheduleDocument?: Document | null;
  rideId: string;
  onEdit: (schedule: NDTSchedule) => void;
  onDelete: (scheduleId: string) => void;
  onRefresh: () => void;
}

const NDTScheduleCard = ({ 
  schedule, 
  scheduleDocument, 
  rideId, 
  onEdit, 
  onDelete,
  onRefresh 
}: NDTScheduleCardProps) => {
  const { toast } = useToast();
  const [showDocumentDialog, setShowDocumentDialog] = useState(false);

  const getStatusBadge = () => {
    if (!schedule.next_inspection_due) {
      return <Badge variant="secondary">No Due Date</Badge>;
    }

    const today = new Date();
    const dueDate = new Date(schedule.next_inspection_due);
    const daysDiff = Math.ceil((dueDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));

    if (daysDiff < 0) {
      return <Badge variant="destructive">Overdue</Badge>;
    } else if (daysDiff <= 30) {
      return <Badge variant="outline">Due Soon</Badge>;
    } else {
      return <Badge variant="default">Current</Badge>;
    }
  };

  const handleDocumentLinked = async (documentId: string) => {
    try {
      const { error } = await supabase
        .from('ndt_schedules')
        .update({ schedule_document_id: documentId })
        .eq('id', schedule.id);

      if (error) throw error;

      toast({
        title: "Schedule document linked",
        description: "The NDT schedule document has been linked successfully",
      });

      onRefresh();
    } catch (error: any) {
      console.error('Error linking document:', error);
      toast({
        title: "Error linking document",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const handleViewDocument = async () => {
    if (!scheduleDocument) return;

    try {
      const { data, error } = await supabase.storage
        .from('ride-documents')
        .createSignedUrl(scheduleDocument.file_path, 3600);

      if (error) throw error;

      window.open(data.signedUrl, '_blank');
    } catch (error: any) {
      console.error('Error viewing document:', error);
      toast({
        title: "Error viewing document",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  return (
    <>
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <TestTube className="h-5 w-5" />
              <div>
                <CardTitle>{schedule.schedule_name}</CardTitle>
                <CardDescription>{schedule.component_description}</CardDescription>
              </div>
            </div>
            <div className="flex items-center space-x-2">
              {getStatusBadge()}
              <Button size="sm" variant="outline" onClick={() => onEdit(schedule)}>
                <Edit className="h-4 w-4" />
              </Button>
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button size="sm" variant="outline">
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Delete NDT Schedule</AlertDialogTitle>
                    <AlertDialogDescription>
                      Are you sure you want to delete "{schedule.schedule_name}"? This action cannot be undone.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction
                      onClick={() => onDelete(schedule.id)}
                      className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                    >
                      Delete
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
            <div>
              <p className="font-medium">Method</p>
              <p className="text-muted-foreground">{schedule.ndt_method.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase())}</p>
            </div>
            <div>
              <p className="font-medium">Frequency</p>
              <p className="text-muted-foreground">Every {schedule.frequency_months} months</p>
            </div>
            <div>
              <p className="font-medium">Next Due</p>
              <p className="text-muted-foreground flex items-center space-x-1">
                <Calendar className="h-4 w-4" />
                <span>
                  {schedule.next_inspection_due 
                    ? format(new Date(schedule.next_inspection_due), 'd MMM yyyy')
                    : 'Not scheduled'
                  }
                </span>
              </p>
            </div>
          </div>

          {/* Schedule Document Section */}
          <div className="mt-4 pt-4 border-t">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <FileText className="h-4 w-4 text-muted-foreground" />
                <span className="font-medium text-sm">Schedule Document</span>
              </div>
              {scheduleDocument ? (
                <div className="flex items-center gap-2">
                  <span className="text-sm text-muted-foreground truncate max-w-[150px]">
                    {scheduleDocument.document_name}
                  </span>
                  <Button size="sm" variant="ghost" onClick={handleViewDocument}>
                    <Eye className="h-4 w-4" />
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => setShowDocumentDialog(true)}>
                    <Edit className="h-4 w-4" />
                  </Button>
                </div>
              ) : (
                <Button size="sm" variant="outline" onClick={() => setShowDocumentDialog(true)}>
                  <Upload className="h-4 w-4 mr-1" />
                  Add Document
                </Button>
              )}
            </div>
          </div>

          {schedule.notes && (
            <div className="mt-4 p-3 bg-muted rounded">
              <p className="text-sm">{schedule.notes}</p>
            </div>
          )}
        </CardContent>
      </Card>

      <NDTDocumentLink
        open={showDocumentDialog}
        onOpenChange={setShowDocumentDialog}
        rideId={rideId}
        documentType="schedule"
        currentDocumentId={schedule.schedule_document_id}
        onDocumentLinked={handleDocumentLinked}
      />
    </>
  );
};

export default NDTScheduleCard;
