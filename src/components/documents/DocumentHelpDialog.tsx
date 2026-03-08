import { useState } from 'react';
import { HelpCircle, FileText, Globe, MapPin, Download, Eye, MoreVertical } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';

/**
 * Small help dialog explaining how the document system works.
 * Rendered as a subtle help button on document pages.
 */
const DocumentHelpDialog = () => {
  const [open, setOpen] = useState(false);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="sm" className="text-muted-foreground hover:text-foreground h-8 px-2 sm:px-3 text-[13px]">
          <HelpCircle className="h-4 w-4" />
          <span className="hidden sm:inline ml-1">How it works</span>
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5 text-primary" />
            How Documents Work
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 text-sm text-muted-foreground">
          <section>
            <h3 className="font-semibold text-foreground mb-1 flex items-center gap-1.5">
              <MapPin className="h-3.5 w-3.5" /> Ride-only documents
            </h3>
            <p>Documents linked to a specific piece of equipment. They only appear on that equipment's page.</p>
          </section>

          <section>
            <h3 className="font-semibold text-foreground mb-1 flex items-center gap-1.5">
              <Globe className="h-3.5 w-3.5" /> Global documents
            </h3>
            <p>Company-wide documents like insurance certificates, policies, or training records. These appear across all your equipment.</p>
          </section>

          <section>
            <h3 className="font-semibold text-foreground mb-1 flex items-center gap-1.5">
              <FileText className="h-3.5 w-3.5" /> Generated reports
            </h3>
            <p>When you complete a check, log maintenance, or run a compliance report, the system automatically saves a PDF into your documents.</p>
          </section>

          <section>
            <h3 className="font-semibold text-foreground mb-1">Actions</h3>
            <div className="space-y-1.5">
              <div className="flex items-center gap-2">
                <Eye className="h-3.5 w-3.5 shrink-0" /> <span><strong>View</strong> — opens the document in-app</span>
              </div>
              <div className="flex items-center gap-2">
                <Download className="h-3.5 w-3.5 shrink-0" /> <span><strong>Download</strong> — saves to your device</span>
              </div>
              <div className="flex items-center gap-2">
                <MoreVertical className="h-3.5 w-3.5 shrink-0" /> <span><strong>More</strong> — copy link, replace, change scope, or delete</span>
              </div>
            </div>
          </section>

          <section>
            <h3 className="font-semibold text-foreground mb-1">Changing scope</h3>
            <p>Use the <strong>More</strong> menu on any document to switch between <em>This ride only</em> and <em>Global</em>.</p>
          </section>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default DocumentHelpDialog;
