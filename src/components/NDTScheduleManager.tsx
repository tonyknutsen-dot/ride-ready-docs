import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { TestTube, Upload, FileText, Eye, Trash2, ClipboardList, FileCheck } from 'lucide-react';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { Tables } from '@/integrations/supabase/types';
import { Ride } from '@/types/ride';
import NDTDocumentUpload from './ndt/NDTDocumentUpload';
import { format } from 'date-fns';

type Document = Tables<'documents'>;

interface NDTScheduleManagerProps {
  ride: Ride;
}

const NDTScheduleManager = ({ ride }: NDTScheduleManagerProps) => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [scheduleDocuments, setScheduleDocuments] = useState<Document[]>([]);
  const [reportDocuments, setReportDocuments] = useState<Document[]>([]);
  const [loading, setLoading] = useState(true);
  const [showScheduleUpload, setShowScheduleUpload] = useState(false);
  const [showReportUpload, setShowReportUpload] = useState(false);

  useEffect(() => {
    if (user) {
      loadDocuments();
    }
  }, [user, ride.id]);

  const loadDocuments = async () => {
    try {
      const { data, error } = await supabase
        .from('documents')
        .select('*')
        .eq('user_id', user?.id)
        .eq('ride_id', ride.id)
        .in('document_type', ['ndt_schedule', 'ndt_report'])
        .order('uploaded_at', { ascending: false });

      if (error) throw error;

      const schedules = (data || []).filter(d => d.document_type === 'ndt_schedule');
      const reports = (data || []).filter(d => d.document_type === 'ndt_report');
      
      setScheduleDocuments(schedules);
      setReportDocuments(reports);
    } catch (error: any) {
      console.error('Error loading NDT documents:', error);
      toast({
        title: "Error loading documents",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleViewDocument = async (doc: Document) => {
    try {
      const { data, error } = await supabase.storage
        .from('ride-documents')
        .createSignedUrl(doc.file_path, 3600);

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

  const handleDeleteDocument = async (doc: Document) => {
    try {
      // Delete from storage
      await supabase.storage
        .from('ride-documents')
        .remove([doc.file_path]);

      // Delete from database
      const { error } = await supabase
        .from('documents')
        .delete()
        .eq('id', doc.id);

      if (error) throw error;

      toast({
        title: "Document deleted",
        description: "The document has been removed",
      });

      loadDocuments();
    } catch (error: any) {
      console.error('Error deleting document:', error);
      toast({
        title: "Error deleting document",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const handleUploadSuccess = () => {
    loadDocuments();
    setShowScheduleUpload(false);
    setShowReportUpload(false);
  };

  const DocumentCard = ({ doc, type }: { doc: Document; type: 'schedule' | 'report' }) => (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3 min-w-0 flex-1">
            <FileText className="h-8 w-8 text-primary flex-shrink-0" />
            <div className="min-w-0">
              <p className="font-medium truncate">{doc.document_name}</p>
              <p className="text-sm text-muted-foreground">
                Uploaded {format(new Date(doc.uploaded_at), 'd MMM yyyy')}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            <Button size="sm" variant="ghost" onClick={() => handleViewDocument(doc)}>
              <Eye className="h-4 w-4" />
            </Button>
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button size="sm" variant="ghost">
                  <Trash2 className="h-4 w-4" />
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Delete Document</AlertDialogTitle>
                  <AlertDialogDescription>
                    Are you sure you want to delete "{doc.document_name}"? This action cannot be undone.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction
                    onClick={() => handleDeleteDocument(doc)}
                    className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                  >
                    Delete
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        </div>
      </CardContent>
    </Card>
  );

  if (loading) {
    return (
      <Card>
        <CardContent className="pt-6">
          <div className="text-center py-4">
            <TestTube className="mx-auto h-8 w-8 text-muted-foreground animate-pulse" />
            <p className="text-muted-foreground mt-2">Loading NDT documents...</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <Alert>
        <AlertDescription>
          <strong>NDT Documentation:</strong> Upload your NDT schedules (what inspectors should test) and NDT reports (inspector findings). All documents are also available in your Documents section.
        </AlertDescription>
      </Alert>

      {/* NDT Schedules Section */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <ClipboardList className="h-5 w-5 text-primary" />
              <div>
                <CardTitle className="text-lg">NDT Schedules</CardTitle>
                <CardDescription>Documents detailing what inspectors should test</CardDescription>
              </div>
            </div>
            <Button onClick={() => setShowScheduleUpload(true)} size="sm">
              <Upload className="h-4 w-4 mr-2" />
              Upload Schedule
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {scheduleDocuments.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <ClipboardList className="mx-auto h-12 w-12 mb-3 opacity-50" />
              <p>No NDT schedules uploaded yet</p>
              <p className="text-sm">Upload a schedule document to share with NDT inspectors</p>
            </div>
          ) : (
            <div className="space-y-3">
              {scheduleDocuments.map((doc) => (
                <DocumentCard key={doc.id} doc={doc} type="schedule" />
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* NDT Reports Section */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <FileCheck className="h-5 w-5 text-primary" />
              <div>
                <CardTitle className="text-lg">NDT Reports</CardTitle>
                <CardDescription>Inspection reports from NDT inspectors</CardDescription>
              </div>
            </div>
            <Button onClick={() => setShowReportUpload(true)} size="sm">
              <Upload className="h-4 w-4 mr-2" />
              Upload Report
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {reportDocuments.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <FileCheck className="mx-auto h-12 w-12 mb-3 opacity-50" />
              <p>No NDT reports uploaded yet</p>
              <p className="text-sm">Upload reports received from NDT inspectors</p>
            </div>
          ) : (
            <div className="space-y-3">
              {reportDocuments.map((doc) => (
                <DocumentCard key={doc.id} doc={doc} type="report" />
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Upload Dialogs */}
      <NDTDocumentUpload
        open={showScheduleUpload}
        onOpenChange={setShowScheduleUpload}
        rideId={ride.id}
        documentType="schedule"
        onSuccess={handleUploadSuccess}
      />

      <NDTDocumentUpload
        open={showReportUpload}
        onOpenChange={setShowReportUpload}
        rideId={ride.id}
        documentType="report"
        onSuccess={handleUploadSuccess}
      />
    </div>
  );
};

export default NDTScheduleManager;
