import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { 
  Mail, 
  FileText, 
  AlertCircle, 
  Loader2, 
  ChevronDown, 
  ChevronRight,
  Send,
  Building2,
  Users
} from 'lucide-react';
import { toast } from 'sonner';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';

interface Document {
  id: string;
  document_name: string;
  document_type: string;
  expires_at?: string;
  file_size?: number;
  is_global: boolean;
  ride_id: string | null;
}

interface Ride {
  id: string;
  ride_name: string;
  manufacturer?: string;
}

interface RideWithDocs extends Ride {
  documents: Document[];
  expanded: boolean;
}

const BatchSendDocuments = () => {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [rides, setRides] = useState<RideWithDocs[]>([]);
  const [globalDocuments, setGlobalDocuments] = useState<Document[]>([]);
  const [selectedDocuments, setSelectedDocuments] = useState<string[]>([]);
  const [recipientEmail, setRecipientEmail] = useState('');
  const [recipientName, setRecipientName] = useState('');
  const [message, setMessage] = useState('');
  const [profile, setProfile] = useState<any>(null);

  useEffect(() => {
    if (user) {
      loadData();
    }
  }, [user]);

  const loadData = async () => {
    setLoading(true);
    try {
      // Load user profile
      const { data: profileData } = await supabase
        .from('profiles')
        .select('company_name, controller_name, showmen_name, address')
        .eq('user_id', user?.id)
        .single();
      setProfile(profileData);

      // Load all rides
      const { data: ridesData, error: ridesError } = await supabase
        .from('rides')
        .select('id, ride_name, manufacturer')
        .eq('user_id', user?.id)
        .order('ride_name');

      if (ridesError) throw ridesError;

      // Load all documents
      const { data: allDocuments, error: docsError } = await supabase
        .from('documents')
        .select('id, document_name, document_type, expires_at, file_size, is_global, ride_id')
        .eq('user_id', user?.id)
        .order('document_name');

      if (docsError) throw docsError;

      // Separate global and ride-specific documents
      const global = allDocuments?.filter(doc => doc.is_global) || [];
      const rideSpecific = allDocuments?.filter(doc => !doc.is_global && doc.ride_id) || [];

      setGlobalDocuments(global);

      // Map rides with their documents
      const ridesWithDocs: RideWithDocs[] = (ridesData || []).map(ride => ({
        ...ride,
        documents: rideSpecific.filter(doc => doc.ride_id === ride.id),
        expanded: false
      }));

      setRides(ridesWithDocs);
    } catch (error) {
      console.error('Error loading data:', error);
      toast.error('Failed to load documents');
    } finally {
      setLoading(false);
    }
  };

  const handleDocumentToggle = (documentId: string) => {
    setSelectedDocuments(prev => 
      prev.includes(documentId)
        ? prev.filter(id => id !== documentId)
        : [...prev, documentId]
    );
  };

  const handleSelectAllRide = (rideId: string, documents: Document[]) => {
    const docIds = documents.map(d => d.id);
    const allSelected = docIds.every(id => selectedDocuments.includes(id));
    
    if (allSelected) {
      setSelectedDocuments(prev => prev.filter(id => !docIds.includes(id)));
    } else {
      setSelectedDocuments(prev => [...prev, ...docIds.filter(id => !prev.includes(id))]);
    }
  };

  const handleSelectAllGlobal = () => {
    const docIds = globalDocuments.map(d => d.id);
    const allSelected = docIds.every(id => selectedDocuments.includes(id));
    
    if (allSelected) {
      setSelectedDocuments(prev => prev.filter(id => !docIds.includes(id)));
    } else {
      setSelectedDocuments(prev => [...prev, ...docIds.filter(id => !prev.includes(id))]);
    }
  };

  const toggleRideExpanded = (rideId: string) => {
    setRides(prev => prev.map(ride => 
      ride.id === rideId ? { ...ride, expanded: !ride.expanded } : ride
    ));
  };

  const handleSend = async () => {
    if (!recipientEmail || selectedDocuments.length === 0) {
      toast.error('Please enter recipient email and select at least one document');
      return;
    }

    setSending(true);
    try {
      const { data, error } = await supabase.functions.invoke('send-batch-documents', {
        body: {
          recipientEmail,
          recipientName,
          message,
          documentIds: selectedDocuments
        }
      });

      if (error) throw error;

      const successMessage = data.wasSplit 
        ? `Successfully sent ${data.documentsCount} documents to ${recipientEmail} across ${data.emailsSent} separate emails`
        : `Successfully sent ${data.documentsCount} documents to ${recipientEmail}`;
        
      toast.success(successMessage);
      
      // Reset form
      setRecipientEmail('');
      setRecipientName('');
      setMessage('');
      setSelectedDocuments([]);
      
    } catch (error: any) {
      console.error('Error sending documents:', error);
      toast.error(error.message || 'Failed to send documents');
    } finally {
      setSending(false);
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

  // Calculate totals
  const allDocs = [...globalDocuments, ...rides.flatMap(r => r.documents)];
  const totalFileSize = allDocs
    .filter(doc => selectedDocuments.includes(doc.id))
    .reduce((sum, doc) => sum + (doc.file_size || 0), 0);
  const totalSizeMB = totalFileSize / (1024 * 1024);
  const exceedsEmailLimit = totalSizeMB > 10;

  if (loading) {
    return (
      <div className="container mx-auto py-8 px-4 pb-24 md:pb-8">
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-8 px-4 pb-24 md:pb-8">
      <div className="mb-6">
        <h1 className="text-2xl font-bold mb-1 flex items-center gap-2">
          <Send className="h-6 w-6 text-primary" />
          Send Documents
        </h1>
        <p className="text-sm text-muted-foreground">
          Select documents from multiple rides and send them to councils, guilds, or other recipients
        </p>
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        {/* Left Column - Document Selection */}
        <div className="space-y-4">
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base">Select Documents</CardTitle>
                <Badge variant="secondary">{selectedDocuments.length} selected</Badge>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* File size indicator */}
              {selectedDocuments.length > 0 && (
                <div className="flex items-center justify-between text-xs bg-muted/50 rounded-lg px-3 py-2">
                  <span className="text-muted-foreground">Total size:</span>
                  <Badge variant={exceedsEmailLimit ? "destructive" : "outline"} className="text-xs">
                    {formatFileSize(totalFileSize)}
                  </Badge>
                </div>
              )}

              {exceedsEmailLimit && (
                <div className="bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-lg p-3">
                  <div className="flex gap-2 text-amber-700 dark:text-amber-400">
                    <AlertCircle className="h-4 w-4 mt-0.5 flex-shrink-0" />
                    <div className="text-xs">
                      <p className="font-medium">Large file size ({totalSizeMB.toFixed(1)}MB)</p>
                      <p className="text-muted-foreground mt-0.5">Will be split into multiple emails automatically</p>
                    </div>
                  </div>
                </div>
              )}

              {/* Global Documents */}
              {globalDocuments.length > 0 && (
                <Collapsible defaultOpen>
                  <div className="border rounded-lg">
                    <CollapsibleTrigger className="w-full px-4 py-3 flex items-center justify-between hover:bg-muted/50 transition-colors">
                      <div className="flex items-center gap-2">
                        <Building2 className="h-4 w-4 text-primary" />
                        <span className="font-medium text-sm">Global Documents</span>
                        <Badge variant="outline" className="text-xs">{globalDocuments.length}</Badge>
                      </div>
                      <div className="flex items-center gap-2">
                        <Button 
                          variant="ghost" 
                          size="sm" 
                          className="h-7 text-xs"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleSelectAllGlobal();
                          }}
                        >
                          {globalDocuments.every(d => selectedDocuments.includes(d.id)) ? 'Deselect All' : 'Select All'}
                        </Button>
                        <ChevronDown className="h-4 w-4" />
                      </div>
                    </CollapsibleTrigger>
                    <CollapsibleContent>
                      <div className="px-4 pb-3 space-y-2">
                        {globalDocuments.map(doc => (
                          <label 
                            key={doc.id} 
                            className="flex items-start gap-3 p-2 border rounded cursor-pointer hover:bg-accent/50 transition-colors"
                          >
                            <Checkbox
                              checked={selectedDocuments.includes(doc.id)}
                              onCheckedChange={() => handleDocumentToggle(doc.id)}
                              className="mt-0.5"
                            />
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="text-sm font-medium truncate">{doc.document_name}</span>
                                <Badge variant="outline" className="text-xs">{doc.document_type}</Badge>
                                {doc.expires_at && isExpiringSoon(doc.expires_at) && (
                                  <Badge variant="destructive" className="text-xs">Expiring</Badge>
                                )}
                              </div>
                              <div className="text-xs text-muted-foreground mt-0.5">
                                {formatFileSize(doc.file_size)}
                              </div>
                            </div>
                          </label>
                        ))}
                      </div>
                    </CollapsibleContent>
                  </div>
                </Collapsible>
              )}

              {/* Ride-specific Documents */}
              {rides.filter(r => r.documents.length > 0).map(ride => (
                <Collapsible 
                  key={ride.id} 
                  open={ride.expanded}
                  onOpenChange={() => toggleRideExpanded(ride.id)}
                >
                  <div className="border rounded-lg">
                    <CollapsibleTrigger className="w-full px-4 py-3 flex items-center justify-between hover:bg-muted/50 transition-colors">
                      <div className="flex items-center gap-2">
                        {ride.expanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                        <span className="font-medium text-sm">{ride.ride_name}</span>
                        {ride.manufacturer && (
                          <span className="text-xs text-muted-foreground">({ride.manufacturer})</span>
                        )}
                        <Badge variant="outline" className="text-xs">{ride.documents.length}</Badge>
                      </div>
                      <Button 
                        variant="ghost" 
                        size="sm" 
                        className="h-7 text-xs"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleSelectAllRide(ride.id, ride.documents);
                        }}
                      >
                        {ride.documents.every(d => selectedDocuments.includes(d.id)) ? 'Deselect All' : 'Select All'}
                      </Button>
                    </CollapsibleTrigger>
                    <CollapsibleContent>
                      <div className="px-4 pb-3 space-y-2">
                        {ride.documents.map(doc => (
                          <label 
                            key={doc.id} 
                            className="flex items-start gap-3 p-2 border rounded cursor-pointer hover:bg-accent/50 transition-colors"
                          >
                            <Checkbox
                              checked={selectedDocuments.includes(doc.id)}
                              onCheckedChange={() => handleDocumentToggle(doc.id)}
                              className="mt-0.5"
                            />
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="text-sm font-medium truncate">{doc.document_name}</span>
                                <Badge variant="outline" className="text-xs">{doc.document_type}</Badge>
                                {doc.expires_at && isExpiringSoon(doc.expires_at) && (
                                  <Badge variant="destructive" className="text-xs">Expiring</Badge>
                                )}
                              </div>
                              <div className="text-xs text-muted-foreground mt-0.5">
                                {formatFileSize(doc.file_size)}
                              </div>
                            </div>
                          </label>
                        ))}
                      </div>
                    </CollapsibleContent>
                  </div>
                </Collapsible>
              ))}

              {globalDocuments.length === 0 && rides.every(r => r.documents.length === 0) && (
                <div className="text-center py-8 text-muted-foreground">
                  <FileText className="mx-auto h-12 w-12 mb-3 opacity-30" />
                  <p className="text-sm font-medium">No documents available</p>
                  <p className="text-xs mt-1">Upload documents to your rides first</p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Right Column - Recipient & Send */}
        <div className="space-y-4">
          {/* Sender Info */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Users className="h-4 w-4 text-primary" />
                Your Information
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-sm space-y-1 text-muted-foreground">
                {profile?.company_name && (
                  <p><span className="font-medium text-foreground">Company:</span> {profile.company_name}</p>
                )}
                {profile?.controller_name && (
                  <p><span className="font-medium text-foreground">Controller:</span> {profile.controller_name}</p>
                )}
                {user?.email && (
                  <p><span className="font-medium text-foreground">Email:</span> {user.email}</p>
                )}
                {!profile?.company_name && !profile?.controller_name && (
                  <p className="text-destructive italic text-xs">Please complete your profile in Settings</p>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Recipient Form */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Mail className="h-4 w-4 text-primary" />
                Recipient Details
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label htmlFor="recipientEmail" className="text-sm">Email Address *</Label>
                <Input
                  id="recipientEmail"
                  type="email"
                  value={recipientEmail}
                  onChange={(e) => setRecipientEmail(e.target.value)}
                  placeholder="council@example.gov.uk"
                  className="mt-1.5"
                  required
                />
              </div>
              <div>
                <Label htmlFor="recipientName" className="text-sm">Name / Organization</Label>
                <Input
                  id="recipientName"
                  value={recipientName}
                  onChange={(e) => setRecipientName(e.target.value)}
                  placeholder="Local Council, Showmen's Guild, etc."
                  className="mt-1.5"
                />
              </div>
              <div>
                <Label htmlFor="message" className="text-sm">Message (Optional)</Label>
                <Textarea
                  id="message"
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  placeholder="Please find attached the requested documentation for our equipment..."
                  className="mt-1.5 resize-none"
                  rows={3}
                />
              </div>

              <Separator />

              <Button 
                onClick={handleSend} 
                disabled={sending || !recipientEmail || selectedDocuments.length === 0}
                className="w-full"
                size="lg"
              >
                {sending ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Sending...
                  </>
                ) : (
                  <>
                    <Send className="h-4 w-4 mr-2" />
                    Send {selectedDocuments.length} Document{selectedDocuments.length !== 1 ? 's' : ''}
                  </>
                )}
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default BatchSendDocuments;
