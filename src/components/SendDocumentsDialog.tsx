import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Mail, FileText, AlertCircle, CheckCircle, Loader2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';

interface SendDocumentsDialogProps {
  ride: {
    id: string;
    ride_name: string;
    manufacturer?: string;
    serial_number?: string;
    year_manufactured?: number;
  };
  trigger?: React.ReactNode;
}

interface Document {
  id: string;
  document_name: string;
  document_type: string;
  expires_at?: string;
  file_size?: number;
  is_global: boolean;
}

export const SendDocumentsDialog: React.FC<SendDocumentsDialogProps> = ({ ride, trigger }) => {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [documents, setDocuments] = useState<Document[]>([]);
  const [selectedDocuments, setSelectedDocuments] = useState<string[]>([]);
  const [recipientEmail, setRecipientEmail] = useState('');
  const [recipientName, setRecipientName] = useState('');
  const [message, setMessage] = useState('');
  const [includeInsurance, setIncludeInsurance] = useState(true);
  const [insuranceDocuments, setInsuranceDocuments] = useState<Document[]>([]);
  const [profile, setProfile] = useState<any>(null);

  useEffect(() => {
    if (open && user) {
      loadDocuments();
    }
  }, [open, user, ride.id]);

  const loadDocuments = async () => {
    try {
      // Load user profile
      const { data: profileData } = await supabase
        .from('profiles')
        .select('company_name, controller_name, showmen_name, address')
        .eq('user_id', user?.id)
        .single();

      setProfile(profileData);

      // Load ride-specific documents
      const { data: rideDocuments, error: rideError } = await supabase
        .from('documents')
        .select('id, document_name, document_type, expires_at, file_size, is_global')
        .eq('user_id', user?.id)
        .eq('ride_id', ride.id)
        .order('document_name');

      if (rideError) throw rideError;

      // Load insurance documents
      const { data: insuranceDocs, error: insuranceError } = await supabase
        .from('documents')
        .select('id, document_name, document_type, expires_at, file_size, is_global')
        .eq('user_id', user?.id)
        .eq('is_global', true)
        .ilike('document_type', '%insurance%')
        .order('document_name');

      if (insuranceError) throw insuranceError;

      setDocuments(rideDocuments || []);
      setInsuranceDocuments(insuranceDocs || []);
      
      // Auto-select all ride documents and insurance docs
      const allDocIds = [
        ...(rideDocuments || []).map(doc => doc.id),
        ...(insuranceDocs || []).map(doc => doc.id)
      ];
      setSelectedDocuments(allDocIds);

    } catch (error) {
      console.error('Error loading documents:', error);
      toast.error('Failed to load documents');
    }
  };

  const handleDocumentToggle = (documentId: string) => {
    setSelectedDocuments(prev => 
      prev.includes(documentId)
        ? prev.filter(id => id !== documentId)
        : [...prev, documentId]
    );
  };

  const handleSend = async () => {
    if (!recipientEmail || selectedDocuments.length === 0) {
      toast.error('Please enter recipient email and select at least one document');
      return;
    }

    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('send-ride-documents', {
        body: {
          rideId: ride.id,
          recipientEmail,
          recipientName,
          message,
          includeInsurance,
          documentIds: selectedDocuments
        }
      });

      if (error) throw error;

      const successMessage = data.wasSplit 
        ? `Successfully sent ${data.documentsCount} documents to ${recipientEmail} across ${data.emailsSent} separate emails due to size limits`
        : `Successfully sent ${data.documentsCount} documents to ${recipientEmail}`;
        
      toast.success(successMessage);
      setOpen(false);
      
      // Reset form
      setRecipientEmail('');
      setRecipientName('');
      setMessage('');
      setSelectedDocuments([]);
      
    } catch (error: any) {
      console.error('Error sending documents:', error);
      toast.error(error.message || 'Failed to send documents');
    } finally {
      setLoading(false);
    }
  };

  const formatFileSize = (bytes?: number) => {
    if (!bytes) return '';
    const mb = bytes / (1024 * 1024);
    return mb < 1 ? `${Math.round(bytes / 1024)}KB` : `${mb.toFixed(1)}MB`;
  };

  const isExpiringSoon = (expiryDate?: string) => {
    if (!expiryDate) return false;
    const expiry = new Date(expiryDate);
    const thirtyDaysFromNow = new Date();
    thirtyDaysFromNow.setDate(thirtyDaysFromNow.getDate() + 30);
    return expiry <= thirtyDaysFromNow;
  };

  const totalSelectedDocs = selectedDocuments.length;
  const rideInfo = `${ride.ride_name}${ride.manufacturer ? ` (${ride.manufacturer})` : ''}`;
  
  // Calculate total file size of selected documents
  const allAvailableDocs = [...documents, ...insuranceDocuments];
  const totalFileSize = allAvailableDocs
    .filter(doc => selectedDocuments.includes(doc.id))
    .reduce((sum, doc) => sum + (doc.file_size || 0), 0);
  
  const totalSizeMB = totalFileSize / (1024 * 1024);
  const exceedsEmailLimit = totalSizeMB > 10;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger || (
          <Button variant="outline" size="sm">
            <Mail className="h-4 w-4 mr-2" />
            Send Documents
          </Button>
        )}
      </DialogTrigger>
      
      <DialogContent className="max-w-xl max-h-[85vh] overflow-hidden flex flex-col">
        <DialogHeader className="flex-shrink-0">
          <DialogTitle className="flex items-center gap-2 text-lg">
            <Mail className="h-5 w-5 text-primary" />
            Send Documents
          </DialogTitle>
          <p className="text-sm text-muted-foreground mt-1">{rideInfo}</p>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto space-y-5 pr-2">
          {/* Sender Information */}
          <div className="bg-primary/5 border border-primary/20 rounded-lg p-4 space-y-2">
            <h3 className="text-sm font-semibold text-primary flex items-center gap-2">
              <Mail className="h-4 w-4" />
              Your Information (will be included in email)
            </h3>
            <div className="text-xs space-y-1 text-muted-foreground">
              {profile?.company_name && (
                <p><span className="font-medium">Company:</span> {profile.company_name}</p>
              )}
              {profile?.controller_name && (
                <p><span className="font-medium">Controller:</span> {profile.controller_name}</p>
              )}
              {profile?.showmen_name && (
                <p><span className="font-medium">Showmen:</span> {profile.showmen_name}</p>
              )}
              {profile?.address && (
                <p><span className="font-medium">Address:</span> {profile.address}</p>
              )}
              {user?.email && (
                <p><span className="font-medium">Email:</span> {user.email}</p>
              )}
              {!profile?.company_name && !profile?.controller_name && (
                <p className="text-destructive italic">⚠️ Please complete your profile in Settings</p>
              )}
            </div>
          </div>

          {/* Recipient Information */}
          <div className="space-y-3">
            <h3 className="text-sm font-semibold">Recipient</h3>
            <div className="space-y-3">
              <div>
                <Label htmlFor="recipientEmail" className="text-xs">Email Address *</Label>
                <Input
                  id="recipientEmail"
                  type="email"
                  value={recipientEmail}
                  onChange={(e) => setRecipientEmail(e.target.value)}
                  placeholder="council@example.com"
                  className="mt-1.5"
                  required
                />
              </div>
              <div>
                <Label htmlFor="recipientName" className="text-xs">Name/Organization</Label>
                <Input
                  id="recipientName"
                  value={recipientName}
                  onChange={(e) => setRecipientName(e.target.value)}
                  placeholder="Local Council / Authority"
                  className="mt-1.5"
                />
              </div>
              <div>
                <Label htmlFor="message" className="text-xs">Message (Optional)</Label>
                <Textarea
                  id="message"
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  placeholder="Additional notes for the recipient..."
                  className="mt-1.5 resize-none"
                  rows={2}
                />
              </div>
            </div>
          </div>

          {/* Document Selection */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold">Documents</h3>
              <Badge variant="secondary" className="text-xs">{totalSelectedDocs} selected</Badge>
            </div>
            
            {/* File size info */}
            <div className="flex items-center justify-between text-xs bg-muted/50 rounded-lg px-3 py-2">
              <span className="text-muted-foreground">Total size:</span>
              <Badge variant={exceedsEmailLimit ? "destructive" : "outline"} className="text-xs">
                {formatFileSize(totalFileSize)}
              </Badge>
            </div>

            {exceedsEmailLimit && (
              <div className="bg-destructive/10 border border-destructive/20 rounded-lg p-3">
                <div className="flex gap-2 text-destructive">
                  <AlertCircle className="h-4 w-4 mt-0.5 flex-shrink-0" />
                  <div className="text-xs">
                    <p className="font-medium">Large file size ({totalSizeMB.toFixed(1)}MB)</p>
                    <p className="text-muted-foreground mt-0.5">Will be split into multiple emails if needed</p>
                  </div>
                </div>
              </div>
            )}

            {/* Ride-specific documents */}
            {documents.length > 0 && (
              <div className="space-y-2">
                <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                  <FileText className="h-3.5 w-3.5" />
                  <span>Ride Documents ({documents.length})</span>
                </div>
                <div className="space-y-1.5">
                  {documents.map((doc) => (
                    <label 
                      key={doc.id} 
                      className="flex items-start gap-3 p-3 border rounded-lg cursor-pointer hover:bg-accent/50 transition-colors"
                    >
                      <Checkbox
                        checked={selectedDocuments.includes(doc.id)}
                        onCheckedChange={() => handleDocumentToggle(doc.id)}
                        className="mt-0.5"
                      />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-medium text-sm">{doc.document_name}</span>
                          <Badge variant="outline" className="text-xs">{doc.document_type}</Badge>
                          {doc.expires_at && isExpiringSoon(doc.expires_at) && (
                            <Badge variant="destructive" className="text-xs">Expiring</Badge>
                          )}
                        </div>
                        <div className="text-xs text-muted-foreground mt-0.5">
                          {formatFileSize(doc.file_size)}
                          {doc.expires_at && ` • Expires: ${new Date(doc.expires_at).toLocaleDateString()}`}
                        </div>
                      </div>
                    </label>
                  ))}
                </div>
              </div>
            )}

            {/* Insurance documents */}
            {insuranceDocuments.length > 0 && (
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                    <CheckCircle className="h-3.5 w-3.5" />
                    <span>Insurance Documents ({insuranceDocuments.length})</span>
                  </div>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <Checkbox
                      checked={includeInsurance}
                      onCheckedChange={(checked) => {
                        setIncludeInsurance(!!checked);
                        if (checked) {
                          setSelectedDocuments(prev => [
                            ...prev,
                            ...insuranceDocuments.map(doc => doc.id).filter(id => !prev.includes(id))
                          ]);
                        } else {
                          setSelectedDocuments(prev => 
                            prev.filter(id => !insuranceDocuments.some(doc => doc.id === id))
                          );
                        }
                      }}
                    />
                    <span className="text-xs text-muted-foreground">Select all</span>
                  </label>
                </div>
                <div className="space-y-1.5">
                  {insuranceDocuments.map((doc) => (
                    <label 
                      key={doc.id} 
                      className="flex items-start gap-3 p-3 border rounded-lg cursor-pointer hover:bg-accent/50 transition-colors bg-accent/30"
                    >
                      <Checkbox
                        checked={selectedDocuments.includes(doc.id)}
                        onCheckedChange={() => handleDocumentToggle(doc.id)}
                        className="mt-0.5"
                      />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-medium text-sm">{doc.document_name}</span>
                          <Badge variant="outline" className="text-xs">{doc.document_type}</Badge>
                          {doc.expires_at && isExpiringSoon(doc.expires_at) && (
                            <Badge variant="destructive" className="text-xs">Expiring</Badge>
                          )}
                        </div>
                        <div className="text-xs text-muted-foreground mt-0.5">
                          {formatFileSize(doc.file_size)}
                          {doc.expires_at && ` • Expires: ${new Date(doc.expires_at).toLocaleDateString()}`}
                        </div>
                      </div>
                    </label>
                  ))}
                </div>
              </div>
            )}

            {documents.length === 0 && insuranceDocuments.length === 0 && (
              <div className="text-center py-8 text-muted-foreground">
                <FileText className="mx-auto h-12 w-12 mb-3 opacity-30" />
                <p className="text-sm font-medium">No documents available</p>
                <p className="text-xs mt-1">Upload documents to this ride first</p>
              </div>
            )}
          </div>
        </div>

        {/* Actions */}
        <div className="flex-shrink-0 flex justify-end gap-3 pt-4 border-t mt-4">
          <Button variant="outline" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button 
            onClick={handleSend} 
            disabled={loading || !recipientEmail || selectedDocuments.length === 0}
          >
            {loading ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Sending...
              </>
            ) : (
              <>
                <Mail className="h-4 w-4 mr-2" />
                Send {totalSelectedDocs > 0 && `(${totalSelectedDocs})`}
              </>
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};