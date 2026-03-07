import { useState } from 'react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Button } from '@/components/ui/button';
import { Share2, Link2, Mail, Download, Loader2, Copy } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { downloadBlob, isLikelyMobileOrTablet } from '@/utils/exportFileActions';
import { cn } from '@/lib/utils';

interface ShareMenuPopoverProps {
  blob: Blob;
  fileName: string;
  /** For saved documents: provide a link to copy */
  documentLink?: string;
  children?: React.ReactNode;
  /** Button variant for the trigger */
  triggerVariant?: 'action-button' | 'icon';
}

/**
 * Platform-aware share component:
 * - Mobile/tablet: triggers native share sheet directly
 * - Desktop: shows a small menu with Copy Link, Email, Download options
 */
const ShareMenuPopover = ({ blob, fileName, documentLink, children, triggerVariant = 'action-button' }: ShareMenuPopoverProps) => {
  const { toast } = useToast();
  const [sharing, setSharing] = useState(false);
  const [open, setOpen] = useState(false);

  const isMobile = isLikelyMobileOrTablet();

  const handleNativeShare = async () => {
    setSharing(true);
    try {
      const file = new File([blob], fileName, { type: blob.type || 'application/octet-stream' });
      const canShareFiles = typeof navigator.canShare !== 'function' || navigator.canShare({ files: [file] });
      if (canShareFiles) {
        await navigator.share({ files: [file], title: fileName });
        toast({ title: 'Shared', description: 'Report sent via share sheet' });
      } else {
        downloadBlob(blob, fileName);
        toast({ title: 'Downloaded', description: 'Share not supported — file downloaded instead' });
      }
    } catch (error: any) {
      if (error?.name !== 'AbortError') {
        downloadBlob(blob, fileName);
        toast({ title: 'Downloaded', description: 'Share failed — file downloaded instead' });
      }
    } finally {
      setSharing(false);
    }
  };

  const handleCopyLink = async () => {
    if (!documentLink) return;
    try {
      await navigator.clipboard.writeText(documentLink);
      toast({ title: 'Link copied', description: 'Paste into email, Teams, or WhatsApp' });
    } catch {
      toast({ title: 'Copy failed', variant: 'destructive' });
    }
    setOpen(false);
  };

  const handleEmailShare = () => {
    const subject = encodeURIComponent(fileName);
    const body = documentLink
      ? encodeURIComponent(`Here is the document: ${documentLink}`)
      : encodeURIComponent(`Please find the document "${fileName}" attached.`);
    window.open(`mailto:?subject=${subject}&body=${body}`, '_self');
    setOpen(false);
  };

  const handleDownloadFallback = () => {
    downloadBlob(blob, fileName);
    toast({ title: 'Downloaded', description: fileName });
    setOpen(false);
  };

  // Mobile: direct native share, no popover
  if (isMobile && typeof navigator?.share === 'function') {
    if (children) {
      return <span onClick={handleNativeShare}>{children}</span>;
    }
    return (
      <ShareActionButton onClick={handleNativeShare} loading={sharing} />
    );
  }

  // Desktop: show a small share menu
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        {children || <ShareActionButton onClick={() => setOpen(true)} loading={sharing} />}
      </PopoverTrigger>
      <PopoverContent className="w-52 p-1.5" align="start" side="top">
        <div className="space-y-0.5">
          <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider px-2 pt-1 pb-1">
            Share via
          </p>

          {documentLink && (
            <ShareMenuItem
              icon={Link2}
              label="Copy Link"
              description="Copy document link"
              onClick={handleCopyLink}
            />
          )}

          <ShareMenuItem
            icon={Mail}
            label="Email"
            description={documentLink ? 'Open email with link' : 'Open email client'}
            onClick={handleEmailShare}
          />

          <ShareMenuItem
            icon={Download}
            label="Save to Device"
            description="Download file"
            onClick={handleDownloadFallback}
          />
        </div>
      </PopoverContent>
    </Popover>
  );
};

function ShareActionButton({ onClick, loading }: { onClick: () => void; loading: boolean }) {
  return (
    <button
      onClick={onClick}
      disabled={loading}
      className={cn(
        'flex items-center gap-3 w-full rounded-xl border px-4 py-3 text-left transition-colors',
        'hover:bg-muted/50 active:bg-muted/70 disabled:opacity-60',
      )}
    >
      <div className="h-9 w-9 rounded-lg flex items-center justify-center shrink-0 bg-muted text-muted-foreground">
        {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Share2 className="h-4 w-4" />}
      </div>
      <div className="min-w-0">
        <p className="text-sm font-medium text-foreground">Share</p>
        <p className="text-[11px] text-muted-foreground">Send via share sheet or email</p>
      </div>
    </button>
  );
}

function ShareMenuItem({ icon: Icon, label, description, onClick }: {
  icon: typeof Share2;
  label: string;
  description: string;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="flex items-center gap-2.5 w-full rounded-lg px-2 py-2 text-left hover:bg-muted/60 transition-colors"
    >
      <Icon className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
      <div className="min-w-0">
        <p className="text-xs font-medium text-foreground">{label}</p>
        <p className="text-[10px] text-muted-foreground leading-tight">{description}</p>
      </div>
    </button>
  );
}

export default ShareMenuPopover;
