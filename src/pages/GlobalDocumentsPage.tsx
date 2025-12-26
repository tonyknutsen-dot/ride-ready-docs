import GlobalDocuments from '@/components/GlobalDocuments';
import { FileText } from 'lucide-react';

const GlobalDocumentsPage = () => {
  return (
    <div className="container mx-auto px-4 py-5 pb-28 md:pb-8">
      <div className="flex items-center gap-3 mb-5">
        <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
          <FileText className="h-5 w-5 text-primary" />
        </div>
        <div>
          <h1 className="text-xl md:text-2xl font-bold tracking-tight">Documents</h1>
          <p className="text-sm text-muted-foreground">Manage your global documents</p>
        </div>
      </div>
      <GlobalDocuments />
    </div>
  );
};

export default GlobalDocumentsPage;
