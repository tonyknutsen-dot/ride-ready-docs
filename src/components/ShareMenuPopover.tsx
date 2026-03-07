import { useState, forwardRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Share2, Loader2, Send } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { downloadBlob, isLikelyMobileOrTablet } from '@/utils/exportFileActions';
import { cn } from '@/lib/utils';

interface ShareMenuPopoverProps {
  blob: Blob;
  fileName: string;
  children?: React.ReactNode;
}

/**
 * Platform-aware share component:
 * - Mobile/tablet with native share: triggers share sheet directly
 * - Desktop: navigates to the built-in Send Documents page
 */
const ShareMenuPopover = ({ blob, fileName, children }: ShareMenuPopoverProps) => {
  const { toast } = useToast();
  const navigate = useNavigate();
  const [sharing, setSharing] = useState(false);

  const isMobile = isLikelyMobileOrTablet();
  const hasNativeShare = typeof navigator?.share === 'function';

  const handleNativeShare = async () => {
    setSharing(true);
    try {
      const file = new File([blob], fileName, { type: blob.type || 'application/octet-stream' });
      const canShareFiles = typeof navigator.canShare !== 'function' || navigator.canShare({ files: [file] });
      if (canShareFiles) {
        await navigator.share({ files: [file], title: fileName });
        toast({ title: 'Shared', description: 'Report sent via share sheet' });
      } else {
        // Fallback: go to Send Documents
        navigate('/send-documents');
      }
    } catch (error: any) {
      if (error?.name !== 'AbortError') {
        navigate('/send-documents');
      }
    } finally {
      setSharing(false);
    }
  };

  const handleShare = () => {
    if (isMobile && hasNativeShare) {
      handleNativeShare();
    } else {
      navigate('/send-documents');
    }
  };

  if (children) {
    return <span onClick={handleShare}>{children}</span>;
  }

  return (
    <ShareActionButton onClick={handleShare} loading={sharing} />
  );
};

const ShareActionButton = forwardRef<HTMLButtonElement, { onClick: () => void; loading: boolean }>(
  ({ onClick, loading }, ref) => {
    return (
      <button
        ref={ref}
        type="button"
        onClick={onClick}
        disabled={loading}
        className={cn(
          'flex items-center gap-3 w-full rounded-xl border px-4 py-3 text-left transition-colors',
          'hover:bg-muted/50 active:bg-muted/70 disabled:opacity-60',
        )}
      >
        <div className="h-9 w-9 rounded-lg flex items-center justify-center shrink-0 bg-muted text-muted-foreground">
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
        </div>
        <div className="min-w-0">
          <p className="text-sm font-medium text-foreground">Send</p>
          <p className="text-[11px] text-muted-foreground">Send via the built-in document sharing</p>
        </div>
      </button>
    );
  },
);
ShareActionButton.displayName = 'ShareActionButton';

export default ShareMenuPopover;
