import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { FileText, Download, Trash2, Calendar, AlertTriangle } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { Tables } from '@/integrations/supabase/types';

type Document = Tables<'documents'>;

interface DocumentListProps {
  rideId?: string;
  rideName?: string;
  isGlobal?: boolean;
  grouped?: boolean;
  onDocumentDeleted: () => void;
}

const DocumentList = ({ rideId, rideName, isGlobal = false, grouped = false, onDocumentDeleted }: DocumentListProps) => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [documents, setDocuments] = useState<Document[]>([]);
  const [loading, setLoading] = useState(true);
  const [thumbs, setThumbs] = useState<Record<string, string>>({});

  // Helper to identify image documents
  const isImageDoc = (doc: Document) => {
    const name = (doc.file_path || doc.document_name || '').toLowerCase();
    return /\.(jpg|jpeg|png|gif|bmp|webp|tif|tiff)$/.test(name);
  };

  useEffect(() => {
    if (user) {
      loadDocuments();
    }
  }, [user, rideId, isGlobal]);

  const loadDocuments = async () => {
    try {
      let query = supabase
        .from('documents')
        .select('*')
        .eq('user_id', user?.id)
        .order('uploaded_at', { ascending: false });

      if (isGlobal) {
        query = query.eq('is_global', true);
      } else if (rideId) {
        query = query.eq('ride_id', rideId);
      }

      const { data, error } = await query;

      if (error) {
        throw error;
      }

      setDocuments(data || []);
      
      // Fetch thumbnails for image documents
      if (data && data.length > 0) {
        const fetchThumbs = async () => {
          try {
            const next: Record<string, string> = {};
            const imageDocs = data.filter(isImageDoc);

            await Promise.all(
              imageDocs.map(async (doc) => {
                const { data: signedData, error } = await supabase
                  .storage
                  .from('ride-documents')
                  .createSignedUrl(doc.file_path, 3600); // 1 hour preview

                if (!error && signedData?.signedUrl) {
                  next[doc.id] = signedData.signedUrl;
                }
              })
            );

            setThumbs(next);
          } catch (e) {
            // Silent fail – fall back to icon
            console.warn('Thumbnail fetch skipped:', e);
          }
        };

        fetchThumbs();
      } else {
        setThumbs({});
      }
    } catch (error: any) {
      console.error('Error loading documents:', error);
      toast({
        title: "Error loading documents",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleDownload = async (document: Document) => {
    try {
      const { data, error } = await supabase.storage
        .from('ride-documents')
        .download(document.file_path);

      if (error) {
        throw error;
      }

      // Create download link
      const blob = new Blob([data]);
      const url = window.URL.createObjectURL(blob);
      const a = window.document.createElement('a');
      a.href = url;
      a.download = document.document_name;
      a.click();
      window.URL.revokeObjectURL(url);

      toast({
        title: "Download started",
        description: `Downloading ${document.document_name}`,
      });
    } catch (error: any) {
      console.error('Download error:', error);
      toast({
        title: "Download failed",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const handleDelete = async (document: Document) => {
    try {
      // Delete from storage
      const { error: storageError } = await supabase.storage
        .from('ride-documents')
        .remove([document.file_path]);

      if (storageError) {
        throw storageError;
      }

      // Delete from database
      const { error: dbError } = await supabase
        .from('documents')
        .delete()
        .eq('id', document.id);

      if (dbError) {
        throw dbError;
      }

      toast({
        title: "Document deleted",
        description: `${document.document_name} has been deleted`,
      });

      onDocumentDeleted();
      loadDocuments();
    } catch (error: any) {
      console.error('Delete error:', error);
      toast({
        title: "Delete failed",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const isExpiringSoon = (expiryDate: string) => {
    const expiry = new Date(expiryDate);
    const today = new Date();
    const daysUntilExpiry = Math.ceil((expiry.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
    return daysUntilExpiry <= 30 && daysUntilExpiry > 0;
  };

  const isExpired = (expiryDate: string) => {
    const expiry = new Date(expiryDate);
    const today = new Date();
    return expiry < today;
  };

  const getDocumentTypeDisplay = (type: string) => {
    const types: Record<string, string> = {
      doc: '📜 DOC Certificate',
      safety: 'Safety',
      maintenance: 'Maintenance',
      inspection: 'Inspection',
      manual: 'Manual',
      insurance: 'Insurance',
      photo: 'Device Photo',
      other: 'Other'
    };
    return types[type] || type;
  };

  const formatFileSize = (bytes: number) => {
    if (!bytes) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const prettyType = (raw: string) => {
    const t = raw.trim().toLowerCase();
    if (t === 'doc') return "📜 DOC Certificate";
    if (t === 'risk_assessment' || t.includes('risk')) return "Risk Assessment (RA)";
    if (t === 'method_statement' || t.includes('method')) return "Method Statement";
    if (t.includes('insur')) return "Insurance";
    if (t.includes('cert')) return "Certificate";
    if (t === 'photo' || t.includes('photo')) return "Device Photo";
    return "Other";
  };

  const groupByType = (docs: Document[]) => {
    const ORDER = ["📜 DOC Certificate", "Risk Assessment (RA)", "Method Statement", "Insurance", "Certificate", "Device Photo", "Other"];
    const groups: Record<string, Document[]> = {};
    docs.forEach(d => {
      const k = prettyType(d.document_type);
      (groups[k] ||= []).push(d);
    });
    const keys = Object.keys(groups).sort((a, b) => {
      const ia = ORDER.indexOf(a), ib = ORDER.indexOf(b);
      if (ia === -1 && ib === -1) return a.localeCompare(b);
      if (ia === -1) return 1;
      if (ib === -1) return -1;
      return ia - ib;
    });
    return keys.map(k => ({ type: k, items: groups[k] }));
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="pt-6">
          <div className="text-center py-4">
            <FileText className="mx-auto h-8 w-8 text-muted-foreground animate-pulse" />
            <p className="text-muted-foreground mt-2">Loading documents...</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (documents.length === 0) {
    return (
      <Card>
        <CardContent className="pt-6">
          <div className="text-center py-8">
            <FileText className="mx-auto h-16 w-16 text-muted-foreground" />
            <h3 className="text-lg font-semibold mt-4">No files yet</h3>
            <p className="text-muted-foreground">
              Press Add a document to upload files{rideName ? ` for ${rideName}` : ''}
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  // Grouped render for mobile-first clarity
  if (grouped) {
    const groupedDocs = groupByType(documents);
    return (
      <div className="space-y-6 pb-24 md:pb-0">
        {groupedDocs.map(g => (
          <section key={g.type} className="space-y-2">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold">{g.type}</h3>
              <span className="text-xs px-2 py-1 rounded-full bg-secondary">
                {g.items.length} file{g.items.length !== 1 ? "s" : ""}
              </span>
            </div>
            <div className="grid grid-cols-1 gap-3">
              {g.items.map(d => (
                <div key={d.id} className="border rounded-2xl p-3 flex items-start gap-3 hover:bg-muted/50 transition-colors min-w-0">
                  <div className="shrink-0">
                    {thumbs[d.id] ? (
                      <img
                        src={thumbs[d.id]}
                        alt={d.document_name}
                        className="w-10 h-10 rounded-md object-cover border"
                      />
                    ) : (
                      <FileText className="w-5 h-5 mt-0.5 text-primary" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-medium text-[15px] truncate" title={d.document_name}>{d.document_name}</div>
                    <div className="text-xs text-muted-foreground break-words">
                      {d.expires_at && ` • Expires ${new Date(d.expires_at).toLocaleDateString()}`}
                      {` • Uploaded ${new Date(d.uploaded_at).toLocaleDateString()}`}
                    </div>
                    {d.notes && (
                      <p className="text-xs text-muted-foreground mt-1 break-words">{d.notes}</p>
                    )}
                  </div>
                  <div className="flex flex-wrap items-center gap-2 shrink-0">
                    <Button variant="outline" size="sm" onClick={() => handleDownload(d)}>
                      <Download className="h-4 w-4" />
                    </Button>
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button size="sm" variant="outline">
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent className="w-[95vw] max-w-[95vw] sm:max-w-lg">
                        <AlertDialogHeader>
                          <AlertDialogTitle>Delete Document</AlertDialogTitle>
                          <AlertDialogDescription>
                            Are you sure you want to delete "{d.document_name}"? This action cannot be undone.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancel</AlertDialogCancel>
                          <AlertDialogAction
                            onClick={() => handleDelete(d)}
                            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                          >
                            Delete
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </div>
                </div>
              ))}
            </div>
          </section>
        ))}
      </div>
    );
  }

  // Flat list (default)
  return (
    <div className="space-y-4 pb-24 md:pb-0">
      <Card>
        <CardHeader>
          <CardTitle>
            {isGlobal ? 'Global Documents' : 'Ride Documents'} ({documents.length})
          </CardTitle>
          <CardDescription>
            {isGlobal 
              ? 'Documents that apply to all your rides'
              : 'Documents specific to this ride'
            }
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {documents.map((doc) => (
              <div key={doc.id} className="flex items-start gap-3 p-4 border rounded-lg hover:bg-muted/50 transition-colors min-w-0">
                <div className="shrink-0">
                  {thumbs[doc.id] ? (
                    <img
                      src={thumbs[doc.id]}
                      alt={doc.document_name}
                      className="h-8 w-8 rounded-md object-cover border"
                    />
                  ) : (
                    <FileText className="h-8 w-8 text-primary" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center space-x-2 flex-wrap">
                    <h4 className="font-medium truncate" title={doc.document_name}>{doc.document_name}</h4>
                    <Badge variant="secondary" className="text-xs">
                      {getDocumentTypeDisplay(doc.document_type)}
                    </Badge>
                  </div>
                  <div className="flex items-center space-x-4 text-sm text-muted-foreground mt-1 break-words">
                    <span>{formatFileSize(doc.file_size || 0)}</span>
                    <span>Uploaded {new Date(doc.uploaded_at).toLocaleDateString()}</span>
                  </div>
                  {doc.expires_at && (
                    <div className="flex items-center space-x-1 mt-1">
                      <Calendar className="h-3 w-3" />
                      <span className={`text-xs ${
                        isExpired(doc.expires_at) ? 'text-red-600' :
                        isExpiringSoon(doc.expires_at) ? 'text-yellow-600' :
                        'text-muted-foreground'
                      }`}>
                        {isExpired(doc.expires_at) && <AlertTriangle className="h-3 w-3 inline mr-1" />}
                        Expires: {new Date(doc.expires_at).toLocaleDateString()}
                      </span>
                    </div>
                  )}
                  {doc.notes && (
                    <p className="text-xs text-muted-foreground mt-1 break-words">
                      {doc.notes}
                    </p>
                  )}
                </div>
                <div className="flex flex-wrap items-center gap-2 shrink-0">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handleDownload(doc)}
                  >
                    <Download className="h-4 w-4" />
                  </Button>
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button size="sm" variant="outline">
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent className="w-[95vw] max-w-[95vw] sm:max-w-lg">
                      <AlertDialogHeader>
                        <AlertDialogTitle>Delete Document</AlertDialogTitle>
                        <AlertDialogDescription>
                          Are you sure you want to delete "{doc.document_name}"? This action cannot be undone.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction
                          onClick={() => handleDelete(doc)}
                          className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                        >
                          Delete
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default DocumentList;