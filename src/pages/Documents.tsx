import { useState } from 'react';
import { FileText, Globe, FolderOpen } from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import PageHeader from '@/components/PageHeader';
import DocumentList from '@/components/DocumentList';

const Documents = () => {
  const [activeTab, setActiveTab] = useState('all');
  const [refreshKey, setRefreshKey] = useState(0);

  const handleDocumentDeleted = () => {
    setRefreshKey(prev => prev + 1);
  };

  return (
    <div className="min-h-screen bg-background pb-28 md:pb-8">
      <header className="border-b-2 border-primary/30 bg-gradient-to-r from-primary/5 to-transparent backdrop-blur-sm sticky top-0 z-40">
        <div className="container mx-auto px-4 py-4">
          <PageHeader
            icon={<FileText className="h-5 w-5 text-primary" />}
            iconBgClass="from-primary/20 to-primary/10"
            title="All Documents"
            subtitle="View and manage all your documents"
            showBackButton
            backTo="/overview"
          />
        </div>
      </header>
      
      <main className="container mx-auto px-4 py-5">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
          <TabsList className="grid w-full max-w-md grid-cols-2 gap-2 p-1.5 bg-muted border border-border/50 h-auto">
            <TabsTrigger value="all" className="flex items-center justify-center gap-2 py-2.5">
              <FolderOpen className="h-4 w-4" />
              <span>All Documents</span>
            </TabsTrigger>
            <TabsTrigger value="global" className="flex items-center justify-center gap-2 py-2.5">
              <Globe className="h-4 w-4" />
              <span>Global Only</span>
            </TabsTrigger>
          </TabsList>

          <TabsContent value="all">
            <DocumentList 
              key={`all-${refreshKey}`}
              onDocumentDeleted={handleDocumentDeleted}
              grouped
              showAllDocuments
            />
          </TabsContent>

          <TabsContent value="global">
            <DocumentList 
              key={`global-${refreshKey}`}
              isGlobal
              onDocumentDeleted={handleDocumentDeleted}
              grouped
            />
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
};

export default Documents;
