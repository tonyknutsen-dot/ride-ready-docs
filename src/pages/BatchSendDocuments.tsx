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
    <div className="container mx-auto py-8 px-4 pb-24 md:pb-8" style={{ backgroundColor: 'hsl(210 40% 95%)' }}>
      <PageHeader
        title="Send Compliance Documents"
        subtitle="Submit compliance documents to councils, insurers, and auditors."
        icon={<Send className="h-5 w-5 text-primary" />}
        showBackButton
        backTo="/documents"
      />

      {/* Step 1: Ride Selection (if no ride selected) */}
      {!selectedRide ? (
        <div className="space-y-4">
          {/* Submission Summary Strip */}
          <div className="rounded-2xl px-4 py-3.5 flex items-center gap-4 flex-wrap" style={{ backgroundColor: 'hsl(217 91% 97%)', border: '1px solid hsl(213 52% 24% / 0.15)' }}>
            <div className="flex items-center gap-2">
              <Package className="h-4 w-4" style={{ color: 'hsl(213 52% 24%)' }} strokeWidth={2} />
              <span className="text-sm font-semibold" style={{ color: 'hsl(213 52% 24%)' }}>{rides.length} {rides.length === 1 ? 'Asset' : 'Assets'}</span>
            </div>
            <div className="h-4 w-px" style={{ backgroundColor: 'hsl(213 52% 24% / 0.2)' }} />
            <div className="flex items-center gap-2">
              <FileText className="h-4 w-4" style={{ color: 'hsl(213 52% 24%)' }} strokeWidth={2} />
              <span className="text-sm font-semibold" style={{ color: 'hsl(213 52% 24%)' }}>
                {rides.reduce((sum, r) => sum + r.documents.length, 0) + checkRecords.length} Documents
              </span>
            </div>
            {globalDocuments.length > 0 && (
              <>
                <div className="h-4 w-px" style={{ backgroundColor: 'hsl(213 52% 24% / 0.2)' }} />
                <div className="flex items-center gap-2">
                  <Building2 className="h-4 w-4" style={{ color: 'hsl(213 52% 24%)' }} strokeWidth={2} />
                  <span className="text-sm font-semibold" style={{ color: 'hsl(213 52% 24%)' }}>{globalDocuments.length} Global</span>
                </div>
              </>
            )}
          </div>

          {/* Asset Compliance Pack Selection */}
          <div className="bg-white border border-border rounded-2xl overflow-hidden" style={{ boxShadow: '0 6px 14px rgba(0,0,0,0.06)' }}>
            <div className="px-5 py-4 border-b border-border flex items-center gap-3">
              <span className="flex items-center justify-center w-9 h-9 rounded-xl" style={{ backgroundColor: 'hsl(217 91% 97%)' }}>
                <ClipboardCheck className="h-5 w-5" style={{ color: 'hsl(213 52% 24%)' }} strokeWidth={2} />
              </span>
              <div>
                <p className="text-sm font-bold" style={{ color: 'hsl(222 84% 5%)' }}>Select Asset Compliance Pack</p>
                <p className="text-xs mt-0.5" style={{ color: 'hsl(215 19% 45%)' }}>Choose the asset to build a documentation submission for</p>
              </div>
            </div>
            <div className="p-4">
              {rides.length === 0 ? (
                <div className="text-center py-10">
                  <Package className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
                  <p className="text-sm font-medium text-muted-foreground">No assets found</p>
                  <p className="text-xs text-muted-foreground mt-1">Add equipment to start building compliance packs</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {rides.map(ride => {
                    const docCount = ride.documents.length;
                    const rideCheckRecords = checkRecords.filter(doc => doc.ride_id === ride.id);
                    const totalDocs = docCount + rideCheckRecords.length;
                    
                    // Compliance status based on expiring docs
                    const hasExpired = ride.documents.some(d => d.expires_at && new Date(d.expires_at) < new Date());
                    const hasExpiringSoon = ride.documents.some(d => d.expires_at && isExpiringSoon(d.expires_at));
                    const complianceStatus = hasExpired ? 'overdue' : hasExpiringSoon ? 'expiring' : 'compliant';
                    
                    const statusConfig = {
                      overdue: { label: 'Doc Expiring', color: '#DC2626', bg: '#FEF2F2', icon: AlertTriangle },
                      expiring: { label: 'Expiring Soon', color: '#F59E0B', bg: '#FFFBEB', icon: Clock },
                      compliant: { label: 'All Current', color: '#16A34A', bg: '#F0FDF4', icon: CheckCircle2 },
                    }[complianceStatus];
                    
                    const StatusIcon = statusConfig.icon;

                    return (
                      <button
                        key={ride.id}
                        onClick={() => setSelectedRide(ride)}
                        className="w-full text-left group active:scale-[0.99] transition-all"
                      >
                        <div 
                          className="p-4 rounded-2xl border-2 transition-all group-hover:border-primary/40"
                          style={{ backgroundColor: 'hsl(210 40% 98%)', borderColor: 'hsl(215 19% 90%)', boxShadow: '0 2px 8px rgba(0,0,0,0.05)' }}
                        >
                          <div className="flex items-start gap-3">
                            <span className="flex items-center justify-center w-10 h-10 rounded-xl shrink-0" style={{ backgroundColor: 'hsl(217 91% 97%)' }}>
                              <ClipboardCheck className="h-5 w-5" style={{ color: 'hsl(213 52% 24%)' }} strokeWidth={2} />
                            </span>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center justify-between gap-2">
                                <p className="font-bold text-sm group-hover:text-primary transition-colors truncate" style={{ color: 'hsl(222 84% 5%)' }}>
                                  {ride.ride_name}
                                </p>
                                <span 
                                  className="inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-full shrink-0"
                                  style={{ backgroundColor: statusConfig.bg, color: statusConfig.color }}
                                >
                                  <StatusIcon className="h-3 w-3" strokeWidth={2} />
                                  {statusConfig.label}
                                </span>
                              </div>
                              {ride.manufacturer && (
                                <p className="text-xs mt-0.5 truncate" style={{ color: 'hsl(215 19% 50%)' }}>{ride.manufacturer}</p>
                              )}
                              <div className="flex items-center gap-3 mt-2.5">
                                <span className="inline-flex items-center gap-1 text-xs font-medium" style={{ color: 'hsl(215 19% 40%)' }}>
                                  <FileText className="h-3.5 w-3.5" strokeWidth={2} />
                                  {totalDocs} {totalDocs === 1 ? 'document' : 'documents'}
                                </span>
                              </div>
                            </div>
                          </div>
                          <div className="mt-3 pt-3 border-t flex items-center justify-between" style={{ borderColor: 'hsl(215 19% 92%)' }}>
                            <span className="text-xs font-semibold flex items-center gap-1.5 group-hover:text-primary transition-colors" style={{ color: 'hsl(213 52% 24%)' }}>
                              <Shield className="h-3.5 w-3.5" strokeWidth={2} />
                              Build Compliance Pack
                            </span>
                            <ChevronRight className="h-4 w-4 text-muted-foreground group-hover:text-primary transition-colors" />
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          {/* Global Documents Panel */}
          {globalDocuments.length > 0 && (
            <div 
              className="bg-white border border-border rounded-2xl p-4 flex items-center justify-between gap-3 cursor-pointer group hover:border-primary/40 transition-all"
              style={{ boxShadow: '0 2px 8px rgba(0,0,0,0.04)' }}
              onClick={() => {
                // Select all global docs and open send panel without a specific ride
                setSelectedRide({ id: '__global__', ride_name: 'Global Documents' });
              }}
            >
              <div className="flex items-center gap-3">
                <span className="flex items-center justify-center w-9 h-9 rounded-xl shrink-0" style={{ backgroundColor: 'hsl(213 52% 24% / 0.08)' }}>
                  <Building2 className="h-5 w-5" style={{ color: 'hsl(213 52% 24%)' }} strokeWidth={2} />
                </span>
                <div>
                  <p className="text-sm font-bold" style={{ color: 'hsl(222 84% 5%)' }}>Global Compliance Documents</p>
                  <p className="text-xs mt-0.5" style={{ color: 'hsl(215 19% 50%)' }}>Insurance, policies &amp; company-wide documents · {globalDocuments.length} files</p>
                </div>
              </div>
              <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground group-hover:text-primary transition-colors" />
            </div>
          )}
        </div>
      ) : (
        <>
          {/* Asset context strip */}
          <div className="mb-4 bg-white border border-border rounded-2xl p-4" style={{ boxShadow: '0 2px 6px rgba(0,0,0,0.04)' }}>
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-3 min-w-0">
                <span className="flex items-center justify-center w-9 h-9 rounded-xl shrink-0" style={{ backgroundColor: 'hsl(217 91% 97%)' }}>
                  <ClipboardCheck className="h-4.5 w-4.5" style={{ color: 'hsl(213 52% 24%)' }} strokeWidth={2} />
                </span>
                <div className="min-w-0">
                  <p className="text-xs font-medium" style={{ color: 'hsl(215 19% 40%)' }}>Asset</p>
                  <p className="text-sm font-semibold truncate" style={{ color: 'hsl(222 84% 5%)' }}>{selectedRide.ride_name}</p>
                </div>
                <div className="hidden sm:block h-8 w-px bg-border mx-1" />
                <div className="hidden sm:block">
                  <p className="text-xs font-medium" style={{ color: 'hsl(215 19% 40%)' }}>Available</p>
                  <p className="text-sm font-semibold" style={{ color: 'hsl(222 84% 5%)' }}>
                    {currentRideDocuments.length + currentRideCheckRecords.length} documents
                  </p>
                </div>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setSelectedRide(null);
                  setSelectedDocuments([]);
                }}
                className="gap-1.5 text-muted-foreground hover:text-foreground shrink-0 text-xs"
              >
                <ChevronRight className="h-3.5 w-3.5 rotate-180" />
                Change
              </Button>
            </div>

            {/* Selection summary bar */}
            {selectedDocuments.length > 0 && (
              <div className="mt-3 flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium" style={{ backgroundColor: 'hsl(217 91% 97%)', color: 'hsl(213 52% 24%)' }}>
                <FileText className="h-4 w-4 shrink-0" strokeWidth={2} />
                <span>{selectedDocuments.length} document{selectedDocuments.length !== 1 ? 's' : ''} selected</span>
                <span className="text-xs opacity-70">·</span>
                <span className="text-xs opacity-70">{formatFileSize(totalFileSize)}</span>
              </div>
            )}
          </div>

          <div className="grid lg:grid-cols-2 gap-4 md:gap-6">
            {/* Left Column - Document Selection */}
            <div className="space-y-4">
              <div className="bg-white border rounded-2xl overflow-hidden" style={{ boxShadow: '0 4px 14px rgba(0,0,0,0.08)', borderColor: 'hsl(215 19% 85%)' }}>
                <div className="px-5 py-4 border-b flex items-center justify-between gap-2" style={{ borderColor: 'hsl(215 19% 88%)', backgroundColor: 'hsl(210 30% 97%)' }}>
                  <p className="text-sm font-bold" style={{ color: 'hsl(222 84% 5%)' }}>Select Documents</p>
                  {selectedDocuments.length > 0 && (
                    <Badge variant="secondary" className="text-xs shrink-0 font-semibold">{selectedDocuments.length} selected</Badge>
                  )}
                </div>
                <div className="space-y-3 p-4">
                  {/* File size indicator */}
                  {selectedDocuments.length > 0 && (
                    <div className="flex items-center justify-between text-xs bg-secondary/50 border border-primary/20 rounded-lg px-2 sm:px-3 py-2">
                      <span className="text-muted-foreground">Total size:</span>
                      <Badge variant={exceedsEmailLimit ? "destructive" : "outline"} className="text-xs">
                        {formatFileSize(totalFileSize)}
                      </Badge>
                    </div>
                  )}

                  {/* Send method selector */}
                  {(exceedsEmailLimit || sendMethod !== 'auto') && (
                    <div className="bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800 rounded-lg p-3">
                      <div className="flex gap-2 text-blue-700 dark:text-blue-400 mb-3">
                        <Info className="h-4 w-4 mt-0.5 flex-shrink-0" />
                        <div className="text-xs">
                          <p className="font-medium">Large file size ({totalSizeMB.toFixed(1)}MB)</p>
                          <p className="text-muted-foreground mt-0.5">Choose how to send these documents</p>
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        <button
                          type="button"
                          onClick={() => setSendMethod('links')}
                          className={cn(
                            "flex items-center gap-2 p-2.5 rounded-lg border-2 transition-all text-left",
                            (sendMethod === 'links' || (sendMethod === 'auto' && exceedsEmailLimit))
                              ? "border-primary bg-primary/5 ring-1 ring-primary/20"
                              : "border-border hover:border-primary/50"
                          )}
                        >
                          <Link className="h-4 w-4 text-primary shrink-0" />
                          <div>
                            <p className="text-xs font-medium">Download Link</p>
                            <p className="text-[10px] text-muted-foreground">Recommended</p>
                          </div>
                        </button>
                        <button
                          type="button"
                          onClick={() => setSendMethod('attachments')}
                          className={cn(
                            "flex items-center gap-2 p-2.5 rounded-lg border-2 transition-all text-left",
                            sendMethod === 'attachments'
                              ? "border-primary bg-primary/5 ring-1 ring-primary/20"
                              : "border-border hover:border-primary/50"
                          )}
                        >
                          <Paperclip className="h-4 w-4 text-muted-foreground shrink-0" />
                          <div>
                            <p className="text-xs font-medium">Attachments</p>
                            <p className="text-[10px] text-muted-foreground">Multiple emails</p>
                          </div>
                        </button>
                      </div>
                      {(sendMethod === 'links' || (sendMethod === 'auto' && exceedsEmailLimit)) && (
                        <p className="text-[10px] text-muted-foreground mt-2 flex items-center gap-1">
                          <Link className="h-3 w-3" />
                          Recipient will receive a secure link valid for 7 days
                        </p>
                      )}
                    </div>
                  )}

                  {/* Check Records for this ride */}
                  {currentRideCheckRecords.length > 0 && (
                    <Collapsible open={checkRecordsExpanded} onOpenChange={setCheckRecordsExpanded}>
                      <div className="border-2 border-green-500/20 rounded-lg">
                        <CollapsibleTrigger className="w-full px-2 sm:px-4 py-2 sm:py-3 flex items-center justify-between hover:bg-green-500/5 transition-colors gap-2">
                          <div className="flex items-center gap-1.5 sm:gap-2 min-w-0">
                            <ClipboardCheck className="h-4 w-4 text-green-600 shrink-0" />
                            <span className="font-medium text-xs sm:text-sm truncate">Safety Check Records</span>
                            <Badge variant="outline" className="text-xs shrink-0 border-green-500/30 text-green-600">
                              {currentRideCheckRecords.length}
                            </Badge>
                          </div>
                          <div className="flex items-center gap-1 sm:gap-2 shrink-0">
                            <span 
                              role="button"
                              tabIndex={0}
                              className="h-6 sm:h-7 text-xs px-2 inline-flex items-center justify-center rounded-md hover:bg-accent hover:text-accent-foreground cursor-pointer"
                              onClick={(e) => {
                                e.stopPropagation();
                                const ids = currentRideCheckRecords.map(d => d.id);
                                const allSelected = ids.every(id => selectedDocuments.includes(id));
                                if (allSelected) {
                                  setSelectedDocuments(prev => prev.filter(id => !ids.includes(id)));
                                } else {
                                  setSelectedDocuments(prev => [...new Set([...prev, ...ids])]);
                                }
                              }}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter' || e.key === ' ') {
                                  e.stopPropagation();
                                  const ids = currentRideCheckRecords.map(d => d.id);
                                  const allSelected = ids.every(id => selectedDocuments.includes(id));
                                  if (allSelected) {
                                    setSelectedDocuments(prev => prev.filter(id => !ids.includes(id)));
                                  } else {
                                    setSelectedDocuments(prev => [...new Set([...prev, ...ids])]);
                                  }
                                }
                              }}
                            >
                              {currentRideCheckRecords.every(d => selectedDocuments.includes(d.id)) ? 'Deselect' : 'Select All'}
                            </span>
                            <ChevronDown className="h-4 w-4" />
                          </div>
                        </CollapsibleTrigger>
                        <CollapsibleContent>
                          <div className="px-3 pb-3 space-y-2">
                            {currentRideCheckRecords.map(doc => (
                              <label 
                                key={doc.id} 
                                className={`flex items-center gap-3 p-3.5 border-2 rounded-xl cursor-pointer transition-all bg-white ${selectedDocuments.includes(doc.id) ? 'border-green-500 bg-green-50/50' : 'border-border hover:border-green-400/50'}`}
                                style={{ boxShadow: selectedDocuments.includes(doc.id) ? '0 0 0 3px rgba(22,163,74,0.08)' : '0 2px 6px rgba(0,0,0,0.05)' }}
                              >
                                <Checkbox
                                  checked={selectedDocuments.includes(doc.id)}
                                  onCheckedChange={() => handleDocumentToggle(doc.id)}
                                  className="shrink-0"
                                />
                                <div className="flex items-center justify-center w-9 h-9 rounded-xl shrink-0" style={{ backgroundColor: 'hsl(142 76% 96%)' }}>
                                  <FileText className="h-4 w-4" style={{ color: 'hsl(142 76% 36%)' }} strokeWidth={2} />
                                </div>
                                <div className="flex-1 min-w-0">
                                  <p className="text-sm font-semibold break-words leading-tight" style={{ color: 'hsl(222 84% 5%)' }}>{doc.document_name}</p>
                                  <div className="flex items-center gap-2 flex-wrap mt-1.5">
                                    <span className="text-[11px]" style={{ color: 'hsl(215 19% 55%)' }}>
                                      {doc.uploaded_at && format(new Date(doc.uploaded_at), 'dd MMM yyyy')}
                                    </span>
                                    {doc.file_size && (
                                      <span className="text-[11px]" style={{ color: 'hsl(215 19% 55%)' }}>· {formatFileSize(doc.file_size)}</span>
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

                  {/* Ride Documents */}
                  {currentRideDocuments.length > 0 && (
                    <Collapsible defaultOpen>
                      <div className="border rounded-xl overflow-hidden" style={{ borderColor: 'hsl(215 19% 85%)' }}>
                        <CollapsibleTrigger className="w-full px-4 py-3 flex items-center justify-between hover:bg-secondary/50 transition-colors gap-2 bg-white">
                          <div className="flex items-center gap-2 min-w-0">
                            <span className="flex items-center justify-center w-6 h-6 rounded-lg" style={{ backgroundColor: 'hsl(217 91% 97%)' }}>
                              <FileText className="h-3.5 w-3.5" style={{ color: 'hsl(213 52% 24%)' }} strokeWidth={2} />
                            </span>
                            <span className="font-semibold text-xs" style={{ color: 'hsl(222 84% 5%)' }}>Documents</span>
                            <Badge variant="outline" className="text-xs shrink-0">{currentRideDocuments.length}</Badge>
                          </div>
                          <div className="flex items-center gap-1 shrink-0">
                            <span 
                              role="button"
                              tabIndex={0}
                              className="h-6 text-xs px-2 inline-flex items-center justify-center rounded-md hover:bg-secondary text-muted-foreground cursor-pointer"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleSelectAllRide(selectedRide.id, currentRideDocuments);
                              }}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter' || e.key === ' ') {
                                  e.stopPropagation();
                                  handleSelectAllRide(selectedRide.id, currentRideDocuments);
                                }
                              }}
                            >
                              <span className="hidden sm:inline">{currentRideDocuments.every(d => selectedDocuments.includes(d.id)) ? 'Deselect All' : 'Select All'}</span>
                              <span className="sm:hidden">{currentRideDocuments.every(d => selectedDocuments.includes(d.id)) ? 'None' : 'All'}</span>
                            </span>
                            <ChevronDown className="h-4 w-4" />
                          </div>
                        </CollapsibleTrigger>
                        <CollapsibleContent>
                         <div className="p-3 pt-2 space-y-2">
                            {currentRideDocuments.map(doc => (
                              <label 
                                key={doc.id} 
                                className={`flex items-center gap-3 p-3.5 border-2 rounded-xl cursor-pointer transition-all bg-white ${selectedDocuments.includes(doc.id) ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/40'}`}
                                style={{ boxShadow: selectedDocuments.includes(doc.id) ? '0 0 0 3px rgba(30,58,95,0.08)' : '0 2px 6px rgba(0,0,0,0.05)' }}
                              >
                                <Checkbox
                                  checked={selectedDocuments.includes(doc.id)}
                                  onCheckedChange={() => handleDocumentToggle(doc.id)}
                                  className="shrink-0"
                                />
                                <div className="flex items-center justify-center w-9 h-9 rounded-xl shrink-0" style={{ backgroundColor: selectedDocuments.includes(doc.id) ? 'hsl(213 52% 24% / 0.12)' : 'hsl(217 91% 97%)' }}>
                                  <FileText className="h-4 w-4" style={{ color: 'hsl(213 52% 24%)' }} strokeWidth={2} />
                                </div>
                                <div className="flex-1 min-w-0">
                                  <p className="text-sm font-semibold break-words leading-tight" style={{ color: 'hsl(222 84% 5%)' }}>{doc.document_name}</p>
                                  <div className="flex items-center gap-2 flex-wrap mt-1.5">
                                    <span className="text-[11px] font-medium px-1.5 py-0.5 rounded-md" style={{ backgroundColor: 'hsl(215 19% 95%)', color: 'hsl(215 19% 40%)' }}>{doc.document_type}</span>
                                    {doc.expires_at && isExpiringSoon(doc.expires_at) && (
                                      <Badge variant="destructive" className="text-[10px]">Expiring</Badge>
                                    )}
                                    {doc.file_size && (
                                      <span className="text-[11px]" style={{ color: 'hsl(215 19% 55%)' }}>{formatFileSize(doc.file_size)}</span>
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

                  {/* Global Documents - always available */}
                  {globalDocuments.length > 0 && (
                    <Collapsible defaultOpen={currentRideDocuments.length === 0}>
                      <div className="border rounded-xl overflow-hidden" style={{ backgroundColor: 'hsl(210 40% 98%)', borderColor: 'hsl(215 19% 85%)' }}>
                        <CollapsibleTrigger className="w-full px-4 py-3 flex items-center justify-between hover:bg-secondary/50 transition-colors gap-2">
                          <div className="flex items-center gap-2 min-w-0">
                            <span className="flex items-center justify-center w-6 h-6 rounded-lg" style={{ backgroundColor: 'hsl(213 52% 24% / 0.1)' }}>
                              <Building2 className="h-3.5 w-3.5 shrink-0" style={{ color: 'hsl(213 52% 24%)' }} strokeWidth={2} />
                            </span>
                            <span className="font-semibold text-xs" style={{ color: 'hsl(222 84% 5%)' }}>Global Compliance Documents</span>
                            <Badge variant="outline" className="text-xs shrink-0">{globalDocuments.length}</Badge>
                          </div>
                          <div className="flex items-center gap-1 shrink-0">
                            <span 
                              role="button"
                              tabIndex={0}
                              className="h-6 text-xs px-2 inline-flex items-center justify-center rounded-md hover:bg-secondary text-muted-foreground cursor-pointer"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleSelectAllGlobal();
                              }}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter' || e.key === ' ') {
                                  e.stopPropagation();
                                  handleSelectAllGlobal();
                                }
                              }}
                            >
                              <span className="hidden sm:inline">{globalDocuments.every(d => selectedDocuments.includes(d.id)) ? 'Deselect All' : 'Select All'}</span>
                              <span className="sm:hidden">{globalDocuments.every(d => selectedDocuments.includes(d.id)) ? 'None' : 'All'}</span>
                            </span>
                            <ChevronDown className="h-4 w-4" />
                          </div>
                        </CollapsibleTrigger>
                        <CollapsibleContent>
                          <div className="p-3 space-y-2">
                            {globalDocuments.map(doc => (
                              <label 
                                key={doc.id} 
                                className="flex items-start gap-3 p-3 border border-border rounded-xl cursor-pointer hover:border-primary/50 hover:bg-secondary/50 transition-all bg-white"
                                style={{ boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}
                              >
                                <Checkbox
                                  checked={selectedDocuments.includes(doc.id)}
                                  onCheckedChange={() => handleDocumentToggle(doc.id)}
                                  className="mt-0.5 shrink-0"
                                />
                                <div className="flex items-center justify-center w-7 h-7 rounded-lg shrink-0" style={{ backgroundColor: 'hsl(213 52% 24% / 0.08)' }}>
                                  <Building2 className="h-3.5 w-3.5" style={{ color: 'hsl(213 52% 24%)' }} strokeWidth={2} />
                                </div>
                                <div className="flex-1 min-w-0">
                                  <p className="text-xs font-semibold break-words leading-tight" style={{ color: 'hsl(222 84% 5%)' }}>{doc.document_name}</p>
                                  <div className="flex items-center gap-2 flex-wrap mt-1">
                                    <Badge variant="outline" className="text-[10px]">{doc.document_type}</Badge>
                                    {doc.expires_at && isExpiringSoon(doc.expires_at) && (
                                      <Badge variant="destructive" className="text-[10px]">Expiring</Badge>
                                    )}
                                    {doc.file_size && (
                                      <span className="text-[11px]" style={{ color: 'hsl(215 19% 50%)' }}>{formatFileSize(doc.file_size)}</span>
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

                  {/* Empty state */}
                  {currentRideDocuments.length === 0 && currentRideCheckRecords.length === 0 && globalDocuments.length === 0 && (
                    <div className="text-center py-8">
                      <FileText className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
                      <p className="text-sm text-muted-foreground">No documents available</p>
                      <p className="text-xs text-muted-foreground mt-1">Upload documents to this item first</p>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Right Column - Recipient & Send */}
            <div className="space-y-4">
              {/* Sender Info */}
              <div className="bg-white border rounded-2xl overflow-hidden" style={{ boxShadow: '0 4px 14px rgba(0,0,0,0.08)', borderColor: 'hsl(215 19% 85%)' }}>
                <div className="px-5 py-4 border-b flex items-center gap-3" style={{ borderColor: 'hsl(215 19% 88%)', backgroundColor: 'hsl(210 30% 97%)' }}>
                  <span className="flex items-center justify-center w-7 h-7 rounded-lg shrink-0" style={{ backgroundColor: 'hsl(213 52% 24% / 0.12)' }}>
                    <Users className="h-3.5 w-3.5" style={{ color: 'hsl(213 52% 24%)' }} strokeWidth={2} />
                  </span>
                  <p className="text-sm font-bold" style={{ color: 'hsl(222 84% 5%)' }}>Your Information</p>
                </div>
                <div className="px-5 py-4">
                  <div className="text-xs space-y-1.5" style={{ color: 'hsl(215 19% 40%)' }}>
                    {profile?.company_name && (
                      <p className="break-words"><span className="font-semibold" style={{ color: 'hsl(222 84% 5%)' }}>Company:</span> {profile.company_name}</p>
                    )}
                    {profile?.controller_name && (
                      <p className="break-words"><span className="font-semibold" style={{ color: 'hsl(222 84% 5%)' }}>Controller:</span> {profile.controller_name}</p>
                    )}
                    {user?.email && (
                      <p className="break-words"><span className="font-semibold" style={{ color: 'hsl(222 84% 5%)' }}>Email:</span> {user.email}</p>
                    )}
                    {!isStaff && !profile?.company_name && !profile?.controller_name && (
                      <p className="text-destructive italic">Please complete your profile in Settings</p>
                    )}
                  </div>
                </div>
              </div>

              {/* Saved Recipients */}
              {savedRecipients.length > 0 && (
                <div className="bg-white border rounded-2xl overflow-hidden" style={{ boxShadow: '0 4px 14px rgba(0,0,0,0.08)', borderColor: 'hsl(215 19% 85%)' }}>
                  <div className="px-5 py-4 border-b flex items-center gap-3" style={{ borderColor: 'hsl(215 19% 88%)', backgroundColor: 'hsl(210 30% 97%)' }}>
                    <span className="flex items-center justify-center w-7 h-7 rounded-lg shrink-0" style={{ backgroundColor: 'hsl(213 52% 24% / 0.12)' }}>
                      <BookUser className="h-3.5 w-3.5" style={{ color: 'hsl(213 52% 24%)' }} strokeWidth={2} />
                    </span>
                    <p className="text-sm font-bold" style={{ color: 'hsl(222 84% 5%)' }}>Saved Recipients</p>
                  </div>
                  <div className="px-5 py-4">
                    <div className="space-y-2 max-h-48 overflow-y-auto">
                      {savedRecipients.map(recipient => (
                        <div 
                          key={recipient.id}
                          className="flex items-center gap-2 p-3 border border-border rounded-xl hover:border-primary/50 hover:bg-secondary/50 cursor-pointer group transition-all"
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
                            <p className="text-xs font-semibold truncate" style={{ color: 'hsl(222 84% 5%)' }}>{recipient.name}</p>
                            <p className="text-xs truncate" style={{ color: 'hsl(215 19% 50%)' }}>{recipient.email}</p>
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
                  </div>
                </div>
              )}

              {/* Recipient Form */}
              <div className="bg-white border rounded-2xl overflow-hidden" style={{ boxShadow: '0 4px 14px rgba(0,0,0,0.08)', borderColor: 'hsl(215 19% 85%)' }}>
                <div className="px-5 py-4 border-b flex items-center justify-between gap-2" style={{ borderColor: 'hsl(215 19% 88%)', backgroundColor: 'hsl(210 30% 97%)' }}>
                  <div className="flex items-center gap-3">
                    <span className="flex items-center justify-center w-7 h-7 rounded-lg shrink-0" style={{ backgroundColor: 'hsl(213 52% 24% / 0.12)' }}>
                      <Mail className="h-3.5 w-3.5" style={{ color: 'hsl(213 52% 24%)' }} strokeWidth={2} />
                    </span>
                    <p className="text-sm font-bold" style={{ color: 'hsl(222 84% 5%)' }}>Recipient Details</p>
                  </div>
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
                              <SelectItem value="council">{terminology.isUK ? 'Local Council' : 'Local Authority'}</SelectItem>
                              <SelectItem value="guild">{terminology.isUK ? 'Guild / Trade Association' : 'Trade Association'}</SelectItem>
                              <SelectItem value="insurer">Insurance Company</SelectItem>
                              <SelectItem value="inspector">Inspection Body</SelectItem>
                            <SelectItem value="regulatory_body">Regulatory Body</SelectItem>
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
                <div className="space-y-4 px-5 py-4">
              <div>
                <Label htmlFor="recipientEmail" className="text-[13px] font-semibold">Email Address *</Label>
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
                <Label htmlFor="recipientName" className="text-[13px] font-semibold">Name / Organization</Label>
                <Input
                  id="recipientName"
                  value={recipientName}
                  onChange={(e) => setRecipientName(e.target.value)}
                  placeholder="Local Authority, Trade Association, etc."
                  className="mt-1.5"
                />
              </div>
              <div>
                <div className="flex items-center justify-between gap-2 mb-1.5">
                  <Label htmlFor="message" className="text-[13px] font-semibold">Message (Optional)</Label>
                  <div className="flex items-center gap-1">
                    {emailTemplates.length > 0 && (
                      <Select onValueChange={handleSelectTemplate}>
                        <SelectTrigger className="h-7 text-xs w-auto min-w-[100px]">
                          <SelectValue placeholder="Use template" />
                        </SelectTrigger>
                        <SelectContent>
                          {emailTemplates.map(template => (
                            <SelectItem key={template.id} value={template.id} className="text-xs">
                              <div className="flex items-center gap-1">
                                {template.is_default && <Star className="h-3 w-3 fill-yellow-400 text-yellow-400" />}
                                {template.name}
                              </div>
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    )}
                    <Dialog open={showSaveTemplateDialog} onOpenChange={setShowSaveTemplateDialog}>
                      <DialogTrigger asChild>
                        <Button 
                          variant="ghost" 
                          size="sm" 
                          className="h-7 text-xs px-2"
                          disabled={!message}
                        >
                          <Plus className="h-3 w-3 mr-1" />
                          <span className="hidden sm:inline">Save</span>
                        </Button>
                      </DialogTrigger>
                      <DialogContent className="max-w-sm">
                        <DialogHeader>
                          <DialogTitle>Save Email Template</DialogTitle>
                        </DialogHeader>
                        <div className="space-y-4 pt-2">
                          <div>
                            <Label className="text-sm">Template Name *</Label>
                            <Input 
                              value={newTemplateName} 
                              onChange={(e) => setNewTemplateName(e.target.value)}
                              placeholder="e.g., Council Submission"
                              className="mt-1.5" 
                            />
                          </div>
                          <div>
                            <Label className="text-sm">Message Preview</Label>
                            <div className="mt-1.5 p-2 bg-muted rounded text-xs max-h-24 overflow-y-auto">
                              {message || 'No message entered'}
                            </div>
                          </div>
                          <div>
                            <Label className="text-sm">Recipient Type (Optional)</Label>
                            <Select value={newTemplateType} onValueChange={setNewTemplateType}>
                              <SelectTrigger className="mt-1.5">
                                <SelectValue placeholder="Select type..." />
                              </SelectTrigger>
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
                          <Button onClick={handleSaveTemplate} className="w-full">
                            Save Template
                          </Button>
                        </div>
                      </DialogContent>
                    </Dialog>
                  </div>
                </div>
                <Textarea
                  id="message"
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  placeholder="Please find attached the requested documentation for our equipment..."
                  className="resize-none"
                  rows={3}
                />
              </div>

              {/* Saved Templates List */}
              {emailTemplates.length > 0 && (
                <Collapsible>
                  <CollapsibleTrigger className="flex items-center gap-2 text-xs text-muted-foreground hover:text-foreground transition-colors">
                    <ChevronRight className="h-3 w-3" />
                    Manage {emailTemplates.length} saved template{emailTemplates.length !== 1 ? 's' : ''}
                  </CollapsibleTrigger>
                  <CollapsibleContent className="pt-2">
                    <div className="space-y-1.5 max-h-32 overflow-y-auto">
                      {emailTemplates.map(template => (
                        <div 
                          key={template.id}
                          className="flex items-center gap-2 p-2 border rounded text-xs group"
                        >
                          <button
                            onClick={() => handleToggleDefaultTemplate(template.id, template.is_default)}
                            className="shrink-0"
                          >
                            <Star className={`h-3 w-3 ${template.is_default ? 'fill-yellow-400 text-yellow-400' : 'text-muted-foreground'}`} />
                          </button>
                          <div className="flex-1 min-w-0">
                            <p className="font-medium truncate">{template.name}</p>
                            {template.recipient_type && (
                              <Badge variant="outline" className="text-xs mt-0.5">{template.recipient_type}</Badge>
                            )}
                          </div>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-6 px-2 text-xs"
                            onClick={() => handleSelectTemplate(template.id)}
                          >
                            Use
                          </Button>
                          <button
                            onClick={() => handleDeleteTemplate(template.id)}
                            className="opacity-0 group-hover:opacity-100 transition-opacity shrink-0"
                          >
                            <Trash2 className="h-3 w-3 text-destructive" />
                          </button>
                        </div>
                      ))}
                    </div>
                  </CollapsibleContent>
                </Collapsible>
              )}

              <div className="h-px bg-border" />

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
                    Send Compliance Pack{selectedDocuments.length > 0 ? ` (${selectedDocuments.length})` : ''}
                  </>
                )}
              </Button>

              {/* Compliance reassurance footer */}
              <div className="flex items-center justify-center gap-4 pt-1">
                <span className="text-[11px] flex items-center gap-1" style={{ color: 'hsl(215 19% 50%)' }}>
                  <span className="text-success">✓</span> Secure transmission
                </span>
                <span className="text-[11px] flex items-center gap-1" style={{ color: 'hsl(215 19% 50%)' }}>
                  <span className="text-success">✓</span> PDF bundle generated
                </span>
                <span className="text-[11px] flex items-center gap-1" style={{ color: 'hsl(215 19% 50%)' }}>
                  <span className="text-success">✓</span> Audit log recorded
                </span>
              </div>
                </div>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
};

export default BatchSendDocuments;
