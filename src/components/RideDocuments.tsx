import { useState, useEffect } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Upload, FileText, Mail, Download } from 'lucide-react';
import { Tables } from '@/integrations/supabase/types';
import DocumentUpload from './DocumentUpload';
import DocumentList from './DocumentList';
import { SendDocumentsDialog } from './SendDocumentsDialog';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import JSZip from 'jszip';

type Ride = Tables<'rides'> & {
  ride_categories: {
    name: string;
    description: string | null;
  };
};

interface RideDocumentsProps {
  ride: Ride;
}

const RideDocuments = ({ ride }: RideDocumentsProps) => {
  const [refreshKey, setRefreshKey] = useState(0);
  const [downloading, setDownloading] = useState(false);
  const [activeTab, setActiveTab] = useState('list');
  const { toast } = useToast();

  // Listen for mobile nav "upload doc" event
  useEffect(() => {
    const handler = () => {
      setActiveTab('upload');
    };
    window.addEventListener("rrd:upload-doc", handler);
    return () => window.removeEventListener("rrd:upload-doc", handler);
  }, []);

  const handleUploadSuccess = () => {
    setRefreshKey(prev => prev + 1);
    setActiveTab('list'); // Switch back to list after upload
  };

  const handleDocumentDeleted = () => {
    setRefreshKey(prev => prev + 1);
  };

  const handleDownloadAll = async () => {
    setDownloading(true);
    try {
      // Fetch all documents for this ride
      const { data: documents, error } = await supabase
        .from('documents')
        .select('*')
        .eq('ride_id', ride.id);

      if (error) throw error;

      if (!documents || documents.length === 0) {
        toast({
          title: "No documents",
          description: "There are no documents to download for this ride",
          variant: "destructive",
        });
        return;
      }

      toast({
        title: "Preparing download",
        description: `Downloading ${documents.length} document(s)...`,
      });

      // Create a zip file
      const zip = new JSZip();

      // Download each file and add to zip
      await Promise.all(
        documents.map(async (doc) => {
          try {
            const { data, error } = await supabase.storage
              .from('ride-documents')
              .download(doc.file_path);

            if (error) throw error;

            // Add file to zip
            zip.file(doc.document_name, data);
          } catch (err) {
            console.error(`Failed to download ${doc.document_name}:`, err);
          }
        })
      );

      // Generate zip file
      const content = await zip.generateAsync({ type: 'blob' });

      // Trigger download
      const url = window.URL.createObjectURL(content);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${ride.ride_name.replace(/[^a-z0-9]/gi, '_')}_documents.zip`;
      a.click();
      window.URL.revokeObjectURL(url);

      toast({
        title: "Download complete",
        description: `Downloaded ${documents.length} document(s) as a ZIP file`,
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

  // HARD GATES (no uploads without ride or category)
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
            Technical bulletins need this. Pick one for this ride.
          </div>
          <Button 
            className="btn-bold-primary"
            onClick={() => {
              // TODO: Open edit flow for this ride to pick category
              // Consider: navigate to edit form or open RideForm dialog
              console.log('Edit ride to select category:', ride.id);
            }}
          >
            Select category
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {/* Bold header */}
      <Card className="border-2">
        <CardContent className="py-4">
          <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3">
            <div className="min-w-0 flex-1">
              <div className="text-sm text-muted-foreground">You are looking at</div>
              <h2 className="text-2xl font-bold truncate">
                {ride.ride_name} <span className="text-muted-foreground">→</span> Documents
              </h2>
              <p className="text-sm text-muted-foreground">All files for this ride. Send to council/insurer or download.</p>
            </div>
            <div className="flex flex-wrap items-center gap-2 sm:ml-auto">
              <SendDocumentsDialog
                ride={ride}
                trigger={
                  <Button className="btn-bold-primary">
                    <Mail className="w-4 h-4 mr-2" /> Send pack
                  </Button>
                }
              />
              <Button 
                variant="outline" 
                onClick={handleDownloadAll}
                disabled={downloading}
              >
                <Download className="w-4 h-4 mr-2" /> 
                {downloading ? 'Downloading...' : 'Download all'}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Tabs: default to LIST so they see everything first */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <TabsList className="tabs-bold overflow-x-auto h-11">
          <TabsTrigger value="list" className="flex items-center space-x-2 h-10">
            <FileText className="h-4 w-4" />
            <span>All files</span>
          </TabsTrigger>
          <TabsTrigger id="rrd-btn-upload-doc" value="upload" className="flex items-center space-x-2 h-10">
            <Upload className="h-4 w-4" />
            <span>Add a document</span>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="list">
          <DocumentList 
            key={refreshKey}
            rideId={ride.id}
            rideName={ride.ride_name}
            onDocumentDeleted={handleDocumentDeleted}
            grouped
          />
        </TabsContent>

        <TabsContent value="upload">
          <DocumentUpload 
            rideId={ride.id}
            rideName={ride.ride_name}
            onUploadSuccess={handleUploadSuccess}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default RideDocuments;