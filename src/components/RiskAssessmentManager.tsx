import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Checkbox } from '@/components/ui/checkbox';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { toast } from '@/hooks/use-toast';
import { Plus, Trash2, Download, Mail, CalendarIcon, Info, ChevronDown, ChevronUp, Save, FileText, ArrowLeft, Pencil, History, Send, Loader2, User, AlertTriangle, CheckCircle2, Grid3x3, Filter } from 'lucide-react';
import { format } from 'date-fns';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Alert, AlertDescription } from '@/components/ui/alert';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import {
  PDF_COLORS,
  generateDocId,
  buildFileName,
  blobToDataUrl,
  drawPDFHeader,
  drawSectionTitle,
  drawEquipmentDetails,
  drawSummaryBox,
  PDF_TABLE_HEAD_STYLES,
  PDF_TABLE_BODY_STYLES,
  PDF_TABLE_ALT_ROW,
  drawAllPageFooters,
  drawComplianceStatement,
} from '@/utils/pdfUtils';
import { cn } from '@/lib/utils';
import { useTerminology } from '@/hooks/useTerminology';
import { WhoAtRiskSelector } from './risk-assessment/WhoAtRiskSelector';
import { RiskEvaluationPanel, RiskSettings } from './risk-assessment/RiskEvaluationPanel';
import { calculateRisk, LikelihoodKey, SeverityKey, LIKELIHOOD_SCORES, SEVERITY_SCORES } from './risk-assessment/RiskScoring';
import { RiskSettingsDialog, DEFAULT_RISK_SETTINGS } from './risk-assessment/RiskSettingsDialog';
import { RiskDisclaimer } from './risk-assessment/RiskDisclaimer';
import { RiskItemCard } from './risk-assessment/RiskItemCard';

interface RiskAssessmentManagerProps {
  ride: {
    id: string;
    ride_name: string;
    manufacturer?: string;
    year_manufactured?: number;
    serial_number?: string;
    owner_name?: string;
  };
}

interface RiskAssessment {
  id: string;
  assessment_date: string;
  assessor_name: string;
  review_date?: string;
  overall_status: string;
  notes?: string;
  revision_number?: number;
  last_modified_by?: string;
  last_modified_at?: string;
}

interface RiskAssessmentItem {
  id: string;
  hazard_description: string;
  who_at_risk: string;
  existing_controls?: string;
  risk_level: string;
  likelihood: string;
  severity: string;
  additional_actions?: string;
  action_owner?: string;
  target_date?: string;
  status: string;
  sort_order: number;
  is_manually_overridden?: boolean;
}

interface AuditLogEntry {
  id: string;
  action: string;
  changed_by: string;
  changed_at: string;
  notes?: string;
}

export const RiskAssessmentManager: React.FC<RiskAssessmentManagerProps> = ({ ride }) => {
  const { user } = useAuth();
  const { terminology } = useTerminology();
  const [assessments, setAssessments] = useState<RiskAssessment[]>([]);
  const [selectedAssessment, setSelectedAssessment] = useState<RiskAssessment | null>(null);
  const [assessmentItems, setAssessmentItems] = useState<RiskAssessmentItem[]>([]);
  const [showNewAssessment, setShowNewAssessment] = useState(false);
  const [showEditAssessment, setShowEditAssessment] = useState(false);
  const [showItemDialog, setShowItemDialog] = useState(false);
  const [showEmailDialog, setShowEmailDialog] = useState(false);
  const [showAuditHistory, setShowAuditHistory] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [assessmentToDelete, setAssessmentToDelete] = useState<RiskAssessment | null>(null);
  const [editingItem, setEditingItem] = useState<RiskAssessmentItem | null>(null);
  const [loading, setLoading] = useState(true);
  const [sendingEmail, setSendingEmail] = useState(false);
  const [savingItem, setSavingItem] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [profile, setProfile] = useState<any>(null);
  const [ridePhotoUrl, setRidePhotoUrl] = useState<string | null>(null);
  const [useCustomHazard, setUseCustomHazard] = useState(false);
  const [useCustomControls, setUseCustomControls] = useState(false);
  const [auditLog, setAuditLog] = useState<AuditLogEntry[]>([]);
  const [riskSettings, setRiskSettings] = useState<RiskSettings>(DEFAULT_RISK_SETTINGS);
  const [savingRiskSettings, setSavingRiskSettings] = useState(false);

  const [emailFormData, setEmailFormData] = useState({
    recipientEmail: '',
    recipientName: '',
    message: ''
  });

  const [formData, setFormData] = useState({
    assessor_name: '',
    assessment_date: format(new Date(), 'yyyy-MM-dd'),
    review_date: '',
    overall_status: 'in_progress',
    notes: ''
  });

  const [itemFormData, setItemFormData] = useState<Partial<RiskAssessmentItem> & { 
    hazard_description: string;
    who_at_risk: string;
    risk_level: string;
    likelihood: string;
    severity: string;
    status: string;
  }>({
    hazard_description: '',
    who_at_risk: '',
    existing_controls: '',
    risk_level: 'medium',
    likelihood: 'possible',
    severity: 'moderate',
    additional_actions: '',
    action_owner: '',
    target_date: '',
    status: 'open'
  });

  const [useManualRiskOverride, setUseManualRiskOverride] = useState(false);

  useEffect(() => {
    loadAssessments();
    loadProfile();
    loadRidePhoto();
  }, [ride.id, user]);

  useEffect(() => {
    if (selectedAssessment) {
      loadAssessmentItems();
    }
  }, [selectedAssessment]);

  const loadProfile = async () => {
    if (!user) return;
    const { data } = await supabase
      .from('profiles')
      .select('*')
      .eq('user_id', user.id)
      .single();
    if (data) {
      setProfile(data);
      // Load risk settings from profile
      if (data.risk_settings && typeof data.risk_settings === 'object' && !Array.isArray(data.risk_settings)) {
        const rs = data.risk_settings as Record<string, unknown>;
        setRiskSettings({
          existingControlsReduction: typeof rs.existingControlsReduction === 'number' ? rs.existingControlsReduction : 20,
          additionalActionsReduction: typeof rs.additionalActionsReduction === 'number' ? rs.additionalActionsReduction : 15,
        });
      }
    }
  };

  const handleSaveRiskSettings = async (settings: RiskSettings) => {
    if (!user) return;
    
    setSavingRiskSettings(true);
    const { error } = await supabase
      .from('profiles')
      .update({ 
        risk_settings: {
          existingControlsReduction: settings.existingControlsReduction,
          additionalActionsReduction: settings.additionalActionsReduction,
        } 
      })
      .eq('user_id', user.id);

    if (error) {
      toast({ title: 'Error saving settings', description: error.message, variant: 'destructive' });
    } else {
      setRiskSettings(settings);
      toast({ title: 'Settings saved', description: 'Risk calculation settings updated' });
    }
    setSavingRiskSettings(false);
  };

  const loadRidePhoto = async () => {
    if (!user) return;
    
    // Find the primary device photo
    const { data: docs } = await supabase
      .from('documents')
      .select('file_path')
      .eq('ride_id', ride.id)
      .eq('user_id', user.id)
      .or('notes.eq.Primary device photo,document_type.ilike.%photo%')
      .order('uploaded_at', { ascending: false })
      .limit(1);
    
    if (docs && docs.length > 0) {
      // Generate a signed URL that expires in 1 hour
      const { data } = await supabase.storage
        .from('ride-documents')
        .createSignedUrl(docs[0].file_path, 3600);
      
      if (data?.signedUrl) {
        setRidePhotoUrl(data.signedUrl);
      }
    }
  };

  const loadAssessments = async () => {
    if (!user) return;
    
    setLoading(true);
    const { data, error } = await supabase
      .from('risk_assessments')
      .select('*')
      .eq('ride_id', ride.id)
      .order('assessment_date', { ascending: false });

    if (error) {
      toast({ title: 'Error loading risk assessments', description: error.message, variant: 'destructive' });
    } else {
      setAssessments(data || []);
    }
    setLoading(false);
  };

  const loadAssessmentItems = async () => {
    if (!selectedAssessment) return;

    const { data, error } = await supabase
      .from('risk_assessment_items')
      .select('*')
      .eq('risk_assessment_id', selectedAssessment.id)
      .order('sort_order');

    if (error) {
      toast({ title: 'Error loading items', description: error.message, variant: 'destructive' });
    } else {
      setAssessmentItems(data || []);
    }
  };

  const handleCreateAssessment = async () => {
    if (!user) return;

    // Prepare data, converting empty strings to null for date fields
    const insertData = {
      user_id: user.id,
      ride_id: ride.id,
      assessor_name: formData.assessor_name,
      assessment_date: formData.assessment_date,
      review_date: formData.review_date || null,
      overall_status: formData.overall_status,
      notes: formData.notes || null
    };

    const { data, error } = await supabase
      .from('risk_assessments')
      .insert(insertData)
      .select()
      .single();

    if (error) {
      toast({ title: 'Error creating assessment', description: error.message, variant: 'destructive' });
    } else {
      toast({ title: 'Success', description: 'Risk assessment created' });
      setShowNewAssessment(false);
      setFormData({
        assessor_name: '',
        assessment_date: format(new Date(), 'yyyy-MM-dd'),
        review_date: '',
        overall_status: 'in_progress',
        notes: ''
      });
      loadAssessments();
      setSelectedAssessment(data);
    }
  };

  const handleSaveItem = async () => {
    if (!selectedAssessment || savingItem) return;

    // Validate: if additional actions are specified, require action owner and target date
    if (itemFormData.additional_actions && itemFormData.additional_actions.trim()) {
      if (!itemFormData.action_owner || !itemFormData.action_owner.trim()) {
        toast({ 
          title: 'Action Owner Required', 
          description: 'Please specify who is responsible for completing the additional actions.',
          variant: 'destructive' 
        });
        return;
      }
      if (!itemFormData.target_date) {
        toast({ 
          title: 'Target Date Required', 
          description: 'Please set a due date for completing the additional actions.',
          variant: 'destructive' 
        });
        return;
      }
    }

    setSavingItem(true);

    // Calculate risk level if not using manual override
    let finalRiskLevel = itemFormData.risk_level;
    if (!useManualRiskOverride) {
      const calculation = calculateRisk(
        itemFormData.likelihood as LikelihoodKey,
        itemFormData.severity as SeverityKey,
        itemFormData.existing_controls,
        itemFormData.additional_actions,
        riskSettings.existingControlsReduction,
        riskSettings.additionalActionsReduction
      );
      finalRiskLevel = calculation.residualLevel;
    }

    // Convert empty strings to null for date fields
    const itemData = {
      ...itemFormData,
      risk_level: finalRiskLevel,
      target_date: itemFormData.target_date || null,
      is_manually_overridden: useManualRiskOverride
    };

    try {
      // Submit custom hazards and controls for admin review
      const submitCustomItems = async () => {
        if (!user || !selectedAssessment) return;
        
        // Check if hazard is custom (not in predefined list)
        if (useCustomHazard && itemFormData.hazard_description?.trim()) {
          await supabase.from('user_submitted_risk_items').insert({
            user_id: user.id,
            item_type: 'hazard',
            label: itemFormData.hazard_description.trim(),
            category: 'General',
            source_assessment_id: selectedAssessment.id
          });
        }
        
        // Check if control is custom
        if (useCustomControls && itemFormData.existing_controls?.trim()) {
          await supabase.from('user_submitted_risk_items').insert({
            user_id: user.id,
            item_type: 'control',
            label: itemFormData.existing_controls.trim(),
            category: 'General',
            source_assessment_id: selectedAssessment.id
          });
        }
      };

      if (editingItem) {
        const { error } = await supabase
          .from('risk_assessment_items')
          .update(itemData)
          .eq('id', editingItem.id);

        if (error) {
          toast({ title: 'Error updating item', description: error.message, variant: 'destructive' });
        } else {
          await submitCustomItems();
          toast({ title: 'Success', description: 'Risk item updated' });
          setShowItemDialog(false);
          setEditingItem(null);
          resetItemForm();
          setUseManualRiskOverride(false);
          loadAssessmentItems();
        }
      } else {
        const { error } = await supabase
          .from('risk_assessment_items')
          .insert({
            risk_assessment_id: selectedAssessment.id,
            sort_order: assessmentItems.length,
            ...itemData
          });

        if (error) {
          toast({ title: 'Error adding item', description: error.message, variant: 'destructive' });
        } else {
          await submitCustomItems();
          toast({ title: 'Success', description: 'Risk item added' });
          setShowItemDialog(false);
          resetItemForm();
          setUseManualRiskOverride(false);
          loadAssessmentItems();
        }
      }
    } finally {
      setSavingItem(false);
    }
  };

  const handleDeleteItem = async (itemId: string) => {
    const { error } = await supabase
      .from('risk_assessment_items')
      .delete()
      .eq('id', itemId);

    if (error) {
      toast({ title: 'Error deleting item', description: error.message, variant: 'destructive' });
    } else {
      toast({ title: 'Success', description: 'Risk item deleted' });
      loadAssessmentItems();
    }
  };

  const handleDeleteAssessment = async () => {
    if (!assessmentToDelete || deleting) return;
    
    // Only allow deletion of non-completed assessments
    if (assessmentToDelete.overall_status === 'completed') {
      toast({ 
        title: 'Cannot delete', 
        description: 'Completed assessments cannot be deleted as they form part of your audit trail.',
        variant: 'destructive' 
      });
      setShowDeleteConfirm(false);
      setAssessmentToDelete(null);
      return;
    }

    setDeleting(true);
    
    try {
      // First delete any associated items
      await supabase
        .from('risk_assessment_items')
        .delete()
        .eq('risk_assessment_id', assessmentToDelete.id);
      
      // Then delete the assessment itself
      const { error } = await supabase
        .from('risk_assessments')
        .delete()
        .eq('id', assessmentToDelete.id);

      if (error) {
        toast({ title: 'Error deleting assessment', description: error.message, variant: 'destructive' });
      } else {
        toast({ title: 'Success', description: 'Risk assessment deleted' });
        loadAssessments();
      }
    } finally {
      setDeleting(false);
      setShowDeleteConfirm(false);
      setAssessmentToDelete(null);
    }
  };

  const handleStatusChange = async (newStatus: string) => {
    if (!selectedAssessment) return;

    const oldStatus = selectedAssessment.overall_status;
    
    const { error } = await supabase
      .from('risk_assessments')
      .update({ 
        overall_status: newStatus,
        last_modified_by: profile?.controller_name || user?.email || 'Unknown',
        last_modified_at: new Date().toISOString()
      })
      .eq('id', selectedAssessment.id);

    if (error) {
      toast({ title: 'Error updating status', description: error.message, variant: 'destructive' });
    } else {
      // Log to audit trail
      await supabase.from('risk_assessment_audit_log').insert({
        risk_assessment_id: selectedAssessment.id,
        action: 'status_changed',
        changed_by: profile?.controller_name || user?.email || 'Unknown',
        notes: `Status changed from "${oldStatus}" to "${newStatus}"`
      });
      
      setSelectedAssessment({ ...selectedAssessment, overall_status: newStatus });
      toast({ title: 'Success', description: 'Assessment status updated' });
      loadAssessments();
    }
  };

  const handleEditAssessment = async () => {
    if (!selectedAssessment || !user) return;

    const oldData = {
      assessor_name: selectedAssessment.assessor_name,
      assessment_date: selectedAssessment.assessment_date,
      notes: selectedAssessment.notes
    };

    const { error } = await supabase
      .from('risk_assessments')
      .update({
        assessor_name: formData.assessor_name,
        assessment_date: formData.assessment_date,
        review_date: formData.review_date || null,
        notes: formData.notes || null,
        revision_number: (selectedAssessment.revision_number || 1) + 1,
        last_modified_by: profile?.controller_name || user.email || 'Unknown',
        last_modified_at: new Date().toISOString()
      })
      .eq('id', selectedAssessment.id);

    if (error) {
      toast({ title: 'Error updating assessment', description: error.message, variant: 'destructive' });
    } else {
      // Log to audit trail
      await supabase.from('risk_assessment_audit_log').insert({
        risk_assessment_id: selectedAssessment.id,
        action: 'edited',
        changed_by: profile?.controller_name || user.email || 'Unknown',
        old_values: oldData,
        new_values: {
          assessor_name: formData.assessor_name,
          assessment_date: formData.assessment_date,
          notes: formData.notes
        },
        notes: `Revision ${(selectedAssessment.revision_number || 1) + 1}`
      });

      toast({ title: 'Success', description: 'Assessment updated' });
      setShowEditAssessment(false);
      loadAssessments();
      
      // Refresh selected assessment
      const { data } = await supabase
        .from('risk_assessments')
        .select('*')
        .eq('id', selectedAssessment.id)
        .single();
      if (data) setSelectedAssessment(data);
    }
  };

  const loadAuditLog = async () => {
    if (!selectedAssessment) return;
    
    const { data, error } = await supabase
      .from('risk_assessment_audit_log')
      .select('*')
      .eq('risk_assessment_id', selectedAssessment.id)
      .order('changed_at', { ascending: false });

    if (!error && data) {
      setAuditLog(data);
    }
  };

  // Helper function to fetch company logo
  const fetchCompanyLogo = async (): Promise<string | null> => {
    if (!profile?.company_logo_path) return null;
    try {
      const { data: logoBlob } = await supabase.storage
        .from('ride-documents')
        .download(profile.company_logo_path);
      if (logoBlob) {
        return await new Promise<string>((resolve) => {
          const reader = new FileReader();
          reader.onloadend = () => resolve(reader.result as string);
          reader.readAsDataURL(logoBlob);
        });
      }
    } catch (e) {
      console.log('Could not load company logo');
    }
    return null;
  };

  // Helper function to fetch ride image with proper aspect ratio
  const fetchRideImage = async (): Promise<{ dataUrl: string; aspectRatio: number } | null> => {
    try {
      const { data: rideImage } = await supabase
        .from('documents')
        .select('file_path')
        .eq('ride_id', ride.id)
        .like('mime_type', 'image/%')
        .limit(1)
        .maybeSingle();

      if (rideImage) {
        const { data: imageBlob } = await supabase.storage
          .from('ride-documents')
          .download(rideImage.file_path);
        if (imageBlob) {
          const dataUrl = await new Promise<string>((resolve) => {
            const reader = new FileReader();
            reader.onloadend = () => resolve(reader.result as string);
            reader.readAsDataURL(imageBlob);
          });
          
          // Get natural aspect ratio
          const img = new Image();
          img.src = dataUrl;
          await new Promise((resolve) => { img.onload = resolve; });
          const aspectRatio = img.naturalWidth / img.naturalHeight;
          
          return { dataUrl, aspectRatio };
        }
      }
    } catch (e) {
      console.log('Could not load ride image');
    }
    return null;
  };

  // Footer is now handled by drawAllPageFooters from pdfUtils

  const generatePDFBlob = async (): Promise<{ blob: Blob; fileName: string }> => {
    if (!selectedAssessment) throw new Error('No assessment selected');

    const doc = new jsPDF({ orientation: 'landscape' });
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    
    // Fetch company logo
    const logoDataUrl = await fetchCompanyLogo();
    
    // Fetch ride image with aspect ratio
    const rideImageData = await fetchRideImage();
    
    // === HEADER SECTION ===
    const docId = generateDocId('RISK');
    const companyName = profile?.company_name || 'Risk Assessment';

    let yPos = drawPDFHeader({
      doc,
      logoDataUrl,
      companyName,
      controllerName: profile?.controller_name,
      reportTitle: 'Risk Assessment',
      subTitle: ride.ride_name,
      period: `Assessment: ${format(new Date(selectedAssessment.assessment_date), 'dd/MM/yyyy')}`,
      generatedDate: format(new Date(), 'dd MMM yyyy'),
      docId,
    });

    // === EQUIPMENT + ASSESSMENT DETAILS ===
    yPos = drawSectionTitle(doc, 'Equipment & Assessment Details', yPos);

    // Use drawEquipmentDetails for the left-side fields + image
    yPos = await drawEquipmentDetails({
      doc,
      y: yPos,
      fields: [
        { label: 'Equipment', value: ride.ride_name },
        { label: 'Manufacturer', value: ride.manufacturer },
        { label: 'Serial No', value: ride.serial_number },
        { label: 'Year', value: ride.year_manufactured?.toString() },
        { label: 'Assessor', value: selectedAssessment.assessor_name },
        { label: 'Assessment Date', value: format(new Date(selectedAssessment.assessment_date), 'dd/MM/yyyy') },
        { label: 'Status', value: selectedAssessment.overall_status.replace('_', ' ').toUpperCase() },
        ...(selectedAssessment.revision_number && selectedAssessment.revision_number > 1
          ? [{ label: 'Revision', value: `Rev ${selectedAssessment.revision_number}` }]
          : []),
      ],
      imageDataUrl: rideImageData?.dataUrl ?? null,
      maxImageW: 45,
      maxImageH: 30,
    });

    // Summary metrics
    const highCount = assessmentItems.filter(i => i.risk_level === 'high').length;
    const medCount  = assessmentItems.filter(i => i.risk_level === 'medium').length;
    const lowCount  = assessmentItems.filter(i => i.risk_level === 'low').length;

    yPos = drawSummaryBox(doc, [
      { label: 'Total Hazards', value: String(assessmentItems.length), accent: true },
      { label: 'High Risk', value: String(highCount) },
      { label: 'Medium Risk', value: String(medCount) },
      { label: 'Low Risk', value: String(lowCount) },
    ], yPos);

    const leftCol = 14;
    const rightCol = 180;

    // === HAZARDS TABLE ===
    // Helper to format likelihood/severity with numbers
    const formatWithScore = (key: string, type: 'likelihood' | 'severity') => {
      if (type === 'likelihood') {
        const scoreData = LIKELIHOOD_SCORES[key as LikelihoodKey];
        if (scoreData) return `${scoreData.score} - ${scoreData.label}`;
      } else {
        const scoreData = SEVERITY_SCORES[key as SeverityKey];
        if (scoreData) return `${scoreData.score} - ${scoreData.label}`;
      }
      return key;
    };

    // Track overridden items for footnotes
    const overriddenItems = assessmentItems.filter(item => item.is_manually_overridden);
    const hasOverrides = overriddenItems.length > 0;

    yPos = drawSectionTitle(doc, 'Hazard Assessment', yPos);

    const tableData = assessmentItems.map((item) => {
      const overrideMarker = item.is_manually_overridden ? ' *' : '';
      return [
        item.hazard_description,
        item.who_at_risk,
        item.existing_controls || '—',
        item.risk_level.toUpperCase() + overrideMarker,
        formatWithScore(item.likelihood, 'likelihood'),
        formatWithScore(item.severity, 'severity'),
        item.additional_actions || '—',
        item.status
      ];
    });

    autoTable(doc, {
      startY: yPos,
      head: [['Hazard', 'Who at Risk', 'Controls', 'Risk Level', 'Likelihood', 'Severity', 'Actions', 'Status']],
      body: tableData,
      headStyles: { ...PDF_TABLE_HEAD_STYLES, fontSize: 7.5 },
      bodyStyles: { fontSize: 7, cellPadding: 2 },
      alternateRowStyles: PDF_TABLE_ALT_ROW,
      columnStyles: {
        0: { cellWidth: 48 },
        1: { cellWidth: 28 },
        2: { cellWidth: 38 },
        3: { cellWidth: 20, halign: 'center' },
        4: { cellWidth: 26 },
        5: { cellWidth: 26 },
        6: { cellWidth: 42 },
        7: { cellWidth: 18, halign: 'center' }
      },
      margin: { left: 14, right: 14, bottom: 25 },
      didParseCell: function(data) {
        if (data.column.index === 3 && data.section === 'body') {
          const risk = (data.cell.raw as string).replace(' *', '');
          if (risk === 'HIGH') {
            data.cell.styles.fillColor = [185, 28, 28] as [number, number, number];
            data.cell.styles.textColor = [255, 255, 255] as [number, number, number];
          } else if (risk === 'MEDIUM') {
            data.cell.styles.fillColor = [217, 119, 6] as [number, number, number];
            data.cell.styles.textColor = [255, 255, 255] as [number, number, number];
          } else if (risk === 'LOW') {
            data.cell.styles.fillColor = [22, 163, 74] as [number, number, number];
            data.cell.styles.textColor = [255, 255, 255] as [number, number, number];
          }
        }
      }
    });

    let currentY = (doc as any).lastAutoTable.finalY + 8;

    // === METHODOLOGY SECTION ===
    const methodologyNeeded = currentY + 35 < pageHeight - 40;
    if (methodologyNeeded) {
      doc.setFontSize(9);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(50, 50, 50);
      doc.text('Risk Calculation Methodology', leftCol, currentY);
      currentY += 5;
      
      doc.setFontSize(7);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(80, 80, 80);
      
      const methodologyText = [
        `• Inherent Risk Score = Likelihood (1-5) × Severity (1-5), giving a score from 1-25`,
        `• Risk Levels: Low (1-6), Medium (7-12), High (13-25)`,
        `• Control Reduction Applied: Existing Controls -${riskSettings.existingControlsReduction}%, Additional Actions -${riskSettings.additionalActionsReduction}%`,
        `• Maximum combined reduction capped at 50%`
      ];
      
      methodologyText.forEach(line => {
        doc.text(line, leftCol, currentY);
        currentY += 4;
      });
      currentY += 4;
    } else {
      doc.addPage();
      currentY = 20;
      
      doc.setFontSize(9);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(50, 50, 50);
      doc.text('Risk Calculation Methodology', leftCol, currentY);
      currentY += 5;
      
      doc.setFontSize(7);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(80, 80, 80);
      
      const methodologyText = [
        `• Inherent Risk Score = Likelihood (1-5) × Severity (1-5), giving a score from 1-25`,
        `• Risk Levels: Low (1-6), Medium (7-12), High (13-25)`,
        `• Control Reduction Applied: Existing Controls -${riskSettings.existingControlsReduction}%, Additional Actions -${riskSettings.additionalActionsReduction}%`,
        `• Maximum combined reduction capped at 50%`
      ];
      
      methodologyText.forEach(line => {
        doc.text(line, leftCol, currentY);
        currentY += 4;
      });
      currentY += 4;
    }

    // === OVERRIDE FOOTNOTES ===
    if (hasOverrides) {
      doc.setFontSize(8);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(100, 80, 0);
      doc.text('* Professional Overrides Applied', leftCol, currentY);
      currentY += 4;
      
      doc.setFontSize(7);
      doc.setFont('helvetica', 'italic');
      doc.setTextColor(100, 100, 100);
      const overrideNote = `The following hazards have risk levels set by professional judgement rather than calculated values: ${
        overriddenItems.map(item => `"${item.hazard_description.substring(0, 30)}${item.hazard_description.length > 30 ? '...' : ''}"`).join(', ')
      }`;
      const overrideLines = doc.splitTextToSize(overrideNote, pageWidth - 28);
      doc.text(overrideLines, leftCol, currentY);
      currentY += overrideLines.length * 3.5 + 4;
    }

    // === DISCLAIMER SECTION ===
    // Check if we need a new page for disclaimer
    if (currentY + 30 > pageHeight - 25) {
      doc.addPage();
      currentY = 20;
    }

    doc.setFontSize(8);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(80, 80, 80);
    doc.text('Important Disclaimer', leftCol, currentY);
    currentY += 4;
    
    doc.setFontSize(6.5);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(100, 100, 100);
    
    const disclaimerText = `This risk assessment is provided as a guidance tool and does not guarantee the elimination of all hazards. Risk scores are calculated using a standardised matrix but must be interpreted in the context of your specific operating environment. The reduction percentages applied for existing controls and additional actions are organisational settings and may not reflect actual control effectiveness. Professional judgement must always be applied when determining final risk levels. Users are responsible for verifying that all controls are implemented and effective. The operators of this software accept no liability for incidents arising from the use of this assessment. This document should be reviewed regularly and updated when conditions change.`;
    
    const disclaimerLines = doc.splitTextToSize(disclaimerText, pageWidth - 28);
    doc.text(disclaimerLines, leftCol, currentY);
    currentY += disclaimerLines.length * 3 + 6;

    // Signature section
    if (currentY + 10 < pageHeight - 20) {
      doc.setFontSize(8);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(0);
      doc.text('Compiled by: ___________________________________', leftCol, currentY);
      doc.text(`${selectedAssessment.assessor_name}`, leftCol + 28, currentY);
      doc.text('Date: _______________', rightCol, currentY);
      doc.text(format(new Date(), 'dd/MM/yyyy'), rightCol + 15, currentY);
    }

    // Add standardised footers to all pages
    drawAllPageFooters(doc);

    const fileName = buildFileName([ride.ride_name, 'RiskAssessment', format(new Date(), 'yyyyMMdd')]);
    return { blob: doc.output('blob'), fileName };
  };

  // Helper to check if assessment can be exported
  const canExportAssessment = (): { allowed: boolean; message?: string } => {
    if (!selectedAssessment) return { allowed: false, message: 'No assessment selected' };
    
    if (selectedAssessment.overall_status !== 'completed') {
      return { 
        allowed: false, 
        message: 'Please mark the assessment as "Completed" before exporting or emailing.' 
      };
    }
    
    if (assessmentItems.length === 0) {
      return { 
        allowed: false, 
        message: 'Please add at least one risk item before exporting or emailing.' 
      };
    }
    
    return { allowed: true };
  };

  // Helper to save PDF to documents (used by export and email)
  const savePDFToDocuments = async (pdfBlob: Blob, fileName: string): Promise<boolean> => {
    if (!user || !selectedAssessment) return false;
    
    try {
      const filePath = `${user.id}/${ride.id}/${fileName}`;
      
      // Check if file already exists - use upsert to update if it does
      const { error: uploadError } = await supabase.storage
        .from('ride-documents')
        .upload(filePath, pdfBlob, {
          contentType: 'application/pdf',
          upsert: true
        });

      if (uploadError) throw uploadError;

      // Check if document record already exists for this assessment
      const { data: existingDoc } = await supabase
        .from('documents')
        .select('id')
        .eq('ride_id', ride.id)
        .eq('user_id', user.id)
        .eq('document_type', 'Risk Assessment')
        .ilike('document_name', `%${format(new Date(selectedAssessment.assessment_date), 'dd MMM yyyy')}%`)
        .maybeSingle();

      if (existingDoc) {
        // Update existing record
        await supabase
          .from('documents')
          .update({
            file_path: filePath,
            file_size: pdfBlob.size,
            uploaded_at: new Date().toISOString(),
            notes: `Generated from risk assessment by ${selectedAssessment.assessor_name}`
          })
          .eq('id', existingDoc.id);
      } else {
        // Create new record
        await supabase
          .from('documents')
          .insert({
            user_id: user.id,
            ride_id: ride.id,
            document_name: `Risk Assessment - ${format(new Date(selectedAssessment.assessment_date), 'dd MMM yyyy')}`,
            document_type: 'Risk Assessment',
            file_path: filePath,
            mime_type: 'application/pdf',
            file_size: pdfBlob.size,
            notes: `Generated from risk assessment by ${selectedAssessment.assessor_name}`
          });
      }

      return true;
    } catch (error) {
      console.error('Error saving PDF to documents:', error);
      return false;
    }
  };

  const handleSendEmail = async () => {
    if (!selectedAssessment || !user || !emailFormData.recipientEmail) return;

    // Check if can export
    const exportCheck = canExportAssessment();
    if (!exportCheck.allowed) {
      toast({ title: 'Cannot send email', description: exportCheck.message, variant: 'destructive' });
      return;
    }

    setSendingEmail(true);
    try {
      const { blob, fileName } = await generatePDFBlob();
      
      // Auto-save to documents
      await savePDFToDocuments(blob, fileName);
      
      // Convert blob to base64
      const arrayBuffer = await blob.arrayBuffer();
      const base64 = btoa(String.fromCharCode(...new Uint8Array(arrayBuffer)));

      const response = await supabase.functions.invoke('send-risk-assessment', {
        body: {
          assessmentId: selectedAssessment.id,
          rideId: ride.id,
          rideName: ride.ride_name,
          recipientEmail: emailFormData.recipientEmail,
          recipientName: emailFormData.recipientName || 'Recipient',
          message: emailFormData.message,
          pdfBase64: base64,
          pdfFileName: fileName
        }
      });

      if (response.error) {
        throw new Error(response.error.message || 'Failed to send email');
      }

      toast({ 
        title: 'Success!', 
        description: `Risk assessment sent to ${emailFormData.recipientEmail} and saved to documents.` 
      });
      setShowEmailDialog(false);
      setEmailFormData({ recipientEmail: '', recipientName: '', message: '' });
    } catch (error: any) {
      console.error('Error sending email:', error);
      toast({ 
        title: 'Failed to send email', 
        description: error.message || 'Please try again',
        variant: 'destructive' 
      });
    } finally {
      setSendingEmail(false);
    }
  };

  const resetItemForm = () => {
    setItemFormData({
      hazard_description: '',
      who_at_risk: '',
      existing_controls: '',
      risk_level: 'medium',
      likelihood: 'possible',
      severity: 'moderate',
      additional_actions: '',
      action_owner: '',
      target_date: '',
      status: 'open'
    });
    setUseCustomHazard(false);
    setUseCustomControls(false);
  };

  const getRiskColor = (level: string) => {
    switch (level) {
      case 'low': return 'bg-green-100 text-green-800';
      case 'medium': return 'bg-yellow-100 text-yellow-800';
      case 'high': return 'bg-red-100 text-red-800';
      case 'critical': return 'bg-red-900 text-white';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  // Left-rail severity config — matches ISO colour convention
  const SEVERITY_STRIP: Record<string, {
    rail: string; badgeBg: string; badgeText: string; label: string; chipBg: string; chipText: string;
  }> = {
    low:      { rail: 'bg-green-500',  badgeBg: 'bg-green-50',  badgeText: 'text-green-800',  label: 'LOW RISK',     chipBg: 'bg-[#DCFCE7]', chipText: 'text-[#166534]' },
    medium:   { rail: 'bg-amber-400',  badgeBg: 'bg-amber-50',  badgeText: 'text-amber-800',  label: 'MEDIUM RISK',  chipBg: 'bg-[#FEF3C7]', chipText: 'text-[#92400E]' },
    high:     { rail: 'bg-red-500',    badgeBg: 'bg-red-50',    badgeText: 'text-red-800',    label: 'HIGH RISK',    chipBg: 'bg-[#FEE2E2]', chipText: 'text-[#991B1B]' },
    critical: { rail: 'bg-[#7F1D1D]', badgeBg: 'bg-red-950',   badgeText: 'text-red-100',    label: 'EXTREME RISK', chipBg: 'bg-[#450a0a]', chipText: 'text-red-200' },
  };

  const getDueDateStatus = (targetDate: string | null, status: string) => {
    if (!targetDate || status === 'completed') return null;
    
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const dueDate = new Date(targetDate);
    dueDate.setHours(0, 0, 0, 0);
    
    const diffDays = Math.ceil((dueDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
    
    if (diffDays < 0) {
      return { 
        label: 'Overdue', 
        className: 'bg-red-100 text-red-800 border border-red-200',
        icon: 'overdue'
      };
    } else if (diffDays === 0) {
      return { 
        label: 'Due Today', 
        className: 'bg-orange-100 text-orange-800 border border-orange-200',
        icon: 'today'
      };
    } else if (diffDays <= 7) {
      return { 
        label: `Due in ${diffDays}d`, 
        className: 'bg-amber-100 text-amber-800 border border-amber-200',
        icon: 'soon'
      };
    }
    return null;
  };


  const exportToPDF = async () => {
    if (!selectedAssessment) return;

    // Check if can export
    const exportCheck = canExportAssessment();
    if (!exportCheck.allowed) {
      toast({ title: 'Cannot download PDF', description: exportCheck.message, variant: 'destructive' });
      return;
    }

    try {
      const { blob, fileName } = await generatePDFBlob();
      
      // Auto-save to documents
      const saved = await savePDFToDocuments(blob, fileName);
      
      // Create download link
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = fileName;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      
      toast({ 
        title: 'Success', 
        description: saved ? 'PDF downloaded and saved to documents' : 'PDF downloaded' 
      });
    } catch (error) {
      console.error('Error generating PDF:', error);
      toast({ title: 'Error', description: 'Failed to generate PDF', variant: 'destructive' });
    }
  };

  // Legacy function - now uses the shared helper
  const saveToDocuments = async () => {
    const exportCheck = canExportAssessment();
    if (!exportCheck.allowed) {
      toast({ title: 'Cannot save to documents', description: exportCheck.message, variant: 'destructive' });
      return;
    }

    try {
      const { blob: pdfBlob, fileName } = await generatePDFBlob();
      const saved = await savePDFToDocuments(pdfBlob, fileName);
      
      if (saved) {
        toast({ 
          title: 'Success!', 
          description: 'Risk assessment saved to documents.',
          duration: 5000
        });
      } else {
        throw new Error('Failed to save');
      }
    } catch (error: any) {
      console.error('Error saving to documents:', error);
      toast({ 
        title: 'Error', 
        description: error.message || 'Failed to save to documents', 
        variant: 'destructive' 
      });
    }
  };

  if (loading) {
    return <div className="p-8 text-center">Loading risk assessments...</div>;
  }

  if (!selectedAssessment) {
    // Derived KPI stats from assessments list
    const activeCount = assessments.filter(a => ['in_progress', 'active', 'completed'].includes(a.overall_status)).length;
    const reviewDueCount = assessments.filter(a => {
      if (!a.review_date) return false;
      return new Date(a.review_date) <= new Date();
    }).length;
    const overdueCount = assessments.filter(a => {
      if (!a.review_date) return false;
      const due = new Date(a.review_date);
      const now = new Date();
      return due < now && a.overall_status !== 'completed';
    }).length;

    const STATUS_CONFIG: Record<string, { label: string; bg: string; text: string; accentColor: string }> = {
      draft:        { label: 'Draft',        bg: 'bg-muted/60',           text: 'text-muted-foreground', accentColor: '#94A3B8' },
      in_progress:  { label: 'In Progress',  bg: 'bg-blue-50',            text: 'text-blue-700',         accentColor: '#2563EB' },
      active:       { label: 'Active',       bg: 'bg-[#DCFCE7]',          text: 'text-[#166534]',        accentColor: '#16A34A' },
      completed:    { label: 'Completed',    bg: 'bg-[#DCFCE7]',          text: 'text-[#166534]',        accentColor: '#16A34A' },
      review_due:   { label: 'Review Due',   bg: 'bg-[#FEF3C7]',          text: 'text-[#92400E]',        accentColor: '#F59E0B' },
      overdue:      { label: 'Overdue',      bg: 'bg-[#FEE2E2]',          text: 'text-[#991B1B]',        accentColor: '#DC2626' },
      archived:     { label: 'Archived',     bg: 'bg-muted/40',           text: 'text-muted-foreground', accentColor: '#CBD5E1' },
    };

    const RISK_LEVEL_BADGE: Record<string, { label: string; bg: string; text: string; dot: string }> = {
      low:      { label: 'Low Risk',    bg: 'bg-[#F0FDF4]', text: 'text-[#166534]', dot: 'bg-[#16A34A]' },
      medium:   { label: 'Medium Risk', bg: 'bg-[#FFFBEB]', text: 'text-[#92400E]', dot: 'bg-[#F59E0B]' },
      high:     { label: 'High Risk',   bg: 'bg-[#FEF2F2]', text: 'text-[#991B1B]', dot: 'bg-[#DC2626]' },
      critical: { label: 'Critical',    bg: 'bg-[#FFF1F2]', text: 'text-[#881337]', dot: 'bg-[#E11D48]' },
    };

    return (
      <div className="space-y-5">
        {/* ── KPI STRIP ─────────────────────────── */}
        <div className="grid grid-cols-4 gap-2">
          {[
            { label: 'Assessments', value: assessments.length,  color: '#2563EB' },
            { label: 'Active',      value: activeCount,          color: '#16A34A' },
            { label: 'Review Due',  value: reviewDueCount,       color: '#F59E0B' },
            { label: 'Overdue',     value: overdueCount,         color: '#DC2626' },
          ].map(({ label, value, color }) => (
            <div
              key={label}
              className="rounded-2xl border border-border bg-card px-3 py-3 relative overflow-hidden"
              style={{ boxShadow: '0 2px 8px rgba(0,0,0,0.04)' }}
            >
              <span className="absolute top-0 left-0 right-0 h-[3px] rounded-t-2xl" style={{ backgroundColor: color }} />
              <div className="text-xl font-bold text-foreground leading-none mt-1">{value}</div>
              <div className="text-[10px] text-muted-foreground font-medium mt-0.5 leading-tight">{label}</div>
            </div>
          ))}
        </div>

        {/* ── HEADER + CTA ──────────────────────── */}
        <div className="flex items-center justify-between gap-3">
          <div>
            <h3 className="text-sm font-semibold text-foreground">Risk Assessment Register</h3>
            <p className="text-xs text-muted-foreground mt-0.5">{ride.ride_name}</p>
          </div>
          <Button onClick={() => setShowNewAssessment(true)} size="sm" className="gap-1.5 shrink-0">
            <Plus className="h-4 w-4" /> New Risk Assessment
          </Button>
        </div>

        {/* ── ASSESSMENT LIST ───────────────────── */}
        {assessments.length === 0 ? (
          <div className="rounded-2xl border-2 border-dashed border-[#FCD34D] bg-[#FFFBEB] px-5 py-8 text-center">
            <div className="w-10 h-10 rounded-full bg-[#FEF3C7] flex items-center justify-center mx-auto mb-3">
              <FileText className="h-5 w-5 text-[#D97706]" strokeWidth={2} />
            </div>
            <p className="font-semibold text-sm text-[#92400E]">No Risk Assessments Yet</p>
            <p className="text-xs text-[#92400E]/70 mt-1 max-w-xs mx-auto">
              Risk assessments are required for operational compliance. Create your first assessment to identify hazards and implement controls.
            </p>
            <Button
              className="mt-4 bg-[#D97706] hover:bg-[#B45309] text-white border-0"
              size="sm"
              onClick={() => setShowNewAssessment(true)}
            >
              <Plus className="h-4 w-4 mr-1.5" /> Create Assessment
            </Button>
          </div>
        ) : (
          <div className="space-y-2">
            {assessments.map((assessment) => {
              const statusKey = assessment.overall_status in STATUS_CONFIG ? assessment.overall_status : 'draft';
              const statusCfg = STATUS_CONFIG[statusKey];
              // Determine risk posture from review_date overdue logic  
              const isOverdueReview = assessment.review_date && new Date(assessment.review_date) < new Date() && assessment.overall_status !== 'completed';
              const accentColor = isOverdueReview ? '#DC2626' : statusCfg.accentColor;
              return (
                <div
                  key={assessment.id}
                  className="rounded-xl border border-border bg-card overflow-hidden hover:border-primary/40 transition-all group"
                  style={{ boxShadow: '0 2px 6px rgba(0,0,0,0.04)', borderLeft: `4px solid ${accentColor}` }}
                >
                  <div
                    className="flex items-start gap-3 p-4 cursor-pointer"
                    onClick={() => setSelectedAssessment(assessment)}
                  >
                    {/* Icon */}
                    <div className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0 mt-0.5" style={{ backgroundColor: `${accentColor}15` }}>
                      <FileText className="h-4 w-4" style={{ color: accentColor }} strokeWidth={2} />
                    </div>

                    {/* Main content */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2">
                        <p className="font-semibold text-sm text-foreground">Risk Assessment</p>
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold shrink-0 ${statusCfg.bg} ${statusCfg.text}`}>
                          {isOverdueReview ? 'Overdue' : statusCfg.label}
                        </span>
                      </div>
                      <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 mt-1 text-xs text-muted-foreground">
                        <span>Created {format(new Date(assessment.assessment_date), 'dd MMM yyyy')}</span>
                        <span className="hidden sm:inline">·</span>
                        <span className="font-medium text-foreground/80">{assessment.assessor_name}</span>
                      </div>
                      {/* Extra compliance metadata row */}
                      <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 mt-1.5 text-xs text-muted-foreground">
                        <span>Last reviewed: <span className="text-foreground/70 font-medium">{assessment.last_modified_at ? format(new Date(assessment.last_modified_at), 'dd MMM yyyy') : '—'}</span></span>
                        {assessment.review_date && (
                          <span className={isOverdueReview ? 'text-[#DC2626] font-semibold' : ''}>
                            Next review: <span className="font-medium">{format(new Date(assessment.review_date), 'dd MMM yyyy')}</span>
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Right actions */}
                    <div className="flex items-center gap-1.5 shrink-0 ml-1">
                      {assessment.overall_status !== 'completed' && (
                        <TooltipProvider delayDuration={0}>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-7 w-7 p-0 hover:bg-destructive/10 opacity-0 group-hover:opacity-100 transition-opacity"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setAssessmentToDelete(assessment);
                                  setShowDeleteConfirm(true);
                                }}
                              >
                                <Trash2 className="h-3.5 w-3.5 text-destructive" />
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent side="left">
                              <p className="text-xs">Delete draft</p>
                            </TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                      )}
                      <ChevronDown className="h-4 w-4 text-muted-foreground rotate-[-90deg]" />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Delete Confirmation Dialog */}
        <Dialog open={showDeleteConfirm} onOpenChange={setShowDeleteConfirm}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Delete Risk Assessment?</DialogTitle>
              <DialogDescription>
                This will permanently delete this draft risk assessment and all its items. This action cannot be undone.
              </DialogDescription>
            </DialogHeader>
            {assessmentToDelete && (
              <div className="py-2">
                <p className="text-sm">
                  <span className="text-muted-foreground">Assessment from:</span>{' '}
                  <span className="font-medium">{format(new Date(assessmentToDelete.assessment_date), 'dd MMM yyyy')}</span>
                </p>
                <p className="text-sm">
                  <span className="text-muted-foreground">Assessor:</span>{' '}
                  <span className="font-medium">{assessmentToDelete.assessor_name}</span>
                </p>
              </div>
            )}
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowDeleteConfirm(false)} disabled={deleting}>
                Cancel
              </Button>
              <Button variant="destructive" onClick={handleDeleteAssessment} disabled={deleting}>
                {deleting ? <Loader2 className="h-4 w-4 animate-spin mr-1.5" /> : <Trash2 className="h-4 w-4 mr-1.5" />}
                Delete
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <Dialog open={showNewAssessment} onOpenChange={setShowNewAssessment}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>New Risk Assessment</DialogTitle>
              <DialogDescription>Create a new risk assessment for {ride.ride_name}</DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label htmlFor="assessor_name">Assessor Name</Label>
                <Input
                  id="assessor_name"
                  value={formData.assessor_name}
                  onChange={(e) => setFormData({ ...formData, assessor_name: e.target.value })}
                />
              </div>
              <div>
                <Label htmlFor="assessment_date">Assessment Date</Label>
                <Input
                  id="assessment_date"
                  type="date"
                  value={formData.assessment_date}
                  onChange={(e) => setFormData({ ...formData, assessment_date: e.target.value })}
                />
              </div>
              <div>
                <Label htmlFor="notes">Notes</Label>
                <Textarea
                  id="notes"
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowNewAssessment(false)}>Cancel</Button>
              <Button onClick={handleCreateAssessment}>Create Assessment</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* ── Back nav ── */}
      <button
        onClick={() => setSelectedAssessment(null)}
        className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
      >
        <ArrowLeft className="h-4 w-4" /> Back
      </button>

      {/* ── Assessment header card ── */}
      <div
        className="bg-white rounded-2xl border border-[#E2E8F0] px-4 py-4"
        style={{ boxShadow: '0 2px 6px rgba(0,0,0,0.04)' }}
      >
        {/* Title row */}
        <div className="flex items-start gap-3 mb-3">
          <div className="p-2 rounded-xl bg-primary/10 shrink-0">
            <FileText className="h-5 w-5 text-primary" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-base font-semibold text-foreground">Risk Assessment</span>
              {selectedAssessment.revision_number && selectedAssessment.revision_number > 1 && (
                <span className="text-[11px] bg-muted text-muted-foreground px-2 py-0.5 rounded-full font-medium">
                  Rev {selectedAssessment.revision_number}
                </span>
              )}
            </div>
            <p className="text-xs text-muted-foreground mt-0.5">
              <span className="font-medium text-foreground">{ride.ride_name}</span>
              {' • '}
              {format(new Date(selectedAssessment.assessment_date), 'dd MMM yyyy')}
              {' • '}
              {selectedAssessment.assessor_name}
            </p>
          </div>
        </div>

        {/* Status row */}
        <div className="flex items-center gap-2 flex-wrap mb-4">
          <Label className="text-xs text-muted-foreground shrink-0">Status:</Label>
          <Select value={selectedAssessment.overall_status} onValueChange={handleStatusChange}>
            <SelectTrigger className="h-8 w-[130px] text-xs rounded-lg">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="in_progress">
                <span className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-blue-500" />
                  In Progress
                </span>
              </SelectItem>
              <SelectItem value="completed">
                <span className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-green-500" />
                  Completed
                </span>
              </SelectItem>
            </SelectContent>
          </Select>
          <Button
            variant="ghost"
            size="sm"
            className="h-8 px-2 text-xs"
            onClick={() => {
              setFormData({
                assessor_name: selectedAssessment.assessor_name,
                assessment_date: selectedAssessment.assessment_date,
                review_date: selectedAssessment.review_date || '',
                overall_status: selectedAssessment.overall_status,
                notes: selectedAssessment.notes || ''
              });
              setShowEditAssessment(true);
            }}
          >
            <Pencil className="h-3.5 w-3.5 mr-1" /> Edit
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="h-8 px-2 text-xs"
            onClick={() => { loadAuditLog(); setShowAuditHistory(true); }}
          >
            <History className="h-3.5 w-3.5 mr-1" /> History
          </Button>
          <RiskSettingsDialog
            settings={riskSettings}
            onSave={handleSaveRiskSettings}
            saving={savingRiskSettings}
          />
        </div>

        {/* ── Primary action bar ── */}
        <div className="grid grid-cols-2 sm:flex sm:flex-wrap gap-2">
          {/* Add Risk — primary */}
          <Button
            onClick={() => setShowItemDialog(true)}
            className="h-11 rounded-xl bg-primary hover:bg-primary/90 text-white font-semibold text-sm col-span-2 sm:col-span-1"
          >
            <Plus className="h-4 w-4 mr-1.5" /> Add Risk
          </Button>

          {/* PDF */}
          <Button
            variant="outline"
            className="h-11 rounded-xl border border-[#CBD5E1] bg-white font-semibold text-sm"
            onClick={exportToPDF}
          >
            <Download className="h-4 w-4 mr-1.5" /> PDF
          </Button>

          {/* Save to docs */}
          <TooltipProvider delayDuration={0}>
            <Tooltip>
              <TooltipTrigger asChild>
                <span className="inline-flex">
                  <Button
                    variant="outline"
                    className="h-11 rounded-xl border border-[#CBD5E1] bg-white font-semibold text-sm w-full"
                    onClick={saveToDocuments}
                    disabled={selectedAssessment.overall_status !== 'completed' || assessmentItems.length === 0}
                  >
                    <Save className="h-4 w-4 mr-1.5" /> Save
                  </Button>
                </span>
              </TooltipTrigger>
              <TooltipContent side="bottom">
                <p className="text-xs max-w-[200px]">
                  {assessmentItems.length === 0
                    ? 'Add risk items before saving'
                    : selectedAssessment.overall_status !== 'completed'
                    ? 'Mark as completed to save'
                    : 'Save PDF to Documents'}
                </p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>

          {/* Email */}
          <TooltipProvider delayDuration={0}>
            <Tooltip>
              <TooltipTrigger asChild>
                <span className="inline-flex">
                  <Button
                    variant="outline"
                    className="h-11 rounded-xl border border-[#CBD5E1] bg-white font-semibold text-sm w-full"
                    onClick={() => setShowEmailDialog(true)}
                    disabled={assessmentItems.length === 0}
                  >
                    <Mail className="h-4 w-4 mr-1.5" /> Email
                  </Button>
                </span>
              </TooltipTrigger>
              <TooltipContent side="bottom">
                <p className="text-xs max-w-[200px]">
                  {assessmentItems.length === 0 ? 'Add risk items before emailing' : 'Email as PDF'}
                </p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>
      </div>

      {/* Risk Items Section */}
      {assessmentItems.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border bg-card p-12 text-center">
          <div className="mx-auto w-14 h-14 rounded-full bg-muted flex items-center justify-center mb-4">
            <AlertTriangle className="h-6 w-6 text-muted-foreground" />
          </div>
          <h3 className="text-base font-semibold mb-1">No Risk Items Yet</h3>
          <p className="text-sm text-muted-foreground mb-5">Start by adding hazards and risks to this assessment</p>
          <Button onClick={() => setShowItemDialog(true)} className="bg-primary hover:bg-primary/90 rounded-xl h-11 px-5">
            <Plus className="h-4 w-4 mr-2" /> Add First Risk Item
          </Button>
        </div>
      ) : (
        <div className="space-y-3">
          {/* Section header */}
          <div className="flex items-center justify-between px-1">
            <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
              Risk Items ({assessmentItems.length})
            </p>
          </div>

          {assessmentItems.map((item) => {
            const strip = SEVERITY_STRIP[item.risk_level] || SEVERITY_STRIP.low;
            const dueDateStatus = getDueDateStatus(item.target_date, item.status);
            const isOverdue = dueDateStatus?.icon === 'overdue';
            const lScore = (LIKELIHOOD_SCORES[item.likelihood as LikelihoodKey] ?? 0) as number;
            const sScore = (SEVERITY_SCORES[item.severity as SeverityKey] ?? 0) as number;
            const riskScore = lScore * sScore;

            return (
              <RiskItemCard
                key={item.id}
                item={item}
                strip={strip}
                isOverdue={isOverdue}
                dueDateStatus={dueDateStatus}
                riskScore={riskScore}
                onEdit={() => {
                  setEditingItem(item);
                  setItemFormData(item);
                  setShowItemDialog(true);
                }}
                onDelete={() => handleDeleteItem(item.id)}
              />
            );
          })}
        </div>
      )}


      <Dialog open={showItemDialog} onOpenChange={(open) => {
        setShowItemDialog(open);
        if (!open) {
          setEditingItem(null);
          resetItemForm();
        }
      }}>
        <DialogContent className="max-w-2xl w-[95vw] max-h-[90vh] overflow-y-auto bg-[#F8FAFC] p-0 gap-0">
          {/* Dialog header */}
          <div className="bg-white border-b border-[#E2E8F0] px-5 py-4 rounded-t-2xl">
            <DialogTitle className="text-[17px] font-semibold text-[#0F172A]">
              {editingItem ? 'Edit' : 'Add'} Risk Item
            </DialogTitle>
            <DialogDescription className="text-[13px] text-slate-500 mt-0.5">
              A risk assessment helps identify hazards and controls to keep everyone safe. Answer each question as accurately as possible.
            </DialogDescription>
          </div>

          <TooltipProvider>
            <div className="space-y-4 px-4 py-4 pb-0">
              {/* ── SECTION 1: Risk Identification ── */}
              <div className="bg-white rounded-2xl border border-[#E2E8F0] overflow-hidden" style={{ boxShadow: '0 2px 6px rgba(0,0,0,0.04)' }}>
                {/* Section header */}
                <div className="flex items-center gap-3 px-4 py-3 border-b border-[#F1F5F9]">
                  <div className="w-8 h-8 rounded-xl bg-[#EEF2FF] flex items-center justify-center shrink-0">
                    <span className="text-[13px] font-bold text-[#1E3A8A]">1</span>
                  </div>
                  <div>
                    <p className="text-[15px] font-semibold text-[#0F172A]">Risk Identification</p>
                    <p className="text-[12px] text-slate-500">Describe the hazard and who could be harmed</p>
                  </div>
                </div>
                <div className="px-4 py-4 space-y-4">
                  <div>
                    <div className="flex items-center gap-2 mb-2">
                      <Label htmlFor="hazard_description">Hazard Description *</Label>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Info className="h-3.5 w-3.5 text-muted-foreground cursor-help" />
                        </TooltipTrigger>
                        <TooltipContent className="max-w-xs">
                          <p>What is the danger or hazard? Describe what could cause harm or injury.</p>
                        </TooltipContent>
                      </Tooltip>
                    </div>
                    
                    {/* Custom Hazard Button */}
                    <div className="flex gap-2 mb-3">
                      <button
                        type="button"
                        onClick={() => {
                          setUseCustomHazard(true);
                          setItemFormData({ ...itemFormData, hazard_description: '' });
                        }}
                        className="flex items-center gap-1.5 h-10 px-4 rounded-xl text-[13px] font-semibold transition-colors"
                        style={{ background: '#1E3A5F', color: '#FFFFFF' }}
                      >
                        <Plus className="h-3.5 w-3.5" />
                        Enter Custom Hazard
                      </button>
                      {useCustomHazard && (
                        <button
                          type="button"
                          onClick={() => {
                            setUseCustomHazard(false);
                            setItemFormData({ ...itemFormData, hazard_description: '' });
                          }}
                          className="flex items-center gap-1.5 h-10 px-4 rounded-xl text-[13px] font-semibold border border-[#CBD5E1] bg-[#F1F5F9] text-[#334155] transition-colors hover:bg-slate-200"
                        >
                          Browse Library
                        </button>
                      )}
                    </div>
                    
                    {useCustomHazard ? (
                      <div className="space-y-2">
                        <Textarea
                          placeholder="Describe the hazard in detail - what could cause harm?"
                          value={itemFormData.hazard_description}
                          onChange={(e) => setItemFormData({ ...itemFormData, hazard_description: e.target.value })}
                          className="min-h-[80px]"
                        />
                        <p className="text-xs text-muted-foreground">
                          Custom hazards are submitted for review and may be added to the library for others to use.
                        </p>
                      </div>
                    ) : (
                      <>
                        <Collapsible>
                          <CollapsibleTrigger asChild>
                            <button type="button" className="w-full flex items-center gap-2.5 bg-[#F8FAFC] border border-[#E2E8F0] rounded-[10px] px-3 py-2.5 text-[13px] text-[#334155] font-medium hover:border-[#CBD5E1] transition-colors mb-2">
                              <ChevronDown className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                              <span>Browse hazard categories</span>
                            </button>
                          </CollapsibleTrigger>
                          <CollapsibleContent className="text-[12px] text-slate-500 mb-2 px-3 py-2 bg-[#F8FAFC] border border-[#E2E8F0] rounded-[10px]">
                            Mechanical, Electrical, Hydraulics & Pneumatics, Structural, Stability & Anchoring, Transport/Packing/Setup, Environmental, Operator factors, Patron safety, Emergency, or Chemical/Substance hazards.
                          </CollapsibleContent>
                        </Collapsible>
                        
                        <Select 
                          value={itemFormData.hazard_description} 
                          onValueChange={(value) => {
                            setItemFormData({ ...itemFormData, hazard_description: value });
                          }}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Select a hazard from the library" />
                          </SelectTrigger>
                          <SelectContent className="bg-background z-50 max-h-[300px]">
                            {/* Mechanical Hazards */}
                            <SelectItem value="__mechanical" disabled className="font-semibold text-primary">── Mechanical Hazards ──</SelectItem>
                            <SelectItem value="Mechanical failure during operation">Mechanical failure during operation</SelectItem>
                            <SelectItem value="Moving parts causing crush injuries">Moving parts causing crush injuries</SelectItem>
                            <SelectItem value="Rotating or spinning components without guards">Rotating or spinning components without guards</SelectItem>
                            <SelectItem value="Belt, chain or pulley entanglement">Belt, chain or pulley entanglement</SelectItem>
                            <SelectItem value="Hydraulic or pneumatic system failure">Hydraulic or pneumatic system failure</SelectItem>
                            <SelectItem value="Brake system malfunction">Brake system malfunction</SelectItem>
                            <SelectItem value="Bearing or shaft failure">Bearing or shaft failure</SelectItem>
                            <SelectItem value="Wear and fatigue of mechanical components">Wear and fatigue of mechanical components</SelectItem>
                            <SelectItem value="Inadequate lubrication leading to seizure">Inadequate lubrication leading to seizure</SelectItem>
                            <SelectItem value="Vibration causing loose connections">Vibration causing loose connections</SelectItem>
                            <SelectItem value="Gearbox or transmission failure">Gearbox or transmission failure</SelectItem>
                            <SelectItem value="Drive motor overheating or burnout">Drive motor overheating or burnout</SelectItem>
                            <SelectItem value="Coupling or linkage disconnection">Coupling or linkage disconnection</SelectItem>
                            <SelectItem value="Spring tension failure">Spring tension failure</SelectItem>
                            <SelectItem value="Wheel or roller bearing collapse">Wheel or roller bearing collapse</SelectItem>
                            
                            {/* Electrical Hazards */}
                            <SelectItem value="__electrical" disabled className="font-semibold text-primary">── Electrical Hazards ──</SelectItem>
                            <SelectItem value="Electrical shock from exposed wiring">Electrical shock from exposed wiring</SelectItem>
                            <SelectItem value="Short circuit or electrical fire">Short circuit or electrical fire</SelectItem>
                            <SelectItem value="Overloaded electrical circuits">Overloaded electrical circuits</SelectItem>
                            <SelectItem value="Water ingress to electrical components">Water ingress to electrical components</SelectItem>
                            <SelectItem value="Inadequate earthing or grounding">Inadequate earthing or grounding</SelectItem>
                            <SelectItem value="Damaged or worn electrical cables">Damaged or worn electrical cables</SelectItem>
                            <SelectItem value="Inadequate or missing RCD protection">Inadequate or missing RCD protection</SelectItem>
                            <SelectItem value="Poor cable management creating trip hazards">Poor cable management creating trip hazards</SelectItem>
                            <SelectItem value="Incompatible voltage supply">Incompatible voltage supply</SelectItem>
                            <SelectItem value="Electrical equipment not PAT tested">Electrical equipment not PAT tested</SelectItem>
                            <SelectItem value="Control panel or distribution board faults">Control panel or distribution board faults</SelectItem>
                            <SelectItem value="Emergency electrical shutdown failure">Emergency electrical shutdown failure</SelectItem>
                            <SelectItem value="Inadequate electrical isolation during maintenance">Inadequate electrical isolation during maintenance</SelectItem>
                            <SelectItem value="Arc flash from high voltage equipment">Arc flash from high voltage equipment</SelectItem>
                            <SelectItem value="Capacitor discharge hazard">Capacitor discharge hazard</SelectItem>
                            <SelectItem value="Electromagnetic interference affecting controls">Electromagnetic interference affecting controls</SelectItem>
                            
                            {/* Hydraulics & Pneumatics */}
                            <SelectItem value="__hydraulics" disabled className="font-semibold text-primary">── Hydraulics & Pneumatics ──</SelectItem>
                            <SelectItem value="Hydraulic hose or pipe rupture">Hydraulic hose or pipe rupture</SelectItem>
                            <SelectItem value="Hydraulic oil leak creating slip hazard">Hydraulic oil leak creating slip hazard</SelectItem>
                            <SelectItem value="Pneumatic system pressure loss">Pneumatic system pressure loss</SelectItem>
                            <SelectItem value="Air compressor failure">Air compressor failure</SelectItem>
                            <SelectItem value="Hydraulic cylinder seal failure">Hydraulic cylinder seal failure</SelectItem>
                            <SelectItem value="Uncontrolled release of stored pressure">Uncontrolled release of stored pressure</SelectItem>
                            <SelectItem value="Hydraulic pump malfunction">Hydraulic pump malfunction</SelectItem>
                            <SelectItem value="Contaminated hydraulic fluid">Contaminated hydraulic fluid</SelectItem>
                            <SelectItem value="Pressure relief valve failure">Pressure relief valve failure</SelectItem>
                            <SelectItem value="Pneumatic line disconnection">Pneumatic line disconnection</SelectItem>
                            <SelectItem value="Hydraulic oil injection injury">Hydraulic oil injection injury</SelectItem>
                            <SelectItem value="Accumulator failure or rupture">Accumulator failure or rupture</SelectItem>
                            
                            {/* Structural Hazards */}
                            <SelectItem value="__structural" disabled className="font-semibold text-primary">── Structural Hazards ──</SelectItem>
                            <SelectItem value="Structural collapse or failure">Structural collapse or failure</SelectItem>
                            <SelectItem value="Metal fatigue or stress cracks">Metal fatigue or stress cracks</SelectItem>
                            <SelectItem value="Corrosion weakening structural integrity">Corrosion weakening structural integrity</SelectItem>
                            <SelectItem value="Weld failure at critical joints">Weld failure at critical joints</SelectItem>
                            <SelectItem value="Foundation settlement or instability">Foundation settlement or instability</SelectItem>
                            <SelectItem value="Overloading beyond design capacity">Overloading beyond design capacity</SelectItem>
                            <SelectItem value="Inadequate support or bracing">Inadequate support or bracing</SelectItem>
                            <SelectItem value="Platform or deck deterioration">Platform or deck deterioration</SelectItem>
                            <SelectItem value="Handrail or barrier failure">Handrail or barrier failure</SelectItem>
                            <SelectItem value="Stair or step structural weakness">Stair or step structural weakness</SelectItem>
                            <SelectItem value="Canopy or roof structure failure">Canopy or roof structure failure</SelectItem>
                            
                            {/* Stability & Anchoring */}
                            <SelectItem value="__stability" disabled className="font-semibold text-primary">── Stability & Anchoring ──</SelectItem>
                            <SelectItem value="Inadequate ballast or counterweights">Inadequate ballast or counterweights</SelectItem>
                            <SelectItem value="Ground anchors not properly installed">Ground anchors not properly installed</SelectItem>
                            <SelectItem value="Uneven or unsuitable ground surface">Uneven or unsuitable ground surface</SelectItem>
                            <SelectItem value="Insufficient stabiliser legs or outriggers">Insufficient stabiliser legs or outriggers</SelectItem>
                            <SelectItem value="Stake or anchor pull-out risk">Stake or anchor pull-out risk</SelectItem>
                            <SelectItem value="Center of gravity shift during operation">Center of gravity shift during operation</SelectItem>
                            <SelectItem value="Wind loading exceeding stability limits">Wind loading exceeding stability limits</SelectItem>
                            <SelectItem value="Leveling issues causing instability">Leveling issues causing instability</SelectItem>
                            <SelectItem value="Inadequate guy wire or tensioning">Inadequate guy wire or tensioning</SelectItem>
                            <SelectItem value="Ground subsidence or soft ground">Ground subsidence or soft ground</SelectItem>
                            <SelectItem value="Dynamic forces causing rocking or swaying">Dynamic forces causing rocking or swaying</SelectItem>
                            <SelectItem value="Jacking system failure">Jacking system failure</SelectItem>
                            
                            {/* Transport, Packing & Setup */}
                            <SelectItem value="__transport" disabled className="font-semibold text-primary">── Transport, Packing & Setup ──</SelectItem>
                            <SelectItem value="Load shifting during transport">Load shifting during transport</SelectItem>
                            <SelectItem value="Inadequate load securing or lashing">Inadequate load securing or lashing</SelectItem>
                            <SelectItem value="Overloading transport vehicle">Overloading transport vehicle</SelectItem>
                            <SelectItem value="Improper trailer coupling or hitching">Improper trailer coupling or hitching</SelectItem>
                            <SelectItem value="Manual handling injuries during build-up">Manual handling injuries during build-up</SelectItem>
                            <SelectItem value="Crane or lifting equipment failure during setup">Crane or lifting equipment failure during setup</SelectItem>
                            <SelectItem value="Collision with overhead lines or structures">Collision with overhead lines or structures</SelectItem>
                            <SelectItem value="Inadequate traffic management during setup">Inadequate traffic management during setup</SelectItem>
                            <SelectItem value="Components damaged during transport">Components damaged during transport</SelectItem>
                            <SelectItem value="Missing or damaged transport securing points">Missing or damaged transport securing points</SelectItem>
                            <SelectItem value="Incorrect assembly sequence">Incorrect assembly sequence</SelectItem>
                            <SelectItem value="Working at height during build-up/breakdown">Working at height during build-up/breakdown</SelectItem>
                            <SelectItem value="Crushing between moving ride sections">Crushing between moving ride sections</SelectItem>
                            <SelectItem value="Pinch points during folding/unfolding">Pinch points during folding/unfolding</SelectItem>
                            
                            {/* Environmental Hazards */}
                            <SelectItem value="__environmental" disabled className="font-semibold text-primary">── Environmental Hazards ──</SelectItem>
                            <SelectItem value="Weather-related hazards (wind, rain, lightning)">Weather-related hazards (wind, rain, lightning)</SelectItem>
                            <SelectItem value="High wind causing instability">High wind causing instability</SelectItem>
                            <SelectItem value="Lightning strike risk">Lightning strike risk</SelectItem>
                            <SelectItem value="Temperature extremes affecting operation">Temperature extremes affecting operation</SelectItem>
                            <SelectItem value="Poor ground conditions">Poor ground conditions</SelectItem>
                            <SelectItem value="Slips, trips and falls from ride platform">Slips, trips and falls from ride platform</SelectItem>
                            <SelectItem value="Inadequate lighting causing visibility issues">Inadequate lighting causing visibility issues</SelectItem>
                            <SelectItem value="Noise hazards affecting communication">Noise hazards affecting communication</SelectItem>
                            <SelectItem value="Ice or frost making surfaces slippery">Ice or frost making surfaces slippery</SelectItem>
                            <SelectItem value="Sun glare affecting visibility">Sun glare affecting visibility</SelectItem>
                            <SelectItem value="Flooding or waterlogging">Flooding or waterlogging</SelectItem>
                            <SelectItem value="Heat stress for operators">Heat stress for operators</SelectItem>
                            
                            {/* Operator & Human Factors */}
                            <SelectItem value="__operator" disabled className="font-semibold text-primary">── Operator & Human Factors ──</SelectItem>
                            <SelectItem value="Operator error or inadequate training">Operator error or inadequate training</SelectItem>
                            <SelectItem value="Fatigue affecting operator performance">Fatigue affecting operator performance</SelectItem>
                            <SelectItem value="Communication failure between staff">Communication failure between staff</SelectItem>
                            <SelectItem value="Inadequate supervision">Inadequate supervision</SelectItem>
                            <SelectItem value="Emergency procedure not followed">Emergency procedure not followed</SelectItem>
                            <SelectItem value="Lack of competency or qualification">Lack of competency or qualification</SelectItem>
                            <SelectItem value="Maintenance errors during servicing">Maintenance errors during servicing</SelectItem>
                            <SelectItem value="Bypassing safety systems">Bypassing safety systems</SelectItem>
                            <SelectItem value="Distraction or loss of concentration">Distraction or loss of concentration</SelectItem>
                            <SelectItem value="Lone working hazards">Lone working hazards</SelectItem>
                            <SelectItem value="Language barriers affecting safety">Language barriers affecting safety</SelectItem>
                            <SelectItem value="Substance or alcohol impairment">Substance or alcohol impairment</SelectItem>
                            
                            {/* Patron Safety */}
                            <SelectItem value="__patron" disabled className="font-semibold text-primary">── Patron Safety ──</SelectItem>
                            <SelectItem value="Rider entrapment or ejection">Rider entrapment or ejection</SelectItem>
                            <SelectItem value="Inadequate restraint systems">Inadequate restraint systems</SelectItem>
                            <SelectItem value="Patron not meeting height or health restrictions">Patron not meeting height or health restrictions</SelectItem>
                            <SelectItem value="Loose articles becoming projectiles">Loose articles becoming projectiles</SelectItem>
                            <SelectItem value="Overcrowding or queue management issues">Overcrowding or queue management issues</SelectItem>
                            <SelectItem value="Motion sickness or disorientation">Motion sickness or disorientation</SelectItem>
                            <SelectItem value="Patron misbehaviour affecting others">Patron misbehaviour affecting others</SelectItem>
                            <SelectItem value="Collision with other riders">Collision with other riders</SelectItem>
                            <SelectItem value="Inadequate boarding/alighting procedures">Inadequate boarding/alighting procedures</SelectItem>
                            <SelectItem value="Sudden ride stoppage causing whiplash">Sudden ride stoppage causing whiplash</SelectItem>
                            <SelectItem value="Crushing or impact injuries from ride elements">Crushing or impact injuries from ride elements</SelectItem>
                            
                            {/* Emergency & Fire */}
                            <SelectItem value="__emergency" disabled className="font-semibold text-primary">── Emergency & Fire ──</SelectItem>
                            <SelectItem value="Fire or explosion risk">Fire or explosion risk</SelectItem>
                            <SelectItem value="Inadequate emergency evacuation routes">Inadequate emergency evacuation routes</SelectItem>
                            <SelectItem value="Fire suppression system failure">Fire suppression system failure</SelectItem>
                            <SelectItem value="Fuel or oil leak creating fire hazard">Fuel or oil leak creating fire hazard</SelectItem>
                            <SelectItem value="Emergency stop system malfunction">Emergency stop system malfunction</SelectItem>
                            <SelectItem value="Rider evacuation at height">Rider evacuation at height</SelectItem>
                            <SelectItem value="LPG or flammable gas leak">LPG or flammable gas leak</SelectItem>
                            <SelectItem value="Inadequate fire detection">Inadequate fire detection</SelectItem>
                            <SelectItem value="Blocked emergency exits">Blocked emergency exits</SelectItem>
                            
                            {/* Chemical & Substance Hazards */}
                            <SelectItem value="__chemical" disabled className="font-semibold text-primary">── Chemical & Substance Hazards ──</SelectItem>
                            <SelectItem value="Fuel spillage or leak">Fuel spillage or leak</SelectItem>
                            <SelectItem value="Lubricant or oil exposure">Lubricant or oil exposure</SelectItem>
                            <SelectItem value="Battery acid leak or explosion">Battery acid leak or explosion</SelectItem>
                            <SelectItem value="Cleaning chemical exposure">Cleaning chemical exposure</SelectItem>
                            <SelectItem value="Paint or coating fumes">Paint or coating fumes</SelectItem>
                            <SelectItem value="Exhaust fume accumulation">Exhaust fume accumulation</SelectItem>
                            <SelectItem value="Refrigerant or coolant leak">Refrigerant or coolant leak</SelectItem>
                          </SelectContent>
                        </Select>
                      </>
                    )}
                  </div>

                  <WhoAtRiskSelector
                    value={itemFormData.who_at_risk}
                    onChange={(value) => setItemFormData({ ...itemFormData, who_at_risk: value })}
                  />

                  <div>
                    <div className="flex items-center gap-2 mb-2">
                      <Label htmlFor="existing_controls">Existing Controls</Label>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Info className="h-3.5 w-3.5 text-muted-foreground cursor-help" />
                        </TooltipTrigger>
                        <TooltipContent className="max-w-xs">
                          <p>What safety measures are already in place to prevent or reduce this risk?</p>
                        </TooltipContent>
                      </Tooltip>
                    </div>
                    
                    {/* Custom Controls Button - Prominent placement */}
                    <div className="flex gap-2 mb-3">
                      <button
                        type="button"
                        onClick={() => {
                          setUseCustomControls(true);
                          setItemFormData({ ...itemFormData, existing_controls: '' });
                        }}
                        className="flex items-center gap-1.5 h-10 px-4 rounded-xl text-[13px] font-semibold transition-colors"
                        style={{ background: '#1E3A5F', color: '#FFFFFF' }}
                      >
                        <Plus className="h-3.5 w-3.5" />
                        Enter Custom Control
                      </button>
                      {useCustomControls && (
                        <button
                          type="button"
                          onClick={() => {
                            setUseCustomControls(false);
                            setItemFormData({ ...itemFormData, existing_controls: '' });
                          }}
                          className="flex items-center gap-1.5 h-10 px-4 rounded-xl text-[13px] font-semibold border border-[#CBD5E1] bg-[#F1F5F9] text-[#334155] transition-colors hover:bg-slate-200"
                        >
                          Browse Library
                        </button>
                      )}
                    </div>
                    
                    {useCustomControls ? (
                      <div className="space-y-2">
                        <Textarea
                          placeholder="Describe the existing control measures in place"
                          value={itemFormData.existing_controls || ''}
                          onChange={(e) => setItemFormData({ ...itemFormData, existing_controls: e.target.value })}
                          className="min-h-[80px]"
                        />
                        <p className="text-xs text-muted-foreground">
                          Custom controls are submitted for review and may be added to the library for others to use.
                        </p>
                      </div>
                    ) : (
                      <>
                        <Collapsible>
                          <CollapsibleTrigger asChild>
                            <button type="button" className="w-full flex items-center gap-2.5 bg-[#F8FAFC] border border-[#E2E8F0] rounded-[10px] px-3 py-2.5 text-[13px] text-[#334155] font-medium hover:border-[#CBD5E1] transition-colors mb-2">
                              <ChevronDown className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                              <span>Browse control categories</span>
                            </button>
                          </CollapsibleTrigger>
                          <CollapsibleContent className="text-[12px] text-slate-500 mb-2 px-3 py-2 bg-[#F8FAFC] border border-[#E2E8F0] rounded-[10px]">
                            Engineering controls, Administrative procedures, Inspection & maintenance, Emergency preparedness, Training programs, PPE, or Monitoring.
                          </CollapsibleContent>
                        </Collapsible>
                        
                        <Select 
                          value={itemFormData.existing_controls || ''} 
                          onValueChange={(value) => {
                            setItemFormData({ ...itemFormData, existing_controls: value });
                          }}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Select existing controls from the library" />
                          </SelectTrigger>
                          <SelectContent className="bg-background z-50 max-h-[300px]">
                            {/* Engineering Controls */}
                            <SelectItem value="__engineering" disabled className="font-semibold text-primary">── Engineering Controls ──</SelectItem>
                            <SelectItem value="Machine guards and safety interlocks installed">Machine guards and safety interlocks installed</SelectItem>
                            <SelectItem value="Emergency stop buttons strategically positioned">Emergency stop buttons strategically positioned</SelectItem>
                            <SelectItem value="Safety restraints and harnesses fitted">Safety restraints and harnesses fitted</SelectItem>
                            <SelectItem value="Non-slip surfaces applied to platforms">Non-slip surfaces applied to platforms</SelectItem>
                            <SelectItem value="Safety barriers and fencing installed">Safety barriers and fencing installed</SelectItem>
                            <SelectItem value="Perimeter fencing and access control">Perimeter fencing and access control</SelectItem>
                            <SelectItem value="Two-hand control systems for operator stations">Two-hand control systems for operator stations</SelectItem>
                            <SelectItem value="Pressure relief valves on hydraulic systems">Pressure relief valves on hydraulic systems</SelectItem>
                            <SelectItem value="Residual current devices (RCD) on electrical circuits">Residual current devices (RCD) on electrical circuits</SelectItem>
                            <SelectItem value="Lightning protection system installed">Lightning protection system installed</SelectItem>
                            <SelectItem value="Fire suppression and detection systems">Fire suppression and detection systems</SelectItem>
                            <SelectItem value="Speed limiters and overspeed detection">Speed limiters and overspeed detection</SelectItem>
                            <SelectItem value="Anti-rollback devices installed">Anti-rollback devices installed</SelectItem>
                            <SelectItem value="Sensor-based proximity detection">Sensor-based proximity detection</SelectItem>
                            <SelectItem value="Automatic braking systems">Automatic braking systems</SelectItem>
                            <SelectItem value="Load limiting or weighing systems">Load limiting or weighing systems</SelectItem>
                            <SelectItem value="Secondary locking mechanisms on restraints">Secondary locking mechanisms on restraints</SelectItem>
                            <SelectItem value="Redundant safety systems (fail-safe design)">Redundant safety systems (fail-safe design)</SelectItem>
                            <SelectItem value="Enclosed control panels with lockable access">Enclosed control panels with lockable access</SelectItem>
                            <SelectItem value="Ground fault protection installed">Ground fault protection installed</SelectItem>
                            
                            {/* Administrative Controls */}
                            <SelectItem value="__administrative" disabled className="font-semibold text-primary">── Administrative Controls ──</SelectItem>
                            <SelectItem value="Safe operating procedures documented">Safe operating procedures documented</SelectItem>
                            <SelectItem value="Staff training on safety procedures completed">Staff training on safety procedures completed</SelectItem>
                            <SelectItem value="Height and health restriction signage displayed">Height and health restriction signage displayed</SelectItem>
                            <SelectItem value="Warning signage clearly displayed at hazard points">Warning signage clearly displayed at hazard points</SelectItem>
                            <SelectItem value="Operating manual accessible to operators">Operating manual accessible to operators</SelectItem>
                            <SelectItem value="Weather monitoring and wind speed limits established">Weather monitoring and wind speed limits established</SelectItem>
                            <SelectItem value="Permit to work system for maintenance">Permit to work system for maintenance</SelectItem>
                            <SelectItem value="Lockout/tagout procedures implemented">Lockout/tagout procedures implemented</SelectItem>
                            <SelectItem value="Competency requirements defined for operators">Competency requirements defined for operators</SelectItem>
                            <SelectItem value="Emergency response plan in place">Emergency response plan in place</SelectItem>
                            <SelectItem value="Pre-ride safety briefings given to patrons">Pre-ride safety briefings given to patrons</SelectItem>
                            <SelectItem value="Supervision ratios maintained">Supervision ratios maintained</SelectItem>
                            <SelectItem value="Shift handover procedures documented">Shift handover procedures documented</SelectItem>
                            <SelectItem value="Incident reporting system in place">Incident reporting system in place</SelectItem>
                            <SelectItem value="Safety meeting and briefings scheduled">Safety meeting and briefings scheduled</SelectItem>
                            <SelectItem value="Risk assessment reviews scheduled">Risk assessment reviews scheduled</SelectItem>
                            <SelectItem value="Access control and authorisation system">Access control and authorisation system</SelectItem>
                            <SelectItem value="Visitor and contractor management procedures">Visitor and contractor management procedures</SelectItem>
                            
                            {/* Inspection & Maintenance */}
                            <SelectItem value="__inspection" disabled className="font-semibold text-primary">── Inspection & Maintenance ──</SelectItem>
                            <SelectItem value="Daily pre-operation safety checks performed">Daily pre-operation safety checks performed</SelectItem>
                            <SelectItem value="Regular maintenance schedule in place">Regular maintenance schedule in place</SelectItem>
                            <SelectItem value="Annual independent inspection completed">Annual independent inspection completed</SelectItem>
                            <SelectItem value="Safety restraints inspected before each use">Safety restraints inspected before each use</SelectItem>
                            <SelectItem value="NDT testing on critical components scheduled">NDT testing on critical components scheduled</SelectItem>
                            <SelectItem value="Maintenance records kept up to date">Maintenance records kept up to date</SelectItem>
                            <SelectItem value="Periodic structural integrity inspections">Periodic structural integrity inspections</SelectItem>
                            <SelectItem value="Electrical testing and PAT completed">Electrical testing and PAT completed</SelectItem>
                            <SelectItem value="Hydraulic system pressure testing">Hydraulic system pressure testing</SelectItem>
                            <SelectItem value="Brake testing before each operating period">Brake testing before each operating period</SelectItem>
                            <SelectItem value="Weekly thorough inspections documented">Weekly thorough inspections documented</SelectItem>
                            <SelectItem value="Monthly detailed inspection programme">Monthly detailed inspection programme</SelectItem>
                            <SelectItem value="Component replacement schedules followed">Component replacement schedules followed</SelectItem>
                            <SelectItem value="Lubrication schedule maintained">Lubrication schedule maintained</SelectItem>
                            <SelectItem value="Torque checking on critical fasteners">Torque checking on critical fasteners</SelectItem>
                            
                            {/* Emergency Preparedness */}
                            <SelectItem value="__emergency" disabled className="font-semibold text-primary">── Emergency Preparedness ──</SelectItem>
                            <SelectItem value="Emergency evacuation procedures established">Emergency evacuation procedures established</SelectItem>
                            <SelectItem value="First aid station and trained personnel available">First aid station and trained personnel available</SelectItem>
                            <SelectItem value="Emergency contact numbers displayed">Emergency contact numbers displayed</SelectItem>
                            <SelectItem value="Fire extinguishers positioned and serviced">Fire extinguishers positioned and serviced</SelectItem>
                            <SelectItem value="Emergency lighting installed">Emergency lighting installed</SelectItem>
                            <SelectItem value="Communication systems for emergencies">Communication systems for emergencies</SelectItem>
                            <SelectItem value="Emergency drills conducted regularly">Emergency drills conducted regularly</SelectItem>
                            <SelectItem value="Evacuation equipment available (ladders, harnesses)">Evacuation equipment available (ladders, harnesses)</SelectItem>
                            <SelectItem value="Emergency power backup systems">Emergency power backup systems</SelectItem>
                            <SelectItem value="Emergency assembly points designated">Emergency assembly points designated</SelectItem>
                            <SelectItem value="Spill kits available for chemical/oil spills">Spill kits available for chemical/oil spills</SelectItem>
                            
                            {/* Training & Competency */}
                            <SelectItem value="__training" disabled className="font-semibold text-primary">── Training & Competency ──</SelectItem>
                            <SelectItem value="Operator training and certification program">Operator training and certification program</SelectItem>
                            <SelectItem value="Refresher training conducted annually">Refresher training conducted annually</SelectItem>
                            <SelectItem value="Induction training for new staff">Induction training for new staff</SelectItem>
                            <SelectItem value="Toolbox talks on specific hazards">Toolbox talks on specific hazards</SelectItem>
                            <SelectItem value="Competency assessments completed">Competency assessments completed</SelectItem>
                            <SelectItem value="Emergency response training provided">Emergency response training provided</SelectItem>
                            <SelectItem value="First aid training for designated staff">First aid training for designated staff</SelectItem>
                            <SelectItem value="Manual handling training completed">Manual handling training completed</SelectItem>
                            <SelectItem value="Fire safety training provided">Fire safety training provided</SelectItem>
                            <SelectItem value="Working at height training certified">Working at height training certified</SelectItem>
                            
                            {/* PPE & Personal Protection */}
                            <SelectItem value="__ppe" disabled className="font-semibold text-primary">── PPE & Personal Protection ──</SelectItem>
                            <SelectItem value="High visibility clothing required">High visibility clothing required</SelectItem>
                            <SelectItem value="Safety footwear mandatory">Safety footwear mandatory</SelectItem>
                            <SelectItem value="Hard hats worn in setup areas">Hard hats worn in setup areas</SelectItem>
                            <SelectItem value="Safety gloves provided for handling">Safety gloves provided for handling</SelectItem>
                            <SelectItem value="Eye protection available">Eye protection available</SelectItem>
                            <SelectItem value="Hearing protection in noisy areas">Hearing protection in noisy areas</SelectItem>
                            <SelectItem value="Fall arrest equipment for height work">Fall arrest equipment for height work</SelectItem>
                            
                            {/* Monitoring & Review */}
                            <SelectItem value="__monitoring" disabled className="font-semibold text-primary">── Monitoring & Review ──</SelectItem>
                            <SelectItem value="CCTV monitoring of operations">CCTV monitoring of operations</SelectItem>
                            <SelectItem value="Wind speed monitoring equipment">Wind speed monitoring equipment</SelectItem>
                            <SelectItem value="Temperature monitoring systems">Temperature monitoring systems</SelectItem>
                            <SelectItem value="Structural movement monitoring">Structural movement monitoring</SelectItem>
                            <SelectItem value="Regular safety audits conducted">Regular safety audits conducted</SelectItem>
                            <SelectItem value="Near-miss reporting and analysis">Near-miss reporting and analysis</SelectItem>
                            <SelectItem value="Safety performance tracking">Safety performance tracking</SelectItem>
                          </SelectContent>
                        </Select>
                      </>
                    )}
                  </div>
                </div>
              </div>

              {/* ── SECTION 2: Risk Evaluation ── */}
              <div className="bg-white rounded-2xl border border-[#E2E8F0] overflow-hidden" style={{ boxShadow: '0 2px 6px rgba(0,0,0,0.04)' }}>
                <div className="flex items-center gap-3 px-4 py-3 border-b border-[#F1F5F9]">
                  <div className="w-8 h-8 rounded-xl bg-[#FFF7ED] flex items-center justify-center shrink-0">
                    <span className="text-[13px] font-bold text-[#C2410C]">2</span>
                  </div>
                  <div>
                    <p className="text-[15px] font-semibold text-[#0F172A]">Risk Evaluation</p>
                    <p className="text-[12px] text-slate-500">Risk is calculated as Likelihood × Severity. Controls reduce the residual risk.</p>
                  </div>
                </div>
                <div className="px-4 py-4">
                  <RiskEvaluationPanel
                    likelihood={itemFormData.likelihood}
                    severity={itemFormData.severity}
                    riskLevel={itemFormData.risk_level}
                    existingControls={itemFormData.existing_controls}
                    additionalActions={itemFormData.additional_actions}
                    useManualOverride={useManualRiskOverride}
                    onLikelihoodChange={(value) => setItemFormData({ ...itemFormData, likelihood: value })}
                    onSeverityChange={(value) => setItemFormData({ ...itemFormData, severity: value })}
                    onRiskLevelChange={(value) => setItemFormData({ ...itemFormData, risk_level: value })}
                    onUseManualOverrideChange={setUseManualRiskOverride}
                    riskSettings={riskSettings}
                    showDisclaimerLink={true}
                  />
                </div>
              </div>

              {/* ── SECTION 3: Risk Controls & Actions ── */}
              <div className="bg-white rounded-2xl border border-[#E2E8F0] overflow-hidden" style={{ boxShadow: '0 2px 6px rgba(0,0,0,0.04)' }}>
                <div className="flex items-center gap-3 px-4 py-3 border-b border-[#F1F5F9]">
                  <div className="w-8 h-8 rounded-xl bg-[#F0FDF4] flex items-center justify-center shrink-0">
                    <span className="text-[13px] font-bold text-[#166534]">3</span>
                  </div>
                  <div>
                    <p className="text-[15px] font-semibold text-[#0F172A]">Risk Controls &amp; Actions</p>
                    <p className="text-[12px] text-slate-500">Define controls in place and any additional actions required</p>
                  </div>
                </div>
                <div className="px-4 py-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="col-span-2">
                      <div className="flex items-center gap-2 mb-2">
                        <Label htmlFor="additional_actions">Additional Actions Required</Label>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Info className="h-3.5 w-3.5 text-muted-foreground cursor-help" />
                          </TooltipTrigger>
                          <TooltipContent className="max-w-xs">
                            <p>What extra steps need to be taken to further reduce the risk?</p>
                          </TooltipContent>
                        </Tooltip>
                      </div>
                      
                      <Collapsible>
                        <CollapsibleTrigger className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground mb-2">
                          <ChevronDown className="h-3 w-3" />
                          Need help choosing actions?
                        </CollapsibleTrigger>
                        <CollapsibleContent className="text-xs text-muted-foreground mb-2 ml-4">
                          Browse categories: Technical improvements, Documentation, Training, Inspection & testing, Communication, or Monitoring & review.
                        </CollapsibleContent>
                      </Collapsible>
                      
                      <Select value={itemFormData.additional_actions} onValueChange={(value) => setItemFormData({ ...itemFormData, additional_actions: value })}>
                        <SelectTrigger>
                          <SelectValue placeholder="Select additional actions or choose Custom" />
                        </SelectTrigger>
                        <SelectContent className="bg-background z-50">
                          {/* Technical Improvements */}
                          <SelectItem value="__technical" disabled className="font-semibold text-primary">── Technical Improvements ──</SelectItem>
                          <SelectItem value="Install additional safety barriers or guards">Install additional safety barriers or guards</SelectItem>
                          <SelectItem value="Upgrade to more reliable safety systems">Upgrade to more reliable safety systems</SelectItem>
                          <SelectItem value="Replace worn or damaged equipment">Replace worn or damaged equipment</SelectItem>
                          <SelectItem value="Install additional emergency stop buttons">Install additional emergency stop buttons</SelectItem>
                          <SelectItem value="Improve lighting in operational areas">Improve lighting in operational areas</SelectItem>
                          <SelectItem value="Install CCTV monitoring system">Install CCTV monitoring system</SelectItem>
                          <SelectItem value="Upgrade electrical systems to current standards">Upgrade electrical systems to current standards</SelectItem>
                          <SelectItem value="Install weather monitoring equipment">Install weather monitoring equipment</SelectItem>
                          <SelectItem value="Improve non-slip surfaces on platforms">Improve non-slip surfaces on platforms</SelectItem>
                          <SelectItem value="Install better signage and warnings">Install better signage and warnings</SelectItem>
                          
                          {/* Documentation & Procedures */}
                          <SelectItem value="__documentation" disabled className="font-semibold text-primary">── Documentation & Procedures ──</SelectItem>
                          <SelectItem value="Review and update operating procedures">Review and update operating procedures</SelectItem>
                          <SelectItem value="Create or revise emergency response plan">Create or revise emergency response plan</SelectItem>
                          <SelectItem value="Develop maintenance schedule and checklists">Develop maintenance schedule and checklists</SelectItem>
                          <SelectItem value="Document safe work method statements">Document safe work method statements</SelectItem>
                          <SelectItem value="Update risk assessment and control measures">Update risk assessment and control measures</SelectItem>
                          <SelectItem value="Create operator competency matrix">Create operator competency matrix</SelectItem>
                          <SelectItem value="Review manufacturer's recommendations">Review manufacturer's recommendations</SelectItem>
                          <SelectItem value="Implement permit-to-work system">Implement permit-to-work system</SelectItem>
                          
                          {/* Training & Awareness */}
                          <SelectItem value="__training" disabled className="font-semibold text-primary">── Training & Awareness ──</SelectItem>
                          <SelectItem value="Provide additional staff training on hazards">Provide additional staff training on hazards</SelectItem>
                          <SelectItem value="Conduct refresher training for all operators">Conduct refresher training for all operators</SelectItem>
                          <SelectItem value="Provide emergency response training">Provide emergency response training</SelectItem>
                          <SelectItem value="Train staff on new equipment or procedures">Train staff on new equipment or procedures</SelectItem>
                          <SelectItem value="Conduct toolbox talks on specific risks">Conduct toolbox talks on specific risks</SelectItem>
                          <SelectItem value="Arrange competency assessments">Arrange competency assessments</SelectItem>
                          
                          {/* Inspection & Testing */}
                          <SelectItem value="__inspection" disabled className="font-semibold text-primary">── Inspection & Testing ──</SelectItem>
                          <SelectItem value="Schedule NDT testing on critical components">Schedule NDT testing on critical components</SelectItem>
                          <SelectItem value="Arrange independent safety inspection">Arrange independent safety inspection</SelectItem>
                          <SelectItem value="Conduct load testing on structural elements">Conduct load testing on structural elements</SelectItem>
                          <SelectItem value="Increase frequency of daily checks">Increase frequency of daily checks</SelectItem>
                          <SelectItem value="Arrange electrical testing and certification">Arrange electrical testing and certification</SelectItem>
                          <SelectItem value="Implement regular audits of safety systems">Implement regular audits of safety systems</SelectItem>
                          <SelectItem value="Schedule hydraulic pressure testing">Schedule hydraulic pressure testing</SelectItem>
                          <SelectItem value="Conduct emergency stop function tests">Conduct emergency stop function tests</SelectItem>
                          
                          {/* Communication & Management */}
                          <SelectItem value="__communication" disabled className="font-semibold text-primary">── Communication & Management ──</SelectItem>
                          <SelectItem value="Improve communication systems between staff">Improve communication systems between staff</SelectItem>
                          <SelectItem value="Hold safety meeting with all operators">Hold safety meeting with all operators</SelectItem>
                          <SelectItem value="Report findings to management">Report findings to management</SelectItem>
                          <SelectItem value="Consult with manufacturer or specialist">Consult with manufacturer or specialist</SelectItem>
                          <SelectItem value="Notify relevant regulatory authorities">Notify relevant regulatory authorities</SelectItem>
                          
                          {/* Monitoring & Review */}
                          <SelectItem value="__monitoring" disabled className="font-semibold text-primary">── Monitoring & Review ──</SelectItem>
                          <SelectItem value="Conduct risk assessment review">Conduct risk assessment review</SelectItem>
                          <SelectItem value="Monitor effectiveness of control measures">Monitor effectiveness of control measures</SelectItem>
                          <SelectItem value="Track maintenance completion rates">Track maintenance completion rates</SelectItem>
                          <SelectItem value="Review incident and near-miss reports">Review incident and near-miss reports</SelectItem>
                          <SelectItem value="Schedule follow-up inspection">Schedule follow-up inspection</SelectItem>
                          <SelectItem value="Review and update after any modifications">Review and update after any modifications</SelectItem>
                          
                          <SelectItem value="Custom">Custom (enter below)</SelectItem>
                        </SelectContent>
                      </Select>
                      {itemFormData.additional_actions === 'Custom' && (
                        <Textarea
                          className="mt-2"
                          placeholder="Enter your custom additional actions"
                          value={itemFormData.additional_actions}
                          onChange={(e) => setItemFormData({ ...itemFormData, additional_actions: e.target.value })}
                        />
                      )}
                    </div>
                    
                    <div>
                      <div className="flex items-center gap-2 mb-2">
                        <Label htmlFor="action_owner">
                          Action Owner
                          {itemFormData.additional_actions?.trim() && (
                            <span className="text-destructive ml-1">*</span>
                          )}
                        </Label>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Info className="h-3.5 w-3.5 text-muted-foreground cursor-help" />
                          </TooltipTrigger>
                          <TooltipContent className="max-w-xs">
                            <p>The person accountable for implementing this action. They are responsible for ensuring it gets done.</p>
                          </TooltipContent>
                        </Tooltip>
                      </div>
                      <Input
                        id="action_owner"
                        placeholder="Name of person responsible for this action"
                        value={itemFormData.action_owner}
                        onChange={(e) => setItemFormData({ ...itemFormData, action_owner: e.target.value })}
                        className={cn(
                          "placeholder:text-muted-foreground/60",
                          itemFormData.additional_actions?.trim() && !itemFormData.action_owner?.trim() && "border-destructive"
                        )}
                      />
                      <p className="text-xs text-muted-foreground mt-1">
                        {itemFormData.additional_actions?.trim() 
                          ? "Required: Enter who will implement and verify this control"
                          : "Enter the name/role of who will implement and verify this control"
                        }
                      </p>
                    </div>
                    
                    <div>
                      <div className="flex items-center gap-2 mb-2">
                        <Label htmlFor="target_date">
                          Action Due Date
                          {itemFormData.additional_actions?.trim() && (
                            <span className="text-destructive ml-1">*</span>
                          )}
                        </Label>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Info className="h-3.5 w-3.5 text-muted-foreground cursor-help" />
                          </TooltipTrigger>
                          <TooltipContent className="max-w-xs">
                            <p>The deadline for completing the additional control measure or action. Set this to ensure timely risk mitigation.</p>
                          </TooltipContent>
                        </Tooltip>
                      </div>
                      <Popover>
                        <PopoverTrigger asChild>
                          <Button
                            variant="outline"
                            className={cn(
                              "w-full justify-start text-left font-normal h-10",
                              !itemFormData.target_date && "text-muted-foreground",
                              itemFormData.additional_actions?.trim() && !itemFormData.target_date && "border-destructive"
                            )}
                          >
                            <CalendarIcon className="mr-2 h-4 w-4 shrink-0" />
                            <span className="truncate">
                              {itemFormData.target_date ? format(new Date(itemFormData.target_date), 'dd MMM yyyy') : 'Pick a date'}
                            </span>
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0" align="start">
                          <Calendar
                            mode="single"
                            selected={itemFormData.target_date ? new Date(itemFormData.target_date) : undefined}
                            onSelect={(date) => setItemFormData({ ...itemFormData, target_date: date ? format(date, 'yyyy-MM-dd') : '' })}
                            initialFocus
                            className={cn("p-3 pointer-events-auto")}
                          />
                        </PopoverContent>
                      </Popover>
                      {itemFormData.additional_actions?.trim() && !itemFormData.target_date && (
                        <p className="text-xs text-destructive mt-1">
                          Required when additional actions are specified
                        </p>
                      )}
                    </div>
                    
                    <div className="col-span-2">
                      <div className="flex items-center gap-2 mb-2">
                        <Label htmlFor="status" className="text-[13px] font-semibold text-[#0F172A]">Status</Label>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Info className="h-3.5 w-3.5 text-slate-400 cursor-help" />
                          </TooltipTrigger>
                          <TooltipContent className="max-w-xs">
                            <p>Track the progress of actions for this risk item</p>
                          </TooltipContent>
                        </Tooltip>
                      </div>
                      <Select value={itemFormData.status} onValueChange={(value) => setItemFormData({ ...itemFormData, status: value })}>
                        <SelectTrigger className="bg-white border-[#CBD5E1] rounded-xl h-10">
                          <SelectValue>
                            {itemFormData.status === 'open' && (
                              <span className="inline-flex items-center gap-1.5">
                                <span className="w-2 h-2 rounded-full bg-blue-500" /> Open
                              </span>
                            )}
                            {itemFormData.status === 'in_progress' && (
                              <span className="inline-flex items-center gap-1.5">
                                <span className="w-2 h-2 rounded-full bg-amber-500" /> In Progress
                              </span>
                            )}
                            {itemFormData.status === 'completed' && (
                              <span className="inline-flex items-center gap-1.5">
                                <span className="w-2 h-2 rounded-full bg-green-500" /> Completed
                              </span>
                            )}
                          </SelectValue>
                        </SelectTrigger>
                        <SelectContent className="bg-background z-50">
                          <SelectItem value="open">
                            <div className="flex items-center gap-2">
                              <span className="inline-flex px-2 py-0.5 rounded-full text-[11px] font-bold bg-[#DBEAFE] text-[#1E3A8A]">Open</span>
                              <span className="text-xs text-slate-500">Not yet started</span>
                            </div>
                          </SelectItem>
                          <SelectItem value="in_progress">
                            <div className="flex items-center gap-2">
                              <span className="inline-flex px-2 py-0.5 rounded-full text-[11px] font-bold bg-[#FEF3C7] text-[#92400E]">In Progress</span>
                              <span className="text-xs text-slate-500">Actions underway</span>
                            </div>
                          </SelectItem>
                          <SelectItem value="completed">
                            <div className="flex items-center gap-2">
                              <span className="inline-flex px-2 py-0.5 rounded-full text-[11px] font-bold bg-[#DCFCE7] text-[#166534]">Completed</span>
                              <span className="text-xs text-slate-500">Controls verified</span>
                            </div>
                          </SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </TooltipProvider>

          {/* ── Sticky footer action bar ── */}
          <div className="sticky bottom-0 bg-white border-t border-[#E2E8F0] px-5 py-3 rounded-b-2xl flex gap-3">
            <Button
              onClick={handleSaveItem}
              disabled={savingItem}
              className="flex-1 h-12 rounded-xl text-[14px] font-semibold"
              style={{ background: '#1E3A5F', color: '#FFFFFF' }}
            >
              {savingItem ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Saving...
                </>
              ) : (
                editingItem ? 'Save Changes' : 'Save'
              )}
            </Button>
            <Button
              variant="outline"
              onClick={() => {
                setShowItemDialog(false);
                setEditingItem(null);
                resetItemForm();
              }}
              disabled={savingItem}
              className="flex-1 h-12 rounded-xl text-[14px] font-semibold bg-[#F1F5F9] text-[#334155] border-0"
            >
              Cancel
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Edit Assessment Dialog */}
      <Dialog open={showEditAssessment} onOpenChange={setShowEditAssessment}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Risk Assessment</DialogTitle>
            <DialogDescription>Changes will be tracked in the audit history.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="edit_assessor_name">Assessor Name</Label>
              <Input
                id="edit_assessor_name"
                value={formData.assessor_name}
                onChange={(e) => setFormData({ ...formData, assessor_name: e.target.value })}
              />
            </div>
            <div>
              <Label htmlFor="edit_assessment_date">Assessment Date</Label>
              <Input
                id="edit_assessment_date"
                type="date"
                value={formData.assessment_date}
                onChange={(e) => setFormData({ ...formData, assessment_date: e.target.value })}
              />
            </div>
            <div>
              <Label htmlFor="edit_notes">Notes</Label>
              <Textarea
                id="edit_notes"
                value={formData.notes}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowEditAssessment(false)}>Cancel</Button>
            <Button onClick={handleEditAssessment}>Save Changes</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Email Dialog */}
      <Dialog open={showEmailDialog} onOpenChange={setShowEmailDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Email Risk Assessment</DialogTitle>
            <DialogDescription>Send this assessment as a PDF attachment.</DialogDescription>
          </DialogHeader>
          <Alert className="bg-primary/5 border-primary/20 mb-4">
            <Info className="h-4 w-4 text-primary" />
            <AlertDescription className="text-xs">
              A PDF copy will be saved to your Documents under "Risk Assessments".
            </AlertDescription>
          </Alert>
          <div className="space-y-4">
            <div>
              <Label htmlFor="recipient_email">Recipient Email *</Label>
              <Input
                id="recipient_email"
                type="email"
                placeholder="council@example.com"
                value={emailFormData.recipientEmail}
                onChange={(e) => setEmailFormData({ ...emailFormData, recipientEmail: e.target.value })}
              />
            </div>
            <div>
              <Label htmlFor="recipient_name">Recipient Name</Label>
              <Input
                id="recipient_name"
                placeholder="e.g., Safety Officer"
                value={emailFormData.recipientName}
                onChange={(e) => setEmailFormData({ ...emailFormData, recipientName: e.target.value })}
              />
            </div>
            <div>
              <Label htmlFor="email_message">Message (optional)</Label>
              <Textarea
                id="email_message"
                placeholder="Add a personal message..."
                value={emailFormData.message}
                onChange={(e) => setEmailFormData({ ...emailFormData, message: e.target.value })}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowEmailDialog(false)}>Cancel</Button>
            <Button onClick={handleSendEmail} disabled={sendingEmail || !emailFormData.recipientEmail}>
              {sendingEmail ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Sending...</> : <><Send className="h-4 w-4 mr-2" /> Send Email</>}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Audit History Dialog */}
      <Dialog open={showAuditHistory} onOpenChange={setShowAuditHistory}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Change History</DialogTitle>
            <DialogDescription>All changes to this assessment are tracked.</DialogDescription>
          </DialogHeader>
          <div className="max-h-[400px] overflow-y-auto space-y-3">
            {auditLog.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">No changes recorded yet.</p>
            ) : (
              auditLog.map((entry) => (
                <div key={entry.id} className="border rounded-lg p-3 text-sm">
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-medium capitalize">{entry.action.replace('_', ' ')}</span>
                    <span className="text-xs text-muted-foreground">
                      {format(new Date(entry.changed_at), 'dd MMM yyyy HH:mm')}
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground">By: {entry.changed_by}</p>
                  {entry.notes && <p className="text-xs mt-1">{entry.notes}</p>}
                </div>
              ))
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAuditHistory(false)}>Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};