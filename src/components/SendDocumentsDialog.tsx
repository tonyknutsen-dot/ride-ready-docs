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
import { useEffectiveUserId } from '@/hooks/useEffectiveUserId';
import { toast } from 'sonner';
import { useTerminology } from '@/hooks/useTerminology';
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
  const { effectiveUserId, isStaff } = useEffectiveUserId();
  const { terminology } = useTerminology();
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
      // Load operator's profile (uses effectiveUserId for staff)
      const { data: profileData } = await supabase
        .from('profiles')
        .select('company_name, controller_name, showmen_name, address')
        .eq('user_id', effectiveUserId)
        .single();

      setProfile(profileData);

      // Load ride-specific documents
      const { data: rideDocuments, error: rideError } = await supabase
        .from('documents')
        .select('id, document_name, document_type, expires_at, file_size, is_global')
        .eq('user_id', effectiveUserId)
        .eq('ride_id', ride.id)
        .order('document_name');

      if (rideError) throw rideError;

      // Load insurance documents
      const { data: insuranceDocs, error: insuranceError } = await supabase
        .from('documents')
        .select('id, document_name, document_type, expires_at, file_size, is_global')
        .eq('user_id', effectiveUserId)
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

      const methodLabel = data.sendMethod === 'share-link' ? ' via secure download link' : data.sendMethod === 'zip' ? ' as ZIP' : '';
      const successMessage = `Successfully sent ${data.documentsCount} documents to ${recipientEmail}${methodLabel}`;
        
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
      
      <DialogContent className="max-w-xl max-h-[90vh] overflow-hidden flex flex-col p-0 gap-0 bg-muted/60">
        {/* Header */}
        <div className="flex items-start justify-between px-5 pt-5 pb-4 border-b-2 border-border bg-card flex-shrink-0">
          <div>
            <DialogTitle className="text-base font-bold text-foreground">
              Send Documents
            </DialogTitle>
            <p className="text-xs text-muted-foreground mt-0.5">{rideInfo}</p>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto space-y-4 px-5 py-4">
          {/* Sender Information — stronger card */}
          <div className="bg-card border-2 border-border rounded-xl p-4 space-y-1.5 shadow-sm">
            <p className="text-[13px] font-bold text-foreground">Sender Information</p>
            <div className="text-xs text-foreground/70 space-y-0.5">
              {profile?.company_name && <p>{profile.company_name}</p>}
              {profile?.controller_name && <p>{profile.controller_name}</p>}
              {user?.email && <p>{user.email}</p>}
            </div>
            {!isStaff && !profile?.company_name && !profile?.controller_name && (
              <p className="text-xs text-warning-foreground mt-1">Complete your profile details in Settings</p>
            )}
          </div>

          {/* Recipient */}
          <div className="bg-card border-2 border-border rounded-xl p-4 space-y-3 shadow-sm">
            <h3 className="text-[13px] font-bold text-foreground">Recipient</h3>
            <div className="space-y-2">
              <div>
                <Label htmlFor="recipientEmail" className="text-[13px] font-semibold text-foreground mb-1.5 block">
                  Email Address *
                </Label>
                <Input
                  id="recipientEmail"
                  type="email"
                  value={recipientEmail}
                  onChange={(e) => setRecipientEmail(e.target.value)}
                  placeholder={`${terminology.localAuthority}@example.com`}
                  required
                />
              </div>
              <div>
                <Label htmlFor="recipientName" className="text-[13px] font-semibold text-foreground mb-1.5 block">
                  Name / Organisation
                </Label>
                <Input
                  id="recipientName"
                  value={recipientName}
                  onChange={(e) => setRecipientName(e.target.value)}
                  placeholder={terminology.isUK ? "Local Council / Guild" : "Local Authority / Organization"}
                />
              </div>
            </div>
          </div>

          {/* Message — single instance */}
          <div className="bg-card border-2 border-border rounded-xl p-4 space-y-2 shadow-sm">
            <Label htmlFor="message" className="text-[13px] font-bold text-foreground block">
              Message <span className="text-muted-foreground font-normal text-xs">(optional)</span>
            </Label>
            <Textarea
              id="message"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="Add notes for the recipient…"
              className="resize-none"
              rows={3}
            />
          </div>

          {/* Documents section */}
          <div className="bg-card border-2 border-border rounded-xl p-4 space-y-3 shadow-sm">
            <div className="flex items-center justify-between">
              <h3 className="text-[13px] font-bold text-foreground">Documents</h3>
              <span className="text-xs font-semibold text-primary">{totalSelectedDocs} selected</span>
            </div>

            {/* Size bar */}
            {totalFileSize > 0 && (
              <div className="space-y-1.5">
                <div className="flex justify-between text-xs text-muted-foreground">
                  <span>Total size</span>
                  <span className={exceedsEmailLimit ? "text-destructive font-medium" : ""}>
                    {formatFileSize(totalFileSize)}
                  </span>
                </div>
                <div className="w-full h-1.5 bg-muted rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all ${exceedsEmailLimit ? "bg-destructive" : "bg-primary"}`}
                    style={{ width: `${Math.min((totalSizeMB / 25) * 100, 100)}%` }}
                  />
                </div>
              </div>
            )}

            {exceedsEmailLimit && (
              <div className="bg-warning/10 border border-warning/30 rounded-xl p-3">
                <div className="flex gap-2">
                  <AlertCircle className="h-4 w-4 text-warning mt-0.5 flex-shrink-0" />
                  <div className="text-xs text-warning-foreground">
                    <p className="font-medium">Large file size ({totalSizeMB.toFixed(1)}MB)</p>
                    <p className="mt-0.5">
                      {totalSizeMB > 25
                        ? "Documents will be sent via a secure 7-day download link"
                        : "Documents will be compressed into a ZIP attachment"}
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* Ride documents */}
            {documents.length > 0 && (
              <div className="space-y-1.5">
                <p className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
                  <FileText className="h-3.5 w-3.5" />
                  Ride Documents ({documents.length})
                </p>
                <div className="border border-border rounded-xl overflow-hidden divide-y divide-border">
                  {documents.map((doc) => (
                    <label
                      key={doc.id}
                      className="flex items-center gap-3 px-3 py-2.5 cursor-pointer hover:bg-muted/40 transition-colors"
                    >
                      <Checkbox
                        checked={selectedDocuments.includes(doc.id)}
                        onCheckedChange={() => handleDocumentToggle(doc.id)}
                      />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-foreground truncate">{doc.document_name}</p>
                        <p className="text-xs text-muted-foreground">
                          {doc.document_type}
                          {doc.file_size ? ` • ${formatFileSize(doc.file_size)}` : ""}
                          {doc.expires_at ? ` • Exp: ${new Date(doc.expires_at).toLocaleDateString()}` : ""}
                        </p>
                      </div>
                      {doc.expires_at && isExpiringSoon(doc.expires_at) && (
                        <Badge variant="destructive" className="text-xs shrink-0">Expiring</Badge>
                      )}
                    </label>
                  ))}
                </div>
              </div>
            )}

            {/* Insurance documents */}
            {insuranceDocuments.length > 0 && (
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <p className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
                    <CheckCircle className="h-3.5 w-3.5" />
                    Insurance Documents ({insuranceDocuments.length})
                  </p>
                  <label className="flex items-center gap-1.5 cursor-pointer">
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
                <div className="border border-border rounded-xl overflow-hidden divide-y divide-border">
                  {insuranceDocuments.map((doc) => (
                    <label
                      key={doc.id}
                      className="flex items-center gap-3 px-3 py-2.5 cursor-pointer hover:bg-muted/40 transition-colors"
                    >
                      <Checkbox
                        checked={selectedDocuments.includes(doc.id)}
                        onCheckedChange={() => handleDocumentToggle(doc.id)}
                      />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-foreground truncate">{doc.document_name}</p>
                        <p className="text-xs text-muted-foreground">
                          {doc.document_type}
                          {doc.file_size ? ` • ${formatFileSize(doc.file_size)}` : ""}
                          {doc.expires_at ? ` • Exp: ${new Date(doc.expires_at).toLocaleDateString()}` : ""}
                        </p>
                      </div>
                      {doc.expires_at && isExpiringSoon(doc.expires_at) && (
                        <Badge variant="destructive" className="text-xs shrink-0">Expiring</Badge>
                      )}
                    </label>
                  ))}
                </div>
              </div>
            )}

            {documents.length === 0 && insuranceDocuments.length === 0 && (
              <div className="text-center py-8 text-muted-foreground border-2 border-dashed border-border rounded-xl">
                <FileText className="mx-auto h-10 w-10 mb-2 opacity-30" />
                <p className="text-sm font-medium">No documents available</p>
                <p className="text-xs mt-1">Upload documents to this ride first</p>
              </div>
            )}
          </div>
        </div>

        {/* Sticky footer */}
        <div className="flex-shrink-0 flex gap-3 px-5 py-4 border-t-2 border-border bg-card shadow-[0_-4px_12px_rgba(0,0,0,0.06)]">
          <Button variant="outline" className="flex-1" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button
            className="flex-1"
            onClick={handleSend}
            disabled={loading || !recipientEmail || selectedDocuments.length === 0}
          >
            {loading ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Sending…
              </>
            ) : (
              <>
                <Mail className="h-4 w-4" />
                Send{totalSelectedDocs > 0 ? ` (${totalSelectedDocs})` : ""}
              </>
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};