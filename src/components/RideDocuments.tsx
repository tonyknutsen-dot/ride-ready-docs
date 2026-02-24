import { useState, useEffect } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Upload, FileText, Mail, Download } from 'lucide-react';
import { Ride } from '@/types/ride';
import DocumentUpload from './DocumentUpload';
import RideDocumentView from './RideDocumentView';
import { SendDocumentsDialog } from './SendDocumentsDialog';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import JSZip from 'jszip';

interface RideDocumentsProps {
  ride: Ride;
}

const RideDocuments = ({ ride }: RideDocumentsProps) => {
  const [refreshKey, setRefreshKey] = useState(0);
  const [downloading, setDownloading] = useState(false);
  const [activeTab, setActiveTab] = useState('list');
  const [replaceDocId, setReplaceDocId] = useState<string | undefined>();
  const [replaceDocType, setReplaceDocType] = useState<string | undefined>();
  const [replaceDocName, setReplaceDocName] = useState<string | undefined>();
  const { toast } = useToast();

  // Listen for mobile nav "upload doc" event
  useEffect(() => {
    const handler = () => {
      setReplaceDocId(undefined);
      setReplaceDocType(undefined);
      setReplaceDocName(undefined);
      setActiveTab('upload');
    };
    window.addEventListener("rrd:upload-doc", handler);
    return () => window.removeEventListener("rrd:upload-doc", handler);
  }, []);

  // Listen for replace document events
  useEffect(() => {
    const handler = (e: CustomEvent) => {
      const { docId, docType, docName } = e.detail;
      setReplaceDocId(docId);
      setReplaceDocType(docType);
      setReplaceDocName(docName);
      setActiveTab('upload');
    };
    window.addEventListener("rrd:replace-doc", handler as EventListener);
    return () => window.removeEventListener("rrd:replace-doc", handler as EventListener);
  }, []);

  const handleUploadSuccess = () => {
    setRefreshKey(prev => prev + 1);
    setReplaceDocId(undefined);
    setReplaceDocType(undefined);
    setReplaceDocName(undefined);
    setActiveTab('list');
  };

  const handleDocumentDeleted = () => {
    setRefreshKey(prev => prev + 1);
  };

  const handleDownloadAll = async () => {
    setDownloading(true);
    try {
      const { data: documents, error } = await supabase
        .from('documents')
        .select('*')
        .eq('ride_id', ride.id);

      if (error) throw error;

      if (!documents || documents.length === 0) {
        toast({
          title: "No documents",
          description: "There are no documents to download",
          variant: "destructive",
        });
        return;
      }

      toast({
        title: "Preparing download",
        description: `Downloading ${documents.length} document(s)...`,
      });

      const zip = new JSZip();
      await Promise.all(
        documents.map(async (doc) => {
          try {
            const { data, error } = await supabase.storage
              .from('ride-documents')
              .download(doc.file_path);
            if (error) throw error;
            zip.file(doc.document_name, data);
          } catch (err) {
            console.error(`Failed to download ${doc.document_name}:`, err);
          }
        })
      );

      const content = await zip.generateAsync({ type: 'blob' });
      const url = window.URL.createObjectURL(content);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${ride.ride_name.replace(/[^a-z0-9]/gi, '_')}_documents.zip`;
      a.click();
      window.URL.revokeObjectURL(url);

      toast({
        title: "Download complete",
        description: `Downloaded ${documents.length} document(s) as ZIP`,
      });
    } catch (error: any) {
      console.error('Download all error:', error);
      toast({
        title: "Download failed",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setDownloading(false);
    }
  };

  if (!ride) {
    return (
      <Card>
        <CardContent className="py-6">
          <div className="text-sm">Pick a ride first.</div>
        </CardContent>
      </Card>
    );
  }

  if (!ride.category_id) {
    return (
      <Card className="border-2 border-warning">
        <CardContent className="py-6 space-y-2">
          <div className="text-lg font-semibold">Choose a category first</div>
          <div className="text-sm text-muted-foreground">
            Pick a category for this ride to manage documents.
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div className="space-y-1">
          <h2 className="text-2xl font-bold tracking-tight">Documents</h2>
          <p className="text-sm text-muted-foreground">
            Files for {ride.ride_name}
          </p>
        </div>
        
        <div className="flex flex-wrap gap-2">
          <SendDocumentsDialog
            ride={ride}
            trigger={
              <Button variant="outline" size="sm">
                <Mail className="w-4 h-4 mr-2" /> 
                Send
              </Button>
            }
          />
          <Button 
            variant="outline"
            size="sm"
            onClick={handleDownloadAll}
            disabled={downloading}
          >
            <Download className="w-4 h-4 mr-2" /> 
            {downloading ? 'Downloading...' : 'Download all'}
          </Button>
        </div>
      </div>

      {/* Two tabs: Files and Upload */}
      <Tabs value={activeTab} onValueChange={(v) => {
        if (v !== 'upload') {
          setReplaceDocId(undefined);
          setReplaceDocType(undefined);
          setReplaceDocName(undefined);
        }
        setActiveTab(v);
      }} className="space-y-4">
        <TabsList className="grid w-full grid-cols-2 gap-2 p-1.5 bg-muted border border-border/50 h-auto">
          <TabsTrigger value="list" className="flex items-center justify-center gap-2 py-2.5">
            <FileText className="h-4 w-4" />
            <span>Files</span>
          </TabsTrigger>
          <TabsTrigger id="rrd-btn-upload-doc" value="upload" className="flex items-center justify-center gap-2 py-2.5">
            <Upload className="h-4 w-4" />
            <span>{replaceDocId ? 'Replace' : 'Upload'}</span>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="list">
          <RideDocumentView
            rideId={ride.id}
            rideName={ride.ride_name}
            onDocumentDeleted={handleDocumentDeleted}
            refreshKey={refreshKey}
          />
        </TabsContent>

        <TabsContent value="upload">
          <DocumentUpload 
            rideId={ride.id}
            rideName={ride.ride_name}
            onUploadSuccess={handleUploadSuccess}
            prefillDocType={replaceDocType}
            prefillDocName={replaceDocName}
            replacingDocumentId={replaceDocId}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default RideDocuments;
