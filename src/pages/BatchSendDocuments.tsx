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
  Users,
  Star,
  Plus,
  Trash2,
  BookUser
} from 'lucide-react';
import { toast } from 'sonner';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

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

interface SavedRecipient {
  id: string;
  name: string;
  email: string;
  organization_type?: string;
  notes?: string;
  is_favorite: boolean;
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
  
  // Saved recipients state
  const [savedRecipients, setSavedRecipients] = useState<SavedRecipient[]>([]);
  const [showSaveRecipientDialog, setShowSaveRecipientDialog] = useState(false);
  const [newRecipientOrg, setNewRecipientOrg] = useState('');

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

      // Load saved recipients
      const { data: recipientsData } = await supabase
        .from('saved_recipients')
        .select('*')
        .eq('user_id', user?.id)
        .order('is_favorite', { ascending: false })
        .order('name');
      setSavedRecipients(recipientsData || []);

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

  const handleSelectRecipient = (recipientId: string) => {
    const recipient = savedRecipients.find(r => r.id === recipientId);
    if (recipient) {
      setRecipientEmail(recipient.email);
      setRecipientName(recipient.name);
    }
  };

  const handleSaveRecipient = async () => {
    if (!recipientEmail || !recipientName) {
      toast.error('Please enter both name and email to save');
      return;
    }

    try {
      const { error } = await supabase
        .from('saved_recipients')
        .insert({
          user_id: user?.id,
          name: recipientName,
          email: recipientEmail,
          organization_type: newRecipientOrg || null
        });

      if (error) throw error;

      toast.success('Recipient saved');
      setShowSaveRecipientDialog(false);
      setNewRecipientOrg('');
      
      // Reload saved recipients
      const { data: recipientsData } = await supabase
        .from('saved_recipients')
        .select('*')
        .eq('user_id', user?.id)
        .order('is_favorite', { ascending: false })
        .order('name');
      setSavedRecipients(recipientsData || []);
    } catch (error: any) {
      console.error('Error saving recipient:', error);
      toast.error('Failed to save recipient');
    }
  };

  const handleDeleteRecipient = async (recipientId: string) => {
    try {
      const { error } = await supabase
        .from('saved_recipients')
        .delete()
        .eq('id', recipientId);

      if (error) throw error;

      setSavedRecipients(prev => prev.filter(r => r.id !== recipientId));
      toast.success('Recipient removed');
    } catch (error) {
      console.error('Error deleting recipient:', error);
      toast.error('Failed to remove recipient');
    }
  };

  const handleToggleFavorite = async (recipientId: string, currentFavorite: boolean) => {
    try {
      const { error } = await supabase
        .from('saved_recipients')
        .update({ is_favorite: !currentFavorite })
        .eq('id', recipientId);

      if (error) throw error;

      setSavedRecipients(prev => 
        prev.map(r => r.id === recipientId ? { ...r, is_favorite: !currentFavorite } : r)
          .sort((a, b) => {
            if (a.is_favorite !== b.is_favorite) return b.is_favorite ? 1 : -1;
            return a.name.localeCompare(b.name);
          })
      );
    } catch (error) {
      console.error('Error updating favorite:', error);
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

      <div className="grid lg:grid-cols-2 gap-4 md:gap-6">
        {/* Left Column - Document Selection */}
        <div className="space-y-4">
          <Card>
            <CardHeader className="pb-3 px-3 sm:px-6">
              <div className="flex items-center justify-between gap-2">
                <CardTitle className="text-sm sm:text-base">Select Documents</CardTitle>
                <Badge variant="secondary" className="text-xs shrink-0">{selectedDocuments.length} selected</Badge>
              </div>
            </CardHeader>
            <CardContent className="space-y-3 px-3 sm:px-6">
              {/* File size indicator */}
              {selectedDocuments.length > 0 && (
                <div className="flex items-center justify-between text-xs bg-muted/50 rounded-lg px-2 sm:px-3 py-2">
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
                    <CollapsibleTrigger className="w-full px-2 sm:px-4 py-2 sm:py-3 flex items-center justify-between hover:bg-muted/50 transition-colors gap-2">
                      <div className="flex items-center gap-1.5 sm:gap-2 min-w-0">
                        <Building2 className="h-4 w-4 text-primary shrink-0" />
                        <span className="font-medium text-xs sm:text-sm truncate">Global Docs</span>
                        <Badge variant="outline" className="text-xs shrink-0">{globalDocuments.length}</Badge>
                      </div>
                      <div className="flex items-center gap-1 sm:gap-2 shrink-0">
                        <Button 
                          variant="ghost" 
                          size="sm" 
                          className="h-6 sm:h-7 text-xs px-2"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleSelectAllGlobal();
                          }}
                        >
                          <span className="hidden sm:inline">{globalDocuments.every(d => selectedDocuments.includes(d.id)) ? 'Deselect All' : 'Select All'}</span>
                          <span className="sm:hidden">{globalDocuments.every(d => selectedDocuments.includes(d.id)) ? 'None' : 'All'}</span>
                        </Button>
                        <ChevronDown className="h-4 w-4" />
                      </div>
                    </CollapsibleTrigger>
                    <CollapsibleContent>
                      <div className="px-2 sm:px-4 pb-3 space-y-2">
                        {globalDocuments.map(doc => (
                          <label 
                            key={doc.id} 
                            className="flex items-start gap-2 sm:gap-3 p-2 border rounded cursor-pointer hover:bg-accent/50 transition-colors"
                          >
                            <Checkbox
                              checked={selectedDocuments.includes(doc.id)}
                              onCheckedChange={() => handleDocumentToggle(doc.id)}
                              className="mt-0.5 shrink-0"
                            />
                            <div className="flex-1 min-w-0">
                              <p className="text-xs sm:text-sm font-medium break-words leading-tight">{doc.document_name}</p>
                              <div className="flex items-center gap-1.5 flex-wrap mt-1">
                                <Badge variant="outline" className="text-xs">{doc.document_type}</Badge>
                                {doc.expires_at && isExpiringSoon(doc.expires_at) && (
                                  <Badge variant="destructive" className="text-xs">Expiring</Badge>
                                )}
                                {doc.file_size && (
                                  <span className="text-xs text-muted-foreground">{formatFileSize(doc.file_size)}</span>
                                )}
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
                    <CollapsibleTrigger className="w-full px-2 sm:px-4 py-2 sm:py-3 flex items-center justify-between hover:bg-muted/50 transition-colors gap-2">
                      <div className="flex items-center gap-1.5 sm:gap-2 min-w-0">
                        {ride.expanded ? <ChevronDown className="h-4 w-4 shrink-0" /> : <ChevronRight className="h-4 w-4 shrink-0" />}
                        <span className="font-medium text-xs sm:text-sm truncate">{ride.ride_name}</span>
                        <Badge variant="outline" className="text-xs shrink-0">{ride.documents.length}</Badge>
                      </div>
                      <Button 
                        variant="ghost" 
                        size="sm" 
                        className="h-6 sm:h-7 text-xs px-2 shrink-0"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleSelectAllRide(ride.id, ride.documents);
                        }}
                      >
                        <span className="hidden sm:inline">{ride.documents.every(d => selectedDocuments.includes(d.id)) ? 'Deselect All' : 'Select All'}</span>
                        <span className="sm:hidden">{ride.documents.every(d => selectedDocuments.includes(d.id)) ? 'None' : 'All'}</span>
                      </Button>
                    </CollapsibleTrigger>
                    <CollapsibleContent>
                      <div className="px-2 sm:px-4 pb-3 space-y-2">
                        {ride.documents.map(doc => (
                          <label 
                            key={doc.id} 
                            className="flex items-start gap-2 sm:gap-3 p-2 border rounded cursor-pointer hover:bg-accent/50 transition-colors"
                          >
                            <Checkbox
                              checked={selectedDocuments.includes(doc.id)}
                              onCheckedChange={() => handleDocumentToggle(doc.id)}
                              className="mt-0.5 shrink-0"
                            />
                            <div className="flex-1 min-w-0">
                              <p className="text-xs sm:text-sm font-medium break-words leading-tight">{doc.document_name}</p>
                              <div className="flex items-center gap-1.5 flex-wrap mt-1">
                                <Badge variant="outline" className="text-xs">{doc.document_type}</Badge>
                                {doc.expires_at && isExpiringSoon(doc.expires_at) && (
                                  <Badge variant="destructive" className="text-xs">Expiring</Badge>
                                )}
                                {doc.file_size && (
                                  <span className="text-xs text-muted-foreground">{formatFileSize(doc.file_size)}</span>
                                )}
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
            <CardHeader className="pb-3 px-3 sm:px-6">
              <CardTitle className="text-sm sm:text-base flex items-center gap-2">
                <Users className="h-4 w-4 text-primary" />
                Your Information
              </CardTitle>
            </CardHeader>
            <CardContent className="px-3 sm:px-6">
              <div className="text-xs sm:text-sm space-y-1 text-muted-foreground">
                {profile?.company_name && (
                  <p className="break-words"><span className="font-medium text-foreground">Company:</span> {profile.company_name}</p>
                )}
                {profile?.controller_name && (
                  <p className="break-words"><span className="font-medium text-foreground">Controller:</span> {profile.controller_name}</p>
                )}
                {user?.email && (
                  <p className="break-words"><span className="font-medium text-foreground">Email:</span> {user.email}</p>
                )}
                {!profile?.company_name && !profile?.controller_name && (
                  <p className="text-destructive italic text-xs">Please complete your profile in Settings</p>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Saved Recipients */}
          {savedRecipients.length > 0 && (
            <Card>
              <CardHeader className="pb-3 px-3 sm:px-6">
                <CardTitle className="text-sm sm:text-base flex items-center gap-2">
                  <BookUser className="h-4 w-4 text-primary" />
                  Saved Recipients
                </CardTitle>
              </CardHeader>
              <CardContent className="px-3 sm:px-6">
                <div className="space-y-2 max-h-48 overflow-y-auto">
                  {savedRecipients.map(recipient => (
                    <div 
                      key={recipient.id}
                      className="flex items-center gap-2 p-2 border rounded-lg hover:bg-accent/50 cursor-pointer group"
                      onClick={() => handleSelectRecipient(recipient.id)}
                    >
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleToggleFavorite(recipient.id, recipient.is_favorite);
                        }}
                        className="shrink-0"
                      >
                        <Star className={`h-4 w-4 ${recipient.is_favorite ? 'fill-yellow-400 text-yellow-400' : 'text-muted-foreground'}`} />
                      </button>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs sm:text-sm font-medium truncate">{recipient.name}</p>
                        <p className="text-xs text-muted-foreground truncate">{recipient.email}</p>
                      </div>
                      {recipient.organization_type && (
                        <Badge variant="outline" className="text-xs hidden sm:inline-flex">{recipient.organization_type}</Badge>
                      )}
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDeleteRecipient(recipient.id);
                        }}
                        className="opacity-0 group-hover:opacity-100 transition-opacity shrink-0"
                      >
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </button>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Recipient Form */}
          <Card>
            <CardHeader className="pb-3 px-3 sm:px-6">
              <div className="flex items-center justify-between gap-2">
                <CardTitle className="text-sm sm:text-base flex items-center gap-2">
                  <Mail className="h-4 w-4 text-primary" />
                  Recipient Details
                </CardTitle>
                <Dialog open={showSaveRecipientDialog} onOpenChange={setShowSaveRecipientDialog}>
                  <DialogTrigger asChild>
                    <Button 
                      variant="ghost" 
                      size="sm" 
                      className="h-7 text-xs"
                      disabled={!recipientEmail || !recipientName}
                    >
                      <Plus className="h-3 w-3 mr-1" />
                      <span className="hidden sm:inline">Save Recipient</span>
                      <span className="sm:hidden">Save</span>
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="max-w-sm">
                    <DialogHeader>
                      <DialogTitle>Save Recipient</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4 pt-2">
                      <div>
                        <Label className="text-sm">Name</Label>
                        <Input value={recipientName} disabled className="mt-1.5 bg-muted" />
                      </div>
                      <div>
                        <Label className="text-sm">Email</Label>
                        <Input value={recipientEmail} disabled className="mt-1.5 bg-muted" />
                      </div>
                      <div>
                        <Label className="text-sm">Organization Type (Optional)</Label>
                        <Select value={newRecipientOrg} onValueChange={setNewRecipientOrg}>
                          <SelectTrigger className="mt-1.5">
                            <SelectValue placeholder="Select type..." />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="council">Local Council</SelectItem>
                            <SelectItem value="guild">Showmen's Guild</SelectItem>
                            <SelectItem value="insurer">Insurance Company</SelectItem>
                            <SelectItem value="inspector">Inspection Body</SelectItem>
                            <SelectItem value="hse">HSE</SelectItem>
                            <SelectItem value="other">Other</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <Button onClick={handleSaveRecipient} className="w-full">
                        Save Recipient
                      </Button>
                    </div>
                  </DialogContent>
                </Dialog>
              </div>
            </CardHeader>
            <CardContent className="space-y-4 px-3 sm:px-6">
              <div>
                <Label htmlFor="recipientEmail" className="text-xs sm:text-sm">Email Address *</Label>
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
                <Label htmlFor="recipientName" className="text-xs sm:text-sm">Name / Organization</Label>
                <Input
                  id="recipientName"
                  value={recipientName}
                  onChange={(e) => setRecipientName(e.target.value)}
                  placeholder="Local Council, Showmen's Guild, etc."
                  className="mt-1.5"
                />
              </div>
              <div>
                <Label htmlFor="message" className="text-xs sm:text-sm">Message (Optional)</Label>
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
