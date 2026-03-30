/**
 * Single document row used in DocumentList.
 * Mobile-first layout: filename readable, actions compact.
 */
import { FileText, Eye, Download, MoreVertical } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Link2, RefreshCw, Archive, Globe, MapPin } from 'lucide-react';
import { isDocExpired, isDocExpiringSoon, formatFileSize } from '@/utils/documentHelpers';
import { Tables } from '@/integrations/supabase/types';

type Document = Tables<'documents'>;

interface DocumentRowProps {
  doc: Document;
  isOlderVersion?: boolean;
  hasMultipleVersions?: boolean;
  thumbUrl?: string;
  rideName?: string;
  rideId?: string;
  isStaff?: boolean;
  getDocumentDisplayName: (doc: Document) => string;
  onView: (doc: Document) => void;
  onDownload: (doc: Document) => void;
  onCopyLink: (doc: Document) => void;
  onDelete?: (doc: Document) => void;
  onToggleGlobal?: (doc: Document) => void;
}

const DocumentRow = ({
  doc,
  isOlderVersion = false,
  hasMultipleVersions = false,
  thumbUrl,
  rideName,
  rideId,
  isStaff,
  getDocumentDisplayName,
  onView,
  onDownload,
  onCopyLink,
  onDelete,
  onToggleGlobal,
}: DocumentRowProps) => {
  const displayName = getDocumentDisplayName(doc);
  const expired = doc.expires_at && isDocExpired(doc.expires_at);
  const expiringSoon = doc.expires_at && !expired && isDocExpiringSoon(doc.expires_at);
  const uploadedStr = new Date(doc.uploaded_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
  const sizeStr = doc.file_size ? formatFileSize(doc.file_size) : null;

  const hasOverflow = !!(onCopyLink || onDelete || (!isOlderVersion && !isStaff && onToggleGlobal));

  return (
    <div
      className={`flex items-start gap-3 px-3 py-3 border-b border-border/50 last:border-b-0 hover:bg-muted/40 transition-colors min-w-0 ${isOlderVersion ? 'opacity-70' : ''}`}
      onClick={() => onView(doc)}
      role="button"
      tabIndex={0}
    >
      {/* File icon / thumbnail */}
      <div className="shrink-0 mt-0.5">
        {thumbUrl ? (
          <img
            src={thumbUrl}
            alt={displayName}
            className="w-10 h-10 object-cover rounded-lg border border-border"
          />
        ) : (
          <div className="w-10 h-10 bg-muted rounded-lg flex items-center justify-center border border-border">
            <FileText className="w-5 h-5 text-muted-foreground" />
          </div>
        )}
      </div>

      {/* File info — full width, wrapping allowed */}
      <div className="flex-1 min-w-0">
        {/* Title — 2-line clamp, semibold, readable */}
        <div className="flex items-start gap-1.5">
          <p
            className="text-sm font-semibold text-foreground leading-snug line-clamp-2"
            title={displayName}
          >
            {isOlderVersion
              ? `📅 ${new Date(doc.uploaded_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}`
              : displayName}
          </p>
          {hasMultipleVersions && !isOlderVersion && (
            <span className="shrink-0 text-[10px] font-semibold px-1.5 py-0.5 rounded bg-primary/10 text-primary mt-0.5">Latest</span>
          )}
        </div>

        {/* Compliance subtitle */}
        {!isOlderVersion && (() => {
          const docIdMatch = doc.document_name?.match(/^([A-Z0-9]+-CR-\d{4}-\d{4})/);
          const fullDocId = docIdMatch ? docIdMatch[1] : null;
          const parts: string[] = [];
          if (fullDocId) parts.push(fullDocId);
          if (doc.notes) {
            const lines = doc.notes.split('\n');
            const inspectorLine = lines.find(l => l.startsWith('Inspector: '));
            const refLine = lines.find(l => l.startsWith('Ref: '));
            if (rideName && !fullDocId) parts.push(rideName);
            if (inspectorLine) parts.push(inspectorLine);
            if (refLine) parts.push(refLine);
          }
          if (parts.length === 0) return null;
          return (
            <p className="text-xs text-muted-foreground truncate mt-0.5" title={parts.join(' • ')}>
              {fullDocId && <span className="font-mono font-semibold text-primary mr-1">{fullDocId}</span>}
              {parts.slice(fullDocId ? 1 : 0).join(' • ')}
            </p>
          );
        })()}

        {/* Metadata row — compact, secondary */}
        <div className="flex items-center gap-1.5 mt-1 flex-wrap">
          {!isOlderVersion && doc.is_global && (
            <span className="text-[10px] text-muted-foreground font-medium">Shared insurance</span>
          )}
          {!isOlderVersion && !doc.is_global && rideId && (
            <span className="text-[10px] text-muted-foreground font-medium">This equipment only</span>
          )}
          {!isOlderVersion && (
            <span className="text-[11px] text-foreground/60 font-medium">{uploadedStr}</span>
          )}
          {sizeStr && <span className="text-[11px] text-foreground/60">• {sizeStr}</span>}
          {doc.expires_at && !isOlderVersion && (
            expired ? (
              <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-destructive/10 text-destructive border border-destructive/20">Expired</span>
            ) : expiringSoon ? (
              <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-amber-100 text-amber-800 border border-amber-200">Expires soon</span>
            ) : (
              <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-green-100 text-green-800 border border-green-200">Valid</span>
            )
          )}
        </div>
      </div>

      {/* Actions — minimal footprint: overflow menu only on mobile */}
      <div className="flex items-center gap-0.5 shrink-0 mt-0.5" onClick={(e) => e.stopPropagation()}>
        {/* Download — single visible icon */}
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8 shrink-0"
          onClick={(e) => { e.stopPropagation(); onDownload(doc); }}
          title="Save to device"
        >
          <Download className="h-4 w-4" />
        </Button>

        {/* Overflow menu — all other actions */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
            <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0">
              <MoreVertical className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={(e) => { e.stopPropagation(); onView(doc); }}>
              <Eye className="h-4 w-4 mr-2" /> View
            </DropdownMenuItem>
            {!isOlderVersion && !isStaff && onToggleGlobal && (
              <>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={(e) => { e.stopPropagation(); onToggleGlobal(doc); }}>
                  {doc.is_global ? (
                    <><MapPin className="h-4 w-4 mr-2" /> Make equipment-only</>
                  ) : (
                    <><Globe className="h-4 w-4 mr-2" /> Share across all equipment</>
                  )}
                </DropdownMenuItem>
              </>
            )}
            {onCopyLink && (
              <DropdownMenuItem onClick={(e) => { e.stopPropagation(); onCopyLink(doc); }}>
                <Link2 className="h-4 w-4 mr-2" /> Copy Link
              </DropdownMenuItem>
            )}
            {!isOlderVersion && onDelete && (
              <>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  className="text-destructive"
                  onClick={(e) => { e.stopPropagation(); onDelete(doc); }}
                >
                  <Archive className="h-4 w-4 mr-2" /> Delete
                </DropdownMenuItem>
              </>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  );
};

export default DocumentRow;
