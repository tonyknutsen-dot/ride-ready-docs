import { useState } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Upload, FileText, FolderOpen } from 'lucide-react';
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
        <div className="flex items-center gap-3 mb-2">
          <div className="w-10 h-10 rounded-full bg-gradient-to-br from-info/20 to-primary/10 flex items-center justify-center shadow-sm">
            <FolderOpen className="h-5 w-5 text-info" />
          </div>
          <div>
            <h1 className="text-xl font-bold tracking-tight">Global Documents</h1>
            <p className="text-sm text-muted-foreground">
              Insurance, licenses & business documents
            </p>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="documents" className="space-y-4">
        <TabsList className="grid w-full grid-cols-2 h-12 bg-secondary border-2 border-border p-1">
          <TabsTrigger 
            value="documents" 
            className="flex items-center gap-2 text-sm data-[state=active]:bg-info data-[state=active]:text-white data-[state=active]:shadow-md"
          >
            <FileText className="h-4 w-4" />
            Files
          </TabsTrigger>
          <TabsTrigger 
            value="upload" 
            className="flex items-center gap-2 text-sm data-[state=active]:bg-success data-[state=active]:text-white data-[state=active]:shadow-md"
          >
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
