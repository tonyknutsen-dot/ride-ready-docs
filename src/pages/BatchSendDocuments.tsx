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
  const isMobile = window.innerWidth < 768;
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
      <div className="container mx-auto py-4 px-4 pb-24 md:pb-8 space-y-4 overflow-x-hidden">
        <PageHeader
          title="Send Compliance Documents"
          subtitle="Submit compliance documents to councils, insurers, and auditors."
          icon={<Send className="h-5 w-5 text-primary" />}
          showBackButton
          backTo="/overview"
        />

        {/* Step 1: Ride Selection */}
        {!selectedRide ? (
          <div className="space-y-4">
            {/* KPI summary chips */}
            <div className="flex gap-2 flex-wrap">
              <button
                onClick={() => document.getElementById('asset-pack-section')?.scrollIntoView({ behavior: 'smooth', block: 'start' })}
                className="inline-flex items-center gap-2 rounded-xl border-2 border-foreground/10 bg-card px-3.5 py-2 min-h-[40px] hover:border-primary/40 hover:shadow-md active:scale-[0.97] transition-all cursor-pointer shadow-sm"
              >
                <Package className="h-4 w-4 text-primary" strokeWidth={2.5} />
                <span className="text-xs font-bold text-foreground">{rides.length} {rides.length === 1 ? 'Asset' : 'Assets'}</span>
                <ChevronRight className="h-3 w-3 text-muted-foreground/60" />
              </button>
              <button
                onClick={() => document.getElementById('asset-pack-section')?.scrollIntoView({ behavior: 'smooth', block: 'start' })}
                className="inline-flex items-center gap-2 rounded-xl border-2 border-foreground/10 bg-card px-3.5 py-2 min-h-[40px] hover:border-primary/40 hover:shadow-md active:scale-[0.97] transition-all cursor-pointer shadow-sm"
              >
                <FileText className="h-4 w-4 text-primary" strokeWidth={2.5} />
                <span className="text-xs font-bold text-foreground">{rides.reduce((sum, r) => sum + r.documents.length, 0) + checkRecords.length} Docs</span>
                <ChevronRight className="h-3 w-3 text-muted-foreground/60" />
              </button>
              <button
                onClick={() => document.getElementById('global-docs-section')?.scrollIntoView({ behavior: 'smooth', block: 'start' })}
                className="inline-flex items-center gap-2 rounded-xl border-2 border-foreground/10 bg-card px-3.5 py-2 min-h-[40px] hover:border-primary/40 hover:shadow-md active:scale-[0.97] transition-all cursor-pointer shadow-sm"
              >
                <Building2 className="h-4 w-4 text-primary" strokeWidth={2.5} />
                <span className="text-xs font-bold text-foreground">{globalDocuments.length} Global</span>
                <ChevronRight className="h-3 w-3 text-muted-foreground/60" />
              </button>
            </div>

            {/* Asset list card */}
            <div id="asset-pack-section" className="rounded-2xl border-2 border-foreground/10 bg-card shadow-[0_8px_24px_rgba(15,23,42,0.08)] overflow-hidden">
              <div className="t-card-header px-4 py-3 flex items-center gap-3">
                <span className="flex items-center justify-center w-8 h-8 rounded-xl bg-primary/10 shrink-0">
                  <ClipboardCheck className="h-4 w-4 text-primary" strokeWidth={2.5} />
                </span>
                <div>
                  <p className="text-sm font-extrabold text-foreground tracking-tight">Select Asset</p>
                  <p className="text-[11px] text-muted-foreground">Choose an asset to build a compliance pack</p>
                </div>
              </div>
              <div className="p-2.5">
                {rides.length === 0 ? (
                  <div className="text-center py-10">
                    <Package className="h-9 w-9 text-muted-foreground/30 mx-auto mb-2" />
                    <p className="text-xs font-semibold text-muted-foreground">No assets found</p>
                    <p className="text-[10px] text-muted-foreground/70 mt-0.5">Add equipment to start building compliance packs</p>
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
                          className="w-full text-left group active:scale-[0.98] transition-all"
                        >
                          <div className={cn(
                            "flex items-center gap-3 px-3.5 py-3 rounded-xl border-2 transition-all",
                            "border-foreground/8 hover:border-primary/40 hover:shadow-md bg-card"
                          )}>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2">
                                <p className="text-[13px] font-bold text-foreground truncate">{ride.ride_name}</p>
                                <Badge
                                  variant={statusConfig.variant}
                                  className={cn(
                                    "text-[9px] h-[18px] px-1.5 shrink-0 gap-0.5 font-bold",
                                    complianceStatus === 'compliant' && "bg-success/15 text-success border-success/25",
                                    complianceStatus === 'expiring' && "bg-warning/15 text-warning border-warning/25"
                                  )}
                                  title="Based on expiry dates in the document register"
                                >
                                  <StatusIcon className="h-2.5 w-2.5" strokeWidth={3} />
                                  {statusConfig.label}
                                </Badge>
                              </div>
                              <div className="flex items-center gap-1.5 mt-1">
                                {ride.manufacturer && (
                                  <span className="text-[11px] text-muted-foreground truncate">{ride.manufacturer}</span>
                                )}
                                {ride.manufacturer && <span className="text-muted-foreground/30">·</span>}
                                <span className="text-[11px] text-muted-foreground shrink-0 font-medium">
                                  <FileText className="h-3 w-3 inline mr-0.5 -mt-0.5" strokeWidth={2} />
                                  {totalDocs} {totalDocs === 1 ? 'doc' : 'docs'}
                                </span>
                              </div>
                            </div>
                            <ChevronRight className="h-5 w-5 text-muted-foreground/40 group-hover:text-primary shrink-0 transition-colors" />
                          </div>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>

            {/* Global Documents card */}
            <div id="global-docs-section">
              <button
                className="w-full text-left group active:scale-[0.98] transition-all"
                onClick={() => setSelectedRide({ id: '__global__', ride_name: 'Global Documents' })}
              >
                <div className="rounded-2xl border-2 border-foreground/10 bg-card shadow-[0_8px_24px_rgba(15,23,42,0.08)] overflow-hidden hover:border-primary/40 hover:shadow-lg transition-all">
                  <div className="flex items-center gap-3.5 px-4 py-3.5">
                    <span className="flex items-center justify-center w-10 h-10 rounded-xl bg-primary/10 shrink-0">
                      <Building2 className="h-5 w-5 text-primary" strokeWidth={2.5} />
                    </span>
                    <div className="flex-1 min-w-0">
                      <p className="text-[13px] font-bold text-foreground group-hover:text-primary transition-colors">Global Compliance Documents</p>
                      <p className="text-[11px] text-muted-foreground mt-0.5 font-medium">
                        Insurance, policies &amp; company-wide · <span className="font-bold">{globalDocuments.length} {globalDocuments.length === 1 ? 'file' : 'files'}</span>
                      </p>
                    </div>
                    <ChevronRight className="h-5 w-5 text-muted-foreground/40 group-hover:text-primary shrink-0 transition-colors" />
                  </div>
                </div>
              </button>
            </div>
          </div>
        ) : (
          <>
            {/* Step 2: Asset context strip */}
            <div className="rounded-2xl border-2 border-foreground/10 bg-card shadow-sm px-4 py-3">
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-3 min-w-0">
                  <span className="flex items-center justify-center w-9 h-9 rounded-xl bg-primary/12 shrink-0">
                    {isGlobalMode
                      ? <Building2 className="h-4 w-4 text-primary" strokeWidth={2.5} />
                      : <ClipboardCheck className="h-4 w-4 text-primary" strokeWidth={2.5} />}
                  </span>
                  <div className="min-w-0">
                    <p className="text-[10px] text-muted-foreground font-semibold uppercase tracking-wider">{isGlobalMode ? 'Global' : 'Asset'}</p>
                    <p className="text-sm font-extrabold text-foreground truncate tracking-tight">{selectedRide.ride_name}</p>
                  </div>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => { setSelectedRide(null); setSelectedDocuments([]); }}
                  className="gap-1.5 shrink-0 text-xs h-8 px-3 font-semibold border-foreground/15"
                >
                  <ChevronRight className="h-3 w-3 rotate-180" />
                  Back
                </Button>
              </div>
              {selectedDocuments.length > 0 && (
                <div className="mt-2.5 flex items-center gap-2 rounded-xl px-3 py-2 text-xs font-bold bg-primary/10 text-primary border border-primary/20">
                  <FileText className="h-3.5 w-3.5 shrink-0" strokeWidth={2.5} />
                  {selectedDocuments.length} document{selectedDocuments.length !== 1 ? 's' : ''} selected
                  <span className="text-primary/60 font-medium">·</span>
                  <span className="font-medium text-primary/70">{formatFileSize(totalFileSize)}</span>
                </div>
              )}
            </div>

            <div className="grid lg:grid-cols-2 gap-4">
              {/* Left: Document Selection */}
              <div>
                <div className="rounded-2xl border-2 border-foreground/10 bg-card shadow-[0_8px_24px_rgba(15,23,42,0.08)] overflow-hidden">
                  <div className="t-card-header px-4 py-2.5 flex items-center justify-between">
                    <p className="text-sm font-extrabold text-foreground tracking-tight">Select Documents</p>
                    {selectedDocuments.length > 0 && (
                      <Badge variant="secondary" className="text-[10px] h-5 font-bold px-2">{selectedDocuments.length} selected</Badge>
                    )}
                  </div>
                  <div className="p-2.5 space-y-2 overflow-x-hidden">
                    {/* Size indicator */}
                    {selectedDocuments.length > 0 && (
                      <div className="flex items-center justify-between text-[11px] bg-muted/60 border border-foreground/8 rounded-lg px-3 py-1.5">
                        <span className="text-muted-foreground font-medium">Total size</span>
                        <Badge variant={exceedsEmailLimit ? "destructive" : "outline"} className="text-[10px] h-4 font-bold">
                          {formatFileSize(totalFileSize)}
                        </Badge>
                      </div>
                    )}

                    {/* Send method selector */}
                    {(exceedsEmailLimit || sendMethod !== 'auto') && (
                      <div className="bg-warning/8 border-2 border-warning/20 rounded-xl p-3">
                        <p className="text-[11px] font-bold text-foreground mb-2">
                          <AlertTriangle className="h-3.5 w-3.5 text-warning inline mr-1 -mt-0.5" />
                          Large file ({totalSizeMB.toFixed(1)}MB) — choose send method:
                        </p>
                        <div className="grid grid-cols-2 gap-1.5">
                          <button
                            type="button"
                            onClick={() => setSendMethod('links')}
                            className={cn(
                              "flex items-center gap-2 p-2 rounded-lg border-2 text-left text-[11px] font-semibold transition-all",
                              (sendMethod === 'links' || (sendMethod === 'auto' && exceedsEmailLimit))
                                ? "border-primary bg-primary/8 text-primary"
                                : "border-foreground/8 hover:border-primary/40"
                            )}
                          >
                            <Link className="h-3.5 w-3.5 shrink-0" />
                            Download Link
                          </button>
                          <button
                            type="button"
                            onClick={() => setSendMethod('attachments')}
                            className={cn(
                              "flex items-center gap-2 p-2 rounded-lg border-2 text-left text-[11px] font-semibold transition-all",
                              sendMethod === 'attachments'
                                ? "border-primary bg-primary/8 text-primary"
                                : "border-foreground/8 hover:border-primary/40"
                            )}
                          >
                            <Paperclip className="h-3.5 w-3.5 shrink-0" />
                            Attachments
                          </button>
                        </div>
                      </div>
                    )}

                    {/* Scrollable document sections */}
                    <div className="space-y-2 max-h-[40vh] overflow-y-auto pr-0.5 md:max-h-none md:overflow-visible md:pr-0">
                      {/* Check Records */}
                      {currentRideCheckRecords.length > 0 && (
                        <Collapsible open={checkRecordsExpanded} onOpenChange={setCheckRecordsExpanded}>
                          <div className="border-2 border-success/20 rounded-xl overflow-hidden bg-success/3">
                            <CollapsibleTrigger className="w-full px-3 py-2.5 flex items-center justify-between hover:bg-success/8 transition-colors gap-2">
                              <div className="flex items-center gap-2 min-w-0">
                                <ClipboardCheck className="h-4 w-4 text-success shrink-0" strokeWidth={2.5} />
                                <span className="font-bold text-xs text-foreground">Check Records</span>
                                <Badge variant="outline" className="text-[10px] h-4 border-success/30 text-success font-bold">{currentRideCheckRecords.length}</Badge>
                              </div>
                              <div className="flex items-center gap-1.5 shrink-0">
                                <span
                                  role="button"
                                  tabIndex={0}
                                  className="h-6 text-[11px] px-2 inline-flex items-center justify-center rounded-md hover:bg-success/15 text-success cursor-pointer font-semibold"
                                  onClick={(e) => { e.stopPropagation(); const ids = currentRideCheckRecords.map(d => d.id); const allSel = ids.every(id => selectedDocuments.includes(id)); setSelectedDocuments(prev => allSel ? prev.filter(id => !ids.includes(id)) : [...new Set([...prev, ...ids])]); }}
                                  onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.stopPropagation(); const ids = currentRideCheckRecords.map(d => d.id); const allSel = ids.every(id => selectedDocuments.includes(id)); setSelectedDocuments(prev => allSel ? prev.filter(id => !ids.includes(id)) : [...new Set([...prev, ...ids])]); } }}
                                >
                                  {currentRideCheckRecords.every(d => selectedDocuments.includes(d.id)) ? 'None' : 'All'}
                                </span>
                                <ChevronDown className={cn("h-3.5 w-3.5 text-muted-foreground transition-transform", checkRecordsExpanded && "rotate-180")} />
                              </div>
                            </CollapsibleTrigger>
                            <CollapsibleContent>
                              <div className="px-2 pb-2 space-y-0.5 border-t border-success/15">
                                {currentRideCheckRecords.map(doc => (
                                  <label key={doc.id} className={cn("flex items-center gap-2.5 min-w-0 px-2.5 py-2 rounded-lg cursor-pointer transition-all", selectedDocuments.includes(doc.id) ? 'bg-success/12 border border-success/30 shadow-sm' : 'hover:bg-success/5 border border-transparent')}>
                                    <Checkbox checked={selectedDocuments.includes(doc.id)} onCheckedChange={() => handleDocumentToggle(doc.id)} className="shrink-0" />
                                    <div className="flex-1 min-w-0 overflow-hidden">
                                      <p className="text-xs font-semibold text-foreground truncate">{doc.document_name}</p>
                                      <p className="text-[10px] text-muted-foreground truncate">{doc.uploaded_at && format(new Date(doc.uploaded_at), 'dd MMM yyyy')}{doc.file_size ? ` · ${formatFileSize(doc.file_size)}` : ''}</p>
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
                        <Collapsible defaultOpen={!isMobile}>
                          <div className="border-2 border-foreground/10 rounded-xl overflow-hidden">
                            <CollapsibleTrigger className="w-full px-3 py-2.5 flex items-center justify-between hover:bg-muted/50 transition-colors gap-2 bg-muted/20">
                              <div className="flex items-center gap-2 min-w-0">
                                <FileText className="h-4 w-4 text-primary shrink-0" strokeWidth={2.5} />
                                <span className="font-bold text-xs text-foreground">Documents</span>
                                <Badge variant="outline" className="text-[10px] h-4 font-bold">{currentRideDocuments.length}</Badge>
                              </div>
                              <div className="flex items-center gap-1.5 shrink-0">
                                <span
                                  role="button"
                                  tabIndex={0}
                                  className="h-6 text-[11px] px-2 inline-flex items-center justify-center rounded-md hover:bg-primary/10 text-primary cursor-pointer font-semibold"
                                  onClick={(e) => { e.stopPropagation(); handleSelectAllRide(selectedRide!.id, currentRideDocuments); }}
                                  onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.stopPropagation(); handleSelectAllRide(selectedRide!.id, currentRideDocuments); } }}
                                >
                                  {currentRideDocuments.every(d => selectedDocuments.includes(d.id)) ? 'None' : 'All'}
                                </span>
                                <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
                              </div>
                            </CollapsibleTrigger>
                            <CollapsibleContent>
                              <div className="px-2 pb-2 space-y-0.5 border-t border-foreground/8">
                                {currentRideDocuments.map(doc => (
                                  <label key={doc.id} className={cn("flex items-center gap-2.5 min-w-0 px-2.5 py-2 rounded-lg cursor-pointer transition-all", selectedDocuments.includes(doc.id) ? 'bg-primary/8 border border-primary/20 shadow-sm' : 'hover:bg-muted/40 border border-transparent')}>
                                    <Checkbox checked={selectedDocuments.includes(doc.id)} onCheckedChange={() => handleDocumentToggle(doc.id)} className="shrink-0" />
                                    <div className="flex-1 min-w-0 overflow-hidden">
                                      <p className="text-xs font-semibold text-foreground truncate">{doc.document_name}</p>
                                      <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground min-w-0">
                                        <span className="truncate">{doc.document_type}</span>
                                        {doc.expires_at && isExpiringSoon(doc.expires_at) && <Badge variant="destructive" className="text-[8px] h-3.5 px-1 font-bold">Expiring</Badge>}
                                        {doc.file_size && <span className="shrink-0">· {formatFileSize(doc.file_size)}</span>}
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
                        <Collapsible defaultOpen={!isMobile && currentRideDocuments.length === 0}>
                          <div className="border-2 border-foreground/10 rounded-xl overflow-hidden">
                            <CollapsibleTrigger className="w-full px-3 py-2.5 flex items-center justify-between hover:bg-muted/50 transition-colors gap-2 bg-muted/20">
                              <div className="flex items-center gap-2 min-w-0">
                                <Building2 className="h-4 w-4 text-primary shrink-0" strokeWidth={2.5} />
                                <span className="font-bold text-xs text-foreground">Global Documents</span>
                                <Badge variant="outline" className="text-[10px] h-4 font-bold">{globalDocuments.length}</Badge>
                              </div>
                              <div className="flex items-center gap-1.5 shrink-0">
                                <span
                                  role="button"
                                  tabIndex={0}
                                  className="h-6 text-[11px] px-2 inline-flex items-center justify-center rounded-md hover:bg-primary/10 text-primary cursor-pointer font-semibold"
                                  onClick={(e) => { e.stopPropagation(); handleSelectAllGlobal(); }}
                                  onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.stopPropagation(); handleSelectAllGlobal(); } }}
                                >
                                  {globalDocuments.every(d => selectedDocuments.includes(d.id)) ? 'None' : 'All'}
                                </span>
                                <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
                              </div>
                            </CollapsibleTrigger>
                            <CollapsibleContent>
                              <div className="px-2 pb-2 space-y-0.5 border-t border-foreground/8">
                                {globalDocuments.map(doc => (
                                  <label key={doc.id} className={cn("flex items-center gap-2.5 min-w-0 px-2.5 py-2 rounded-lg cursor-pointer transition-all", selectedDocuments.includes(doc.id) ? 'bg-primary/8 border border-primary/20 shadow-sm' : 'hover:bg-muted/40 border border-transparent')}>
                                    <Checkbox checked={selectedDocuments.includes(doc.id)} onCheckedChange={() => handleDocumentToggle(doc.id)} className="shrink-0" />
                                    <div className="flex-1 min-w-0 overflow-hidden">
                                      <p className="text-xs font-semibold text-foreground truncate">{doc.document_name}</p>
                                      <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground min-w-0">
                                        <span className="truncate">{doc.document_type}</span>
                                        {doc.expires_at && isExpiringSoon(doc.expires_at) && <Badge variant="destructive" className="text-[8px] h-3.5 px-1 font-bold">Expiring</Badge>}
                                        {doc.file_size && <span className="shrink-0">· {formatFileSize(doc.file_size)}</span>}
                                      </div>
                                    </div>
                                  </label>
                                ))}
                              </div>
                            </CollapsibleContent>
                          </div>
                        </Collapsible>
                      )}
                    </div>

                    {/* Empty state */}
                    {currentRideDocuments.length === 0 && currentRideCheckRecords.length === 0 && globalDocuments.length === 0 && (
                      <div className="text-center py-8">
                        <FileText className="h-8 w-8 text-muted-foreground/30 mx-auto mb-2" />
                        <p className="text-xs font-semibold text-muted-foreground">No documents available</p>
                        <p className="text-[10px] text-muted-foreground/70 mt-0.5">Upload documents to this asset first</p>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Right: Recipient & Send */}
              <div className="space-y-3">
                {/* Sender Info */}
                <div className="rounded-2xl border-2 border-foreground/10 bg-card shadow-[0_8px_24px_rgba(15,23,42,0.08)] overflow-hidden">
                  <div className="t-card-header px-4 py-2.5 flex items-center gap-2.5">
                    <Users className="h-4 w-4 text-primary shrink-0" strokeWidth={2.5} />
                    <p className="text-xs font-extrabold text-foreground tracking-tight">Your Information</p>
                  </div>
                  <div className="px-4 py-3 text-xs space-y-1 text-foreground/70">
                    {profile?.company_name && <p><span className="font-bold text-foreground">Company:</span> {profile.company_name}</p>}
                    {profile?.controller_name && <p><span className="font-bold text-foreground">Controller:</span> {profile.controller_name}</p>}
                    {user?.email && <p><span className="font-bold text-foreground">Email:</span> {user.email}</p>}
                    {!isStaff && !profile?.company_name && !profile?.controller_name && (
                      <p className="text-destructive font-semibold italic text-[11px]">Complete your profile in Settings</p>
                    )}
                  </div>
                </div>

                {/* Saved Recipients */}
                {savedRecipients.length > 0 && (
                  <div className="rounded-2xl border-2 border-foreground/10 bg-card shadow-[0_8px_24px_rgba(15,23,42,0.08)] overflow-hidden">
                    <div className="t-card-header px-4 py-2.5 flex items-center gap-2.5">
                      <BookUser className="h-4 w-4 text-primary shrink-0" strokeWidth={2.5} />
                      <p className="text-xs font-extrabold text-foreground tracking-tight">Saved Recipients</p>
                    </div>
                    <div className="px-2.5 py-2 max-h-36 overflow-y-auto space-y-0.5">
                      {savedRecipients.map(recipient => (
                        <div
                          key={recipient.id}
                          className="flex items-center gap-2.5 px-2.5 py-2 rounded-lg hover:bg-muted/50 cursor-pointer group transition-colors"
                          onClick={() => handleSelectRecipient(recipient.id)}
                        >
                          <button onClick={(e) => { e.stopPropagation(); handleToggleFavorite(recipient.id, recipient.is_favorite); }} className="shrink-0">
                            <Star className={cn("h-3.5 w-3.5", recipient.is_favorite ? 'fill-amber-400 text-amber-400' : 'text-muted-foreground/40')} />
                          </button>
                          <div className="flex-1 min-w-0">
                            <p className="text-xs font-bold text-foreground truncate">{recipient.name}</p>
                            <p className="text-[10px] text-muted-foreground truncate">{recipient.email}</p>
                          </div>
                          <button onClick={(e) => { e.stopPropagation(); handleDeleteRecipient(recipient.id); }} className="opacity-0 group-hover:opacity-100 shrink-0">
                            <Trash2 className="h-3.5 w-3.5 text-destructive/70" />
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Recipient Form */}
                <div className="rounded-2xl border-2 border-foreground/10 bg-card shadow-[0_8px_24px_rgba(15,23,42,0.08)] overflow-hidden">
                  <div className="t-card-header px-4 py-2.5 flex items-center justify-between">
                    <div className="flex items-center gap-2.5">
                      <Mail className="h-4 w-4 text-primary shrink-0" strokeWidth={2.5} />
                      <p className="text-xs font-extrabold text-foreground tracking-tight">Recipient</p>
                    </div>
                    <Dialog open={showSaveRecipientDialog} onOpenChange={setShowSaveRecipientDialog}>
                      <DialogTrigger asChild>
                        <Button variant="ghost" size="sm" className="h-7 text-[11px] px-2 font-semibold" disabled={!recipientEmail || !recipientName}>
                          <Plus className="h-3 w-3 mr-1" />Save
                        </Button>
                      </DialogTrigger>
                      <DialogContent className="max-w-sm">
                        <DialogHeader><DialogTitle>Save Recipient</DialogTitle></DialogHeader>
                        <div className="space-y-3 pt-2">
                          <div><Label className="text-xs font-bold">Name</Label><Input value={recipientName} disabled className="mt-1 bg-muted h-9" /></div>
                          <div><Label className="text-xs font-bold">Email</Label><Input value={recipientEmail} disabled className="mt-1 bg-muted h-9" /></div>
                          <div>
                            <Label className="text-xs font-bold">Organization Type</Label>
                            <Select value={newRecipientOrg} onValueChange={setNewRecipientOrg}>
                              <SelectTrigger className="mt-1 h-9"><SelectValue placeholder="Select type..." /></SelectTrigger>
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
                  <div className="space-y-3 px-4 py-3">
                    <div>
                      <Label htmlFor="recipientEmail" className="text-xs font-bold text-foreground">Email Address *</Label>
                      <Input id="recipientEmail" type="email" value={recipientEmail} onChange={(e) => setRecipientEmail(e.target.value)} placeholder="council@example.gov.uk" className="mt-1 h-10 text-sm border-foreground/15 shadow-[inset_0_1px_3px_rgba(0,0,0,0.06)]" required />
                    </div>
                    <div>
                      <Label htmlFor="recipientName" className="text-xs font-bold text-foreground">Name / Organization</Label>
                      <Input id="recipientName" value={recipientName} onChange={(e) => setRecipientName(e.target.value)} placeholder="Local Authority, etc." className="mt-1 h-10 text-sm border-foreground/15 shadow-[inset_0_1px_3px_rgba(0,0,0,0.06)]" />
                    </div>
                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <Label htmlFor="message" className="text-xs font-bold text-foreground">Message (Optional)</Label>
                        <div className="flex items-center gap-1">
                          {emailTemplates.length > 0 && (
                            <Select onValueChange={handleSelectTemplate}>
                              <SelectTrigger className="h-6 text-[10px] w-auto min-w-[80px] font-semibold"><SelectValue placeholder="Template" /></SelectTrigger>
                              <SelectContent>
                                {emailTemplates.map(t => (
                                  <SelectItem key={t.id} value={t.id} className="text-xs">
                                    <span className="flex items-center gap-1">{t.is_default && <Star className="h-2.5 w-2.5 fill-amber-400 text-amber-400" />}{t.name}</span>
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          )}
                          <Dialog open={showSaveTemplateDialog} onOpenChange={setShowSaveTemplateDialog}>
                            <DialogTrigger asChild>
                              <Button variant="ghost" size="sm" className="h-6 text-[10px] px-1.5 font-semibold" disabled={!message}><Plus className="h-2.5 w-2.5 mr-0.5" />Save</Button>
                            </DialogTrigger>
                            <DialogContent className="max-w-sm">
                              <DialogHeader><DialogTitle>Save Email Template</DialogTitle></DialogHeader>
                              <div className="space-y-3 pt-2">
                                <div><Label className="text-xs font-bold">Template Name *</Label><Input value={newTemplateName} onChange={(e) => setNewTemplateName(e.target.value)} placeholder="e.g., Council Submission" className="mt-1" /></div>
                                <div><Label className="text-xs font-bold">Message Preview</Label><div className="mt-1 p-2 bg-muted rounded-lg text-xs max-h-20 overflow-y-auto">{message || 'No message'}</div></div>
                                <div>
                                  <Label className="text-xs font-bold">Recipient Type</Label>
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
                      <Textarea id="message" value={message} onChange={(e) => setMessage(e.target.value)} placeholder="Please find attached the requested documentation..." className="resize-none text-sm border-foreground/15 shadow-[inset_0_1px_3px_rgba(0,0,0,0.06)]" rows={2} />
                    </div>

                    {/* Templates list */}
                    {emailTemplates.length > 0 && (
                      <Collapsible>
                        <CollapsibleTrigger className="flex items-center gap-1.5 text-[11px] text-muted-foreground hover:text-foreground transition-colors font-semibold">
                          <ChevronRight className="h-3 w-3" />
                          Manage {emailTemplates.length} template{emailTemplates.length !== 1 ? 's' : ''}
                        </CollapsibleTrigger>
                        <CollapsibleContent className="pt-2">
                          <div className="space-y-1 max-h-28 overflow-y-auto">
                            {emailTemplates.map(template => (
                              <div key={template.id} className="flex items-center gap-2 p-1.5 border border-foreground/10 rounded-lg text-[11px] group">
                                <button onClick={() => handleToggleDefaultTemplate(template.id, template.is_default)} className="shrink-0">
                                  <Star className={cn("h-3 w-3", template.is_default ? 'fill-amber-400 text-amber-400' : 'text-muted-foreground/40')} />
                                </button>
                                <p className="flex-1 min-w-0 font-semibold truncate">{template.name}</p>
                                <Button variant="ghost" size="sm" className="h-5 px-2 text-[10px] font-semibold" onClick={() => handleSelectTemplate(template.id)}>Use</Button>
                                <button onClick={() => handleDeleteTemplate(template.id)} className="opacity-0 group-hover:opacity-100 shrink-0"><Trash2 className="h-3 w-3 text-destructive/70" /></button>
                              </div>
                            ))}
                          </div>
                        </CollapsibleContent>
                      </Collapsible>
                    )}

                    <Separator className="bg-foreground/8" />

                    <button
                      onClick={handleSend}
                      disabled={sending || !recipientEmail || selectedDocuments.length === 0}
                      className="t-btn-primary w-full min-h-[48px] rounded-xl text-sm font-bold flex items-center justify-center gap-2.5 tracking-tight"
                    >
                      {sending ? (
                        <><Loader2 className="h-4 w-4 animate-spin" />Sending...</>
                      ) : (
                        <><Send className="h-4 w-4" />Send Compliance Pack{selectedDocuments.length > 0 ? ` (${selectedDocuments.length})` : ''}</>
                      )}
                    </button>

                    <div className="flex items-center justify-center gap-4 pt-1">
                      <span className="text-[10px] flex items-center gap-1 text-muted-foreground font-medium"><Shield className="h-3 w-3 text-success" />Secure</span>
                      <span className="text-[10px] flex items-center gap-1 text-muted-foreground font-medium"><FileText className="h-3 w-3 text-success" />PDF bundle</span>
                      <span className="text-[10px] flex items-center gap-1 text-muted-foreground font-medium"><CheckCircle2 className="h-3 w-3 text-success" />Audit logged</span>
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
