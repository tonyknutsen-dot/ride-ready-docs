import { useState, useEffect } from 'react';
import { format } from 'date-fns';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Progress } from '@/components/ui/progress';
import { Checkbox } from '@/components/ui/checkbox';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Download, FileText, CheckCircle, Clock, AlertTriangle, Mail, Printer, Plus, Settings, Trash2, Archive, Loader2, WifiOff, CloudOff, RefreshCw, XCircle, MinusCircle, Eye, MoreVertical, ChevronDown, ChevronUp, PlayCircle, Wrench } from 'lucide-react';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { useToast } from '@/hooks/use-toast';

import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useEffectiveUserId } from '@/hooks/useEffectiveUserId';
import { Tables } from '@/integrations/supabase/types';
import { useQueryClient } from '@tanstack/react-query';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
import {
  PDF_COLORS,
  buildFileName,
  blobToDataUrl,
  drawSectionTitle,
  drawEquipmentDetails,
  drawSummaryBox,
  PDF_TABLE_HEAD_STYLES,
} from '@/utils/pdfUtils';
import {
  drawTemplateHeader,
  drawTemplateFooters,
  generateDocumentId,
} from '@/utils/pdfTemplate';
import { storeRideDocument, getRideCode } from '@/utils/rideDocumentService';
import TemplateBuilder from './TemplateBuilder';
import { EmptyState } from '@/components/EmptyState';
import DefectReportDialog from './DefectReportDialog';
import PriorDefectReviewDialog from './PriorDefectReviewDialog';
import DefectsList from './DefectsList';
import { useOfflineCheck } from '@/hooks/useOfflineCheck';
import { useOfflineSync } from '@/hooks/useOfflineSync';
import { getCachedTemplatesForRide, findCachedAddress, cacheLocationAddress, type CachedTemplate, type CheckItemResult } from '@/lib/offlineDb';
import CheckDetailDialog from './CheckDetailDialog';
import QuickMaintenanceLog from './QuickMaintenanceLog';
import { createInspectionRecord, updateInspectionRecordPdf, type InspectionRecord, type ItemResultSnapshot } from '@/utils/inspectionRecordService';

import InspectionRecordList from './InspectionRecordList';
import { useBillingWriteGuard } from '@/hooks/useBillingWriteGuard';
// CriticalDefectModal removed in showmen simplification
import { useQueryClient as useQueryClientImport } from '@tanstack/react-query';
type Ride = Tables<'rides'> & {
  ride_categories: {
    name: string;
    description: string | null;
    category_group: string;
  };
};

type Template = Tables<'daily_check_templates'> & {
  daily_check_template_items: Tables<'daily_check_template_items'>[];
};

type Check = Tables<'checks'>;

interface InspectionChecklistProps {
  ride: Ride;
  frequency: string;
  onChecklistSaved?: () => void;
  startImmediately?: boolean;
}

const FREQUENCY_LABELS: Record<string, string> = {
  daily: 'Daily / Pre-Opening',
  preopening: 'Pre-Opening',
  weekly: 'Weekly',
  monthly: 'Monthly',
  yearly: 'Yearly',
};

const InspectionChecklist = ({ ride, frequency, onChecklistSaved, startImmediately = false }: InspectionChecklistProps) => {
  const navigate = useNavigate();
  const { guardWrite } = useBillingWriteGuard();
  const [activeTemplate, setActiveTemplate] = useState<Template | null>(null);
  const [recentChecks, setRecentChecks] = useState<Check[]>([]);
  const [itemResults, setItemResults] = useState<{ [key: string]: CheckItemResult }>({});
  const [notes, setNotes] = useState<{ [key: string]: string }>({});
  const [inspectorName, setInspectorName] = useState('');
  const [inspectorNameError, setInspectorNameError] = useState(false);
  const [locationError, setLocationError] = useState(false);
  const [wizardStep, setWizardStep] = useState<'details' | 'start-notice' | 'checklist'>('details');
  const [inspectorNotes, setInspectorNotes] = useState('');
  const [location, setLocation] = useState('');
  const [loading, setLoading] = useState(true);
  const [showTemplateBuilder, setShowTemplateBuilder] = useState(false);
  const [defectRefreshKey, setDefectRefreshKey] = useState(0);
  const [usingCachedTemplate, setUsingCachedTemplate] = useState(false);
  const [selectedCheck, setSelectedCheck] = useState<Check | null>(null);
  const [showCheckDetail, setShowCheckDetail] = useState(false);
  const [itemAttachments, setItemAttachments] = useState<Record<string, File[]>>({});
  const [detailsExpanded, setDetailsExpanded] = useState(true);
  const [checkStarted, setCheckStarted] = useState(startImmediately);
  const [checkStartedAt, setCheckStartedAt] = useState<Date | null>(startImmediately ? new Date() : null);
  const [showMaintenanceForItem, setShowMaintenanceForItem] = useState<string | null>(null);
  const [declarationChecked, setDeclarationChecked] = useState(false);
  const [highlightItemId, setHighlightItemId] = useState<string | null>(null);
  const [itemDefectRaised, setItemDefectRaised] = useState<Record<string, boolean>>({});
  // Map of failed item id → defect raised IN THIS RUN (id + photo count + severity)
  const [itemDefects, setItemDefects] = useState<Record<string, { id: string; photoCount: number; severity: string }>>({});
  // Map of failed item id → previously open defect from prior runs (display-only, never auto-linked)
  const [priorOpenDefects, setPriorOpenDefects] = useState<Record<string, { id: string; photoCount: number; severity: string }>>({});
  // Which item is currently editing its linked defect
  const [editingDefectForItem, setEditingDefectForItem] = useState<string | null>(null);
  // Which item is currently reviewing the prior defect (read-only review modal)
  const [reviewingPriorForItem, setReviewingPriorForItem] = useState<string | null>(null);
  // Which item is currently reopening a prior defect (explicit user action — opens edit dialog)
  const [reopeningPriorForItem, setReopeningPriorForItem] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [startNoticeAcknowledged, setStartNoticeAcknowledged] = useState(false);
  const [startNoticeAcknowledgedAt, setStartNoticeAcknowledgedAt] = useState<string | null>(null);
  const [finishNoticeAcknowledged, setFinishNoticeAcknowledged] = useState(false);
  const [finishNoticeAcknowledgedAt, setFinishNoticeAcknowledgedAt] = useState<string | null>(null);

  const { toast } = useToast();
  const { user } = useAuth();
  const { effectiveUserId, isStaff } = useEffectiveUserId();
  const queryClient = useQueryClient();
  const { submitCheck, isOnline } = useOfflineCheck();
  const { pendingCount, isSyncing, syncAll } = useOfflineSync();

  // Prefill inspector name from the actual user's profile (not org owner for staff)
  useEffect(() => {
    if (user && !inspectorName) {
      // For staff: use *their own* profile name, not the org owner's
      const profileUserId = isStaff ? user.id : effectiveUserId;
      if (!profileUserId) return;
      supabase
        .from('profiles')
        .select('controller_name')
        .eq('user_id', profileUserId)
        .single()
        .then(({ data }) => {
          if (data?.controller_name && !inspectorName) {
            setInspectorName(data.controller_name);
          }
        });
    }
  }, [user, effectiveUserId, isStaff]);

  useEffect(() => {
    if (user) {
      loadActiveTemplate();
      loadRecentChecks();
    }
  }, [user, ride.id, frequency]);

  // Convert cached template to the Template type used by the component
  const convertCachedToTemplate = (cached: CachedTemplate): Template => {
    return {
      id: cached.id,
      ride_id: cached.rideId,
      template_name: cached.templateName,
      check_frequency: cached.checkFrequency,
      is_active: cached.isActive,
      is_archived: false,
      user_id: user?.id || '',
      created_at: cached.cachedAt,
      updated_at: cached.cachedAt,
      description: null,
      template_type: cached.checkFrequency,
      custom_interval_days: null,
      start_notice_required: false,
      start_notice_text: null,
      finish_notice_required: false,
      finish_notice_text: null,
      daily_check_template_items: cached.items.map(item => ({
        id: item.id,
        template_id: cached.id,
        check_item_text: item.checkItemText,
        category: item.category || 'general',
        is_required: item.isRequired,
        sort_order: item.sortOrder,
        created_at: cached.cachedAt,
      })),
    };
  };

  const loadActiveTemplate = async () => {
    setUsingCachedTemplate(false);
    
    try {
      // Build query - for staff, skip user_id filter (RLS handles access)
      let query = supabase
        .from('daily_check_templates')
        .select(`
          *,
          daily_check_template_items (*)
        `)
        .eq('ride_id', ride.id)
        .eq('check_frequency', frequency)
        .eq('is_active', true)
        .eq('is_archived', false);

      if (!isStaff) {
        query = query.eq('user_id', effectiveUserId);
      }

      const { data, error } = await query.maybeSingle();

      if (error && error.code !== 'PGRST116') {
        throw error;
      }

      setActiveTemplate(data);
    } catch (error) {
      console.error('Error loading active template:', error);
      
      // Try to load from offline cache
      try {
        const cachedTemplates = await getCachedTemplatesForRide(ride.id);
        const matchingTemplate = cachedTemplates.find(
          t => t.checkFrequency === frequency && t.isActive
        );
        
        if (matchingTemplate) {
          const convertedTemplate = convertCachedToTemplate(matchingTemplate);
          setActiveTemplate(convertedTemplate);
          setUsingCachedTemplate(true);
          toast({
            title: "Using cached template",
            description: "You're offline. Using previously cached template.",
          });
        } else if (navigator.onLine) {
          toast({
            title: "Error",
            description: "Failed to load template. No cached version available.",
            variant: "destructive"
          });
        }
      } catch (cacheError) {
        console.error('Error loading cached template:', cacheError);
        if (navigator.onLine) {
          toast({
            title: "Error",
            description: "Failed to load inspection template",
            variant: "destructive"
          });
        }
      }
    } finally {
      setLoading(false);
    }
  };

  const loadRecentChecks = async () => {
    try {
      // Build query - for staff, skip user_id filter (RLS handles access)
      let query = supabase
        .from('checks')
        .select('*')
        .eq('ride_id', ride.id)
        .eq('check_frequency', frequency)
        .order('check_date', { ascending: false })
        .limit(5);

      if (!isStaff) {
        query = query.eq('user_id', effectiveUserId);
      }

      const { data, error } = await query;

      if (error) throw error;
      setRecentChecks(data || []);
    } catch (error) {
      console.error('Error loading recent checks:', error);
    }
  };

  const handleResultChange = (itemId: string, result: CheckItemResult) => {
    setItemResults(prev => {
      const current = prev[itemId];
      // Toggle off if tapping the already-selected option
      if (current === result) {
        const { [itemId]: _, ...rest } = prev;
        return rest;
      }
      // Clear attachments when moving away from fail
      if (current === 'fail' && result !== 'fail') {
        setItemAttachments(a => { const { [itemId]: _, ...rest } = a; return rest; });
      }
      return { ...prev, [itemId]: result };
    });
  };

  const handleNoteChange = (itemId: string, note: string) => {
    setNotes(prev => ({
      ...prev,
      [itemId]: note
    }));
  };

  // Detect (but never auto-link) prior still-open defects on failed items.
  // These are surfaced as a separate "Previous open defect — review / reopen"
  // affordance. The current run's defect state is NOT touched here.
  useEffect(() => {
    if (!activeTemplate || !effectiveUserId) return;

    const failedItemIds = Object.entries(itemResults)
      .filter(([, result]) => result === 'fail')
      .map(([itemId]) => itemId)
      .filter(itemId => !itemDefects[itemId] && !priorOpenDefects[itemId]);

    if (failedItemIds.length === 0) return;

    let cancelled = false;
    (async () => {
      let query = supabase
        .from('defects')
        .select('id, template_item_id, photo_paths, severity')
        .eq('ride_id', ride.id)
        .in('template_item_id', failedItemIds)
        .neq('status', 'resolved')
        .order('updated_at', { ascending: false });

      if (!isStaff) {
        query = query.eq('user_id', effectiveUserId);
      }

      const { data, error } = await query;
      if (cancelled || error || !data?.length) return;

      setPriorOpenDefects(prev => {
        const next = { ...prev };
        data.forEach((defect: any) => {
          if (!defect.template_item_id || next[defect.template_item_id]) return;
          next[defect.template_item_id] = {
            id: defect.id,
            photoCount: Array.isArray(defect.photo_paths) ? defect.photo_paths.length : 0,
            severity: defect.severity,
          };
        });
        return next;
      });
    })();

    return () => { cancelled = true; };
  }, [activeTemplate, effectiveUserId, isStaff, itemDefects, priorOpenDefects, itemResults, ride.id]);

  const getProgress = () => {
    if (!activeTemplate?.daily_check_template_items) return 0;
    const items = activeTemplate.daily_check_template_items;
    const totalItems = items.length;
    const completedCount = items.filter(item => {
      const r = itemResults[item.id];
      if (r === 'pass' || r === 'na') return true;
      if (r === 'fail') return !!itemDefectRaised[item.id];
      return false;
    }).length;
    return totalItems > 0 ? (completedCount / totalItems) * 100 : 0;
  };

  // State for raw GPS coordinates (for deferred resolution when offline)
  const [rawGpsCoords, setRawGpsCoords] = useState<{ lat: number; lon: number } | null>(null);
  const [needsAddressResolution, setNeedsAddressResolution] = useState(false);

  // GPS location removed in showmen simplification - location field is manual-only

  const generatePDFBlob = async (checkId?: string): Promise<Blob | null> => {
    if (!activeTemplate) return null;

    try {
      // Fetch profile for company branding - use effectiveUserId to get operator's profile
      const { data: profile } = await supabase
        .from('profiles')
        .select('*')
        .eq('user_id', effectiveUserId)
        .single();

      // Fetch company logo if available
      let logoDataUrl: string | null = null;
      if (profile?.company_logo_path) {
        try {
          const { data: logoBlob } = await supabase.storage
            .from('ride-documents')
            .download(profile.company_logo_path);
          if (logoBlob) {
            logoDataUrl = await new Promise<string>((resolve) => {
              const reader = new FileReader();
              reader.onloadend = () => resolve(reader.result as string);
              reader.readAsDataURL(logoBlob);
            });
          }
        } catch (e) {
          console.log('Could not load company logo');
        }
      }

      // Fetch ride image if available
      const { data: rideImage } = await supabase
        .from('documents')
        .select('file_path')
        .eq('ride_id', ride.id)
        .like('mime_type', 'image/%')
        .limit(1)
        .maybeSingle();

      let rideImageDataUrl: string | null = null;
      if (rideImage) {
        try {
          const { data: imageBlob } = await supabase.storage
            .from('ride-documents')
            .download(rideImage.file_path);
          if (imageBlob) {
            rideImageDataUrl = await new Promise<string>((resolve) => {
              const reader = new FileReader();
              reader.onloadend = () => resolve(reader.result as string);
              reader.readAsDataURL(imageBlob);
            });
          }
        } catch (e) {
          console.log('Could not load ride image');
        }
      }

      // Fetch defects for this ride (open ones or ones linked to this check)
      // Build query - for staff, skip user_id filter (RLS handles access)
      let defectsQuery = supabase
        .from('defects')
        .select('*')
        .eq('ride_id', ride.id)
        .neq('status', 'resolved')
        .order('severity', { ascending: false });

      if (!isStaff) {
        defectsQuery = defectsQuery.eq('user_id', effectiveUserId);
      }

      const { data: defectsData } = await defectsQuery;

      // Type the defects
      type DefectRecord = {
        id: string;
        description: string;
        severity: 'non_urgent' | 'urgent' | 'stop_operation';
        status: string;
        location_on_ride: string | null;
        photo_paths: string[];
        reported_at: string;
      };
      const defects = (defectsData || []) as unknown as DefectRecord[];

      // Load defect photos
      const defectPhotos: { [defectId: string]: string[] } = {};
      for (const defect of defects) {
        if (defect.photo_paths && defect.photo_paths.length > 0) {
          const photoDataUrls: string[] = [];
          for (const path of defect.photo_paths.slice(0, 3)) { // Limit to 3 photos per defect in PDF
            try {
              const { data: photoBlob } = await supabase.storage
                .from('defect-photos')
                .download(path);
              if (photoBlob) {
                const dataUrl = await new Promise<string>((resolve) => {
                  const reader = new FileReader();
                  reader.onloadend = () => resolve(reader.result as string);
                  reader.readAsDataURL(photoBlob);
                });
                photoDataUrls.push(dataUrl);
              }
            } catch (e) {
              console.log('Could not load defect photo');
            }
          }
          if (photoDataUrls.length > 0) {
            defectPhotos[defect.id] = photoDataUrls;
          }
        }
      }

      const pdf = new jsPDF();
      const pageWidth = pdf.internal.pageSize.getWidth();
      const pageHeight = pdf.internal.pageSize.getHeight();
      const margin = 13;
      const leftCol = margin;
      const labelWidth = 32;
      let currentY = margin;

      // Helper function to check for page overflow and add new page if needed
      const checkPageOverflow = (neededSpace: number = 30) => {
        if (currentY > pageHeight - neededSpace) {
          pdf.addPage();
          currentY = margin;
        }
      };

      const docId = await generateDocumentId(ride.id, 'IC');
      const frequencyLabel = frequency === 'preopening' ? 'PRE-OPENING' : frequency.toUpperCase();
      const templateOpts = { doc: pdf, title: `${frequencyLabel} CHECKLIST`, documentId: docId, docType: 'IC' as const };

      currentY = drawTemplateHeader(templateOpts);

      // === EQUIPMENT DETAILS ===
      currentY = drawSectionTitle(pdf, 'Equipment Details', currentY);
      currentY = await drawEquipmentDetails({
        doc: pdf,
        y: currentY,
        fields: [
          { label: 'Equipment', value: ride.ride_name },
          { label: 'Category', value: ride.ride_categories?.name },
          { label: 'Manufacturer', value: ride.manufacturer },
          { label: 'Serial No', value: ride.serial_number },
          { label: 'Year', value: ride.year_manufactured?.toString() },
          { label: 'Controller', value: ride.owner_name },
        ],
        imageDataUrl: rideImageDataUrl,
      });

      // === CHECK DETAILS SECTION ===
      pdf.setDrawColor(200);
      pdf.line(margin, currentY, pageWidth - margin, currentY);
      currentY += 8;

      pdf.setFontSize(11);
      pdf.setFont('helvetica', 'bold');
      pdf.setTextColor(50, 50, 50);
      pdf.text('Check Details', margin, currentY);
      currentY += 8;

      pdf.setFontSize(10);
      pdf.setFont('helvetica', 'normal');
      pdf.setTextColor(0);

      pdf.setFont('helvetica', 'bold');
      pdf.text('Checked By:', leftCol, currentY);
      pdf.setFont('helvetica', 'normal');
      pdf.text(inspectorName || '-', leftCol + labelWidth, currentY);
      currentY += 6;

      pdf.setFont('helvetica', 'bold');
      pdf.text('Location:', leftCol, currentY);
      pdf.setFont('helvetica', 'normal');
      pdf.text(location || '-', leftCol + labelWidth, currentY);
      currentY += 6;

      // Calculate pass/fail summary
      const totalItems = activeTemplate.daily_check_template_items.length;
      const passedItems = Object.values(itemResults).filter(r => r === 'pass').length;
      const failedItems = Object.values(itemResults).filter(r => r === 'fail').length;
      const naItems = totalItems - passedItems - failedItems;
      const allPassed = failedItems === 0 && naItems === 0;

      currentY += 4;
      pdf.setFont('helvetica', 'bold');
      pdf.text('Result:', leftCol, currentY);
      pdf.setFont('helvetica', 'normal');
      if (allPassed && defects.length === 0) {
        pdf.setTextColor(34, 139, 34); // Green
        pdf.text('ALL CHECKS PASSED', leftCol + labelWidth, currentY);
      } else if (failedItems === 0 && defects.length > 0) {
        pdf.setTextColor(255, 140, 0); // Orange
        pdf.text(`PASSED WITH ${defects.length} DEFECT(S) NOTED`, leftCol + labelWidth, currentY);
      } else if (failedItems > 0) {
        pdf.setTextColor(220, 53, 69); // Red
        pdf.text(`${failedItems} ITEM(S) FAILED`, leftCol + labelWidth, currentY);
      } else {
        pdf.setTextColor(100); // Gray
        pdf.text(`${passedItems} PASS, ${failedItems} FAIL, ${naItems} N/A`, leftCol + labelWidth, currentY);
      }
      pdf.setTextColor(0);
      currentY += 10;

      // === CHECK ITEMS TABLE ===
      pdf.setDrawColor(200);
      pdf.line(margin, currentY, pageWidth - margin, currentY);
      currentY += 8;

      pdf.setFontSize(11);
      pdf.setFont('helvetica', 'bold');
      pdf.setTextColor(50, 50, 50);
      pdf.text('Check Items', margin, currentY);
      currentY += 8;

      pdf.setFontSize(9);
      pdf.setFont('helvetica', 'normal');
      pdf.setTextColor(0);

      activeTemplate.daily_check_template_items
        .sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0))
        .forEach((item, index) => {
          const itemResult = itemResults[item.id] || 'na';
          const itemNote = notes[item.id] || '';

          // Check for page overflow
          checkPageOverflow(30);

          // Status indicator with color
          pdf.setFont('helvetica', 'bold');
          if (itemResult === 'pass') {
            pdf.setTextColor(34, 139, 34); // Green
            pdf.text('✓ PASS', leftCol, currentY);
          } else if (itemResult === 'fail') {
            pdf.setTextColor(220, 53, 69); // Red
            pdf.text('✗ FAIL', leftCol, currentY);
          } else {
            pdf.setTextColor(128, 128, 128); // Gray
            pdf.text('○ N/A', leftCol, currentY);
          }
          pdf.setTextColor(0);

          // Check item text
          pdf.setFont('helvetica', 'normal');
          const itemText = pdf.splitTextToSize(item.check_item_text, pageWidth - margin - 55);
          pdf.text(itemText, leftCol + 20, currentY);
          currentY += Math.max(itemText.length * 4, 5) + 2;

          // Note if present
          if (itemNote) {
            pdf.setFontSize(8);
            pdf.setTextColor(100);
            const noteText = pdf.splitTextToSize(`Note: ${itemNote}`, pageWidth - margin - 30);
            pdf.text(noteText, leftCol + 20, currentY);
            currentY += Math.max(noteText.length * 3.5, 4) + 2;
            pdf.setFontSize(9);
            pdf.setTextColor(0);
          }

          currentY += 2;
        });

      // === DEFECTS SECTION ===
      if (defects.length > 0) {
        checkPageOverflow(50);
        
        currentY += 5;
        pdf.setDrawColor(200);
        pdf.line(margin, currentY, pageWidth - margin, currentY);
        currentY += 8;

        pdf.setFontSize(11);
        pdf.setFont('helvetica', 'bold');
        pdf.setTextColor(220, 53, 69);
        pdf.text(`Defects Reported (${defects.length})`, margin, currentY);
        currentY += 10;

        for (const defect of defects) {
          checkPageOverflow(60);

          // Severity badge
          pdf.setFontSize(9);
          pdf.setFont('helvetica', 'bold');
          let severityLabel = '';
          let severityColor: [number, number, number] = [0, 0, 0];
          
          switch (defect.severity) {
            case 'stop_operation':
              severityLabel = '⛔ STOP OPERATION';
              severityColor = [220, 53, 69];
              break;
            case 'urgent':
              severityLabel = '⚠️ URGENT';
              severityColor = [255, 140, 0];
              break;
            case 'non_urgent':
              severityLabel = '📋 NON-URGENT';
              severityColor = [255, 193, 7];
              break;
          }

          pdf.setTextColor(...severityColor);
          pdf.text(severityLabel, leftCol, currentY);
          currentY += 5;

          // Description
          pdf.setTextColor(0);
          pdf.setFont('helvetica', 'normal');
          const descText = pdf.splitTextToSize(defect.description, pageWidth - 2 * margin);
          pdf.text(descText, leftCol, currentY);
          currentY += descText.length * 4 + 2;

          // Location on ride if present
          if (defect.location_on_ride) {
            pdf.setFontSize(8);
            pdf.setTextColor(100);
            pdf.text(`Location: ${defect.location_on_ride}`, leftCol, currentY);
            currentY += 4;
          }

          // Reported date
          pdf.setFontSize(8);
          pdf.setTextColor(100);
          pdf.text(`Reported: ${new Date(defect.reported_at).toLocaleDateString('en-GB')} ${new Date(defect.reported_at).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}`, leftCol, currentY);
          currentY += 6;

          // Defect photos
          const photos = defectPhotos[defect.id];
          if (photos && photos.length > 0) {
            checkPageOverflow(45);
            
            const photoSize = 35;
            const photoSpacing = 5;
            let photoX = leftCol;

            for (const photoUrl of photos) {
              if (photoX + photoSize > pageWidth - margin) {
                photoX = leftCol;
                currentY += photoSize + photoSpacing;
                checkPageOverflow(45);
              }

              try {
                pdf.addImage(photoUrl, 'JPEG', photoX, currentY, photoSize, photoSize);
                photoX += photoSize + photoSpacing;
              } catch (e) {
                console.log('Could not add defect photo to PDF');
              }
            }
            currentY += photoSize + 8;
          }

          currentY += 5;
          pdf.setFontSize(9);
          pdf.setTextColor(0);
        }
      }

      if (inspectorNotes) {
        currentY += 5;
        checkPageOverflow(40);
        pdf.setDrawColor(200);
        pdf.line(margin, currentY, pageWidth - margin, currentY);
        currentY += 8;
        pdf.setFontSize(11);
        pdf.setFont('helvetica', 'bold');
        pdf.setTextColor(50, 50, 50);
        pdf.text('Additional Notes', margin, currentY);
        currentY += 8;
        pdf.setFontSize(9);
        pdf.setFont('helvetica', 'normal');
        pdf.setTextColor(0);
        const splitNotes = pdf.splitTextToSize(inspectorNotes, pageWidth - 2 * margin);
        pdf.text(splitNotes, leftCol, currentY);
        currentY += splitNotes.length * 4 + 5;
      }

      // Add standardised footers to all pages
      drawTemplateFooters(templateOpts);

      return pdf.output('blob');
    } catch (error) {
      console.error('Error generating PDF:', error);
      return null;
    }
  };

  const generatePDF = async () => {
    const blob = await generatePDFBlob();
    if (!blob) {
      toast({
        title: "Error",
        description: "Failed to generate PDF",
        variant: "destructive"
      });
      return;
    }

    const frequencyLabel = frequency === 'preopening' ? 'Pre-Opening' : frequency.charAt(0).toUpperCase() + frequency.slice(1);
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${frequencyLabel}-Safety-Check-${ride.ride_name.replace(/[^a-zA-Z0-9]/g, '-')}-${new Date().toISOString().split('T')[0]}.pdf`;
    link.click();
    URL.revokeObjectURL(url);
    
    toast({
      title: "PDF Generated",
      description: "Check report has been downloaded"
    });
  };

  const handleSubmitChecks = async () => {
    if (guardWrite()) return;
    if (!activeTemplate) return;

    // Validation
    if (!inspectorName.trim()) {
      toast({
        title: "Name required",
        description: "Please enter the name of the person performing this check",
        variant: "destructive"
      });
      return;
    }

    if (!location.trim()) {
      setWizardStep('details');
      setLocationError(true);
      toast({
        title: "Location required",
        description: "Please enter the location before completing this check",
        variant: "destructive"
      });
      return;
    }

    setSubmitting(true);

    // Optimistically update the overview cache immediately
    const previousOverview = queryClient.getQueryData(['overview', user?.id]);
    queryClient.setQueryData(['overview', user?.id], (old: any) => {
      if (!old) return old;
      return {
        ...old,
        stats: {
          ...old.stats,
          recentChecks: old.stats.recentChecks + 1
        },
        recentActivity: [
          {
            type: 'check',
            title: `Check completed - ${ride.ride_name}`,
            time: new Date().toLocaleDateString('en-GB'),
            _optimistic: true
          },
          ...old.recentActivity.slice(0, 3)
        ]
      };
    });

    try {
      // Determine check status based on item results
      const failedItems = Object.values(itemResults).filter(r => r === 'fail').length;
      const passedItems = Object.values(itemResults).filter(r => r === 'pass').length;
      const totalItems = activeTemplate.daily_check_template_items.length;
      const checkStatus = failedItems > 0 ? 'failed' : passedItems === totalItems ? 'passed' : 'partial';

      // Prepare the check submission data
      const checkSubmission = {
        rideId: ride.id,
        templateId: activeTemplate.id,
        inspectorName: inspectorName.trim(),
        checkDate: new Date().toISOString().split('T')[0],
        checkFrequency: frequency,
        status: checkStatus,
        notes: inspectorNotes.trim() || undefined,
        location: location.trim() || undefined,
        // GPS coordinate fields for deferred address resolution
        rawLatitude: rawGpsCoords?.lat,
        rawLongitude: rawGpsCoords?.lon,
        needsAddressResolution: needsAddressResolution,
        // Start notice acknowledgement
        startNoticeAcknowledged: startNoticeAcknowledged || undefined,
        startNoticeAcknowledgedAt: startNoticeAcknowledgedAt || undefined,
        startNoticeAcknowledgedBy: startNoticeAcknowledged ? user?.id : undefined,
        startNoticeSnapshot: startNoticeAcknowledged ? (activeTemplate as any).start_notice_text : undefined,
        finishNoticeAcknowledged: finishNoticeAcknowledged || undefined,
        finishNoticeAcknowledgedAt: finishNoticeAcknowledgedAt || undefined,
        finishNoticeAcknowledgedBy: finishNoticeAcknowledged ? inspectorName.trim() : undefined,
        finishNoticeSnapshot: finishNoticeAcknowledged ? (activeTemplate as any).finish_notice_text : undefined,
        results: activeTemplate.daily_check_template_items.map(item => {
          const result = itemResults[item.id] || 'na';
          return {
            templateItemId: item.id,
            isChecked: result === 'pass', // backward compatibility
            result: result,
            notes: notes[item.id]?.trim() || undefined,
          };
        }),
      };

      // Use the offline-aware submit function
      const { success, isOffline, checkId } = await submitCheck(checkSubmission);

      if (!success) {
        throw new Error('Failed to submit check');
      }

      // ✅ Primary save succeeded — release the UI immediately so the spinner can never hang on side-effects
      setSubmitting(false);

      // Reset form (safe to do now)
      setItemResults({});
      setNotes({});
      setInspectorName('');
      setInspectorNotes('');
      setLocation('');
      setCheckStarted(false);
      setCheckStartedAt(null);
      setShowMaintenanceForItem(null);
      setDeclarationChecked(false);
      setStartNoticeAcknowledged(false);
      setStartNoticeAcknowledgedAt(null);
      setFinishNoticeAcknowledged(false);
      setFinishNoticeAcknowledgedAt(null);
      setItemDefects({});
      setItemDefectRaised({});

      // Notify parent first — navigation should not wait on side-effects
      onChecklistSaved?.();

      // ── SIDE-EFFECTS (non-blocking) ──────────────────────────────────
      // Each side-effect runs in its own try/catch. A failure here will surface
      // as a non-blocking toast but will NEVER prevent the save from completing.
      if (!isOffline && checkId) {
        const failedCount = Object.values(itemResults).filter(r => r === 'fail').length;
        const passedCount = Object.values(itemResults).filter(r => r === 'pass').length;
        const totalCount = activeTemplate.daily_check_template_items.length;
        const overallResult = failedCount > 0 ? 'failed' : passedCount === totalCount ? 'passed' : 'partial';

        const itemResultSnapshots: ItemResultSnapshot[] = activeTemplate.daily_check_template_items.map(item => ({
          template_item_id: item.id,
          check_item_text: item.check_item_text,
          category: item.category || null,
          result: (itemResults[item.id] || 'na') as 'pass' | 'fail' | 'na',
          notes: notes[item.id]?.trim() || null,
          is_required: item.is_required ?? false,
        }));

        // Fire-and-forget: defect fetch + inspection record + cache invalidation
        (async () => {
          try {
            const linkedDefectIds = Object.values(itemDefects).map(defect => defect.id);
            if (linkedDefectIds.length > 0) {
              await supabase
                .from('defects')
                .update({ check_id: checkId } as any)
                .in('id', linkedDefectIds)
                .is('check_id', null);
            }

            const { data: linkedDefects } = await supabase
              .from('defects')
              .select('id, severity')
              .or(`check_id.eq.${checkId},id.in.(${linkedDefectIds.join(',') || '00000000-0000-0000-0000-000000000000'})`);
            const defectIds = (linkedDefects || []).map(d => d.id);

            await createInspectionRecord({
              checkId,
              rideId: ride.id,
              userId: effectiveUserId!,
              inspectorName: inspectorName.trim() || 'Inspector',
              checkDate: new Date().toISOString().split('T')[0],
              checkFrequency: frequency,
              templateId: activeTemplate.id,
              templateName: activeTemplate.template_name,
              overallResult,
              itemResults: itemResultSnapshots,
              notes: inspectorNotes.trim() || null,
              weatherConditions: null,
              location: location.trim() || null,
              environmentNotes: null,
              complianceOfficer: null,
              signatureData: null,
              defectIds,
            });

            queryClient.invalidateQueries({ queryKey: ['overview'] });
            queryClient.invalidateQueries({ queryKey: ['checks'] });
            queryClient.invalidateQueries({ queryKey: ['inspection-records'] });
            loadRecentChecks().catch(() => {});

            const criticalDefectCount = (linkedDefects || []).filter((d: any) => d.severity === 'stop_operation').length;
            const totalDefectCount = (linkedDefects || []).length;
            if (failedCount > 0) {
              const defectSummary = totalDefectCount > 0
                ? `${totalDefectCount} defect${totalDefectCount !== 1 ? 's' : ''}${criticalDefectCount > 0 ? ` (${criticalDefectCount} critical)` : ''}`
                : '';
              toast({
                title: '⚠️ Check completed with failures',
                description: `${frequency.charAt(0).toUpperCase() + frequency.slice(1)} check saved for ${ride.ride_name}. ${failedCount} failed item${failedCount !== 1 ? 's' : ''}${defectSummary ? ` • ${defectSummary}` : ''}`,
                variant: criticalDefectCount > 0 ? 'destructive' : 'default',
              });
            } else {
              toast({
                title: 'Check completed ✓',
                description: `${frequency.charAt(0).toUpperCase() + frequency.slice(1)} check saved for ${ride.ride_name}`,
              });
            }
          } catch (sideEffectError) {
            console.error('Post-save side-effect failed (check is still saved):', sideEffectError);
            toast({
              title: 'Check saved — some follow-up steps failed',
              description: 'The check was saved successfully but the inspection record or summary could not be generated. You can regenerate from the Checks Log.',
              variant: 'default',
            });
          }
        })();
      }
    } catch (error) {
      // Rollback optimistic update
      if (previousOverview) {
        queryClient.setQueryData(['overview', user?.id], previousOverview);
      }
      console.error('Error submitting checks:', error);
      toast({
        title: 'Error',
        description: 'Failed to save check',
        variant: 'destructive',
      });
      setSubmitting(false);
    }
  };

  const [linkedChecksInfo, setLinkedChecksInfo] = useState<{ count: number; earliest: string | null; latest: string | null } | null>(null);
  const [checkingLinked, setCheckingLinked] = useState(false);

  const checkLinkedRecords = async () => {
    if (!activeTemplate) return;
    setCheckingLinked(true);
    try {
      const { data, error } = await supabase
        .from('checks')
        .select('check_date')
        .eq('template_id', activeTemplate.id)
        .order('check_date', { ascending: true });

      if (!error && data) {
        setLinkedChecksInfo({
          count: data.length,
          earliest: data.length > 0 ? data[0].check_date : null,
          latest: data.length > 0 ? data[data.length - 1].check_date : null,
        });
      }
    } catch (error) {
      console.error('Error checking linked records:', error);
    } finally {
      setCheckingLinked(false);
    }
  };

  const handleArchiveTemplate = async () => {
    if (!activeTemplate) return;

    try {
      const { error } = await supabase
        .from('daily_check_templates')
        .update({ is_archived: true, is_active: false })
        .eq('id', activeTemplate.id);

      if (error) throw error;

      toast({
        title: "Template archived",
        description: "The template has been archived and can be restored later",
      });

      setActiveTemplate(null);
    } catch (error: any) {
      console.error('Error archiving template:', error);
      toast({
        title: "Error archiving template",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const handleDeleteTemplate = async () => {
    if (!activeTemplate) return;

    try {
      const { error } = await supabase
        .from('daily_check_templates')
        .delete()
        .eq('id', activeTemplate.id);

      if (error) throw error;

      toast({
        title: "Template deleted",
        description: "The template has been permanently deleted",
      });

      setActiveTemplate(null);
    } catch (error: any) {
      console.error('Error deleting template:', error);
      toast({
        title: "Error deleting template",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center py-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (showTemplateBuilder) {
    return (
      <TemplateBuilder
        ride={ride}
        template={activeTemplate}
        frequency={frequency}
        onSuccess={() => {
          setShowTemplateBuilder(false);
          loadActiveTemplate();
          toast({
            title: "Template saved",
            description: "Your checklist template is ready to use.",
          });
          onChecklistSaved?.();
        }}
        onCancel={() => setShowTemplateBuilder(false)}
      />
    );
  }

  if (!activeTemplate) {
    // Staff cannot create templates — show a different message
    if (isStaff) {
      return (
        <EmptyState
          icon={FileText}
          title="No Checklist Available"
          description={`No ${frequency === 'preopening' ? 'pre-opening' : frequency} checklist has been set up for this equipment yet. Please contact your controller.`}
        />
      );
    }
    return (
      <EmptyState
        icon={FileText}
        title="No Checklist Found"
        description={`Build your ${frequency === 'preopening' ? 'pre-opening' : frequency} checklist to start recording checks.`}
        actionLabel="Build Checklist"
        onAction={() => setShowTemplateBuilder(true)}
      />
    );
  }

  // Start Check gate — show a start button before revealing the full checklist
  if (!checkStarted && activeTemplate) {
    const lastDoneLabel = recentChecks[0]
      ? new Date(recentChecks[0].check_date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })
      : null;
    const itemCount = activeTemplate.daily_check_template_items.length;

    return (
      <div id="inspection-checklist-form" className="checksWrap -mx-4 px-4 pb-6 pt-2 space-y-3">

        {/* ── Check header + CTA ── */}
        <div className="space-y-3">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <h2 className="text-[15px] font-semibold text-slate-900 leading-tight truncate" style={{ letterSpacing: '0.2px' }}>
                {activeTemplate.template_name}
              </h2>
              <p className="text-[11px] font-normal text-[#9CA3AF] mt-0.5">Routine: {FREQUENCY_LABELS[frequency] || frequency}</p>
            </div>
            {!isStaff && (
              <Button variant="outline" size="sm" onClick={() => setShowTemplateBuilder(true)} className="h-8 gap-1.5 text-[12px] shrink-0">
                <Settings className="h-3.5 w-3.5" />
                Edit Checklist
              </Button>
            )}
            {/* Overflow menu — hide secondary admin actions from staff */}
            {!isStaff && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0">
                    <MoreVertical className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={() => setShowTemplateBuilder(true)}>
                    <Settings className="h-4 w-4 mr-2" />
                    Edit Checklist
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={generatePDF}>
                    <Download className="h-4 w-4 mr-2" />
                    Export PDF
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            )}
          </div>

          <button
            className="t-btn-primary w-full py-3.5 text-sm"
            type="button"
            onClick={() => {
              // Preserve `from=checks` so Back returns to /checks rather than /rides.
              const fromChecks = new URLSearchParams(window.location.search).get('from') === 'checks';
              navigate(`/checks/${ride.id}/${frequency}/execute${fromChecks ? '?from=checks' : ''}`);
            }}
          >
            <PlayCircle className="h-4 w-4 shrink-0" />
            Start Check
          </button>

          <p className="text-[10px] text-center text-[#9CA3AF]">
            {itemCount} items{lastDoneLabel ? ` • Last completed ${lastDoneLabel}` : ''}
          </p>
        </div>

        {/* ── Open Defects (compact) ── */}
        <div className="flex items-center justify-between">
          <p className="text-[11px] font-medium text-muted-foreground">Open defects</p>
          <DefectReportDialog
            rideId={ride.id}
            rideName={ride.ride_name}
            checkFrequency={frequency}
            onDefectReported={() => setDefectRefreshKey(prev => prev + 1)}
            trigger={
              <button type="button" className="text-[11px] font-semibold text-primary hover:underline">
                + Raise
              </button>
            }
          />
        </div>
        <DefectsList
          key={defectRefreshKey}
          rideId={ride.id}
          rideName={ride.ride_name}
          showResolved={false}
          onDefectUpdated={() => setDefectRefreshKey(prev => prev + 1)}
        />

        {/* ── Inspection Records ── */}
        <InspectionRecordList
          rideId={ride.id}
          rideName={ride.ride_name}
          frequency={frequency}
          rideCategory={ride.ride_categories?.name}
          rideManufacturer={ride.manufacturer || undefined}
          rideSerialNumber={ride.serial_number || undefined}
        />

        <CheckDetailDialog
          check={selectedCheck}
          open={showCheckDetail}
          onOpenChange={setShowCheckDetail}
        />
      </div>
    );
  }



  return (
    <>
    <div id="inspection-checklist-form" className="checksWrap -mx-4 pb-32" style={{ background: '#F3F4F6' }}>

      {/* ── Offline / sync banner ── */}
      {(!isOnline || usingCachedTemplate || pendingCount > 0) && (
        <div className={`mx-4 mt-3 flex items-center justify-between gap-2 px-3 py-2 rounded-xl text-xs border ${
          !isOnline ? 'bg-warning/8 border-warning/30 text-warning' : pendingCount > 0 ? 'bg-info/8 border-info/30 text-info' : 'bg-muted border-muted-foreground/20 text-muted-foreground'
        }`}>
          <div className="flex items-center gap-1.5">
            {!isOnline ? <CloudOff className="h-3.5 w-3.5 shrink-0" /> : pendingCount > 0 ? <RefreshCw className={`h-3.5 w-3.5 shrink-0 ${isSyncing ? 'animate-spin' : ''}`} /> : <WifiOff className="h-3.5 w-3.5 shrink-0" />}
            <span>
              {!isOnline ? 'Offline — saved locally, synced when online' : pendingCount > 0 ? `${pendingCount} check${pendingCount > 1 ? 's' : ''} pending sync` : 'Using cached template'}
            </span>
          </div>
          {isOnline && pendingCount > 0 && !isSyncing && (
            <button onClick={syncAll} className="font-semibold underline underline-offset-2 shrink-0">Sync</button>
          )}
        </div>
      )}

      {/* ── WIZARD STEP 1: Check Details ── */}
      {wizardStep === 'details' && (
        <div className="mx-4 mt-3">
          <div className="bg-white border border-slate-200 rounded-md shadow-sm overflow-hidden">
            <div className="px-4 pt-4 pb-1">
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Step 1 of 2</p>
              <h2 className="text-[15px] font-bold text-slate-900 mt-0.5">Check Details</h2>
              <p className="text-[12px] text-slate-500 mt-0.5">Complete before starting the check.</p>
            </div>
              <div className="px-4 pb-4 pt-2 space-y-3">
              <div className="space-y-1">
                <Label htmlFor="checkedBy" className="text-[11px] font-bold text-slate-700">Checked By <span className="text-red-500">*</span></Label>
                <Input
                  id="checkedBy"
                  value={inspectorName}
                  onChange={(e) => { setInspectorName(e.target.value); setInspectorNameError(false); }}
                  placeholder="Your name"
                  className={`h-11 text-sm ${inspectorNameError ? 'border-red-500 ring-1 ring-red-500' : 'border-slate-300'}`}
                />
                {inspectorNameError && (
                  <p className="text-[11px] font-semibold text-red-600">Name is required to start this check.</p>
                )}
              </div>

              <div className="space-y-1">
                <Label htmlFor="checkLocation" className="text-[11px] font-bold text-slate-700">Location <span className="text-red-500">*</span></Label>
                <Input
                  id="checkLocation"
                  value={location}
                  onChange={(e) => { setLocation(e.target.value); setLocationError(false); }}
                  placeholder="e.g. Main fairground, Gate A"
                  className={`h-11 text-sm ${locationError ? 'border-red-500 ring-1 ring-red-500' : 'border-slate-300'}`}
                />
                {locationError && (
                  <p className="text-[11px] font-semibold text-red-600">Location is required to start this check.</p>
                )}
              </div>
              <button
                type="button"
                className="t-btn-primary w-full rounded-md py-3 text-[13px] mt-1"
                onClick={() => {
                  const hasName = !!inspectorName.trim();
                  const hasLocation = !!location.trim();

                  setInspectorNameError(!hasName);
                  setLocationError(!hasLocation);

                  if (!hasName || !hasLocation) {
                    return;
                  }

                  // If template has a start notice, show it before proceeding
                  const tmpl = activeTemplate as any;
                  if (tmpl?.start_notice_required && tmpl?.start_notice_text?.trim()) {
                    setWizardStep('start-notice');
                  } else {
                    setWizardStep('checklist');
                    setCheckStarted(true);
                    setCheckStartedAt(new Date());
                  }
                }}
              >
                {(() => {
                  const tmpl = activeTemplate as any;
                  return tmpl?.start_notice_required && tmpl?.start_notice_text?.trim() ? 'Continue' : 'Start Check';
                })()}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── START NOTICE GATE ── */}
      {wizardStep === 'start-notice' && activeTemplate && (
        <div className="mx-4 mt-3">
          <div className="bg-white border border-warning/40 rounded-md shadow-sm overflow-hidden">
            <div className="px-4 pt-4 pb-1">
              <p className="text-[10px] font-bold text-warning uppercase tracking-widest">⚠️ Important Notice</p>
              <h2 className="text-[15px] font-bold text-slate-900 mt-0.5">Start Notice</h2>
              <p className="text-[12px] text-slate-500 mt-0.5">You must acknowledge the following before starting this check.</p>
            </div>
            <div className="px-4 pb-4 pt-3 space-y-4">
              <div className="rounded-lg bg-warning/5 border border-warning/20 p-4">
                <p className="text-sm text-foreground whitespace-pre-wrap leading-relaxed">
                  {(activeTemplate as any).start_notice_text}
                </p>
              </div>
              <div className="flex items-start gap-3">
                <Checkbox
                  id="startNoticeAck"
                  checked={startNoticeAcknowledged}
                  onCheckedChange={(checked) => setStartNoticeAcknowledged(!!checked)}
                  className="mt-0.5"
                />
                <label htmlFor="startNoticeAck" className="text-[12px] text-slate-700 cursor-pointer leading-relaxed">
                  I have read and understood this notice and confirm I will comply with the above requirements.
                </label>
              </div>
              <button
                type="button"
                className="t-btn-primary w-full rounded-md py-3 text-[13px] disabled:opacity-50 disabled:cursor-not-allowed"
                disabled={!startNoticeAcknowledged}
                onClick={() => {
                  setStartNoticeAcknowledgedAt(new Date().toISOString());
                  setWizardStep('checklist');
                  setCheckStarted(true);
                  setCheckStartedAt(new Date());
                }}
              >
                Start Check
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── WIZARD STEP 2: Checklist ── */}
      {wizardStep === 'checklist' && (
        <>
          {/* Header card */}
          <div className="sticky top-0 z-30 mx-4 mt-2">
            <div className="rounded-xl px-4 py-3 shadow-sm border border-slate-200" style={{ background: '#EEF2F7' }}>
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                   <h2 className="text-[14.5px] font-semibold text-slate-900 leading-tight truncate" style={{ letterSpacing: '0.3px' }}>
                     {frequency === 'preopening' ? 'Pre-Opening Check' : frequency === 'daily' ? 'Daily Check' : frequency === 'weekly' ? 'Weekly Check' : frequency === 'monthly' ? 'Monthly Check' : frequency === 'yearly' ? 'Yearly Check' : `${frequency} Check`}
                   </h2>
                   <p className="text-[12px] font-normal text-slate-600 truncate mt-0.5">
                     {ride.ride_name}{ride.ride_code ? ` – ${ride.ride_code}` : ''}
                   </p>
                   <p className="text-[9.5px] font-normal text-[#9CA3AF] mt-0.5">
                     Checked by <span className="font-medium text-[#9CA3AF]">{inspectorName}</span>
                     {location ? ` · ${location}` : ''}
                   </p>
                </div>
                <button
                  type="button"
                  onClick={() => setWizardStep('details')}
                  className="text-[11px] font-bold text-primary shrink-0 hover:underline mt-1"
                >
                  Edit
                </button>
              </div>
              {/* Progress bar */}
              <div className="mt-2.5">
                <div className="flex items-center justify-between mb-1">
                  <p className="text-[10px] font-normal text-[#9CA3AF]">
                    {activeTemplate.daily_check_template_items.filter(item => { const r = itemResults[item.id]; return r === 'pass' || r === 'na' || (r === 'fail' && itemDefectRaised[item.id]); }).length} of {activeTemplate.daily_check_template_items.length} items completed
                  </p>
                  {getProgress() === 100 && (
                    <span className="text-[10px] font-bold text-green-700">✓ Done</span>
                  )}
                </div>
                <div className="h-2 rounded-full bg-[#E5E7EB] overflow-hidden">
                  <div className={`h-full rounded-full transition-all duration-300 ${getProgress() === 100 ? 'bg-green-600' : 'bg-[#2563EB]'}`} style={{ width: `${Math.round(getProgress())}%` }} />
                </div>
              </div>
            </div>
          </div>

      {/* ── Item cards ── */}
      <div className="mx-4 mt-2 space-y-2">
        {activeTemplate.daily_check_template_items
          .sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0))
          .map((item, index) => {
            const v = itemResults[item.id];
            const isFail = v === 'fail';
            const isPass = v === 'pass';
            const isNA = v === 'na';
            const hasResult = isPass || isFail || isNA;

            const cardBorder = isFail
              ? '4px solid #DC2626'
              : isPass
              ? '4px solid #16A34A'
              : isNA
              ? '4px solid #D97706'
              : 'none';

            return (
              <div
                key={item.id}
                data-item-id={item.id}
                className={`border rounded-2xl overflow-hidden transition-all shadow-[0_1px_4px_rgba(0,0,0,0.08)] ${isFail ? 'bg-[#FFF7F7]' : 'bg-white'} ${highlightItemId === item.id ? 'border-blue-500 ring-2 ring-blue-400/50' : 'border-slate-200/80'}`}
                style={{ borderLeft: cardBorder }}
              >
                {/* Row 1: Number circle + Title + Status icon */}
                 <div className="px-3 pt-2 pb-0.5 flex items-start gap-2.5">
                   <div className={`w-7 h-7 rounded-full flex items-center justify-center text-[12px] font-bold shrink-0 ${
                     isPass ? 'bg-green-600 text-white' : isFail ? 'bg-red-600 text-white' : isNA ? 'bg-amber-500 text-white' : 'bg-[#E5E7EB] text-slate-700 border border-slate-400 shadow-[inset_0_1px_2px_rgba(0,0,0,0.12)]'
                   }`}>
                     {isPass ? '✓' : isFail ? '✗' : isNA ? '—' : index + 1}
                   </div>
                   <div className="flex-1 min-w-0">
                     <div className="flex items-start justify-between gap-2">
                       <h3 className="font-medium text-slate-900 leading-relaxed break-words text-[12.5px]">
                         {item.check_item_text}
                       </h3>
                       <div className="flex items-center gap-1.5 shrink-0 mt-0.5">
                         {item.category && item.category !== 'general' && (
                           <span className="text-[8.5px] font-normal text-[#9CA3AF] uppercase tracking-wider bg-slate-50 border border-slate-200 rounded px-1.5 py-0.5">{item.category}</span>
                         )}
                         {isPass && <CheckCircle className="h-4 w-4 text-green-600" />}
                         {isFail && <AlertTriangle className="h-4 w-4 text-red-600" />}
                       </div>
                     </div>
                   </div>
                 </div>

                {/* Row 2: Segmented control (joined buttons) */}
                <div className="px-3 pb-2 pt-0">
                  <div className="flex rounded-lg overflow-hidden border border-slate-300">
                    <button
                      type="button"
                      onClick={() => handleResultChange(item.id, 'pass')}
                      className={`flex-1 h-11 text-[13px] font-bold flex items-center justify-center gap-1.5 transition-all active:scale-[0.98] focus:outline-none ${
                        isPass
                          ? 'bg-green-600 text-white'
                          : hasResult
                          ? 'bg-slate-50 text-slate-400 border-r border-slate-300'
                          : 'bg-white text-slate-700 hover:bg-slate-50 border-r border-slate-300'
                      }`}
                    >
                      <CheckCircle className="h-4 w-4 shrink-0" />
                      Pass
                    </button>
                    <button
                      type="button"
                      onClick={() => handleResultChange(item.id, 'fail')}
                      className={`flex-1 h-11 text-[13px] font-bold flex items-center justify-center gap-1.5 transition-all active:scale-[0.98] focus:outline-none ${
                        isFail
                          ? 'bg-red-600 text-white'
                          : hasResult
                          ? 'bg-slate-50 text-slate-400 border-r border-slate-300'
                          : 'bg-white text-slate-700 hover:bg-slate-50 border-r border-slate-300'
                      }`}
                    >
                      <XCircle className="h-4 w-4 shrink-0" />
                      Fail
                    </button>
                    <button
                      type="button"
                      onClick={() => handleResultChange(item.id, 'na')}
                      className={`flex-1 h-11 text-[13px] font-bold flex items-center justify-center transition-all active:scale-[0.98] focus:outline-none ${
                        isNA
                          ? 'bg-amber-500 text-white'
                          : hasResult
                          ? 'bg-slate-50 text-slate-400'
                          : 'bg-white text-slate-700 hover:bg-slate-50'
                      }`}
                    >
                      N/A
                    </button>
                   </div>

                   {/* Fail: expanded action section */}
                   {isFail && (
                     <div className="mt-2 space-y-2">
                       <p className="font-bold text-red-700 text-xs flex items-center gap-1.5">
                         <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
                         Action required
                       </p>

                       <Textarea
                         placeholder="Describe the failure…"
                         value={notes[item.id] || ''}
                         onChange={(e) => handleNoteChange(item.id, e.target.value)}
                         className="min-h-[56px] text-sm resize-none rounded-md bg-white border-slate-300"
                         rows={2}
                       />

                       <div className="flex gap-2">
                          {!itemDefects[item.id] ? (
                            <DefectReportDialog
                              rideId={ride.id}
                              rideName={ride.ride_name}
                              checkFrequency={frequency}
                              templateItemId={item.id}
                              defaultDescription={notes[item.id] || ''}
                              onDefectReported={(info) => {
                                setDefectRefreshKey(prev => prev + 1);
                                setItemDefectRaised(prev => ({ ...prev, [item.id]: true }));
                                if (info) {
                                  setItemDefects(prev => ({ ...prev, [item.id]: { id: info.defectId, photoCount: info.photoCount, severity: info.severity } }));
                                }
                              }}
                              trigger={
                                <button type="button" className="h-9 rounded-md border border-red-300 text-xs font-bold flex items-center justify-center gap-1.5 text-red-700 hover:bg-red-50 flex-1 transition-colors">
                                  <AlertTriangle className="h-3 w-3 shrink-0" />
                                  Raise Defect
                                </button>
                              }
                            />
                          ) : (
                            <button
                              type="button"
                              onClick={() => setEditingDefectForItem(item.id)}
                              className="h-9 rounded-md border border-green-300 bg-green-50 text-xs font-bold flex items-center justify-center gap-1.5 text-green-800 hover:bg-green-100 flex-1 transition-colors"
                            >
                              <CheckCircle className="h-3 w-3 shrink-0" />
                              View / Edit defect
                              {itemDefects[item.id].photoCount > 0 && (
                                <span className="ml-1 inline-flex items-center gap-0.5 rounded-full bg-white border border-green-300 px-1.5 py-0.5 text-[10px] font-semibold text-green-700">
                                  📷 {itemDefects[item.id].photoCount}
                                </span>
                              )}
                            </button>
                          )}
                       </div>

                        {/* Edit-defect dialog (controlled, hydrates the existing defect) */}
                        {editingDefectForItem === item.id && itemDefects[item.id] && (
                          <DefectReportDialog
                            rideId={ride.id}
                            rideName={ride.ride_name}
                            checkFrequency={frequency}
                            templateItemId={item.id}
                            editDefectId={itemDefects[item.id].id}
                            open={true}
                            onOpenChange={(v) => { if (!v) setEditingDefectForItem(null); }}
                            onDefectReported={(info) => {
                              setDefectRefreshKey(prev => prev + 1);
                              if (info) {
                                setItemDefects(prev => ({ ...prev, [item.id]: { id: info.defectId, photoCount: info.photoCount, severity: info.severity } }));
                              }
                              setEditingDefectForItem(null);
                            }}
                          />
                        )}

                       {/* Defect status */}
                       {!itemDefectRaised[item.id] && (
                         <p className="text-[11px] font-semibold text-red-600 flex items-center gap-1">
                           <AlertTriangle className="h-3 w-3 shrink-0" />
                           Raise a defect to record evidence and complete this item
                         </p>
                       )}
                       {itemDefectRaised[item.id] && (
                         <p className="text-[11px] font-semibold text-green-700 flex items-center gap-1">
                           <CheckCircle className="h-3 w-3 shrink-0" />
                           Defect linked{itemDefects[item.id]?.photoCount ? ` · ${itemDefects[item.id].photoCount} photo${itemDefects[item.id].photoCount === 1 ? '' : 's'}` : ''}
                         </p>
                       )}

                       {/* Prior open defect — display-only, explicit review/reopen */}
                       {!itemDefects[item.id] && priorOpenDefects[item.id] && (
                         <div className="mt-1 rounded-md border border-amber-300 bg-amber-50 px-2.5 py-2 flex items-start gap-2">
                           <AlertTriangle className="h-3.5 w-3.5 shrink-0 text-amber-700 mt-0.5" />
                           <div className="flex-1 min-w-0">
                             <p className="text-[11px] font-bold text-amber-900">
                               Previous open defect exists
                             </p>
                             <p className="text-[10px] text-amber-800 mt-0.5">
                               Recorded on an earlier check of this item{priorOpenDefects[item.id].photoCount ? ` · ${priorOpenDefects[item.id].photoCount} photo${priorOpenDefects[item.id].photoCount === 1 ? '' : 's'}` : ''}. <span className="font-semibold">Not linked to this run.</span>
                             </p>
                             <button
                               type="button"
                               onClick={() => setReviewingPriorForItem(item.id)}
                               className="mt-1.5 h-7 px-2.5 rounded border border-amber-400 bg-white text-[11px] font-semibold text-amber-900 hover:bg-amber-100 transition-colors"
                             >
                               Review previous defect
                             </button>
                           </div>
                         </div>
                       )}

                       {/* Prior defect REVIEW dialog (read-only summary + explicit choice) */}
                       {reviewingPriorForItem === item.id && priorOpenDefects[item.id] && (
                         <PriorDefectReviewDialog
                           open={true}
                           onOpenChange={(v) => { if (!v) setReviewingPriorForItem(null); }}
                           defectId={priorOpenDefects[item.id].id}
                           onReopen={() => {
                             setReviewingPriorForItem(null);
                             setReopeningPriorForItem(item.id);
                           }}
                           onRaiseNew={() => {
                             setReviewingPriorForItem(null);
                             // Drop the prior chip so the standard "Raise Defect" path is used
                             setPriorOpenDefects(prev => { const { [item.id]: _, ...rest } = prev; return rest; });
                           }}
                         />
                       )}

                       {/* Reopen-prior dialog (only mounts after explicit Reopen click) */}
                       {reopeningPriorForItem === item.id && priorOpenDefects[item.id] && (
                         <DefectReportDialog
                           rideId={ride.id}
                           rideName={ride.ride_name}
                           checkFrequency={frequency}
                           templateItemId={item.id}
                           editDefectId={priorOpenDefects[item.id].id}
                           open={true}
                           onOpenChange={(v) => { if (!v) setReopeningPriorForItem(null); }}
                           onDefectReported={(info) => {
                             setDefectRefreshKey(prev => prev + 1);
                             if (info) {
                               setItemDefects(prev => ({ ...prev, [item.id]: { id: info.defectId, photoCount: info.photoCount, severity: info.severity } }));
                               setItemDefectRaised(prev => ({ ...prev, [item.id]: true }));
                               setPriorOpenDefects(prev => { const { [item.id]: _, ...rest } = prev; return rest; });
                             }
                             setReopeningPriorForItem(null);
                           }}
                         />
                       )}
                     </div>
                   )}

                   {/* Pass/N/A: compact — optional note only */}
                   {!isFail && (
                     notes[item.id] !== undefined ? (
                       <div className="mt-1.5">
                         <Textarea
                           placeholder="Add a note…"
                           value={notes[item.id] || ''}
                           onChange={(e) => handleNoteChange(item.id, e.target.value)}
                           className="min-h-[44px] text-xs resize-none rounded-md bg-white border-slate-300"
                           rows={1}
                         />
                       </div>
                     ) : (
                       <button
                         type="button"
                         onClick={() => handleNoteChange(item.id, '')}
                         className="mt-0.5 text-[11px] font-medium text-slate-500 hover:text-primary"
                       >
                         + Add note
                       </button>
                     )
                   )}
                </div>
              </div>
            );
          })}
      </div>

      {/* ── Defects (slim section) ── */}
       <div className="mx-4 mt-1.5">
         <div className="bg-white border border-slate-200 rounded-md p-3 shadow-sm">
           <div className="flex items-center justify-between mb-1.5">
             <p className="text-[11px] font-semibold text-slate-900 uppercase" style={{ letterSpacing: '0.5px' }}>Defects</p>
             <DefectReportDialog
               rideId={ride.id}
               rideName={ride.ride_name}
               checkFrequency={frequency}
               onDefectReported={() => setDefectRefreshKey(prev => prev + 1)}
               
               trigger={
                 <button type="button" className="text-[11px] font-bold text-primary hover:underline">
                   + Raise defect
                 </button>
               }
             />
          </div>
          <DefectsList
            key={defectRefreshKey}
            rideId={ride.id}
            rideName={ride.ride_name}
            showResolved={false}
            onDefectUpdated={() => setDefectRefreshKey(prev => prev + 1)}
          />
        </div>
      </div>

      {/* ── Confirmation Card ── */}
        <div className="mx-4 mt-3">
          <div className="bg-white border border-slate-300 rounded-2xl p-4 shadow-[0_2px_8px_rgba(0,0,0,0.06)] space-y-3">
           <h3 className="text-[13px] font-semibold text-slate-900 uppercase" style={{ letterSpacing: '0.5px' }}>Confirmation</h3>

          {/* Warning: unanswered items */}
           {getProgress() < 100 && (
             <button
               type="button"
               className="w-full text-left"
               onClick={() => {
                 const sorted = activeTemplate.daily_check_template_items
                   .sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0));
                 const firstIncomplete = sorted.find(item => {
                   const r = itemResults[item.id];
                   if (!r) return true;
                   if (r === 'fail' && !itemDefectRaised[item.id]) return true;
                   return false;
                 });
                 if (firstIncomplete) {
                   const el = document.querySelector(`[data-item-id="${firstIncomplete.id}"]`);
                   if (el) {
                     el.scrollIntoView({ behavior: 'smooth', block: 'center' });
                     setHighlightItemId(firstIncomplete.id);
                     setTimeout(() => setHighlightItemId(null), 1500);
                   }
                 }
               }}
             >
                <p className="text-[11px] text-red-600 font-semibold leading-snug hover:underline">
                  ⚠ {activeTemplate.daily_check_template_items.filter(item => { const r = itemResults[item.id]; return !r || (r === 'fail' && !itemDefectRaised[item.id]); }).length} items remaining — answer all items and raise defects for failures. Tap to view.
               </p>
             </button>
           )}

           {getProgress() === 100 && (
              <p className="text-[11px] text-green-700 font-semibold leading-snug">
                ✓ All items completed. Ready to confirm.
              </p>
           )}

            {(activeTemplate as any).finish_notice_required && (activeTemplate as any).finish_notice_text?.trim() && (
              <div className="rounded-lg border border-warning/30 bg-warning/5 p-3 space-y-2">
                <p className="text-[11px] font-bold text-warning uppercase">Before you finish</p>
                <p className="text-[12px] text-slate-700 whitespace-pre-wrap leading-relaxed">{(activeTemplate as any).finish_notice_text}</p>
                <label className="flex items-start gap-2 text-[12px] font-medium text-slate-700 cursor-pointer">
                  <Checkbox
                    checked={finishNoticeAcknowledged}
                    onCheckedChange={(checked) => {
                      setFinishNoticeAcknowledged(!!checked);
                      setFinishNoticeAcknowledgedAt(checked ? new Date().toISOString() : null);
                    }}
                    className="mt-0.5"
                    disabled={getProgress() < 100}
                  />
                  I have completed these close-out checks.
                </label>
              </div>
            )}

          <div className="border-t border-slate-100 pt-3">
             <label className={`flex items-start gap-2.5 group ${
               getProgress() < 100
                 ? 'opacity-40 pointer-events-none'
                 : 'cursor-pointer'
             }`}>
                <div
                  className={`mt-0.5 w-5 h-5 shrink-0 rounded border-2 flex items-center justify-center transition-colors ${
                    declarationChecked ? 'bg-primary border-primary' :
                    getProgress() < 100
                      ? 'border-slate-300 bg-slate-100'
                      : 'border-slate-400 group-hover:border-primary'
                  }`}
                 onClick={() => {
                   if (getProgress() === 100) setDeclarationChecked(prev => !prev);
                 }}
               >
                 {declarationChecked && <CheckCircle className="h-3.5 w-3.5 text-primary-foreground" />}
               </div>
               <span
                 className="text-[12px] text-slate-700 leading-snug select-none font-medium"
                 onClick={() => {
                   if (getProgress() === 100) setDeclarationChecked(prev => !prev);
                 }}
               >
                I confirm this check is complete, accurate, and the results recorded truthfully.
              </span>
            </label>
          </div>
        </div>
      </div>

      {/* ── Recent Checks (collapsed) ── */}
      {recentChecks.length > 0 && (
        <div className="mx-4 mt-2 mb-2">
          <details className="group">
            <summary className="text-[10px] font-bold text-slate-500 uppercase tracking-wide cursor-pointer hover:text-slate-700 list-none flex items-center gap-1.5">
              <ChevronDown className="h-3 w-3 group-open:rotate-180 transition-transform shrink-0" />
              Recent checks ({recentChecks.length})
            </summary>
            <div className="mt-1.5 space-y-1">
              {recentChecks.map((check) => (
                <div
                  key={check.id}
                  className="flex items-center justify-between rounded-md border border-slate-200 bg-white px-3 py-2 cursor-pointer hover:bg-slate-50 transition-colors shadow-sm"
                  onClick={() => { setSelectedCheck(check); setShowCheckDetail(true); }}
                >
                  <div className="min-w-0 flex-1">
                    <p className="font-bold text-[12px] truncate text-slate-900">{check.inspector_name}</p>
                    <p className="text-[11px] text-slate-500">
                      {new Date(check.check_date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}
                    </p>
                  </div>
                  <Eye className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                </div>
              ))}
            </div>
          </details>
        </div>
      )}

      {/* ── Sticky footer ── */}
      <div className="fixed left-0 right-0 bottom-0 z-30 border-t border-slate-300 bg-white/95 backdrop-blur-sm shadow-[0_-2px_8px_rgba(0,0,0,0.08)]">
        <div className="max-w-xl mx-auto px-4 py-2 flex gap-2">
          <button
            type="button"
            className="flex-1 rounded-md border border-slate-300 py-2.5 text-[13px] font-bold bg-white hover:bg-slate-50 text-slate-700 transition-colors"
            onClick={() => {
              if (Object.keys(itemResults).length > 0) {
                setWizardStep('details');
              } else {
                navigate(`/rides/${ride.id}?tab=checks`);
              }
            }}
          >
            Save & Exit
          </button>
          <button
            type="button"
            disabled={submitting || !inspectorName.trim() || !declarationChecked || getProgress() < 100 || (!!(activeTemplate as any).finish_notice_required && !!(activeTemplate as any).finish_notice_text?.trim() && !finishNoticeAcknowledged)}
            onClick={handleSubmitChecks}
            className="flex-1 t-btn-primary rounded-md py-2.5 text-[13px]"
          >
            {submitting ? (
              <><Loader2 className="h-4 w-4 animate-spin shrink-0" />Saving…</>
            ) : (
              <>Complete Check</>
            )}
          </button>
        </div>
      </div>

      <CheckDetailDialog check={selectedCheck} open={showCheckDetail} onOpenChange={setShowCheckDetail} />
        </>
      )}
    </div>

    </>
  );
};

export default InspectionChecklist;
