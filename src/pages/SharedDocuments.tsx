import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { 
  Download, 
  FileText, 
  AlertCircle, 
  Loader2, 
  Building2,
  Clock,
  User,
  CheckCircle2,
  ShieldCheck,
  Package
} from 'lucide-react';
import { toast } from 'sonner';
import { format } from 'date-fns';
import appLogo from '@/assets/app-logo.jpg';

interface SharedDocument {
  id: string;
  document_name: string;
  document_type: string;
  ride_name: string;
  file_size?: number;
  download_url: string;
}

interface ShareInfo {
  recipientName: string;
  message: string;
  expiresAt: string;
  accessCount: number;
  totalSize?: number;
  documentCount?: number;
  equipment?: {
    label: string;
    count: number;
    multiple: boolean;
    names: string[];
  };
  sender: {
    companyName: string | null;
    controllerName: string | null;
    email?: string | null;
  };
}


function formatBytes(bytes: number): string {
  if (!bytes || bytes <= 0) return '';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

const SharedDocuments = () => {
  const { token } = useParams<{ token: string }>();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [shareInfo, setShareInfo] = useState<ShareInfo | null>(null);
  const [documents, setDocuments] = useState<SharedDocument[]>([]);
  const [downloadingIds, setDownloadingIds] = useState<Set<string>>(new Set());
  const [zipDownloading, setZipDownloading] = useState(false);
  const [zipDownloaded, setZipDownloaded] = useState(false);
  const [closeBlocked, setCloseBlocked] = useState(false);

  useEffect(() => {
    if (token) {
      loadSharedDocuments();
    }
  }, [token]);


  const loadSharedDocuments = async () => {
    setLoading(true);
    setError(null);

    try {
      const { data, error: fnError } = await supabase.functions.invoke('get-shared-documents', {
        body: { shareToken: token }
      });

      if (fnError) throw fnError;
      if (data.error) throw new Error(data.error);

      setShareInfo(data.share);
      setDocuments(data.documents);
      console.log('[SharedDocuments] loaded', {
        message_present: !!data?.share?.message,
        equipment_present: !!data?.share?.equipment && data.share.equipment.count > 0,
        equipment_label: data?.share?.equipment?.label ?? null,
        doc_count: data?.documents?.length ?? 0,
        total_size: data?.share?.totalSize ?? 0,
      });

    } catch (err: any) {
      console.error('Error loading shared documents:', err);
      setError(err.message || 'Failed to load documents');
    } finally {
      setLoading(false);
    }
  };

  const handleDownload = async (doc: SharedDocument) => {
    if (!navigator.onLine) {
      toast.error('Requires connection', { description: 'Downloads are unavailable while offline.' });
      return;
    }
    setDownloadingIds(prev => new Set(prev).add(doc.id));
    try {
      // Create a temporary link and click it to download
      const response = await fetch(doc.download_url);
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = doc.document_name;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
      
      toast.success('Download started', { description: doc.document_name });
    } catch (err) {
      console.error('Download error:', err);
      toast.error('Failed to download file');
    } finally {
      setDownloadingIds(prev => {
        const next = new Set(prev);
        next.delete(doc.id);
        return next;
      });
    }
  };

  const handleDownloadZip = async () => {
    if (!navigator.onLine) {
      toast.error('Requires connection', { description: 'Downloads are unavailable while offline.' });
      return;
    }
    if (!token) return;
    setZipDownloading(true);
    try {
      const projectId = (import.meta as any).env?.VITE_SUPABASE_PROJECT_ID;
      const supabaseUrl = (import.meta as any).env?.VITE_SUPABASE_URL || `https://${projectId}.supabase.co`;
      const apikey = (import.meta as any).env?.VITE_SUPABASE_PUBLISHABLE_KEY;
      const res = await fetch(`${supabaseUrl}/functions/v1/download-document-share-zip`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'apikey': apikey,
          'Authorization': `Bearer ${apikey}`,
        },
        body: JSON.stringify({ shareToken: token }),
      });

      if (!res.ok) {
        let msg = 'We could not prepare the ZIP download. You can still download the documents individually.';
        try {
          const data = await res.json();
          if (data?.error) msg = data.error;
        } catch {}
        toast.error(msg);
        return;
      }

      const blob = await res.blob();
      const disposition = res.headers.get('content-disposition') || '';
      // Prefer RFC 5987 filename* (UTF-8), fall back to filename=
      let filename = '';
      const star = /filename\*\s*=\s*(?:UTF-8'')?([^;]+)/i.exec(disposition);
      if (star?.[1]) {
        try { filename = decodeURIComponent(star[1].trim().replace(/^"|"$/g, '')); } catch { filename = star[1]; }
      }
      if (!filename) {
        const plain = /filename\s*=\s*"?([^";]+)"?/i.exec(disposition);
        if (plain?.[1]) filename = plain[1].trim();
      }
      if (!filename) {
        const company = shareInfo?.sender.companyName || shareInfo?.sender.controllerName || 'Documents';
        filename = `${company} - Documents.zip`;
      }
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
      setZipDownloaded(true);
      toast.success('Your ZIP download has started');
    } catch (err: any) {
      console.error('ZIP download error:', err);
      toast.error('We could not prepare the ZIP download. You can still download the documents individually.');
    } finally {
      setZipDownloading(false);
    }
  };

  const handleClosePage = () => {
    try {
      window.close();
      // If the tab is still here shortly after, the browser blocked it.
      setTimeout(() => {
        if (!window.closed) setCloseBlocked(true);
      }, 300);
    } catch {
      setCloseBlocked(true);
    }
  };

  // Group documents by ride
  const documentsByRide = documents.reduce((acc, doc) => {
    const key = doc.ride_name;
    if (!acc[key]) acc[key] = [];
    acc[key].push(doc);
    return acc;
  }, {} as Record<string, SharedDocument[]>);

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-background to-secondary/20 flex items-center justify-center p-4">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin text-primary mx-auto mb-4" />
          <p className="text-muted-foreground">Loading documents...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-background to-secondary/20 flex items-center justify-center p-4">
        <Card className="max-w-md w-full">
          <CardContent className="pt-6">
            <div className="text-center">
              <div className="w-16 h-16 bg-destructive/10 rounded-full flex items-center justify-center mx-auto mb-4">
                <AlertCircle className="h-8 w-8 text-destructive" />
              </div>
              <h2 className="text-xl font-semibold mb-2">Unable to Access Documents</h2>
              <p className="text-muted-foreground mb-4">{error}</p>
              <p className="text-sm text-muted-foreground">
                Please contact the sender if you believe this is an error.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  const expiresAt = shareInfo ? new Date(shareInfo.expiresAt) : null;
  const daysRemaining = expiresAt ? Math.ceil((expiresAt.getTime() - Date.now()) / (1000 * 60 * 60 * 24)) : 0;
  const totalSize = shareInfo?.totalSize || documents.reduce((s, d) => s + (d.file_size || 0), 0);
  const totalSizeLabel = formatBytes(totalSize);
  const ZIP_MAX_FILES = 50;
  const ZIP_MAX_BYTES = 100 * 1024 * 1024;
  const zipEligible = documents.length > 0
    && documents.length <= ZIP_MAX_FILES
    && (totalSize === 0 || totalSize <= ZIP_MAX_BYTES);
  const expiryLong = expiresAt ? format(expiresAt, 'd MMMM yyyy') : '';

  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-secondary/20">
      {/* Header — no app navigation; this page is public */}
      <header className="border-b bg-card/80 backdrop-blur-sm">
        <div className="container mx-auto px-4 py-4 max-w-3xl flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <img src={appLogo} alt="Ride Ready Docs" className="h-9 w-9 rounded-lg shrink-0" />
            <div className="min-w-0">
              <p className="font-semibold text-sm sm:text-base truncate">Ride Ready Docs</p>
              <p className="text-xs text-muted-foreground">Secure document delivery</p>
            </div>
          </div>
          <Badge className="gap-1 bg-primary/10 text-primary border border-primary/20 hover:bg-primary/10">
            <ShieldCheck className="h-3.5 w-3.5" />
            Secure link
          </Badge>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8 max-w-3xl">
        <div className="mb-6">
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">Secure Document Download</h1>
          <p className="text-sm text-muted-foreground mt-1">
            A verified documentation package has been shared with you.
          </p>
        </div>

        {/* Sender / package summary */}
        <Card className="mb-6 border-2 border-primary/15 bg-gradient-to-b from-card to-primary/[0.02]">
          <CardHeader className="pb-3">
            <div className="flex items-start justify-between gap-4">
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-12 h-12 bg-primary/10 rounded-full flex items-center justify-center shrink-0">
                  <Building2 className="h-6 w-6 text-primary" />
                </div>
                <div className="min-w-0">
                  <CardTitle className="text-lg truncate">
                    {shareInfo?.sender.companyName || shareInfo?.sender.controllerName || 'Document Package'}
                  </CardTitle>
                  {shareInfo?.sender.controllerName && shareInfo?.sender.companyName && (
                    <p className="text-sm text-muted-foreground flex items-center gap-1 mt-0.5">
                      <User className="h-3 w-3" />
                      {shareInfo.sender.controllerName}
                    </p>
                  )}
                </div>
              </div>
              <Badge variant={daysRemaining <= 2 ? "destructive" : "secondary"} className="gap-1 shrink-0">
                <Clock className="h-3 w-3" />
                {daysRemaining} day{daysRemaining !== 1 ? 's' : ''} left
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="pt-0">
            <Separator className="mb-4" />
            {(() => {
              const assetNames = Object.keys(documentsByRide).filter(n => n && n !== 'Global');
              const equipmentLabel = assetNames.length === 0
                ? null
                : assetNames.length === 1
                  ? assetNames[0]
                  : `Multiple items (${assetNames.length})`;
              return equipmentLabel ? (
                <div className="mb-4">
                  <dt className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Equipment</dt>
                  <dd className="font-semibold mt-0.5 break-words">{equipmentLabel}</dd>
                </div>
              ) : null;
            })()}
            <dl className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-sm">
              <div>
                <dt className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Documents</dt>
                <dd className="font-semibold mt-0.5">{documents.length}</dd>
              </div>
              {totalSizeLabel && (
                <div>
                  <dt className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Total size</dt>
                  <dd className="font-semibold mt-0.5">{totalSizeLabel}</dd>
                </div>
              )}
              {expiryLong && (
                <div>
                  <dt className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Expires</dt>
                  <dd className="font-semibold mt-0.5">{expiryLong}</dd>
                </div>
              )}
            </dl>
            {shareInfo?.message && (
              <div className="mt-4 bg-secondary/30 rounded-lg p-4">
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-1">Message</p>
                <p className="text-sm whitespace-pre-wrap">{shareInfo.message}</p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Primary action: ZIP download */}
        {documents.length > 0 && (
          <div className="mb-6 space-y-2">
            {zipEligible ? (
              <Button
                onClick={handleDownloadZip}
                disabled={zipDownloading}
                className="w-full gap-2"
                size="lg"
              >
                {zipDownloading ? (
                  <>
                    <Loader2 className="h-5 w-5 animate-spin" />
                    Preparing ZIP…
                  </>
                ) : zipDownloaded ? (
                  <>
                    <Download className="h-5 w-5" />
                    Download ZIP again
                  </>
                ) : (
                  <>
                    <Package className="h-5 w-5" />
                    Download all as ZIP{totalSizeLabel ? ` (${totalSizeLabel})` : ''}
                  </>
                )}
              </Button>
            ) : (
              <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
                This package is too large for one ZIP download. Please download the documents individually below.
              </div>
            )}
            {zipDownloaded ? (
              <div className="rounded-lg border border-green-200 bg-green-50 p-4 space-y-3">
                <div className="flex items-start gap-2">
                  <CheckCircle2 className="h-5 w-5 text-green-700 mt-0.5 shrink-0" />
                  <div className="text-sm text-green-900">
                    <p className="font-semibold">Your ZIP download has started.</p>
                    <p className="mt-1">
                      You can close this page, download the ZIP again, or download individual files below.
                    </p>
                  </div>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleDownloadZip}
                    disabled={zipDownloading}
                    className="gap-1.5"
                  >
                    <Download className="h-4 w-4" />
                    Download ZIP again
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleClosePage}
                  >
                    Close page
                  </Button>
                </div>
                {closeBlocked && (
                  <p className="text-xs text-green-900">
                    You can safely close this tab or browser window.
                  </p>
                )}
              </div>
            ) : (
              <p className="text-xs text-muted-foreground text-center">
                Download everything as one ZIP, or download individual files from the list below.
              </p>
            )}
          </div>
        )}


        {/* Documents List */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <FileText className="h-5 w-5 text-primary" />
              Available Documents
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            {Object.entries(documentsByRide).map(([rideName, docs]) => (
              <div key={rideName}>
                <div className="flex items-center gap-2 mb-3">
                  <h3 className="font-semibold text-sm">{rideName}</h3>
                  <Badge variant="outline" className="text-xs">{docs.length}</Badge>
                </div>
                <div className="space-y-2">
                  {docs.map(doc => (
                    <div
                      key={doc.id}
                      className="flex items-center justify-between gap-3 p-3 border rounded-lg hover:bg-accent/50 transition-colors"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="w-10 h-10 bg-primary/10 rounded-lg flex items-center justify-center shrink-0">
                          <FileText className="h-5 w-5 text-primary" />
                        </div>
                        <div className="min-w-0">
                          <p className="font-medium text-sm truncate">{doc.document_name}</p>
                          <p className="text-xs text-muted-foreground">
                            {doc.document_type}{doc.file_size ? ` · ${formatBytes(doc.file_size)}` : ''}
                          </p>
                        </div>
                      </div>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleDownload(doc)}
                        disabled={downloadingIds.has(doc.id)}
                        className="shrink-0 gap-1.5"
                      >
                        {downloadingIds.has(doc.id) ? (
                          <>
                            <Loader2 className="h-4 w-4 animate-spin" />
                            <span className="hidden sm:inline">Downloading</span>
                          </>
                        ) : (
                          <>
                            <Download className="h-4 w-4" />
                            <span className="hidden sm:inline">Download</span>
                          </>
                        )}
                      </Button>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </CardContent>
        </Card>

        {/* Security note */}
        <div className="mt-8">
          <div className="rounded-lg border bg-card/60 p-4 text-xs text-muted-foreground flex items-start gap-2">
            <ShieldCheck className="h-4 w-4 text-primary mt-0.5 shrink-0" />
            <p>
              This secure link expires on {expiresAt && format(expiresAt, 'd MMMM yyyy')}.
              Only download documents from people you trust. If you need access after this date, please contact the sender.
            </p>
          </div>
          <div className="flex items-center justify-center gap-2 mt-4 text-xs text-muted-foreground">
            <CheckCircle2 className="h-4 w-4 text-green-600" />
            Delivered securely via Ride Ready Docs
          </div>
        </div>
      </main>
    </div>
  );
};


export default SharedDocuments;
