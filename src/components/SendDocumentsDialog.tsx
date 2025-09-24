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

  useEffect(() => {
    if (open && user) {
      loadDocuments();
    }
  }, [open, user, ride.id]);

  const loadDocuments = async () => {
    try {
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

      toast.success(`Successfully sent ${data.documentsCount} documents to ${recipientEmail}`);
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
      
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Mail className="h-5 w-5" />
            Send Documents: {rideInfo}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {/* Recipient Information */}
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Recipient Information</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="recipientEmail">Email Address *</Label>
                  <Input
                    id="recipientEmail"
                    type="email"
                    value={recipientEmail}
                    onChange={(e) => setRecipientEmail(e.target.value)}
                    placeholder="council@example.com"
                    required
                  />
                </div>
                <div>
                  <Label htmlFor="recipientName">Name/Organization</Label>
                  <Input
                    id="recipientName"
                    value={recipientName}
                    onChange={(e) => setRecipientName(e.target.value)}
                    placeholder="Local Council / Authority"
                  />
                </div>
              </div>
              
              <div>
                <Label htmlFor="message">Message (Optional)</Label>
                <Textarea
                  id="message"
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  placeholder="Please find attached the documentation for our ride..."
                  rows={3}
                />
              </div>
            </CardContent>
          </Card>

          {/* Document Selection */}
          <Card>
            <CardHeader>
              <CardTitle className="text-sm flex items-center justify-between">
                Select Documents to Send
                <Badge variant="secondary">{totalSelectedDocs} selected</Badge>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Ride-specific documents */}
              {documents.length > 0 && (
                <div>
                  <h4 className="font-medium text-sm mb-3 flex items-center gap-2">
                    <FileText className="h-4 w-4" />
                    Ride Documents ({documents.length})
                  </h4>
                  <div className="space-y-2 max-h-40 overflow-y-auto">
                    {documents.map((doc) => (
                      <div key={doc.id} className="flex items-center space-x-3 p-2 border rounded-lg">
                        <Checkbox
                          checked={selectedDocuments.includes(doc.id)}
                          onCheckedChange={() => handleDocumentToggle(doc.id)}
                        />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="font-medium text-sm truncate">{doc.document_name}</span>
                            <Badge variant="outline" className="text-xs">{doc.document_type}</Badge>
                            {doc.expires_at && isExpiringSoon(doc.expires_at) && (
                              <AlertCircle className="h-4 w-4 text-amber-500" />
                            )}
                          </div>
                          <div className="text-xs text-muted-foreground">
                            {formatFileSize(doc.file_size)}
                            {doc.expires_at && ` • Expires: ${doc.expires_at}`}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Insurance documents */}
              {insuranceDocuments.length > 0 && (
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <h4 className="font-medium text-sm flex items-center gap-2">
                      <CheckCircle className="h-4 w-4" />
                      Insurance Documents ({insuranceDocuments.length})
                    </h4>
                    <div className="flex items-center space-x-2">
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
                      <Label className="text-xs">Include all insurance docs</Label>
                    </div>
                  </div>
                  <div className="space-y-2 max-h-32 overflow-y-auto">
                    {insuranceDocuments.map((doc) => (
                      <div key={doc.id} className="flex items-center space-x-3 p-2 border rounded-lg bg-green-50">
                        <Checkbox
                          checked={selectedDocuments.includes(doc.id)}
                          onCheckedChange={() => handleDocumentToggle(doc.id)}
                        />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="font-medium text-sm truncate">{doc.document_name}</span>
                            <Badge variant="outline" className="text-xs">{doc.document_type}</Badge>
                            {doc.expires_at && isExpiringSoon(doc.expires_at) && (
                              <AlertCircle className="h-4 w-4 text-amber-500" />
                            )}
                          </div>
                          <div className="text-xs text-muted-foreground">
                            {formatFileSize(doc.file_size)}
                            {doc.expires_at && ` • Expires: ${doc.expires_at}`}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {documents.length === 0 && insuranceDocuments.length === 0 && (
                <div className="text-center py-8 text-muted-foreground">
                  <FileText className="mx-auto h-12 w-12 mb-4 opacity-50" />
                  <p>No documents found for this ride</p>
                  <p className="text-sm">Upload some documents first</p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Actions */}
          <div className="flex justify-between">
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
                  Send {totalSelectedDocs} Document{totalSelectedDocs !== 1 ? 's' : ''}
                </>
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};