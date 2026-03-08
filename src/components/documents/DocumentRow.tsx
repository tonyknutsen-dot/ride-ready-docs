/**
 * Single document row used in DocumentList.
 * Extracted for maintainability — no UI change.
 */
import { FileText } from 'lucide-react';
import DocumentRowActions from '@/components/documents/DocumentRowActions';
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

  return (
    <div className={`flex items-center gap-3 px-3 py-3 border-b border-slate-100 last:border-b-0 hover:bg-slate-50 transition-colors min-w-0 ${isOlderVersion ? 'opacity-70' : ''}`}>
      {/* File icon / thumbnail */}
      <div className="shrink-0">
        {thumbUrl ? (
          <img
            src={thumbUrl}
            alt={displayName}
            className="w-10 h-10 object-cover rounded-lg border border-slate-200"
          />
        ) : (
          <div className="w-10 h-10 bg-slate-100 rounded-lg flex items-center justify-center border border-slate-200">
            <FileText className="w-5 h-5 text-slate-600" />
          </div>
        )}
      </div>

      {/* File info */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 min-w-0">
          <p className="text-sm font-semibold text-foreground truncate" title={displayName}>
            {isOlderVersion
              ? `📅 ${new Date(doc.uploaded_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}`
              : displayName}
          </p>
          {hasMultipleVersions && !isOlderVersion && (
            <span className="shrink-0 text-[10px] font-semibold px-1.5 py-0.5 rounded bg-primary/10 text-primary">Latest</span>
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
        <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
          {!isOlderVersion && doc.is_global && (
            <span className="text-[10px] text-muted-foreground font-medium">Global</span>
          )}
          {!isOlderVersion && !doc.is_global && rideId && (
            <span className="text-[10px] text-muted-foreground font-medium">This ride only</span>
          )}
          {!isOlderVersion && (
            <span className="text-xs text-muted-foreground">{uploadedStr}</span>
          )}
          {sizeStr && <span className="text-xs text-muted-foreground">• {sizeStr}</span>}
          {doc.expires_at && !isOlderVersion && (
            expired ? (
              <span className="text-[11px] font-semibold px-1.5 py-0.5 rounded bg-red-100 text-red-800 border border-red-200">Expired</span>
            ) : expiringSoon ? (
              <span className="text-[11px] font-semibold px-1.5 py-0.5 rounded bg-amber-100 text-amber-800 border border-amber-200">Expires soon</span>
            ) : (
              <span className="text-[11px] font-semibold px-1.5 py-0.5 rounded bg-green-100 text-green-800 border border-green-200">Valid</span>
            )
          )}
        </div>
      </div>

      {/* Actions — canonical pattern */}
      <DocumentRowActions
        onView={() => onView(doc)}
        onDownload={() => onDownload(doc)}
        onCopyLink={() => onCopyLink(doc)}
        onDelete={!isOlderVersion && onDelete ? () => onDelete(doc) : undefined}
        isGlobal={doc.is_global ?? false}
        onToggleGlobal={!isOlderVersion && !isStaff && onToggleGlobal ? () => onToggleGlobal(doc) : undefined}
      />
    </div>
  );
};

export default DocumentRow;
