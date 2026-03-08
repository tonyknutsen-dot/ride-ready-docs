import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Eye, Download, Link2, RefreshCw, Archive, MoreVertical, Globe, MapPin } from 'lucide-react';

interface DocumentRowActionsProps {
  onView: () => void;
  onDownload: () => void;
  onCopyLink?: () => void;
  onReplace?: () => void;
  onDelete?: () => void;
  /** Pass to enable scope toggle in overflow menu */
  isGlobal?: boolean;
  onToggleGlobal?: () => void;
}

/**
 * Canonical document action pattern used across ALL document lists.
 *
 * Layout:  [View]  [Download]  [⋯ overflow]
 *
 * Scope (Global / Ride-only) is NOT shown here — it belongs in the
 * metadata area of the document row. The scope toggle lives inside
 * the overflow menu.
 */
const DocumentRowActions = ({
  onView,
  onDownload,
  onCopyLink,
  onReplace,
  onDelete,
  isGlobal,
  onToggleGlobal,
}: DocumentRowActionsProps) => {
  const hasOverflow = !!(onCopyLink || onReplace || onDelete || onToggleGlobal);

  return (
    <div className="flex items-center gap-1 shrink-0">
      {/* 1. View — compact secondary utility button */}
      <Button
        variant="outline"
        size="sm"
        className="shrink-0 gap-1.5 h-8 text-xs font-medium rounded-lg"
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
            {onToggleGlobal && (
              <>
                <DropdownMenuItem onClick={(e) => { e.stopPropagation(); onToggleGlobal(); }}>
                  {isGlobal ? (
                    <><MapPin className="h-4 w-4 mr-2" /> Make Ride-Only</>
                  ) : (
                    <><Globe className="h-4 w-4 mr-2" /> Make Global</>
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
