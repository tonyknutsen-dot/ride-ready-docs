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
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Download, FileText, CheckCircle, Clock, AlertTriangle, Mail, Printer, Plus, Settings, Trash2, Archive, MapPin, Locate, Loader2, WifiOff, CloudOff, RefreshCw, XCircle, MinusCircle, Eye, MoreVertical, ChevronDown, ChevronUp, PlayCircle, Wrench } from 'lucide-react';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
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
import DefectsList from './DefectsList';
import { useOfflineCheck } from '@/hooks/useOfflineCheck';
import { useOfflineSync } from '@/hooks/useOfflineSync';
import { getCachedTemplatesForRide, findCachedAddress, cacheLocationAddress, type CachedTemplate, type CheckItemResult } from '@/lib/offlineDb';
import CheckDetailDialog from './CheckDetailDialog';
import QuickMaintenanceLog from './QuickMaintenanceLog';

type Ride = Tables<'rides'> & {
  ride_categories: {
    name: string;
    description: string | null;
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

const InspectionChecklist = ({ ride, frequency, onChecklistSaved, startImmediately = false }: InspectionChecklistProps) => {
  const navigate = useNavigate();
  const [activeTemplate, setActiveTemplate] = useState<Template | null>(null);
  const [recentChecks, setRecentChecks] = useState<Check[]>([]);
  const [itemResults, setItemResults] = useState<{ [key: string]: CheckItemResult }>({});
  const [notes, setNotes] = useState<{ [key: string]: string }>({});
  const [inspectorName, setInspectorName] = useState('');
  const [inspectorNotes, setInspectorNotes] = useState('');
  const [weatherConditions, setWeatherConditions] = useState('');
  const [environmentNotes, setEnvironmentNotes] = useState('');
  const [complianceOfficer, setComplianceOfficer] = useState('');
  const [signatureData, setSignatureData] = useState('');
  const [location, setLocation] = useState('');
  const [gettingLocation, setGettingLocation] = useState(false);
  const [submitting, setSubmitting] = useState(false);
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

  const { toast } = useToast();
  const { user } = useAuth();
  const { effectiveUserId, isStaff } = useEffectiveUserId();
  const queryClient = useQueryClient();
  const { submitCheck, isOnline } = useOfflineCheck();
  const { pendingCount, isSyncing, syncAll } = useOfflineSync();

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

  const getProgress = () => {
    if (!activeTemplate?.daily_check_template_items) return 0;
    const totalItems = activeTemplate.daily_check_template_items.length;
    const answeredCount = Object.values(itemResults).filter(r => r === 'pass' || r === 'fail' || r === 'na').length;
    return totalItems > 0 ? (answeredCount / totalItems) * 100 : 0;
  };

  // State for raw GPS coordinates (for deferred resolution when offline)
  const [rawGpsCoords, setRawGpsCoords] = useState<{ lat: number; lon: number } | null>(null);
  const [needsAddressResolution, setNeedsAddressResolution] = useState(false);

  const getGPSLocation = async () => {
    if (!navigator.geolocation) {
      toast({
        title: "GPS not available",
        description: "Your device doesn't support GPS location",
        variant: "destructive"
      });
      return;
    }

    setGettingLocation(true);
    
    // Helper to attempt GPS with specific accuracy settings
    const attemptGPS = (highAccuracy: boolean, timeout: number): Promise<GeolocationPosition> => {
      return new Promise((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(resolve, reject, {
          enableHighAccuracy: highAccuracy,
          timeout: timeout,
          maximumAge: 300000 // 5 minutes cache is fine for location
        });
      });
    };

    try {
      let position: GeolocationPosition;
      
      try {
        // First try: high accuracy with 30 second timeout
        position = await attemptGPS(true, 30000);
      } catch (firstError: any) {
        // If high accuracy times out, try with low accuracy (faster, uses network/wifi)
        if (firstError.code === 3) {
          toast({
            title: "Trying alternative location method...",
            description: "High accuracy GPS timed out, using network location",
          });
          position = await attemptGPS(false, 15000);
        } else {
          throw firstError;
        }
      }

      const { latitude, longitude } = position.coords;
      
      // Check if we're online - if offline, try cache first then store coordinates for deferred resolution
      if (!navigator.onLine) {
        // Try to find a cached address for this location
        const cachedLocation = await findCachedAddress(latitude, longitude);
        if (cachedLocation) {
          setLocation(cachedLocation.address);
          setRawGpsCoords(null);
          setNeedsAddressResolution(false);
          toast({
            title: "📍 Location found (cached)",
            description: cachedLocation.address,
          });
          setGettingLocation(false);
          return;
        }
        
        // No cached address - store raw coordinates for deferred resolution
        setLocation(`${latitude.toFixed(6)}, ${longitude.toFixed(6)}`);
        setRawGpsCoords({ lat: latitude, lon: longitude });
        setNeedsAddressResolution(true);
        toast({
          title: "📍 GPS location captured",
          description: "Address will resolve when online",
        });
        setGettingLocation(false);
        return;
      }
      
      // Online - try to get address using reverse geocoding
      try {
        const response = await fetch(
          `https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}&zoom=18&addressdetails=1`,
          { headers: { 'Accept-Language': 'en' } }
        );
        const data = await response.json();
        
        if (data.display_name) {
          // Extract a shorter, cleaner address
          const parts = [];
          if (data.address?.road) parts.push(data.address.road);
          if (data.address?.village || data.address?.town || data.address?.city) {
            parts.push(data.address.village || data.address.town || data.address.city);
          }
          if (data.address?.county) parts.push(data.address.county);
          if (data.address?.postcode) parts.push(data.address.postcode);
          
          const shortAddress = parts.length > 0 ? parts.join(', ') : data.display_name;
          setLocation(shortAddress);
          setRawGpsCoords(null);
          setNeedsAddressResolution(false);
          
          // Cache this address for future offline use
          await cacheLocationAddress(latitude, longitude, shortAddress);
          
          toast({
            title: "Location detected",
            description: shortAddress,
          });
        } else {
          // Fallback to coordinates
          setLocation(`${latitude.toFixed(6)}, ${longitude.toFixed(6)}`);
          setRawGpsCoords({ lat: latitude, lon: longitude });
          setNeedsAddressResolution(true);
          toast({
            title: "Location captured",
            description: "Coordinates saved (address lookup unavailable)",
          });
        }
      } catch {
        // Fallback to coordinates if geocoding fails - mark for deferred resolution
        setLocation(`${latitude.toFixed(6)}, ${longitude.toFixed(6)}`);
        setRawGpsCoords({ lat: latitude, lon: longitude });
        setNeedsAddressResolution(true);
        toast({
          title: "📍 GPS location captured",
          description: "Address will resolve when online",
        });
      }
    } catch (error: any) {
      let message = "Could not get your location";
      if (error.code === 1) message = "Location access denied. Please enable GPS permissions in your browser/device settings.";
      if (error.code === 2) message = "Location unavailable. Please check GPS is enabled on your device.";
      if (error.code === 3) message = "Location request timed out. Please try again or enter location manually.";
      
      toast({
        title: "GPS Error",
        description: message,
        variant: "destructive"
      });
    } finally {
      setGettingLocation(false);
    }
  };

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
      const templateOpts = { doc: pdf, title: `${frequencyLabel} INSPECTION CHECKLIST`, documentId: docId, docType: 'IC' as const };

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
          { label: 'Owner', value: ride.owner_name },
        ],
        imageDataUrl: rideImageDataUrl,
      });

      // === INSPECTION DETAILS SECTION ===
      pdf.setDrawColor(200);
      pdf.line(margin, currentY, pageWidth - margin, currentY);
      currentY += 8;

      pdf.setFontSize(11);
      pdf.setFont('helvetica', 'bold');
      pdf.setTextColor(50, 50, 50);
      pdf.text('Inspection Details', margin, currentY);
      currentY += 8;

      pdf.setFontSize(10);
      pdf.setFont('helvetica', 'normal');
      pdf.setTextColor(0);

      pdf.setFont('helvetica', 'bold');
      pdf.text('Checked By:', leftCol, currentY);
      pdf.setFont('helvetica', 'normal');
      pdf.text(inspectorName || '-', leftCol + labelWidth, currentY);
      currentY += 6;

      if (weatherConditions) {
        pdf.setFont('helvetica', 'bold');
        pdf.text('Weather:', leftCol, currentY);
        pdf.setFont('helvetica', 'normal');
        pdf.text(weatherConditions, leftCol + labelWidth, currentY);
        currentY += 6;
      }

      // Location if available
      const checkLocation = location;
      if (checkLocation) {
        pdf.setFont('helvetica', 'bold');
        pdf.text('Location:', leftCol, currentY);
        pdf.setFont('helvetica', 'normal');
        const locationText = pdf.splitTextToSize(checkLocation, pageWidth - margin - labelWidth - 25);
        pdf.text(locationText, leftCol + labelWidth, currentY);
        currentY += Math.max(locationText.length * 4, 6);
      }

      if (complianceOfficer) {
        pdf.setFont('helvetica', 'bold');
        pdf.text('Compliance Officer:', leftCol, currentY);
        pdf.setFont('helvetica', 'normal');
        pdf.text(complianceOfficer, leftCol + labelWidth + 10, currentY);
        currentY += 6;
      }

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

      // === INSPECTOR NOTES SECTION ===
      if (inspectorNotes || environmentNotes) {
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

        if (inspectorNotes) {
          pdf.setFont('helvetica', 'bold');
          pdf.text('Inspector Notes:', leftCol, currentY);
          currentY += 5;
          pdf.setFont('helvetica', 'normal');
          const splitNotes = pdf.splitTextToSize(inspectorNotes, pageWidth - 2 * margin);
          pdf.text(splitNotes, leftCol, currentY);
          currentY += splitNotes.length * 4 + 5;
        }

        if (environmentNotes) {
          pdf.setFont('helvetica', 'bold');
          pdf.text('Environment Notes:', leftCol, currentY);
          currentY += 5;
          pdf.setFont('helvetica', 'normal');
          const splitEnv = pdf.splitTextToSize(environmentNotes, pageWidth - 2 * margin);
          pdf.text(splitEnv, leftCol, currentY);
          currentY += splitEnv.length * 4 + 5;
        }
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
            title: `Safety check completed - ${ride.ride_name}`,
            time: new Date().toLocaleDateString('en-GB'),
            _optimistic: true
          },
          ...old.recentActivity.slice(0, 3)
        ]
      };
    });

    try {
      // Prepare the check submission data
      const checkSubmission = {
        rideId: ride.id,
        templateId: activeTemplate.id,
        inspectorName: inspectorName.trim(),
        checkDate: new Date().toISOString().split('T')[0],
        checkFrequency: frequency,
        status: 'completed',
        notes: inspectorNotes.trim() || undefined,
        weatherConditions: weatherConditions.trim() || undefined,
        location: location.trim() || undefined,
        signatureData: signatureData.trim() || undefined,
        complianceOfficer: complianceOfficer.trim() || undefined,
        environmentNotes: environmentNotes.trim() || undefined,
        // GPS coordinate fields for deferred address resolution
        rawLatitude: rawGpsCoords?.lat,
        rawLongitude: rawGpsCoords?.lon,
        needsAddressResolution: needsAddressResolution,
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
      const { success, isOffline } = await submitCheck(checkSubmission);

      if (!success) {
        throw new Error('Failed to submit check');
      }

      // If submitted online, generate and save PDF (non-blocking)
      if (!isOffline) {
        const savedInspectorName = inspectorName;
        const savedWeatherConditions = weatherConditions;
        
        generatePDFBlob().then(async (pdfBlob) => {
          if (pdfBlob) {
            const frequencyLabel = frequency === 'preopening' ? 'Pre-Opening' : frequency.charAt(0).toUpperCase() + frequency.slice(1);
            const dateStr = new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
            const fileName = `${frequencyLabel}-Check-${ride.ride_name.replace(/[^a-zA-Z0-9]/g, '-')}-${new Date().toISOString().split('T')[0]}.pdf`;
            // Use effectiveUserId for storage path so staff data syncs with operator
            const filePath = `${effectiveUserId}/${ride.id}/check-records/${fileName}`;
            
            const { error: uploadError } = await supabase.storage
              .from('ride-documents')
              .upload(filePath, pdfBlob, {
                contentType: 'application/pdf',
                upsert: false
              });

            if (!uploadError) {
              // Use effectiveUserId for document record so staff data syncs with operator
              await supabase
                .from('documents')
                .insert({
                  user_id: effectiveUserId,
                  ride_id: ride.id,
                  document_name: `${frequencyLabel} Safety Check - ${ride.ride_name} - ${dateStr}`,
                  document_type: 'Check Record',
                  file_path: filePath,
                  mime_type: 'application/pdf',
                  file_size: pdfBlob.size,
                  notes: `Checked by: ${savedInspectorName}${savedWeatherConditions ? ` | Weather: ${savedWeatherConditions}` : ''}`
                });

              // Register in ride_documents
              const docId = await generateDocumentId(ride.id, 'IC');
              const rideCode = await getRideCode(ride.id);
              await storeRideDocument({
                rideId: ride.id,
                rideCode,
                documentType: 'IC',
                documentId: docId,
                fileUrl: filePath,
                title: `${frequencyLabel} Safety Check – ${ride.ride_name} – ${dateStr}`,
                metadata: { inspector: savedInspectorName, frequency },
              });

              queryClient.invalidateQueries({ queryKey: ['overview'] });
              queryClient.invalidateQueries({ queryKey: ['documents'] });
            }
          }
        });

        toast({
          title: "Check completed ✓",
          description: `${frequency.charAt(0).toUpperCase() + frequency.slice(1)} check saved for ${ride.ride_name}`
        });
      }
      // If offline, the useOfflineCheck hook already shows a toast

      // Reset form
      setItemResults({});
      setNotes({});
      setInspectorName('');
      setInspectorNotes('');
      setWeatherConditions('');
      setEnvironmentNotes('');
      setComplianceOfficer('');
      setSignatureData('');
      setLocation('');
      setCheckStarted(false);
      setCheckStartedAt(null);
      setShowMaintenanceForItem(null);
      setDeclarationChecked(false);

      // Reload recent checks (will be empty if offline but that's expected)
      if (!isOffline) {
        await loadRecentChecks();
        queryClient.invalidateQueries({ queryKey: ['overview'] });
        queryClient.invalidateQueries({ queryKey: ['checks'] });
      }
    } catch (error) {
      // Rollback optimistic update
      if (previousOverview) {
        queryClient.setQueryData(['overview', user?.id], previousOverview);
      }
      console.error('Error submitting checks:', error);
      toast({
        title: "Error",
        description: "Failed to save check",
        variant: "destructive"
      });
    } finally {
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
    return (
      <EmptyState
        icon={FileText}
        title="No Checklist Found"
        description={`Build your ${frequency === 'preopening' ? 'pre-opening' : frequency} safety checklist to start recording checks.`}
        actionLabel="Build Checklist"
        onAction={() => setShowTemplateBuilder(true)}
      />
    );
  }

  // Start Check gate — show a start button before revealing the full checklist
  if (!checkStarted && activeTemplate) {
    return (
      <div id="inspection-checklist-form" className="checksWrap -mx-4 px-4 pb-6 pt-2 space-y-4">

        {/* ── Primary inspection card ── */}
        <div className="t-card">
          <div className="t-card-header flex items-center justify-between gap-2">
            <div className="min-w-0">
              <div className="text-xs text-muted-foreground">Next check</div>
              <div className="t-title text-lg truncate">{activeTemplate.template_name}</div>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <span className="t-chip">
                {activeTemplate.daily_check_template_items.length} items · PDF
              </span>
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
            </div>
          </div>

          <div className="p-4 space-y-4">
            {/* KPI mini-stats */}
            <div className="kpiGrid text-center">
              {[
                { label: 'Items', value: activeTemplate.daily_check_template_items.length },
                {
                  label: 'Last done',
                  value: recentChecks[0]
                    ? new Date(recentChecks[0].check_date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })
                    : '—',
                },
                { label: 'Due', value: 'Today' },
              ].map(({ label, value }) => (
                <div key={label} className="kpiCard rounded-2xl border border-border bg-[#f8fafc] p-3 overflow-hidden">
                  <div className="text-[11px] font-semibold" style={{ color: '#64748b' }}>{label}</div>
                  <div className="text-lg font-extrabold" style={{ color: '#0f172a' }}>{value}</div>
                </div>
              ))}
            </div>

            {/* Primary CTA */}
            <button
              className="t-btn-primary w-full py-3.5 text-sm"
              type="button"
              onClick={() => navigate(`/checks/${ride.id}/${frequency}/execute`)}
            >
              <PlayCircle className="h-4 w-4 shrink-0" />
              Start Inspection
            </button>

            <p className="text-xs text-center" style={{ color: '#94a3b8' }}>
              Any failed item automatically raises a defect.
            </p>
          </div>
        </div>

        {/* ── Open Defects card ── */}
        <div className="t-card">
          <div className="t-card-header flex items-center justify-between gap-2">
            <div>
              <div className="text-xs text-muted-foreground">Defects</div>
              <div className="t-title text-base">Open Defects</div>
            </div>
            <span className="t-chip">open</span>
          </div>
          <div className="p-4">
            <DefectsList
              key={defectRefreshKey}
              rideId={ride.id}
              rideName={ride.ride_name}
              showResolved={false}
              onDefectUpdated={() => setDefectRefreshKey(prev => prev + 1)}
            />
          </div>
        </div>

        {/* ── Recent Checks card ── */}
        {recentChecks.length > 0 && (
          <div className="t-card">
            <div className="t-card-header">
              <div className="t-title text-base">Recent Checks</div>
              <div className="text-xs mt-0.5" style={{ color: '#64748b' }}>
                Most recent completions for this equipment
              </div>
            </div>
            <div className="p-4 space-y-2">
              {recentChecks.map((check) => (
                <div
                  key={check.id}
                  className="flex items-center justify-between rounded-2xl border border-border p-3 cursor-pointer transition-colors"
                  style={{ background: '#f8fafc' }}
                  onMouseEnter={e => (e.currentTarget.style.background = '#f1f5f9')}
                  onMouseLeave={e => (e.currentTarget.style.background = '#f8fafc')}
                  onClick={() => { setSelectedCheck(check); setShowCheckDetail(true); }}
                >
                  <div className="min-w-0 flex-1">
                    <p className="font-bold text-sm truncate" style={{ color: '#0f172a' }}>{check.inspector_name}</p>
                    <p className="text-xs" style={{ color: '#64748b' }}>
                      {new Date(check.check_date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className="t-chip">Done</span>
                    <Eye className="h-4 w-4 text-muted-foreground" />
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        <CheckDetailDialog
          check={selectedCheck}
          open={showCheckDetail}
          onOpenChange={setShowCheckDetail}
        />
      </div>
    );
  }



  return (
    <div id="inspection-checklist-form" className="checksWrap -mx-4 pb-32">

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

      {/* ── Inspector Details card ── */}
      <div className="mx-4 mt-4">
        <div className="t-card">
          <button
            type="button"
            onClick={() => setDetailsExpanded(!detailsExpanded)}
            className="w-full t-card-header flex items-center justify-between gap-2"
          >
            <div className="flex items-center gap-3">
              <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold ${
                inspectorName.trim() ? 'bg-success text-success-foreground' : 'bg-primary/15 text-primary'
              }`}>
                1
              </div>
              <div className="text-left">
                <p className="font-bold text-sm text-foreground">Inspector Details</p>
                <p className="text-xs text-muted-foreground">
                  {inspectorName.trim() ? `${inspectorName}${location ? ` · ${location}` : ''}` : 'Name, location & conditions'}
                </p>
              </div>
            </div>
            {detailsExpanded ? <ChevronUp className="h-4 w-4 text-muted-foreground shrink-0" /> : <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0" />}
          </button>
          {detailsExpanded && (
            <div className="p-4 space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="checkedBy">Checked By *</Label>
                  <Input id="checkedBy" value={inspectorName} onChange={(e) => setInspectorName(e.target.value)} placeholder="Enter staff name" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="weather">Weather Conditions</Label>
                  <Input id="weather" value={weatherConditions} onChange={(e) => setWeatherConditions(e.target.value)} placeholder="e.g. Sunny, 20°C, Light wind" />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="location" className="flex items-center gap-2"><MapPin className="h-4 w-4" />Location</Label>
                <div className="flex gap-2">
                  <Input id="location" value={location} onChange={(e) => setLocation(e.target.value)} placeholder="Enter location or use GPS" className="flex-1" />
                  <Button type="button" variant="outline" size="icon" onClick={getGPSLocation} disabled={gettingLocation} title="Get GPS location">
                    {gettingLocation ? <Loader2 className="h-4 w-4 animate-spin" /> : <Locate className="h-4 w-4" />}
                  </Button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ── Progress strip ── */}
      <div className="mx-4 mt-4">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold ${
              getProgress() === 100 ? 'bg-success text-success-foreground' : 'bg-primary/15 text-primary'
            }`}>2</div>
            <div>
              <p className="font-bold text-sm text-foreground">Inspection Items</p>
              <p className="text-xs text-muted-foreground">
                {Object.values(itemResults).filter(r => r === 'pass' || r === 'fail' || r === 'na').length} / {activeTemplate.daily_check_template_items.length} completed
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {getProgress() === 100 && (
              <Badge className="bg-success text-success-foreground text-xs"><CheckCircle className="h-3 w-3 mr-1" />Done</Badge>
            )}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="icon" className="shrink-0 h-9 w-9">
                  <MoreVertical className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => setShowTemplateBuilder(true)}>
                  <Settings className="h-4 w-4 mr-2" />Edit Checklist
                </DropdownMenuItem>
                <DropdownMenuItem onClick={generatePDF}>
                  <Download className="h-4 w-4 mr-2" />Export PDF
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <AlertDialog onOpenChange={(open) => open && checkLinkedRecords()}>
                  <AlertDialogTrigger asChild>
                    <DropdownMenuItem onSelect={(e) => e.preventDefault()}>
                      <Archive className="h-4 w-4 mr-2" />Archive Template
                    </DropdownMenuItem>
                  </AlertDialogTrigger>
                  <AlertDialogContent className="w-[95vw] max-w-[95vw] sm:max-w-lg">
                    <AlertDialogHeader>
                      <AlertDialogTitle>Archive Template</AlertDialogTitle>
                      <AlertDialogDescription asChild>
                        <div>
                          <span>Archive "{activeTemplate.template_name}"? It will be hidden from active use but preserved for historical records.</span>
                          {checkingLinked ? (
                            <span className="block mt-2 text-muted-foreground">Checking for linked records...</span>
                          ) : linkedChecksInfo && linkedChecksInfo.count > 0 ? (
                            <div className="mt-3 p-3 bg-muted border rounded-md">
                              <span className="block font-medium">This template has linked check records:</span>
                              <ul className="mt-2 text-sm space-y-1 text-muted-foreground">
                                <li>• Total records: <strong className="text-foreground">{linkedChecksInfo.count}</strong></li>
                                <li>• Date range: <strong className="text-foreground">{new Date(linkedChecksInfo.earliest!).toLocaleDateString('en-GB')} — {new Date(linkedChecksInfo.latest!).toLocaleDateString('en-GB')}</strong></li>
                              </ul>
                              <span className="block mt-2 text-xs text-muted-foreground">Archiving preserves all historical data.</span>
                            </div>
                          ) : null}
                        </div>
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancel</AlertDialogCancel>
                      <AlertDialogAction onClick={handleArchiveTemplate}>Archive</AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
                <DropdownMenuSeparator />
                <AlertDialog onOpenChange={(open) => open && checkLinkedRecords()}>
                  <AlertDialogTrigger asChild>
                    <DropdownMenuItem onSelect={(e) => e.preventDefault()} className="text-destructive focus:text-destructive">
                      <Trash2 className="h-4 w-4 mr-2" />Delete Permanently
                    </DropdownMenuItem>
                  </AlertDialogTrigger>
                  <AlertDialogContent className="w-[95vw] max-w-[95vw] sm:max-w-lg">
                    <AlertDialogHeader>
                      <AlertDialogTitle>Delete Template</AlertDialogTitle>
                      <AlertDialogDescription asChild>
                        <div>
                          <span>Are you sure you want to permanently delete "{activeTemplate.template_name}"?</span>
                          {checkingLinked ? (
                            <span className="block mt-2 text-muted-foreground">Checking for linked records...</span>
                          ) : linkedChecksInfo && linkedChecksInfo.count > 0 ? (
                            <div className="mt-3 p-3 bg-destructive/10 border border-destructive/20 rounded-md">
                              <span className="block text-destructive font-medium">⚠️ Warning: This template has linked check records</span>
                              <ul className="mt-2 text-sm space-y-1 text-muted-foreground">
                                <li>• Total records: <strong className="text-foreground">{linkedChecksInfo.count}</strong></li>
                                <li>• Date range: <strong className="text-foreground">{new Date(linkedChecksInfo.earliest!).toLocaleDateString('en-GB')} — {new Date(linkedChecksInfo.latest!).toLocaleDateString('en-GB')}</strong></li>
                              </ul>
                              <span className="block mt-2 text-xs text-destructive">Consider archiving instead to preserve historical data.</span>
                            </div>
                          ) : (
                            <span className="block mt-2 text-muted-foreground">This action cannot be undone.</span>
                          )}
                        </div>
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancel</AlertDialogCancel>
                      <AlertDialogAction onClick={handleDeleteTemplate} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">Delete Permanently</AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
        <div className="h-2 rounded-full bg-muted overflow-hidden">
          <div className="h-full bg-primary rounded-full transition-all duration-300" style={{ width: `${Math.round(getProgress())}%` }} />
        </div>
      </div>

      {/* ── Item cards ── */}
      <div className="mx-4 mt-4 space-y-3">
        {activeTemplate.daily_check_template_items
          .sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0))
          .map((item, index) => {
            const v = itemResults[item.id];
            const isFail = v === 'fail';
            const isPass = v === 'pass';
            const isNA = v === 'na';

            const badgeClasses = isPass
              ? 'bg-green-100 border-green-300 text-green-900'
              : isFail
              ? 'bg-red-100 border-red-300 text-red-900'
              : isNA
              ? 'bg-slate-200 border-slate-300 text-slate-800'
              : 'bg-slate-100 border-slate-300 text-slate-800';

            const cardBorderClass = isFail
              ? 'border-red-300'
              : isPass
              ? 'border-green-300'
              : 'border-border';

            return (
              <div
                key={item.id}
                className={`bg-card border rounded-2xl overflow-hidden shadow-sm transition-all ${cardBorderClass}`}
              >
                {/* Card header */}
                <div className="px-4 pt-4 pb-3 flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <p className="text-xs text-muted-foreground mb-0.5">Item {index + 1}</p>
                    <h3 className="font-semibold text-foreground leading-snug break-words text-[15px]">
                      {item.check_item_text}
                    </h3>
                  </div>
                  <span className={`shrink-0 rounded-full px-3 py-1 text-[11px] font-bold border whitespace-nowrap ${badgeClasses}`}>
                    {v ? v.toUpperCase() : 'Pending'}
                  </span>
                </div>

                <div className="border-t mx-4" />

                <div className="p-4 space-y-3">
                  {/* Pass / Fail / N/A — pill toggle group */}
                  <div className="rounded-xl bg-slate-100 border border-slate-200 p-1.5 grid grid-cols-3 gap-1.5">
                    {/* Pass */}
                    <button
                      type="button"
                      onClick={() => handleResultChange(item.id, 'pass')}
                      className={`h-12 rounded-xl border text-sm font-semibold flex items-center justify-center gap-1.5 transition-all active:scale-[0.98] focus:outline-none focus:ring-2 focus:ring-ring ${
                        isPass
                          ? 'bg-green-600 border-green-700 text-white shadow-sm'
                          : 'bg-white border-slate-300 text-slate-900 hover:border-green-500 hover:text-green-700'
                      }`}
                    >
                      <CheckCircle className="h-4 w-4 shrink-0" />
                      Pass
                    </button>
                    {/* Fail */}
                    <button
                      type="button"
                      onClick={() => handleResultChange(item.id, 'fail')}
                      className={`h-12 rounded-xl border text-sm font-semibold flex items-center justify-center gap-1.5 transition-all active:scale-[0.98] focus:outline-none focus:ring-2 focus:ring-ring ${
                        isFail
                          ? 'bg-red-600 border-red-700 text-white shadow-sm'
                          : 'bg-white border-slate-300 text-slate-900 hover:border-red-500 hover:text-red-700'
                      }`}
                    >
                      <XCircle className="h-4 w-4 shrink-0" />
                      Fail
                    </button>
                    {/* N/A */}
                    <button
                      type="button"
                      onClick={() => handleResultChange(item.id, 'na')}
                      className={`h-12 rounded-xl border text-sm font-semibold flex items-center justify-center transition-all active:scale-[0.98] focus:outline-none focus:ring-2 focus:ring-ring ${
                        isNA
                          ? 'bg-slate-700 border-slate-800 text-white shadow-sm'
                          : 'bg-white border-slate-300 text-slate-900 hover:border-slate-500'
                      }`}
                    >
                      — N/A
                    </button>
                  </div>
                  <p className="text-[11px] text-slate-600 -mt-1">Tap the selected option again to clear.</p>

                  {/* Fail extras */}
                  {isFail && (
                    <div className="rounded-2xl border border-red-300 bg-red-50 p-4 space-y-3">
                      {/* Header */}
                      <div className="flex items-center justify-between">
                        <p className="font-semibold text-red-900 text-sm flex items-center gap-1.5">
                          <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
                          Defect required
                        </p>
                        <span className="text-xs font-semibold text-red-900 bg-red-100 border border-red-300 px-2 py-1 rounded-full">Add evidence</span>
                      </div>

                      {/* Report Defect / Log Repair */}
                      <div className="grid grid-cols-2 gap-2">
                        <DefectReportDialog
                          rideId={ride.id}
                          rideName={ride.ride_name}
                          onDefectReported={() => setDefectRefreshKey(prev => prev + 1)}
                          trigger={
                            <button type="button" className="h-11 rounded-xl border bg-card text-sm font-semibold flex items-center justify-center gap-1.5 text-destructive border-destructive/30 hover:bg-destructive/5 w-full">
                              <AlertTriangle className="h-3.5 w-3.5 shrink-0" />Report Defect
                            </button>
                          }
                        />
                        <button
                          type="button"
                          className="h-11 rounded-xl border bg-card text-sm font-semibold flex items-center justify-center gap-1.5 text-primary border-primary/30 hover:bg-primary/5"
                          onClick={() => setShowMaintenanceForItem(showMaintenanceForItem === item.id ? null : item.id)}
                        >
                          <Wrench className="h-3.5 w-3.5 shrink-0" />Log Repair
                        </button>
                      </div>

                      {showMaintenanceForItem === item.id && (
                        <QuickMaintenanceLog
                          rideId={ride.id}
                          rideName={ride.ride_name}
                          checkItemText={item.check_item_text}
                          onLogged={() => setShowMaintenanceForItem(null)}
                          onCancel={() => setShowMaintenanceForItem(null)}
                        />
                      )}

                      {/* Evidence / Photos */}
                      <div className="rounded-xl border border-border bg-card p-3 space-y-2">
                        <p className="text-sm font-medium text-foreground">Photos / Evidence</p>
                        <div className="grid grid-cols-2 gap-2">
                          <label className="h-11 rounded-xl border border-dashed border-border flex items-center justify-center gap-1.5 text-sm font-medium text-muted-foreground cursor-pointer hover:border-primary/40 hover:text-primary transition-colors">
                            📷 Take Photo
                            <input
                              type="file"
                              accept="image/*"
                              capture="environment"
                              className="hidden"
                              onChange={(e) => {
                                const files = Array.from(e.target.files || []);
                                if (!files.length) return;
                                setItemAttachments(prev => ({ ...prev, [item.id]: [...(prev[item.id] || []), ...files] }));
                                e.currentTarget.value = '';
                              }}
                            />
                          </label>
                          <label className="h-11 rounded-xl border border-dashed border-border flex items-center justify-center gap-1.5 text-sm font-medium text-muted-foreground cursor-pointer hover:border-primary/40 hover:text-primary transition-colors">
                            📎 Choose File
                            <input
                              type="file"
                              accept="image/*,application/pdf"
                              multiple
                              className="hidden"
                              onChange={(e) => {
                                const files = Array.from(e.target.files || []);
                                if (!files.length) return;
                                setItemAttachments(prev => ({ ...prev, [item.id]: [...(prev[item.id] || []), ...files] }));
                                e.currentTarget.value = '';
                              }}
                            />
                          </label>
                        </div>

                        {/* Thumbnails */}
                        {(itemAttachments[item.id]?.length ?? 0) > 0 && (
                          <div className="flex flex-wrap gap-2 pt-1">
                            {itemAttachments[item.id].map((f, idx) => (
                              <div key={`${f.name}-${idx}`} className="flex items-center gap-1.5 rounded-lg border border-border bg-muted/50 px-2 py-1 text-xs">
                                <span className="max-w-[130px] truncate text-foreground">{f.name}</span>
                                <button
                                  type="button"
                                  className="text-destructive font-bold shrink-0 hover:opacity-70"
                                  onClick={() => setItemAttachments(prev => ({
                                    ...prev,
                                    [item.id]: (prev[item.id] || []).filter((_, i) => i !== idx)
                                  }))}
                                >
                                  ×
                                </button>
                              </div>
                            ))}
                          </div>
                        )}

                        <p className="text-[11px] text-muted-foreground">
                          Tip: take at least 1 close-up + 1 context photo.
                        </p>
                      </div>

                      {/* Failure notes */}
                      <Textarea
                        placeholder="Describe the failure, location, immediate action taken…"
                        value={notes[item.id] || ''}
                        onChange={(e) => handleNoteChange(item.id, e.target.value)}
                        className={`min-h-[100px] text-sm resize-none rounded-xl bg-card ${!notes[item.id] ? 'border-destructive/40' : ''}`}
                        rows={4}
                      />
                    </div>
                  )}

                  {/* Optional notes (non-fail) */}
                  {!isFail && notes[item.id] !== undefined && (
                    <Textarea
                      placeholder="Add notes (optional)"
                      value={notes[item.id] || ''}
                      onChange={(e) => handleNoteChange(item.id, e.target.value)}
                      className="min-h-[56px] text-sm resize-none rounded-xl"
                      rows={2}
                    />
                  )}

                  {/* Add note link when no note yet and not fail */}
                  {!isFail && notes[item.id] === undefined && (
                    <button
                      type="button"
                      onClick={() => handleNoteChange(item.id, '')}
                      className="text-xs text-muted-foreground hover:text-foreground underline underline-offset-2"
                    >
                      + Add note
                    </button>
                  )}
                </div>
              </div>
            );
          })}
      </div>

      {/* ── Open Defects ── */}
      <div className="mx-4 mt-4">
        <div className="t-card">
          <div className="t-card-header flex items-center justify-between gap-2">
            <div>
              <div className="text-xs text-muted-foreground">Open Issues</div>
              <div className="t-title text-base flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 text-warning" />Open Defects
              </div>
            </div>
            <DefectReportDialog
              rideId={ride.id}
              rideName={ride.ride_name}
              onDefectReported={() => setDefectRefreshKey(prev => prev + 1)}
            />
          </div>
          <div className="p-4">
            <DefectsList
              key={defectRefreshKey}
              rideId={ride.id}
              rideName={ride.ride_name}
              showResolved={false}
              onDefectUpdated={() => setDefectRefreshKey(prev => prev + 1)}
            />
          </div>
        </div>
      </div>

      {/* ── Inspector Declaration ── */}
      <div className="mx-4 mt-4">
        <div className="t-card p-4 space-y-3">
          <p className="text-xs font-bold text-muted-foreground uppercase tracking-wide">Inspector Declaration</p>
          <p className="text-sm text-foreground leading-relaxed">
            I confirm this inspection has been completed in accordance with operational procedures and the equipment is safe to operate at this time.
          </p>
          <label className="flex items-start gap-3 cursor-pointer group">
            <div
              className={`mt-0.5 w-5 h-5 shrink-0 rounded border-2 flex items-center justify-center transition-colors ${
                declarationChecked ? 'bg-primary border-primary' : 'border-border group-hover:border-primary/50'
              }`}
              onClick={() => setDeclarationChecked(prev => !prev)}
            >
              {declarationChecked && <CheckCircle className="h-3.5 w-3.5 text-primary-foreground" />}
            </div>
            <span className="text-sm text-muted-foreground leading-snug select-none" onClick={() => setDeclarationChecked(prev => !prev)}>
              I declare the above inspection is complete and accurate
            </span>
          </label>
        </div>
      </div>

      {/* ── Recent Checks ── */}
      {recentChecks.length > 0 && (
        <div className="mx-4 mt-4">
          <div className="t-card">
            <div className="t-card-header">
              <div className="t-title text-base flex items-center gap-2">
                <Clock className="h-4 w-4 text-muted-foreground" />
                Recent Checks
              </div>
            </div>
            <div className="p-4 space-y-2">
              {recentChecks.map((check) => (
                <div
                  key={check.id}
                  className="flex items-center justify-between rounded-2xl border border-border bg-[#f8fafc] p-3 cursor-pointer hover:bg-[#f1f5f9] transition-colors"
                  onClick={() => { setSelectedCheck(check); setShowCheckDetail(true); }}
                >
                  <div className="min-w-0 flex-1">
                    <p className="font-bold text-sm truncate text-foreground">{check.inspector_name}</p>
                    <p className="text-xs text-muted-foreground">
                      {new Date(check.check_date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className="t-chip">Done</span>
                    <Eye className="h-4 w-4 text-muted-foreground" />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ── Sticky bottom bar ── */}
      <div className="fixed left-0 right-0 bottom-0 z-30 border-t bg-white/95 backdrop-blur-sm">
        <div className="max-w-xl mx-auto px-4 py-3 space-y-2">
          {(!inspectorName.trim() || !declarationChecked) && (
            <p className="text-xs text-center text-muted-foreground">
              {!inspectorName.trim() ? 'Enter your name above to submit' : 'Check the declaration above to submit'}
            </p>
          )}
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              className="rounded-xl border border-border py-3 text-sm font-extrabold bg-card hover:bg-muted/50 text-foreground"
              onClick={() => setCheckStarted(false)}
            >
              Exit
            </button>
            <button
              type="button"
              disabled={submitting || !inspectorName.trim() || !declarationChecked}
              onClick={handleSubmitChecks}
              className="t-btn-primary rounded-xl py-3 text-sm"
            >
              {submitting ? (
                <><Loader2 className="h-4 w-4 animate-spin shrink-0" />Saving…</>
              ) : (
                <><CheckCircle className="h-4 w-4 shrink-0" />Complete Check</>
              )}
            </button>
          </div>
        </div>
      </div>

      <CheckDetailDialog check={selectedCheck} open={showCheckDetail} onOpenChange={setShowCheckDetail} />
    </div>
  );
};

export default InspectionChecklist;
