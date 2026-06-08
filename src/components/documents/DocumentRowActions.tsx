import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Eye, Download, Link2, RefreshCw, Archive, MoreVertical, Globe, MapPin, FileWarning } from 'lucide-react';

interface DocumentRowActionsProps {
  onView: () => void;
  onDownload: () => void;
  onCopyLink?: () => void;
  onReplace?: () => void;
  onDelete?: () => void;
  /** Pass to enable scope toggle in overflow menu */
  isGlobal?: boolean;
  onToggleGlobal?: () => void;
  /** When false, in-app preview isn't available (e.g. DOCX/XLSX) — Download becomes the primary action. Defaults to true. */
  previewable?: boolean;
  /** When provided, shows a "Generate / Retry preview" item in the overflow menu (for DOC/DOCX/XLS/XLSX whose preview hasn't been built or has failed). */
  onRetryPreview?: () => void;
  /** Status of any pending retry — used to label the menu item. */
  previewRetryState?: 'idle' | 'pending';
}

/**
 * Canonical document action pattern used across ALL document lists.
 *
 * Layout (previewable):     [View]  [Download icon]  [⋯ overflow]
 * Layout (not previewable): [Download]              [⋯ overflow]
 */
const DocumentRowActions = ({
  onView,
  onDownload,
  onCopyLink,
  onReplace,
  onDelete,
  isGlobal,
  onToggleGlobal,
  previewable = true,
}: DocumentRowActionsProps) => {
  const hasOverflow = !!(onCopyLink || onReplace || onDelete || onToggleGlobal);

  return (
    <div className="flex items-center gap-1 shrink-0">
      {previewable ? (
        <>
          <Button
            variant="outline"
            size="sm"
            className="shrink-0 gap-1.5 h-8 text-xs font-medium rounded-lg"
            onClick={(e) => { e.stopPropagation(); onView(); }}
          >
            <Eye className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">View</span>
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 shrink-0"
            onClick={(e) => { e.stopPropagation(); onDownload(); }}
            title="Save to device"
          >
            <Download className="h-4 w-4" />
          </Button>
        </>
      ) : (
        <Button
          variant="outline"
          size="sm"
          className="shrink-0 gap-1.5 h-8 text-xs font-medium rounded-lg"
          onClick={(e) => { e.stopPropagation(); onDownload(); }}
          title="Preview not supported — download to open"
        >
          <Download className="h-3.5 w-3.5" />
          <span className="hidden sm:inline">Download</span>
        </Button>
      )}

      {/* 3. Overflow — secondary actions */}
      {hasOverflow && (
        <DropdownMenu>
          <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
            <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0">
              <MoreVertical className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            {onToggleGlobal && (
              <>
                <DropdownMenuItem onClick={(e) => { e.stopPropagation(); onToggleGlobal(); }}>
                  {isGlobal ? (
                    <><MapPin className="h-4 w-4 mr-2" /> Make equipment-only</>
                  ) : (
                    <><Globe className="h-4 w-4 mr-2" /> Share across all equipment</>
                  )}
                </DropdownMenuItem>
                {(onCopyLink || onReplace || onDelete) && <DropdownMenuSeparator />}
              </>
            )}
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
