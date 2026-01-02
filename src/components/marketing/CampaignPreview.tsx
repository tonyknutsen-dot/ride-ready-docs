import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Card, CardContent } from "@/components/ui/card";

interface CampaignPreviewProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  subject: string;
  content: string;
  sampleContact?: {
    email: string;
    name: string | null;
    company_name: string | null;
  };
}

export const CampaignPreview = ({ 
  open, 
  onOpenChange, 
  subject, 
  content,
  sampleContact 
}: CampaignPreviewProps) => {
  const renderPersonalized = (text: string) => {
    if (!sampleContact) return text;
    
    return text
      .replace(/\{\{name\}\}/g, sampleContact.name || "Valued Customer")
      .replace(/\{\{company\}\}/g, sampleContact.company_name || "Your Company")
      .replace(/\{\{email\}\}/g, sampleContact.email);
  };

  const personalizedSubject = renderPersonalized(subject);
  const personalizedContent = renderPersonalized(content);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Email Preview</DialogTitle>
        </DialogHeader>

        <Card className="bg-white">
          <CardContent className="p-6 space-y-4">
            <div className="border-b pb-4">
              <p className="text-sm text-muted-foreground">To:</p>
              <p className="font-medium">
                {sampleContact?.name || "Recipient"} &lt;{sampleContact?.email || "example@email.com"}&gt;
              </p>
            </div>

            <div className="border-b pb-4">
              <p className="text-sm text-muted-foreground">Subject:</p>
              <p className="font-medium">{personalizedSubject || "(No subject)"}</p>
            </div>

            <div className="pt-2">
              <div className="prose prose-sm max-w-none whitespace-pre-wrap">
                {personalizedContent || "(No content)"}
              </div>
            </div>

            <div className="pt-4 border-t text-center">
              <p className="text-xs text-muted-foreground">
                ─────────────────────────────────────
              </p>
              <p className="text-xs text-muted-foreground mt-2">
                If you no longer wish to receive these emails, click here to unsubscribe.
              </p>
            </div>
          </CardContent>
        </Card>

        {sampleContact && (
          <p className="text-xs text-muted-foreground text-center">
            Preview shown for: {sampleContact.name || sampleContact.email}
          </p>
        )}
      </DialogContent>
    </Dialog>
  );
};
