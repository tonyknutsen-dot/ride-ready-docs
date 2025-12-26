import { useState } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Upload, FileText } from 'lucide-react';
import DocumentUpload from '@/components/DocumentUpload';
import DocumentList from '@/components/DocumentList';

const GlobalDocumentsPage = () => {
  const [refreshKey, setRefreshKey] = useState(0);

  const handleUploadSuccess = () => {
    setRefreshKey(prev => prev + 1);
  };

  const handleDocumentDeleted = () => {
    setRefreshKey(prev => prev + 1);
  };

  return (
    <div className="container mx-auto px-4 py-5 pb-28 md:pb-8">
      {/* Header */}
      <div className="mb-5">
        <h1 className="text-xl font-bold tracking-tight">Global Documents</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Insurance, licenses & business documents
        </p>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="documents" className="space-y-4">
        <TabsList className="grid w-full grid-cols-2 h-11">
          <TabsTrigger value="documents" className="flex items-center gap-2 text-sm">
            <FileText className="h-4 w-4" />
            Files
          </TabsTrigger>
          <TabsTrigger value="upload" className="flex items-center gap-2 text-sm">
            <Upload className="h-4 w-4" />
            Upload
          </TabsTrigger>
        </TabsList>

        <TabsContent value="documents">
          <DocumentList 
            key={refreshKey}
            isGlobal={true}
            onDocumentDeleted={handleDocumentDeleted}
          />
        </TabsContent>

        <TabsContent value="upload">
          <DocumentUpload 
            onUploadSuccess={handleUploadSuccess}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default GlobalDocumentsPage;