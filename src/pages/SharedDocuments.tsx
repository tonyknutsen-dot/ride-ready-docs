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
  ShieldCheck
} from 'lucide-react';
import { toast } from 'sonner';
import { format } from 'date-fns';
import appLogo from '@/assets/app-logo.jpg';

interface SharedDocument {
  id: string;
  document_name: string;
  document_type: string;
  ride_name: string;
  download_url: string;
}

interface ShareInfo {
  recipientName: string;
  message: string;
  expiresAt: string;
  accessCount: number;
  sender: {
    companyName: string | null;
    controllerName: string | null;
  };
}

const SharedDocuments = () => {
  const { token } = useParams<{ token: string }>();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [shareInfo, setShareInfo] = useState<ShareInfo | null>(null);
  const [documents, setDocuments] = useState<SharedDocument[]>([]);
  const [downloadingIds, setDownloadingIds] = useState<Set<string>>(new Set());

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
    } catch (err: any) {
      console.error('Error loading shared documents:', err);
      setError(err.message || 'Failed to load documents');
    } finally {
      setLoading(false);
    }
  };

  const handleDownload = async (doc: SharedDocument) => {
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
      
      toast.success(`Downloaded ${doc.document_name}`);
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

  const handleDownloadAll = async () => {
    toast.info(`Downloading ${documents.length} files...`);
    
    for (const doc of documents) {
      await handleDownload(doc);
      // Small delay between downloads to prevent browser blocking
      await new Promise(resolve => setTimeout(resolve, 500));
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

  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-secondary/20">
      {/* Header */}
      <header className="border-b bg-card/80 backdrop-blur-sm sticky top-0 z-10">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <img src={appLogo} alt="Ride Ready Docs" className="h-8 w-8 rounded-full" />
            <div>
              <h1 className="font-semibold text-sm sm:text-base">Ride Ready Docs</h1>
              <p className="text-xs text-muted-foreground">Secure Document Download</p>
            </div>
          </div>
          <Badge variant="outline" className="gap-1">
            <ShieldCheck className="h-3 w-3" />
            Secure
          </Badge>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8 max-w-3xl">
        {/* Sender Info Card */}
        <Card className="mb-6 border-2 border-primary/20 bg-gradient-to-b from-card to-primary/[0.02]">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 bg-primary/10 rounded-full flex items-center justify-center">
                  <Building2 className="h-6 w-6 text-primary" />
                </div>
                <div>
                  <CardTitle className="text-lg">
                    {shareInfo?.sender.companyName || shareInfo?.sender.controllerName || 'Document Package'}
                  </CardTitle>
                  {shareInfo?.sender.companyName && shareInfo?.sender.controllerName && (
                    <p className="text-sm text-muted-foreground flex items-center gap-1">
                      <User className="h-3 w-3" />
                      {shareInfo.sender.controllerName}
                    </p>
                  )}
                </div>
              </div>
              <div className="text-right">
                <Badge variant={daysRemaining <= 2 ? "destructive" : "secondary"} className="gap-1">
                  <Clock className="h-3 w-3" />
                  {daysRemaining} day{daysRemaining !== 1 ? 's' : ''} left
                </Badge>
              </div>
            </div>
          </CardHeader>
          {shareInfo?.message && (
            <CardContent className="pt-0">
              <Separator className="mb-4" />
              <div className="bg-secondary/30 rounded-lg p-4">
                <p className="text-sm whitespace-pre-wrap">{shareInfo.message}</p>
              </div>
            </CardContent>
          )}
        </Card>

        {/* Download All Button */}
        {documents.length > 1 && (
          <div className="mb-6">
            <Button 
              onClick={handleDownloadAll} 
              className="w-full gap-2"
              size="lg"
            >
              <Download className="h-5 w-5" />
              Download All {documents.length} Documents
            </Button>
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
                  <span className="text-lg">🎪</span>
                  <h3 className="font-medium text-sm">{rideName}</h3>
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
                          <p className="text-xs text-muted-foreground">{doc.document_type}</p>
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

        {/* Footer Note */}
        <div className="mt-8 text-center">
          <p className="text-xs text-muted-foreground">
            This secure link will expire on {expiresAt && format(expiresAt, 'dd MMMM yyyy')}.
            <br />
            If you need access after this date, please contact the sender.
          </p>
          <div className="flex items-center justify-center gap-2 mt-4 text-xs text-muted-foreground">
            <CheckCircle2 className="h-4 w-4 text-green-600" />
            Downloaded securely via Ride Ready Docs
          </div>
        </div>
      </main>
    </div>
  );
};

export default SharedDocuments;
