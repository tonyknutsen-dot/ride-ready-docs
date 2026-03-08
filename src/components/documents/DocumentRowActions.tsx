import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Eye, Download, Link2, RefreshCw, Archive, MoreVertical } from 'lucide-react';

interface DocumentRowActionsProps {
  onView: () => void;
  onDownload: () => void;
  onCopyLink?: () => void;
  onReplace?: () => void;
  onDelete?: () => void;
}

/**
 * Canonical document action pattern used across ALL document lists.
 *
 * Order: View → Download → Overflow (Copy Link / Replace / Delete)
 *
 * - Desktop: View button shows icon + label; Download icon button.
 * - Mobile: View shows icon only; same placement.
 */
const DocumentRowActions = ({
  onView,
  onDownload,
  onCopyLink,
  onReplace,
  onDelete,
}: DocumentRowActionsProps) => {
  const hasOverflow = !!(onCopyLink || onReplace || onDelete);

  return (
    <div className="flex items-center gap-1 shrink-0">
      {/* 1. View — always first, always visible */}
      <Button
        variant="outline"
        size="sm"
        className="shrink-0 gap-1.5 h-8 text-xs font-medium"
        onClick={(e) => { e.stopPropagation(); onView(); }}
      >
        <Eye className="h-3.5 w-3.5" />
        <span className="hidden sm:inline">View</span>
      </Button>

      {/* 2. Download — visible icon button */}
      <Button
        variant="ghost"
        size="icon"
        className="h-8 w-8 shrink-0"
        onClick={(e) => { e.stopPropagation(); onDownload(); }}
        title="Save to device"
      >
        <Download className="h-4 w-4" />
      </Button>

      {/* 3. Overflow — secondary actions */}
      {hasOverflow && (
        <DropdownMenu>
          <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
            <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0">
              <MoreVertical className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            {onCopyLink && (
              <DropdownMenuItem onClick={(e) => { e.stopPropagation(); onCopyLink(); }}>
                <Link2 className="h-4 w-4 mr-2" /> Copy Link
              </DropdownMenuItem>
            )}
            {onReplace && (
              <DropdownMenuItem onClick={(e) => { e.stopPropagation(); onReplace(); }}>
                <RefreshCw className="h-4 w-4 mr-2" /> Replace
              </DropdownMenuItem>
            )}
            {onDelete && (
              <DropdownMenuItem
                className="text-destructive"
                onClick={(e) => { e.stopPropagation(); onDelete(); }}
              >
                <Archive className="h-4 w-4 mr-2" /> Delete
              </DropdownMenuItem>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      )}
    </div>
  );
};

export default DocumentRowActions;
