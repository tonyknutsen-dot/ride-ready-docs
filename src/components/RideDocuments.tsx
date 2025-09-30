import { useState } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Upload, FileText } from 'lucide-react';
import { Tables } from '@/integrations/supabase/types';
import DocumentUpload from './DocumentUpload';
import DocumentList from './DocumentList';

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

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <h3 className="text-xl font-semibold">Document Management</h3>
        <p className="text-muted-foreground">
          Upload and manage documents for {ride.ride_name}
        </p>
      </div>

      <Tabs defaultValue="upload" className="space-y-6">
        <TabsList className="tabs-bold grid w-full grid-cols-2">
          <TabsTrigger value="upload" className="flex items-center space-x-2">
            <Upload className="h-4 w-4" />
            <span>Add a document</span>
          </TabsTrigger>
          <TabsTrigger value="documents" className="flex items-center space-x-2">
            <FileText className="h-4 w-4" />
            <span>All files</span>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="upload">
          <DocumentUpload 
            rideId={ride.id}
            rideName={ride.ride_name}
            onUploadSuccess={handleUploadSuccess}
          />
        </TabsContent>

        <TabsContent value="documents">
          <DocumentList 
            key={refreshKey}
            rideId={ride.id}
            rideName={ride.ride_name}
            onDocumentDeleted={handleDocumentDeleted}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default RideDocuments;