import { useState, useEffect, useMemo } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  FileText,
  Image as ImageIcon,
  MoreVertical,
  Download,
  Archive,
  AlertTriangle,
  File,
  Globe,
  Search,
  Upload,
  Share2,
  Link2,
} from 'lucide-react';
import { Input } from '@/components/ui/input';
import { supabase } from '@/integrations/supabase/client';
import { useEffectiveUserId } from '@/hooks/useEffectiveUserId';
import { useToast } from '@/hooks/use-toast';
import { Tables } from '@/integrations/supabase/types';
import { formatDateUK } from '@/utils/dateFormat';
import { cn } from '@/lib/utils';
import { getSignedStorageUrl, shareStoredFileOrFallback } from '@/utils/exportFileActions';

type Document = Tables<'documents'>;

/* ─── Classification helpers ─── */

const GENERATED_TYPES = new Set([
  'daily_check', 'monthly_check', 'yearly_check',
  'check_record', 'safety_check',
  'maintenance_report', 'maintenance_log',
  'risk_assessment',
  'doc', 'declaration_of_compliance',
  'electrical_inspection', 'inservice_inspection',
  'ndt_report', 'ndt_schedule',
  'design_review', 'conformity_design',
  'initial_test_report',
]);

const isGenerated = (doc: Document) => {
  const t = (doc.document_type || '').toLowerCase();
  if (GENERATED_TYPES.has(t)) return true;
  if (t.includes('check') && !t.includes('checklist')) return true;
  const fp = (doc.file_path || '').toLowerCase();
  return fp.includes('/checks/') || fp.includes('/compliance/') || fp.includes('/reports/');
};

const isImageFile = (fp: string) => /\.(jpg|jpeg|png|gif|webp|bmp|tiff?)$/i.test(fp);
const isPDFFile = (fp: string) => /\.pdf$/i.test(fp);
const fileExt = (fp: string) => {
  const m = fp.match(/\.(\w+)$/);
  return m ? m[1].toUpperCase() : 'FILE';
};

const isExpiringSoon = (d: string) => {
  const days = Math.ceil((new Date(d).getTime() - Date.now()) / 86400000);
  return days > 0 && days <= 30;
};
const isExpired = (d: string) => new Date(d) < new Date();

/* ─── Category filter mapping ─── */
const CATEGORY_MAP: Record<string, Set<string>> = {
  insurance: new Set(['insurance']),
  policies: new Set(['risk_assessment', 'method_statement', 'emergency_action_plan', 'evacuation_plan']),
  training: new Set(['certificate', 'safety_certificate']),
  calibration: new Set(['pssr_certificate', 'loler_certificate', 'puwer_certificate']),
};

const matchesCategory = (doc: Document, cat: string): boolean => {
  const types = CATEGORY_MAP[cat];
  if (!types) return true;
  const t = (doc.document_type || '').toLowerCase();
  if (types.has(t)) return true;
  // Also match by substring for broader coverage
  if (cat === 'insurance' && t.includes('insur')) return true;
  if (cat === 'training' && (t.includes('training') || t.includes('cert'))) return true;
  if (cat === 'calibration' && t.includes('calibr')) return true;
  return false;
};

/* ─── Friendly type names ─── */
const TYPE_LABELS: Record<string, string> = {
  insurance: 'Insurance',
  safety_certificate: 'Safety Certificate',
  doc_certificate: 'Declaration of Conformity',
  pssr_certificate: 'PSSR Certificate',
  loler_certificate: 'LOLER Certificate',
  puwer_certificate: 'PUWER Certificate',
  risk_assessment: 'Risk Assessment',
  method_statement: 'Method Statement',
  emergency_action_plan: 'Emergency Action Plan',
  evacuation_plan: 'Evacuation Plan',
  certificate: 'Certificate',
  operator_manual: 'Operator Manual',
  controller_manual: 'Controller Manual',
  build_up_down: 'Build Up & Down',
  maintenance_report: 'Maintenance Report',
  maintenance_log: 'Maintenance Log',
  daily_check: 'Daily Check Record',
  monthly_check: 'Monthly Check Record',
  yearly_check: 'Yearly Check Record',
  ndt_report: 'NDT Report',
  ndt_schedule: 'NDT Schedule',
  design_review: 'Design Review',
  conformity_design: 'Conformity to Design',
  initial_test_report: 'Initial Test Report',
  doc: 'DOC Certificate',
  declaration_of_compliance: 'Annual Inspection Certificate',
  electrical_inspection: 'Electrical Inspection',
  inservice_inspection: 'In-Service Inspection',
  manual: 'Manual',
  other: 'Other',
};

type FilterType = 'all' | 'insurance' | 'policies' | 'training' | 'calibration' | 'other' | 'expiring' | 'archived';

interface GlobalDocumentViewProps {
  refreshKey: number;
  onDocumentDeleted: () => void;
}

const GlobalDocumentView = ({ refreshKey, onDocumentDeleted }: GlobalDocumentViewProps) => {
  const { effectiveUserId } = useEffectiveUserId();
  const { toast } = useToast();

  const [documents, setDocuments] = useState<Document[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<FilterType>('all');
  const [search, setSearch] = useState('');

  /* ─── Fetch ─── */
  useEffect(() => {
    if (!effectiveUserId) return;
    loadDocuments();
  }, [effectiveUserId, refreshKey]);

  const loadDocuments = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('documents')
        .select('*')
        .eq('is_global', true)
        .neq('document_type', 'maintenance')
        .neq('document_type', 'photo')
        .eq('user_id', effectiveUserId)
        .order('uploaded_at', { ascending: false });

      if (error) throw error;
      setDocuments(data || []);
    } catch (err: any) {
      console.error('Error loading global documents:', err);
      if (navigator.onLine) {
        toast({ title: 'Error', description: err.message, variant: 'destructive' });
      }
    } finally {
      setLoading(false);
    }
  };

  /* ─── Filter & search ─── */
  const filtered = useMemo(() => {
    let result = documents;

    // Search
    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter(d =>
        (d.document_name || '').toLowerCase().includes(q) ||
        (d.document_type || '').toLowerCase().includes(q) ||
        (d.notes || '').toLowerCase().includes(q)
      );
    }

    // Category filter
    if (filter === 'expiring') {
      result = result.filter(d => d.expires_at && (isExpiringSoon(d.expires_at) || isExpired(d.expires_at)));
      result.sort((a, b) => new Date(a.expires_at!).getTime() - new Date(b.expires_at!).getTime());
    } else if (filter === 'other') {
      // Docs that don't fit the named categories
      const allMapped = new Set([
        ...CATEGORY_MAP.insurance,
        ...CATEGORY_MAP.policies,
        ...CATEGORY_MAP.training,
        ...CATEGORY_MAP.calibration,
      ]);
      result = result.filter(d => !allMapped.has((d.document_type || '').toLowerCase()));
    } else if (filter !== 'all') {
      result = result.filter(d => matchesCategory(d, filter));
    }

    return result;
  }, [documents, filter, search]);

  /* ─── Split generated vs uploaded ─── */
  const { uploaded, generated } = useMemo(() => {
    const up: Document[] = [];
    const gen: Document[] = [];
    filtered.forEach(d => (isGenerated(d) ? gen : up).push(d));
    return { uploaded: up, generated: gen };
  }, [filtered]);

  /* ─── Actions ─── */
  const handleShare = async (doc: Document) => {
    try {
      const outcome = await shareStoredFileOrFallback(doc.file_path, doc.document_name);
      if (outcome === 'copied') {
        toast({ title: 'Link copied', description: 'Signed link valid for 1 hour.' });
      } else if (outcome === 'downloaded') {
        toast({ title: 'Downloaded', description: 'Native share unavailable, file downloaded instead.' });
      }
    } catch {
      toast({ title: 'Share failed', description: 'Could not share this document.', variant: 'destructive' });
    }
  };

  const handleCopyLink = async (doc: Document) => {
    try {
      const signedUrl = await getSignedStorageUrl(doc.file_path);
      if (!signedUrl) throw new Error('No signed URL');
      await navigator.clipboard.writeText(signedUrl);
      toast({ title: 'Link copied', description: 'Signed link valid for 1 hour.' });
    } catch {
      toast({ title: 'Copy link failed', description: 'Could not copy link.', variant: 'destructive' });
    }
  };

  const handleDownload = async (doc: Document) => {
    if (!navigator.onLine) { showRequiresConnectionToast(); return; }
    try {
      const { data, error } = await supabase.storage
        .from('ride-documents')
        .download(doc.file_path);
      if (error) throw error;
      const blob = new Blob([data], { type: doc.mime_type || 'application/octet-stream' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = doc.document_name;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err: any) {
      toast({ title: 'Download failed', description: err.message, variant: 'destructive' });
    }
  };

  const handleDelete = async (doc: Document) => {
    try {
      await supabase.storage.from('ride-documents').remove([doc.file_path]);
      await supabase.from('documents').delete().eq('id', doc.id);
      toast({ title: 'Document deleted' });
      onDocumentDeleted();
    } catch (err: any) {
      toast({ title: 'Delete failed', description: err.message, variant: 'destructive' });
    }
  };

  /* ─── Render helpers ─── */

  const ExpiryPill = ({ date }: { date: string }) => {
    if (isExpired(date)) {
      return (
        <Badge variant="destructive" className="text-[10px] h-5 gap-1">
          <AlertTriangle className="h-3 w-3" /> Expired {formatDateUK(new Date(date))}
        </Badge>
      );
    }
    if (isExpiringSoon(date)) {
      return (
        <Badge className="text-[10px] h-5 gap-1 bg-warning/15 text-warning-foreground border-warning/30">
          <AlertTriangle className="h-3 w-3" /> Due {formatDateUK(new Date(date))}
        </Badge>
      );
    }
    return (
      <span className="text-[10px] text-muted-foreground">
        Exp: {formatDateUK(new Date(date))}
      </span>
    );
  };

  const FileIcon = ({ doc }: { doc: Document }) => {
    const fp = doc.file_path || '';
    if (isPDFFile(fp)) return <FileText className="h-5 w-5 text-destructive" />;
    if (isImageFile(fp)) return <ImageIcon className="h-5 w-5 text-primary" />;
    return <File className="h-5 w-5 text-muted-foreground" />;
  };

  const DocCard = ({ doc }: { doc: Document }) => {
    const gen = isGenerated(doc);
    const typeLabel = TYPE_LABELS[doc.document_type] || doc.document_type;
    const ext = fileExt(doc.file_path || '');

    return (
      <div className="flex items-center gap-3 p-3 rounded-xl border border-border/60 bg-card">
        {/* File type icon */}
        <div className="w-10 h-10 rounded-lg bg-muted/60 flex items-center justify-center shrink-0">
          <FileIcon doc={doc} />
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0 space-y-0.5">
          <div className="flex items-center gap-1.5">
            <span className="text-sm font-semibold truncate">{doc.document_name || typeLabel}</span>
            <Badge variant="outline" className="text-[10px] h-4 px-1.5 shrink-0 gap-0.5 border-primary/30 text-primary">
              <Globe className="h-2.5 w-2.5" />
              Global
            </Badge>
          </div>

          <div className="flex flex-wrap items-center gap-1.5">
            <Badge variant="secondary" className="text-[10px] h-4 px-1.5">
              {gen ? 'Generated' : 'Uploaded'}
            </Badge>
            <span className="text-[10px] text-muted-foreground font-medium">{ext}</span>
            {doc.version_number && (
              <span className="text-[10px] text-muted-foreground">v{doc.version_number}</span>
            )}
            <span className="text-[10px] text-muted-foreground">
              {formatDateUK(new Date(doc.uploaded_at))}
            </span>
          </div>

          <div className="flex items-center gap-1.5 mt-0.5">
            {doc.expires_at && <ExpiryPill date={doc.expires_at} />}
            <span className="text-[10px] text-muted-foreground italic">Applies to all rides</span>
          </div>
        </div>

        {/* Overflow menu */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
            <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0">
              <MoreVertical className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={(e) => { e.stopPropagation(); handleDownload(doc); }}>
              <Download className="h-4 w-4 mr-2" /> Save to Device
            </DropdownMenuItem>
            <DropdownMenuItem onClick={(e) => { e.stopPropagation(); handleShare(doc); }}>
              <Share2 className="h-4 w-4 mr-2" /> Share
            </DropdownMenuItem>
            <DropdownMenuItem onClick={(e) => { e.stopPropagation(); handleCopyLink(doc); }}>
              <Link2 className="h-4 w-4 mr-2" /> Copy Link
            </DropdownMenuItem>
            <DropdownMenuItem
              className="text-destructive"
              onClick={(e) => { e.stopPropagation(); handleDelete(doc); }}
            >
              <Archive className="h-4 w-4 mr-2" /> Delete
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    );
  };

  const SubSection = ({ label, docs }: { label: string; docs: Document[] }) => {
    if (docs.length === 0) return null;
    return (
      <div className="space-y-2">
        <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground px-1">
          {label}
          <span className="ml-1.5 text-[10px] font-normal">({docs.length})</span>
        </p>
        <div className="space-y-1.5">
          {docs.map(doc => (
            <DocCard key={doc.id} doc={doc} />
          ))}
        </div>
      </div>
    );
  };

  /* ─── Filter chips ─── */
  const FILTERS: { key: FilterType; label: string }[] = [
    { key: 'all', label: 'All' },
    { key: 'insurance', label: 'Insurance' },
    { key: 'policies', label: 'Policies' },
    { key: 'training', label: 'Training' },
    { key: 'calibration', label: 'Calibration' },
    { key: 'other', label: 'Other' },
    { key: 'expiring', label: 'Expiring' },
  ];

  if (loading) {
    return (
      <div className="space-y-3">
        {[1, 2, 3].map(i => (
          <div key={i} className="h-16 rounded-xl bg-muted animate-pulse" />
        ))}
      </div>
    );
  }

  const totalCount = documents.length;

  return (
    <div className="space-y-4">
      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search documents…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-9 h-10"
        />
      </div>

      {/* Filter chips */}
      <div className="flex gap-1.5 overflow-x-auto pb-1 -mx-1 px-1">
        {FILTERS.map(f => (
          <button
            key={f.key}
            onClick={() => setFilter(f.key)}
            className={cn(
              'px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-colors',
              filter === f.key
                ? 'bg-primary text-primary-foreground'
                : 'bg-muted text-muted-foreground hover:bg-muted/80'
            )}
          >
            {f.label}
          </button>
        ))}
      </div>

      {/* Document count */}
      <p className="text-xs text-muted-foreground px-1">
        {filtered.length === totalCount
          ? `${totalCount} global document${totalCount !== 1 ? 's' : ''}`
          : `Showing ${filtered.length} of ${totalCount}`}
      </p>

      {/* Documents */}
      {filtered.length === 0 ? (
        <div className="py-12 text-center space-y-2">
          <Globe className="h-8 w-8 mx-auto text-muted-foreground/50" />
          <p className="text-sm text-muted-foreground">
            {search || filter !== 'all' ? 'No documents match your filters' : 'No global documents yet'}
          </p>
          {!search && filter === 'all' && (
            <p className="text-xs text-muted-foreground">
              Upload insurance, policies, training certs and other company-wide documents
            </p>
          )}
        </div>
      ) : (
        <div className="space-y-5">
          <SubSection label="Uploaded" docs={uploaded} />
          <SubSection label="Generated" docs={generated} />
        </div>
      )}

      {/* Viewers */}
      {viewerState.type === 'image' && (
        <ImageViewer
          url={viewerState.url}
          alt={viewerState.name}
          onClose={() => setViewerState((prev) => { if (prev.url) revokeObjectUrl(prev.url); return { type: null, url: '', name: '' }; })}
        />
      )}
      {viewerState.type === 'pdf' && (
        <DocumentPreviewSheet
          open={true}
          onOpenChange={(o) => { if (!o) setViewerState({ type: null, url: '', name: '' }); }}
          source={{ name: viewerState.name, storagePath: viewerState.url }}
        />
      )}
    </div>
  );
};

export default GlobalDocumentView;
