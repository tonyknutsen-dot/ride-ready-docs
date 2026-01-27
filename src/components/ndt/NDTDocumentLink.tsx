import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ScrollArea } from '@/components/ui/scroll-area';
import { FileText, Upload, Link, Check } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { Tables } from '@/integrations/supabase/types';

type Document = Tables<'documents'>;

interface NDTDocumentLinkProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  rideId: string;
  documentType: 'schedule' | 'report';
  currentDocumentId?: string | null;
  onDocumentLinked: (documentId: string) => void;
}

const NDTDocumentLink = ({ 
  open, 
  onOpenChange, 
  rideId, 
  documentType,
  currentDocumentId,
  onDocumentLinked 
}: NDTDocumentLinkProps) => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState<'existing' | 'upload'>('existing');
  const [documents, setDocuments] = useState<Document[]>([]);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [selectedDocId, setSelectedDocId] = useState<string | null>(currentDocumentId || null);
  const [file, setFile] = useState<File | null>(null);
  const [documentName, setDocumentName] = useState('');

  useEffect(() => {
    if (open && user) {
      loadDocuments();
      setSelectedDocId(currentDocumentId || null);
    }
  }, [open, user, rideId]);

  const loadDocuments = async () => {
    setLoading(true);
    try {
      // Load documents that could be NDT-related
      const { data, error } = await supabase
        .from('documents')
        .select('*')
        .eq('user_id', user?.id)
        .or(`ride_id.eq.${rideId},is_global.eq.true`)
        .order('uploaded_at', { ascending: false });

      if (error) throw error;
      setDocuments(data || []);
    } catch (error: any) {
      console.error('Error loading documents:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleLinkExisting = () => {
    if (selectedDocId) {
      onDocumentLinked(selectedDocId);
      onOpenChange(false);
    }
  };

  const handleUpload = async () => {
    if (!file || !user) return;

    setUploading(true);
    try {
      const fileName = `${user.id}/${rideId}/ndt_${documentType}_${Date.now()}_${file.name}`;
      
      // Upload to storage
      const { error: uploadError } = await supabase.storage
        .from('ride-documents')
        .upload(fileName, file);

      if (uploadError) throw uploadError;

      // Create document record
      const docType = documentType === 'schedule' ? 'ndt_schedule' : 'ndt_report';
      const { data: newDoc, error: docError } = await supabase
        .from('documents')
        .insert({
          user_id: user.id,
          ride_id: rideId,
          document_name: documentName || file.name,
          document_type: docType,
          file_path: fileName,
          file_size: file.size,
          mime_type: file.type,
        })
        .select()
        .single();

      if (docError) throw docError;

      toast({
        title: "Document uploaded",
        description: `NDT ${documentType} has been uploaded and will appear in your documents list`,
      });

      onDocumentLinked(newDoc.id);
      onOpenChange(false);
    } catch (error: any) {
      console.error('Error uploading document:', error);
      toast({
        title: "Upload failed",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setUploading(false);
    }
  };

  const title = documentType === 'schedule' ? 'NDT Schedule Document' : 'NDT Report Document';
  const description = documentType === 'schedule' 
    ? 'Upload or link the schedule document that tells inspectors what to inspect'
    : 'Upload or link the inspection report from the NDT inspector';

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>

        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as 'existing' | 'upload')}>
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="existing" className="flex items-center gap-2">
              <Link className="h-4 w-4" />
              Link Existing
            </TabsTrigger>
            <TabsTrigger value="upload" className="flex items-center gap-2">
              <Upload className="h-4 w-4" />
              Upload New
            </TabsTrigger>
          </TabsList>

          <TabsContent value="existing" className="mt-4">
            {loading ? (
              <p className="text-center text-muted-foreground py-4">Loading documents...</p>
            ) : documents.length === 0 ? (
              <p className="text-center text-muted-foreground py-4">
                No documents found. Upload a new document instead.
              </p>
            ) : (
              <ScrollArea className="h-[250px] pr-4">
                <div className="space-y-2">
                  {documents.map((doc) => (
                    <button
                      key={doc.id}
                      onClick={() => setSelectedDocId(doc.id)}
                      className={`w-full flex items-center gap-3 p-3 rounded-lg border text-left transition-colors ${
                        selectedDocId === doc.id 
                          ? 'border-primary bg-primary/5' 
                          : 'border-border hover:bg-muted/50'
                      }`}
                    >
                      <FileText className="h-5 w-5 text-muted-foreground flex-shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className="font-medium truncate">{doc.document_name}</p>
                        <p className="text-xs text-muted-foreground">{doc.document_type}</p>
                      </div>
                      {selectedDocId === doc.id && (
                        <Check className="h-5 w-5 text-primary flex-shrink-0" />
                      )}
                    </button>
                  ))}
                </div>
              </ScrollArea>
            )}
          </TabsContent>

          <TabsContent value="upload" className="mt-4 space-y-4">
            <div>
              <Label htmlFor="document_name">Document Name</Label>
              <Input
                id="document_name"
                value={documentName}
                onChange={(e) => setDocumentName(e.target.value)}
                placeholder={`e.g., ${documentType === 'schedule' ? 'Main Structure NDT Schedule' : 'NDT Report - Jan 2025'}`}
              />
            </div>
            <div>
              <Label htmlFor="file">Select File</Label>
              <Input
                id="file"
                type="file"
                accept=".pdf,.doc,.docx,.xls,.xlsx"
                onChange={(e) => setFile(e.target.files?.[0] || null)}
                className="mt-1"
              />
              <p className="text-xs text-muted-foreground mt-1">
                Accepted formats: PDF, Word, Excel
              </p>
            </div>
          </TabsContent>
        </Tabs>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          {activeTab === 'existing' ? (
            <Button onClick={handleLinkExisting} disabled={!selectedDocId}>
              Link Document
            </Button>
          ) : (
            <Button onClick={handleUpload} disabled={!file || uploading}>
              {uploading ? 'Uploading...' : 'Upload & Link'}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default NDTDocumentLink;
