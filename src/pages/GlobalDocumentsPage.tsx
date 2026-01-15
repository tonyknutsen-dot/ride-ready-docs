import { useState } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Upload, FileText, FolderOpen } from 'lucide-react';
import DocumentUpload from '@/components/DocumentUpload';
import DocumentList from '@/components/DocumentList';
import PageHeader from '@/components/PageHeader';

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
        <PageHeader
          icon={<FolderOpen className="h-5 w-5 text-info" />}
          iconBgClass="from-info/20 to-primary/10"
          title="Global Documents"
          subtitle="Insurance, licenses & business documents"
          showBackButton
          backTo="/overview"
        />
      </div>

      {/* Tabs */}
      <Tabs defaultValue="documents" className="space-y-4">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="documents" className="flex items-center justify-center gap-2">
            <FileText className="h-4 w-4" />
            Files
          </TabsTrigger>
          <TabsTrigger value="upload" className="flex items-center justify-center gap-2">
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
