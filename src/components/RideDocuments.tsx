import { useState } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Upload, FileText, Mail, Download } from 'lucide-react';
import { Tables } from '@/integrations/supabase/types';
import DocumentUpload from './DocumentUpload';
import DocumentList from './DocumentList';
import { SendDocumentsDialog } from './SendDocumentsDialog';

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

  const handleUploadSuccess = () => {
    setRefreshKey(prev => prev + 1);
  };

  const handleDocumentDeleted = () => {
    setRefreshKey(prev => prev + 1);
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
        <CardContent className="py-4 flex flex-col md:flex-row md:items-center md:justify-between gap-3">
          <div>
            <div className="text-sm text-muted-foreground">You are looking at</div>
            <h2 className="text-2xl font-bold">
              {ride.ride_name} <span className="text-muted-foreground">→</span> Documents
            </h2>
            <p className="text-sm text-muted-foreground">All files for this ride. Send to council/insurer or download.</p>
          </div>
          <div className="flex gap-2">
            <SendDocumentsDialog
              ride={ride}
              trigger={
                <Button className="btn-bold-primary">
                  <Mail className="w-4 h-4 mr-2" /> Send pack
                </Button>
              }
            />
            <Button variant="outline" disabled title="Download all coming soon">
              <Download className="w-4 h-4 mr-2" /> Download all
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Tabs: default to LIST so they see everything first */}
      <Tabs defaultValue="list" className="space-y-6">
        <TabsList className="tabs-bold overflow-x-auto h-11">
          <TabsTrigger value="list" className="flex items-center space-x-2 h-10">
            <FileText className="h-4 w-4" />
            <span>All files</span>
          </TabsTrigger>
          <TabsTrigger value="upload" className="flex items-center space-x-2 h-10">
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