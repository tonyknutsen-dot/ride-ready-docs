import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Upload } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';

interface NDTDocumentUploadProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  rideId: string;
  documentType: 'schedule' | 'report';
  onSuccess: () => void;
}

const NDTDocumentUpload = ({ 
  open, 
  onOpenChange, 
  rideId, 
  documentType,
  onSuccess 
}: NDTDocumentUploadProps) => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [uploading, setUploading] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [documentName, setDocumentName] = useState('');

  const title = documentType === 'schedule' ? 'Upload NDT Schedule' : 'Upload NDT Report';
  const description = documentType === 'schedule' 
    ? 'Upload the schedule document that tells inspectors what components to test'
    : 'Upload the inspection report received from the NDT inspector';
  const placeholder = documentType === 'schedule' 
    ? 'e.g., Main Structure NDT Schedule 2025'
    : 'e.g., NDT Report - January 2025';

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
      const { error: docError } = await supabase
        .from('documents')
        .insert({
          user_id: user.id,
          ride_id: rideId,
          document_name: documentName.trim() || file.name,
          document_type: docType,
          file_path: fileName,
          file_size: file.size,
          mime_type: file.type,
        });

      if (docError) throw docError;

      toast({
        title: "Document uploaded",
        description: `NDT ${documentType} has been uploaded successfully`,
      });

      // Reset form
      setFile(null);
      setDocumentName('');
      onSuccess();
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

  const handleClose = () => {
    setFile(null);
    setDocumentName('');
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[450px]">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div>
            <Label htmlFor="document_name">Document Name</Label>
            <Input
              id="document_name"
              value={documentName}
              onChange={(e) => setDocumentName(e.target.value)}
              placeholder={placeholder}
              className="mt-1"
            />
          </div>
          <div>
            <Label htmlFor="file">Select File</Label>
            <Input
              id="file"
              type="file"
              accept=".pdf,.doc,.docx,.xls,.xlsx,.jpg,.jpeg,.png"
              onChange={(e) => setFile(e.target.files?.[0] || null)}
              className="mt-1"
            />
            <p className="text-xs text-muted-foreground mt-1">
              Accepted formats: PDF, Word, Excel, Images
            </p>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleClose}>
            Cancel
          </Button>
          <Button onClick={handleUpload} disabled={!file || uploading}>
            <Upload className="h-4 w-4 mr-2" />
            {uploading ? 'Uploading...' : 'Upload'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default NDTDocumentUpload;
