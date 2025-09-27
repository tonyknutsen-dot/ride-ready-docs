import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Plus, Send } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';

interface RequestDocumentTypeDialogProps {
  trigger?: React.ReactNode;
}

const RequestDocumentTypeDialog = ({ trigger }: RequestDocumentTypeDialogProps) => {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [documentTypeName, setDocumentTypeName] = useState('');
  const [description, setDescription] = useState('');
  const [justification, setJustification] = useState('');
  const { toast } = useToast();

  const handleSubmit = async () => {
    if (!documentTypeName.trim()) {
      toast({
        title: "Error",
        description: "Please enter a document type name",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);
    try {
      const { error } = await supabase.functions.invoke('send-document-type-request', {
        body: {
          documentTypeName: documentTypeName.trim(),
          description: description.trim(),
          justification: justification.trim(),
        },
      });

      if (error) throw error;

      toast({
        title: "Request Sent",
        description: "Your document type request has been sent for review. We'll add it to the system soon!",
      });

      // Reset form
      setDocumentTypeName('');
      setDescription('');
      setJustification('');
      setOpen(false);
    } catch (error) {
      console.error('Error sending request:', error);
      toast({
        title: "Error",
        description: "Failed to send request. Please try again.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger || (
          <Button variant="outline" size="sm" className="gap-2">
            <Plus className="h-4 w-4" />
            Request New Type
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Request New Document Type</DialogTitle>
          <DialogDescription>
            Can't find the document type you need? Request a new category and we'll add it to the system.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="documentTypeName">Document Type Name *</Label>
            <Input
              id="documentTypeName"
              placeholder="e.g., Structural Assessment Report"
              value={documentTypeName}
              onChange={(e) => setDocumentTypeName(e.target.value)}
            />
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="description">Brief Description</Label>
            <Input
              id="description"
              placeholder="What type of document is this?"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="justification">Why do you need this category? (Optional)</Label>
            <Textarea
              id="justification"
              placeholder="Help us understand the importance of this document type..."
              value={justification}
              onChange={(e) => setJustification(e.target.value)}
              className="min-h-[80px]"
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={loading} className="gap-2">
            {loading ? (
              <>Sending...</>
            ) : (
              <>
                <Send className="h-4 w-4" />
                Send Request
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default RequestDocumentTypeDialog;