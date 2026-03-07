import { useState, useEffect, useMemo } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useEffectiveUserId } from '@/hooks/useEffectiveUserId';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
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
  BookUser,
  CalendarIcon,
  ClipboardCheck,
  Link,
  Paperclip,
  Info,
  Package,
  Shield,
  AlertTriangle,
  CheckCircle2,
  Clock
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
import { useTerminology } from '@/hooks/useTerminology';
import { format, startOfMonth, endOfMonth, subDays, startOfYear, endOfYear } from 'date-fns';
import { cn } from '@/lib/utils';
import { isCheckRecord, filterCheckRecords, CheckRecordFiltersState, defaultCheckRecordFilters } from '@/components/CheckRecordFilters';
import StaffAccountBanner from '@/components/StaffAccountBanner';
import PageHeader from '@/components/PageHeader';

interface Document {
  id: string;
  document_name: string;
  document_type: string;
  expires_at?: string;
  file_size?: number;
  is_global: boolean;
  ride_id: string | null;
  uploaded_at?: string;
  notes?: string | null;
  file_path?: string;
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

interface EmailTemplate {
  id: string;
  name: string;
  subject_line?: string;
  message_body: string;
  recipient_type?: string;
  is_default: boolean;
}

const BatchSendDocuments = () => {
  const { user } = useAuth();
  const { effectiveUserId, actualUserId, isStaff } = useEffectiveUserId();
  const { terminology } = useTerminology();
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [rides, setRides] = useState<RideWithDocs[]>([]);
  const [globalDocuments, setGlobalDocuments] = useState<Document[]>([]);
  const [selectedDocuments, setSelectedDocuments] = useState<string[]>([]);
  const [recipientEmail, setRecipientEmail] = useState('');
  const [recipientName, setRecipientName] = useState('');
  const [message, setMessage] = useState('');
  const [profile, setProfile] = useState<any>(null);
  
  // Send method state - 'auto', 'attachments', or 'links'
  const [sendMethod, setSendMethod] = useState<'auto' | 'attachments' | 'links'>('auto');
  
  // Saved recipients state
  const [savedRecipients, setSavedRecipients] = useState<SavedRecipient[]>([]);
  const [showSaveRecipientDialog, setShowSaveRecipientDialog] = useState(false);
  const [newRecipientOrg, setNewRecipientOrg] = useState('');

  // Email templates state
  const [emailTemplates, setEmailTemplates] = useState<EmailTemplate[]>([]);
  const [showSaveTemplateDialog, setShowSaveTemplateDialog] = useState(false);
  const [newTemplateName, setNewTemplateName] = useState('');
  const [newTemplateType, setNewTemplateType] = useState('');
  
  // Check records state
  const [checkRecords, setCheckRecords] = useState<Document[]>([]);
  const [checkRecordFilters, setCheckRecordFilters] = useState<CheckRecordFiltersState>(defaultCheckRecordFilters);
  const [checkRecordsExpanded, setCheckRecordsExpanded] = useState(false);
  const [fromOpen, setFromOpen] = useState(false);
  const [toOpen, setToOpen] = useState(false);

  // Selected ride for document selection step
  const [selectedRide, setSelectedRide] = useState<Ride | null>(null);

  useEffect(() => {
    if (effectiveUserId) {
      loadData();
    }
  }, [effectiveUserId]);

  const loadData = async () => {
    setLoading(true);
    try {
      // Load user profile (use effectiveUserId to get operator's profile for staff)
      const { data: profileData } = await supabase
        .from('profiles')
        .select('company_name, controller_name, showmen_name, address')
        .eq('user_id', effectiveUserId)
        .single();
      setProfile(profileData);

      // Load saved recipients (use effectiveUserId for operator's recipients)
      const { data: recipientsData } = await supabase
        .from('saved_recipients')
        .select('*')
        .eq('user_id', effectiveUserId)
        .order('is_favorite', { ascending: false })
        .order('name');
      setSavedRecipients(recipientsData || []);

      // Load email templates (use effectiveUserId for operator's templates)
      const { data: templatesData } = await supabase
        .from('email_templates')
        .select('*')
        .eq('user_id', effectiveUserId)
        .order('is_default', { ascending: false })
        .order('name');
      setEmailTemplates(templatesData || []);

      // Load all rides (use effectiveUserId for operator's rides)
      const { data: ridesData, error: ridesError } = await supabase
        .from('rides')
        .select('id, ride_name, manufacturer')
        .eq('user_id', effectiveUserId)
        .order('ride_name');

      if (ridesError) throw ridesError;

      // Load all documents (use effectiveUserId for operator's documents)
      const { data: allDocuments, error: docsError } = await supabase
        .from('documents')
        .select('id, document_name, document_type, expires_at, file_size, is_global, ride_id, uploaded_at, notes, file_path')
        .eq('user_id', effectiveUserId)
        .order('uploaded_at', { ascending: false });

      if (docsError) throw docsError;

      // Separate check records from other documents
      const checkRecordDocs: Document[] = [];
      const otherDocs: Document[] = [];
      
      (allDocuments || []).forEach(doc => {
        if (isCheckRecord(doc.document_type, doc.file_path || undefined)) {
          checkRecordDocs.push(doc);
        } else {
          otherDocs.push(doc);
        }
      });
      
      setCheckRecords(checkRecordDocs);

      // Separate global and ride-specific documents (excluding check records)
      const global = otherDocs.filter(doc => doc.is_global);
      const rideSpecific = otherDocs.filter(doc => !doc.is_global && doc.ride_id);

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
          user_id: effectiveUserId,
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
        .eq('user_id', effectiveUserId)
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

  // Email template functions
  const handleSelectTemplate = (templateId: string) => {
    const template = emailTemplates.find(t => t.id === templateId);
    if (template) {
      setMessage(template.message_body);
    }
  };

  const handleSaveTemplate = async () => {
    if (!message || !newTemplateName) {
      toast.error('Please enter a template name and message');
      return;
    }

    try {
      const { error } = await supabase
        .from('email_templates')
        .insert({
          user_id: effectiveUserId,
          name: newTemplateName,
          message_body: message,
          recipient_type: newTemplateType || null
        });

      if (error) throw error;

      toast.success('Template saved');
      setShowSaveTemplateDialog(false);
      setNewTemplateName('');
      setNewTemplateType('');
      
      // Reload templates
      const { data: templatesData } = await supabase
        .from('email_templates')
        .select('*')
        .eq('user_id', effectiveUserId)
        .order('is_default', { ascending: false })
        .order('name');
      setEmailTemplates(templatesData || []);
    } catch (error: any) {
      console.error('Error saving template:', error);
      toast.error('Failed to save template');
    }
  };

  const handleDeleteTemplate = async (templateId: string) => {
    try {
      const { error } = await supabase
        .from('email_templates')
        .delete()
        .eq('id', templateId);

      if (error) throw error;

      setEmailTemplates(prev => prev.filter(t => t.id !== templateId));
      toast.success('Template removed');
    } catch (error) {
      console.error('Error deleting template:', error);
      toast.error('Failed to remove template');
    }
  };

  const handleToggleDefaultTemplate = async (templateId: string, currentDefault: boolean) => {
    try {
      // If setting as default, first unset all others
      if (!currentDefault) {
        await supabase
          .from('email_templates')
          .update({ is_default: false })
          .eq('user_id', effectiveUserId);
      }

      const { error } = await supabase
        .from('email_templates')
        .update({ is_default: !currentDefault })
        .eq('id', templateId);

      if (error) throw error;

      setEmailTemplates(prev => 
        prev.map(t => ({
          ...t,
          is_default: t.id === templateId ? !currentDefault : false
        })).sort((a, b) => {
          if (a.is_default !== b.is_default) return b.is_default ? 1 : -1;
          return a.name.localeCompare(b.name);
        })
      );
    } catch (error) {
      console.error('Error updating default template:', error);
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
      // Determine which method to use
      const useDownloadLinks = sendMethod === 'links' || (sendMethod === 'auto' && exceedsEmailLimit);
      
      if (useDownloadLinks) {
        // Use secure download links
        const { data, error } = await supabase.functions.invoke('create-document-share', {
          body: {
            recipientEmail,
            recipientName,
            message,
            documentIds: selectedDocuments,
            expiryDays: 7
          }
        });

        if (error) throw error;

        toast.success(`Sent secure download link for ${data.documentsCount} documents to ${recipientEmail}`);
      } else {
        // Use traditional attachments
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
      }
      
      // Reset form
      setRecipientEmail('');
      setRecipientName('');
      setMessage('');
      setSelectedDocuments([]);
      setSendMethod('auto');
      
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

  // Filtered check records
  const filteredCheckRecords = useMemo(() => {
    return filterCheckRecords(checkRecords, checkRecordFilters);
  }, [checkRecords, checkRecordFilters]);

  // Group check records by month
  const checkRecordsByMonth = useMemo(() => {
    const groups: Record<string, Document[]> = {};
    filteredCheckRecords.forEach(doc => {
      const monthKey = doc.uploaded_at ? format(new Date(doc.uploaded_at), 'MMMM yyyy') : 'Unknown';
      if (!groups[monthKey]) groups[monthKey] = [];
      groups[monthKey].push(doc);
    });
    return Object.entries(groups).sort(([a], [b]) => 
      new Date(b).getTime() - new Date(a).getTime()
    );
  }, [filteredCheckRecords]);

  // Select all check records in filtered range
  const handleSelectAllCheckRecords = () => {
    const filteredIds = filteredCheckRecords.map(d => d.id);
    const allSelected = filteredIds.every(id => selectedDocuments.includes(id));
    
    if (allSelected) {
      setSelectedDocuments(prev => prev.filter(id => !filteredIds.includes(id)));
    } else {
      setSelectedDocuments(prev => [...new Set([...prev, ...filteredIds])]);
    }
  };

  // Calculate totals (include check records)
  const allDocs = [...globalDocuments, ...rides.flatMap(r => r.documents), ...checkRecords];
  const totalFileSize = allDocs
    .filter(doc => selectedDocuments.includes(doc.id))
    .reduce((sum, doc) => sum + (doc.file_size || 0), 0);
  const totalSizeMB = totalFileSize / (1024 * 1024);
  const exceedsEmailLimit = totalSizeMB > 10;

  const datePresets = [
    { label: 'This Month', getValue: () => ({ from: startOfMonth(new Date()), to: endOfMonth(new Date()) }) },
    { label: 'Last 30 Days', getValue: () => ({ from: subDays(new Date(), 30), to: new Date() }) },
    { label: 'Last 90 Days', getValue: () => ({ from: subDays(new Date(), 90), to: new Date() }) },
    { label: 'This Year', getValue: () => ({ from: startOfYear(new Date()), to: endOfYear(new Date()) }) },
  ];

  if (loading) {
    return (
      <div className="container mx-auto py-8 px-4 pb-24 md:pb-8">
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </div>
    );
  }

  // Get current ride's documents (when a ride is selected)
  const isGlobalMode = selectedRide?.id === '__global__';
  const currentRideDocuments = selectedRide && !isGlobalMode
    ? rides.find(r => r.id === selectedRide.id)?.documents || []
    : [];

  // Check records for selected ride
  const currentRideCheckRecords = selectedRide && !isGlobalMode
    ? checkRecords.filter(doc => doc.ride_id === selectedRide.id)
    : [];

  return (
    <div className="t-page min-h-screen overflow-x-hidden">
      <div className="container mx-auto py-4 px-4 pb-24 md:pb-8 space-y-3 overflow-x-hidden">
        <PageHeader
          title="Send Compliance Documents"
          subtitle="Submit compliance documents to councils, insurers, and auditors."
          icon={<Send className="h-5 w-5 text-primary" />}
          showBackButton
          backTo="/overview"
        />

        {/* Step 1: Ride Selection */}
        {!selectedRide ? (
          <div className="space-y-3">
            {/* Compact KPI row */}
            <div className="flex gap-2 flex-wrap">
              <button
                onClick={() => document.getElementById('asset-pack-section')?.scrollIntoView({ behavior: 'smooth', block: 'start' })}
                className="t-card inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold cursor-pointer hover:border-primary/40 transition-colors"
              >
                <Package className="h-3.5 w-3.5 text-primary" strokeWidth={2.5} />
                {rides.length} {rides.length === 1 ? 'Asset' : 'Assets'}
                <ChevronRight className="h-3 w-3 text-muted-foreground" />
              </button>
              <button
                onClick={() => document.getElementById('asset-pack-section')?.scrollIntoView({ behavior: 'smooth', block: 'start' })}
                className="t-card inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold cursor-pointer hover:border-primary/40 transition-colors"
              >
                <FileText className="h-3.5 w-3.5 text-primary" strokeWidth={2.5} />
                {rides.reduce((sum, r) => sum + r.documents.length, 0) + checkRecords.length} Docs
                <ChevronRight className="h-3 w-3 text-muted-foreground" />
              </button>
              <button
                onClick={() => document.getElementById('global-docs-section')?.scrollIntoView({ behavior: 'smooth', block: 'start' })}
                className="t-card inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold cursor-pointer hover:border-primary/40 transition-colors"
              >
                <Building2 className="h-3.5 w-3.5 text-primary" strokeWidth={2.5} />
                {globalDocuments.length} Global
                <ChevronRight className="h-3 w-3 text-muted-foreground" />
              </button>
            </div>

            {/* Asset list */}
            <div id="asset-pack-section" className="t-card rounded-xl overflow-hidden">
              <div className="t-card-header px-4 py-2.5 flex items-center gap-2.5">
                <ClipboardCheck className="h-4 w-4 text-primary" strokeWidth={2.5} />
                <div>
                  <p className="text-xs font-bold text-foreground">Select Asset</p>
                  <p className="text-[10px] text-muted-foreground">Choose an asset to build a compliance pack</p>
                </div>
              </div>
              <div className="p-2">
                {rides.length === 0 ? (
                  <div className="text-center py-8">
                    <Package className="h-8 w-8 text-muted-foreground/40 mx-auto mb-2" />
                    <p className="text-xs font-medium text-muted-foreground">No assets found</p>
                  </div>
                ) : (
                  <div className="space-y-1.5">
                    {rides.map(ride => {
                      const rideCheckRecords = checkRecords.filter(doc => doc.ride_id === ride.id);
                      const totalDocs = ride.documents.length + rideCheckRecords.length;
                      const hasExpired = ride.documents.some(d => d.expires_at && new Date(d.expires_at) < new Date());
                      const hasExpiringSoon = ride.documents.some(d => d.expires_at && isExpiringSoon(d.expires_at));
                      const complianceStatus = hasExpired ? 'overdue' : hasExpiringSoon ? 'expiring' : 'compliant';
                      const statusConfig = {
                        overdue: { label: 'Expired', variant: 'destructive' as const, icon: AlertTriangle },
                        expiring: { label: 'Expiring', variant: 'outline' as const, icon: Clock },
                        compliant: { label: 'Current', variant: 'secondary' as const, icon: CheckCircle2 },
                      }[complianceStatus];
                      const StatusIcon = statusConfig.icon;

                      return (
                        <button
                          key={ride.id}
                          onClick={() => setSelectedRide(ride)}
                          className="w-full text-left group active:scale-[0.99] transition-all"
                        >
                          <div className="flex items-center gap-3 px-3 py-2.5 rounded-lg border border-border/80 hover:border-primary/40 hover:bg-accent/30 transition-all">
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2">
                                <p className="text-xs font-bold text-foreground truncate">{ride.ride_name}</p>
                                <Badge
                                  variant={statusConfig.variant}
                                  className={cn(
                                    "text-[9px] h-4 px-1.5 shrink-0 gap-0.5",
                                    complianceStatus === 'compliant' && "bg-success/10 text-success border-success/20",
                                    complianceStatus === 'expiring' && "bg-warning/10 text-warning border-warning/20"
                                  )}
                                  title="Based on expiry dates in the document register"
                                >
                                  <StatusIcon className="h-2.5 w-2.5" strokeWidth={2.5} />
                                  {statusConfig.label}
                                </Badge>
                              </div>
                              <div className="flex items-center gap-1.5 mt-0.5">
                                {ride.manufacturer && (
                                  <span className="text-[10px] text-muted-foreground truncate">{ride.manufacturer}</span>
                                )}
                                {ride.manufacturer && <span className="text-muted-foreground/30 text-[10px]">·</span>}
                                <span className="text-[10px] text-muted-foreground shrink-0">
                                  {totalDocs} {totalDocs === 1 ? 'doc' : 'docs'}
                                </span>
                              </div>
                            </div>
                            <ChevronRight className="h-4 w-4 text-muted-foreground group-hover:text-primary shrink-0" />
                          </div>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>

            {/* Global Documents */}
            <div id="global-docs-section">
              <button
                className="w-full text-left group active:scale-[0.99] transition-all"
                onClick={() => setSelectedRide({ id: '__global__', ride_name: 'Global Documents' })}
              >
                <div className="t-card rounded-xl overflow-hidden">
                  <div className="flex items-center gap-3 px-4 py-3">
                    <span className="flex items-center justify-center w-8 h-8 rounded-lg bg-primary/10 shrink-0">
                      <Building2 className="h-4 w-4 text-primary" strokeWidth={2.5} />
                    </span>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-bold text-foreground group-hover:text-primary transition-colors">Global Compliance Documents</p>
                      <p className="text-[10px] text-muted-foreground mt-0.5">
                        Insurance, policies &amp; company-wide · {globalDocuments.length} {globalDocuments.length === 1 ? 'file' : 'files'}
                      </p>
                    </div>
                    <ChevronRight className="h-4 w-4 text-muted-foreground group-hover:text-primary shrink-0" />
                  </div>
                </div>
              </button>
            </div>
          </div>
        ) : (
          <>
            {/* Step 2: Asset context strip */}
            <div className="t-card rounded-xl px-3 py-2.5">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2.5 min-w-0">
                  <span className="flex items-center justify-center w-7 h-7 rounded-lg bg-primary/10 shrink-0">
                    {isGlobalMode ? <Building2 className="h-3.5 w-3.5 text-primary" strokeWidth={2.5} /> : <ClipboardCheck className="h-3.5 w-3.5 text-primary" strokeWidth={2.5} />}
                  </span>
                  <div className="min-w-0">
                    <p className="text-[10px] text-muted-foreground font-medium">{isGlobalMode ? 'Global' : 'Asset'}</p>
                    <p className="text-xs font-bold text-foreground truncate">{selectedRide.ride_name}</p>
                  </div>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => { setSelectedRide(null); setSelectedDocuments([]); }}
                  className="gap-1 text-muted-foreground hover:text-foreground shrink-0 text-[10px] h-7 px-2"
                >
                  <ChevronRight className="h-3 w-3 rotate-180" />
                  Back
                </Button>
              </div>
              {selectedDocuments.length > 0 && (
                <div className="mt-2 flex items-center gap-2 rounded-lg px-2.5 py-1.5 text-xs font-semibold bg-primary/10 text-primary">
                  <FileText className="h-3.5 w-3.5 shrink-0" strokeWidth={2.5} />
                  {selectedDocuments.length} selected · {formatFileSize(totalFileSize)}
                </div>
              )}
            </div>

            <div className="grid lg:grid-cols-2 gap-3">
              {/* Left: Document Selection */}
              <div className="space-y-2">
                <div className="t-card rounded-xl overflow-hidden">
                  <div className="t-card-header px-3 py-2 flex items-center justify-between">
                    <p className="text-xs font-bold text-foreground">Select Documents</p>
                    {selectedDocuments.length > 0 && (
                      <Badge variant="secondary" className="text-[9px] h-4 font-semibold">{selectedDocuments.length} selected</Badge>
                    )}
                  </div>
                  <div className="p-2 space-y-1.5">
                    {/* Size indicator */}
                    {selectedDocuments.length > 0 && (
                      <div className="flex items-center justify-between text-[10px] bg-secondary/50 border border-border rounded-md px-2 py-1">
                        <span className="text-muted-foreground">Total size:</span>
                        <Badge variant={exceedsEmailLimit ? "destructive" : "outline"} className="text-[9px] h-3.5">
                          {formatFileSize(totalFileSize)}
                        </Badge>
                      </div>
                    )}

                    {/* Send method selector */}
                    {(exceedsEmailLimit || sendMethod !== 'auto') && (
                      <div className="bg-warning/5 border border-warning/20 rounded-lg p-2">
                        <p className="text-[10px] font-semibold text-foreground mb-1.5">Large file ({totalSizeMB.toFixed(1)}MB) — choose send method:</p>
                        <div className="grid grid-cols-2 gap-1">
                          <button
                            type="button"
                            onClick={() => setSendMethod('links')}
                            className={cn(
                              "flex items-center gap-1.5 p-1.5 rounded-md border text-left text-[10px]",
                              (sendMethod === 'links' || (sendMethod === 'auto' && exceedsEmailLimit))
                                ? "border-primary bg-primary/5 font-semibold"
                                : "border-border hover:border-primary/50"
                            )}
                          >
                            <Link className="h-3 w-3 text-primary shrink-0" />
                            <span>Download Link</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => setSendMethod('attachments')}
                            className={cn(
                              "flex items-center gap-1.5 p-1.5 rounded-md border text-left text-[10px]",
                              sendMethod === 'attachments'
                                ? "border-primary bg-primary/5 font-semibold"
                                : "border-border hover:border-primary/50"
                            )}
                          >
                            <Paperclip className="h-3 w-3 text-muted-foreground shrink-0" />
                            <span>Attachments</span>
                          </button>
                        </div>
                      </div>
                    )}

                    {/* Check Records */}
                    {currentRideCheckRecords.length > 0 && (
                      <Collapsible open={checkRecordsExpanded} onOpenChange={setCheckRecordsExpanded}>
                        <div className="border border-success/20 rounded-lg overflow-hidden">
                          <CollapsibleTrigger className="w-full px-2.5 py-1.5 flex items-center justify-between hover:bg-success/5 transition-colors gap-2">
                            <div className="flex items-center gap-1.5 min-w-0">
                              <ClipboardCheck className="h-3 w-3 text-success shrink-0" />
                              <span className="font-semibold text-[11px]">Check Records</span>
                              <Badge variant="outline" className="text-[9px] h-3.5 border-success/30 text-success">{currentRideCheckRecords.length}</Badge>
                            </div>
                            <div className="flex items-center gap-1 shrink-0">
                              <span
                                role="button"
                                tabIndex={0}
                                className="h-5 text-[10px] px-1 inline-flex items-center rounded hover:bg-accent text-muted-foreground cursor-pointer"
                                onClick={(e) => { e.stopPropagation(); const ids = currentRideCheckRecords.map(d => d.id); const allSel = ids.every(id => selectedDocuments.includes(id)); setSelectedDocuments(prev => allSel ? prev.filter(id => !ids.includes(id)) : [...new Set([...prev, ...ids])]); }}
                                onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.stopPropagation(); const ids = currentRideCheckRecords.map(d => d.id); const allSel = ids.every(id => selectedDocuments.includes(id)); setSelectedDocuments(prev => allSel ? prev.filter(id => !ids.includes(id)) : [...new Set([...prev, ...ids])]); } }}
                              >
                                {currentRideCheckRecords.every(d => selectedDocuments.includes(d.id)) ? 'None' : 'All'}
                              </span>
                              <ChevronDown className="h-3 w-3" />
                            </div>
                          </CollapsibleTrigger>
                          <CollapsibleContent>
                            <div className="px-1.5 pb-1.5 space-y-0.5">
                              {currentRideCheckRecords.map(doc => (
                                <label key={doc.id} className={cn("flex items-center gap-2 px-2 py-1.5 rounded-md cursor-pointer transition-colors text-[11px]", selectedDocuments.includes(doc.id) ? 'bg-success/8 border border-success/25' : 'hover:bg-muted/50 border border-transparent')}>
                                  <Checkbox checked={selectedDocuments.includes(doc.id)} onCheckedChange={() => handleDocumentToggle(doc.id)} className="shrink-0 h-3.5 w-3.5" />
                                  <div className="flex-1 min-w-0">
                                    <p className="font-medium text-foreground truncate">{doc.document_name}</p>
                                    <p className="text-[9px] text-muted-foreground">{doc.uploaded_at && format(new Date(doc.uploaded_at), 'dd MMM yyyy')}{doc.file_size ? ` · ${formatFileSize(doc.file_size)}` : ''}</p>
                                  </div>
                                </label>
                              ))}
                            </div>
                          </CollapsibleContent>
                        </div>
                      </Collapsible>
                    )}

                    {/* Ride Documents */}
                    {currentRideDocuments.length > 0 && (
                      <Collapsible defaultOpen>
                        <div className="border border-border rounded-lg overflow-hidden">
                          <CollapsibleTrigger className="w-full px-2.5 py-1.5 flex items-center justify-between hover:bg-muted/50 transition-colors gap-2">
                            <div className="flex items-center gap-1.5 min-w-0">
                              <FileText className="h-3 w-3 text-primary shrink-0" strokeWidth={2.5} />
                              <span className="font-semibold text-[11px]">Documents</span>
                              <Badge variant="outline" className="text-[9px] h-3.5">{currentRideDocuments.length}</Badge>
                            </div>
                            <div className="flex items-center gap-1 shrink-0">
                              <span
                                role="button"
                                tabIndex={0}
                                className="h-5 text-[10px] px-1 inline-flex items-center rounded hover:bg-accent text-muted-foreground cursor-pointer"
                                onClick={(e) => { e.stopPropagation(); handleSelectAllRide(selectedRide!.id, currentRideDocuments); }}
                                onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.stopPropagation(); handleSelectAllRide(selectedRide!.id, currentRideDocuments); } }}
                              >
                                {currentRideDocuments.every(d => selectedDocuments.includes(d.id)) ? 'None' : 'All'}
                              </span>
                              <ChevronDown className="h-3 w-3" />
                            </div>
                          </CollapsibleTrigger>
                          <CollapsibleContent>
                            <div className="px-1.5 pb-1.5 space-y-0.5">
                              {currentRideDocuments.map(doc => (
                                <label key={doc.id} className={cn("flex items-center gap-2 px-2 py-1.5 rounded-md cursor-pointer transition-colors text-[11px]", selectedDocuments.includes(doc.id) ? 'bg-primary/8 border border-primary/25' : 'hover:bg-muted/50 border border-transparent')}>
                                  <Checkbox checked={selectedDocuments.includes(doc.id)} onCheckedChange={() => handleDocumentToggle(doc.id)} className="shrink-0 h-3.5 w-3.5" />
                                  <div className="flex-1 min-w-0">
                                    <p className="font-medium text-foreground truncate">{doc.document_name}</p>
                                    <div className="flex items-center gap-1 text-[9px] text-muted-foreground">
                                      <span>{doc.document_type}</span>
                                      {doc.expires_at && isExpiringSoon(doc.expires_at) && <Badge variant="destructive" className="text-[8px] h-3 px-1">Exp</Badge>}
                                      {doc.file_size && <span>· {formatFileSize(doc.file_size)}</span>}
                                    </div>
                                  </div>
                                </label>
                              ))}
                            </div>
                          </CollapsibleContent>
                        </div>
                      </Collapsible>
                    )}

                    {/* Global Documents */}
                    {globalDocuments.length > 0 && (
                      <Collapsible defaultOpen={currentRideDocuments.length === 0}>
                        <div className="border border-border rounded-lg overflow-hidden">
                          <CollapsibleTrigger className="w-full px-2.5 py-1.5 flex items-center justify-between hover:bg-muted/50 transition-colors gap-2">
                            <div className="flex items-center gap-1.5 min-w-0">
                              <Building2 className="h-3 w-3 text-primary shrink-0" strokeWidth={2.5} />
                              <span className="font-semibold text-[11px]">Global Documents</span>
                              <Badge variant="outline" className="text-[9px] h-3.5">{globalDocuments.length}</Badge>
                            </div>
                            <div className="flex items-center gap-1 shrink-0">
                              <span
                                role="button"
                                tabIndex={0}
                                className="h-5 text-[10px] px-1 inline-flex items-center rounded hover:bg-accent text-muted-foreground cursor-pointer"
                                onClick={(e) => { e.stopPropagation(); handleSelectAllGlobal(); }}
                                onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.stopPropagation(); handleSelectAllGlobal(); } }}
                              >
                                {globalDocuments.every(d => selectedDocuments.includes(d.id)) ? 'None' : 'All'}
                              </span>
                              <ChevronDown className="h-3 w-3" />
                            </div>
                          </CollapsibleTrigger>
                          <CollapsibleContent>
                            <div className="px-1.5 pb-1.5 space-y-0.5">
                              {globalDocuments.map(doc => (
                                <label key={doc.id} className={cn("flex items-center gap-2 px-2 py-1.5 rounded-md cursor-pointer transition-colors text-[11px]", selectedDocuments.includes(doc.id) ? 'bg-primary/8 border border-primary/25' : 'hover:bg-muted/50 border border-transparent')}>
                                  <Checkbox checked={selectedDocuments.includes(doc.id)} onCheckedChange={() => handleDocumentToggle(doc.id)} className="shrink-0 h-3.5 w-3.5" />
                                  <div className="flex-1 min-w-0">
                                    <p className="font-medium text-foreground truncate">{doc.document_name}</p>
                                    <div className="flex items-center gap-1 text-[9px] text-muted-foreground">
                                      <span>{doc.document_type}</span>
                                      {doc.expires_at && isExpiringSoon(doc.expires_at) && <Badge variant="destructive" className="text-[8px] h-3 px-1">Exp</Badge>}
                                      {doc.file_size && <span>· {formatFileSize(doc.file_size)}</span>}
                                    </div>
                                  </div>
                                </label>
                              ))}
                            </div>
                          </CollapsibleContent>
                        </div>
                      </Collapsible>
                    )}

                    {/* Empty state */}
                    {currentRideDocuments.length === 0 && currentRideCheckRecords.length === 0 && globalDocuments.length === 0 && (
                      <div className="text-center py-6">
                        <FileText className="h-7 w-7 text-muted-foreground/40 mx-auto mb-1.5" />
                        <p className="text-xs text-muted-foreground">No documents available</p>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Right: Recipient & Send */}
              <div className="space-y-2">
                {/* Sender Info */}
                <div className="t-card rounded-xl overflow-hidden">
                  <div className="t-card-header px-3 py-2 flex items-center gap-2">
                    <Users className="h-3 w-3 text-primary shrink-0" strokeWidth={2.5} />
                    <p className="text-xs font-bold text-foreground">Your Information</p>
                  </div>
                  <div className="px-3 py-2 text-[10px] space-y-0.5 text-muted-foreground">
                    {profile?.company_name && <p><span className="font-semibold text-foreground">Company:</span> {profile.company_name}</p>}
                    {profile?.controller_name && <p><span className="font-semibold text-foreground">Controller:</span> {profile.controller_name}</p>}
                    {user?.email && <p><span className="font-semibold text-foreground">Email:</span> {user.email}</p>}
                    {!isStaff && !profile?.company_name && !profile?.controller_name && (
                      <p className="text-destructive italic">Complete your profile in Settings</p>
                    )}
                  </div>
                </div>

                {/* Saved Recipients */}
                {savedRecipients.length > 0 && (
                  <div className="t-card rounded-xl overflow-hidden">
                    <div className="t-card-header px-3 py-2 flex items-center gap-2">
                      <BookUser className="h-3 w-3 text-primary shrink-0" strokeWidth={2.5} />
                      <p className="text-xs font-bold text-foreground">Saved Recipients</p>
                    </div>
                    <div className="px-2 py-1.5 max-h-32 overflow-y-auto space-y-0.5">
                      {savedRecipients.map(recipient => (
                        <div
                          key={recipient.id}
                          className="flex items-center gap-2 px-2 py-1.5 rounded-md hover:bg-muted/50 cursor-pointer group transition-colors"
                          onClick={() => handleSelectRecipient(recipient.id)}
                        >
                          <button onClick={(e) => { e.stopPropagation(); handleToggleFavorite(recipient.id, recipient.is_favorite); }} className="shrink-0">
                            <Star className={`h-3 w-3 ${recipient.is_favorite ? 'fill-yellow-400 text-yellow-400' : 'text-muted-foreground'}`} />
                          </button>
                          <div className="flex-1 min-w-0">
                            <p className="text-[11px] font-semibold text-foreground truncate">{recipient.name}</p>
                            <p className="text-[9px] text-muted-foreground truncate">{recipient.email}</p>
                          </div>
                          <button onClick={(e) => { e.stopPropagation(); handleDeleteRecipient(recipient.id); }} className="opacity-0 group-hover:opacity-100 shrink-0">
                            <Trash2 className="h-3 w-3 text-destructive" />
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Recipient Form */}
                <div className="t-card rounded-xl overflow-hidden">
                  <div className="t-card-header px-3 py-2 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Mail className="h-3 w-3 text-primary shrink-0" strokeWidth={2.5} />
                      <p className="text-xs font-bold text-foreground">Recipient</p>
                    </div>
                    <Dialog open={showSaveRecipientDialog} onOpenChange={setShowSaveRecipientDialog}>
                      <DialogTrigger asChild>
                        <Button variant="ghost" size="sm" className="h-6 text-[10px] px-1.5" disabled={!recipientEmail || !recipientName}>
                          <Plus className="h-2.5 w-2.5 mr-0.5" />Save
                        </Button>
                      </DialogTrigger>
                      <DialogContent className="max-w-sm">
                        <DialogHeader><DialogTitle>Save Recipient</DialogTitle></DialogHeader>
                        <div className="space-y-3 pt-2">
                          <div><Label className="text-xs">Name</Label><Input value={recipientName} disabled className="mt-1 bg-muted h-8" /></div>
                          <div><Label className="text-xs">Email</Label><Input value={recipientEmail} disabled className="mt-1 bg-muted h-8" /></div>
                          <div>
                            <Label className="text-xs">Organization Type</Label>
                            <Select value={newRecipientOrg} onValueChange={setNewRecipientOrg}>
                              <SelectTrigger className="mt-1 h-8"><SelectValue placeholder="Select type..." /></SelectTrigger>
                              <SelectContent>
                                <SelectItem value="council">{terminology.isUK ? 'Local Council' : 'Local Authority'}</SelectItem>
                                <SelectItem value="guild">{terminology.isUK ? 'Guild / Trade Association' : 'Trade Association'}</SelectItem>
                                <SelectItem value="insurer">Insurance Company</SelectItem>
                                <SelectItem value="inspector">Inspection Body</SelectItem>
                                <SelectItem value="regulatory_body">Regulatory Body</SelectItem>
                                <SelectItem value="other">Other</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                          <Button onClick={handleSaveRecipient} className="w-full">Save Recipient</Button>
                        </div>
                      </DialogContent>
                    </Dialog>
                  </div>
                  <div className="space-y-2 px-3 py-2.5">
                    <div>
                      <Label htmlFor="recipientEmail" className="text-[10px] font-bold">Email Address *</Label>
                      <Input id="recipientEmail" type="email" value={recipientEmail} onChange={(e) => setRecipientEmail(e.target.value)} placeholder="council@example.gov.uk" className="mt-0.5 h-8 text-xs" required />
                    </div>
                    <div>
                      <Label htmlFor="recipientName" className="text-[10px] font-bold">Name / Organization</Label>
                      <Input id="recipientName" value={recipientName} onChange={(e) => setRecipientName(e.target.value)} placeholder="Local Authority, etc." className="mt-0.5 h-8 text-xs" />
                    </div>
                    <div>
                      <div className="flex items-center justify-between mb-0.5">
                        <Label htmlFor="message" className="text-[10px] font-bold">Message (Optional)</Label>
                        <div className="flex items-center gap-0.5">
                          {emailTemplates.length > 0 && (
                            <Select onValueChange={handleSelectTemplate}>
                              <SelectTrigger className="h-5 text-[9px] w-auto min-w-[70px]"><SelectValue placeholder="Template" /></SelectTrigger>
                              <SelectContent>
                                {emailTemplates.map(t => (
                                  <SelectItem key={t.id} value={t.id} className="text-xs">
                                    <span className="flex items-center gap-1">{t.is_default && <Star className="h-2.5 w-2.5 fill-yellow-400 text-yellow-400" />}{t.name}</span>
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          )}
                          <Dialog open={showSaveTemplateDialog} onOpenChange={setShowSaveTemplateDialog}>
                            <DialogTrigger asChild>
                              <Button variant="ghost" size="sm" className="h-5 text-[9px] px-1" disabled={!message}><Plus className="h-2.5 w-2.5 mr-0.5" />Save</Button>
                            </DialogTrigger>
                            <DialogContent className="max-w-sm">
                              <DialogHeader><DialogTitle>Save Email Template</DialogTitle></DialogHeader>
                              <div className="space-y-3 pt-2">
                                <div><Label className="text-xs">Template Name *</Label><Input value={newTemplateName} onChange={(e) => setNewTemplateName(e.target.value)} placeholder="e.g., Council Submission" className="mt-1" /></div>
                                <div><Label className="text-xs">Message Preview</Label><div className="mt-1 p-2 bg-muted rounded text-xs max-h-20 overflow-y-auto">{message || 'No message'}</div></div>
                                <div>
                                  <Label className="text-xs">Recipient Type</Label>
                                  <Select value={newTemplateType} onValueChange={setNewTemplateType}>
                                    <SelectTrigger className="mt-1"><SelectValue placeholder="Select type..." /></SelectTrigger>
                                    <SelectContent>
                                      <SelectItem value="council">Local Authority</SelectItem>
                                      <SelectItem value="guild">Trade Association</SelectItem>
                                      <SelectItem value="insurer">Insurance Company</SelectItem>
                                      <SelectItem value="inspector">Inspection Body</SelectItem>
                                      <SelectItem value="regulatory_body">Regulatory Body</SelectItem>
                                      <SelectItem value="other">Other</SelectItem>
                                    </SelectContent>
                                  </Select>
                                </div>
                                <Button onClick={handleSaveTemplate} className="w-full">Save Template</Button>
                              </div>
                            </DialogContent>
                          </Dialog>
                        </div>
                      </div>
                      <Textarea id="message" value={message} onChange={(e) => setMessage(e.target.value)} placeholder="Please find attached the requested documentation..." className="resize-none text-xs" rows={2} />
                    </div>

                    {/* Templates list */}
                    {emailTemplates.length > 0 && (
                      <Collapsible>
                        <CollapsibleTrigger className="flex items-center gap-1 text-[10px] text-muted-foreground hover:text-foreground transition-colors">
                          <ChevronRight className="h-2.5 w-2.5" />
                          Manage {emailTemplates.length} template{emailTemplates.length !== 1 ? 's' : ''}
                        </CollapsibleTrigger>
                        <CollapsibleContent className="pt-1.5">
                          <div className="space-y-0.5 max-h-24 overflow-y-auto">
                            {emailTemplates.map(template => (
                              <div key={template.id} className="flex items-center gap-1.5 p-1 border border-border rounded text-[10px] group">
                                <button onClick={() => handleToggleDefaultTemplate(template.id, template.is_default)} className="shrink-0">
                                  <Star className={`h-2.5 w-2.5 ${template.is_default ? 'fill-yellow-400 text-yellow-400' : 'text-muted-foreground'}`} />
                                </button>
                                <p className="flex-1 min-w-0 font-medium truncate">{template.name}</p>
                                <Button variant="ghost" size="sm" className="h-4 px-1 text-[9px]" onClick={() => handleSelectTemplate(template.id)}>Use</Button>
                                <button onClick={() => handleDeleteTemplate(template.id)} className="opacity-0 group-hover:opacity-100 shrink-0"><Trash2 className="h-2.5 w-2.5 text-destructive" /></button>
                              </div>
                            ))}
                          </div>
                        </CollapsibleContent>
                      </Collapsible>
                    )}

                    <div className="h-px bg-border" />

                    <button
                      onClick={handleSend}
                      disabled={sending || !recipientEmail || selectedDocuments.length === 0}
                      className="t-btn-primary w-full min-h-[44px] rounded-lg text-sm font-semibold flex items-center justify-center gap-2"
                    >
                      {sending ? (
                        <><Loader2 className="h-4 w-4 animate-spin" />Sending...</>
                      ) : (
                        <><Send className="h-4 w-4" />Send Pack{selectedDocuments.length > 0 ? ` (${selectedDocuments.length})` : ''}</>
                      )}
                    </button>

                    <div className="flex items-center justify-center gap-3">
                      <span className="text-[9px] flex items-center gap-0.5 text-muted-foreground"><span className="text-success">✓</span>Secure</span>
                      <span className="text-[9px] flex items-center gap-0.5 text-muted-foreground"><span className="text-success">✓</span>PDF bundle</span>
                      <span className="text-[9px] flex items-center gap-0.5 text-muted-foreground"><span className="text-success">✓</span>Audit logged</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default BatchSendDocuments;
