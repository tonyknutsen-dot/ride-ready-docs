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
  generateDocId,
  buildFileName,
  blobToDataUrl,
  drawPDFHeader,
  drawSectionTitle,
  drawEquipmentDetails,
  drawSummaryBox,
  PDF_TABLE_HEAD_STYLES,
  drawAllPageFooters,
  drawComplianceStatement,
} from '@/utils/pdfUtils';
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
        } else {
          toast({
            title: "Error",
            description: "Failed to load template. No cached version available.",
            variant: "destructive"
          });
        }
      } catch (cacheError) {
        console.error('Error loading cached template:', cacheError);
        toast({
          title: "Error",
          description: "Failed to load inspection template",
          variant: "destructive"
        });
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
    setItemResults(prev => ({
      ...prev,
      [itemId]: result
    }));
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

      // === STANDARD HEADER ===
      const docId = generateDocId('CHECK');
      const companyName = profile?.company_name || profile?.showmen_name || 'Safety Inspection Report';
      const frequencyLabel = frequency === 'preopening' ? 'PRE-OPENING' : frequency.toUpperCase();

      currentY = drawPDFHeader({
        doc: pdf,
        logoDataUrl,
        companyName,
        controllerName: profile?.controller_name,
        reportTitle: `${frequencyLabel} SAFETY CHECK`,
        period: format(new Date(), 'dd MMM yyyy'),
        docId,
      });

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
      drawAllPageFooters(pdf);

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
      <div id="inspection-checklist-form" className="space-y-5">
        {/* Checklist Header */}
        <div className="flex items-center justify-between gap-2">
          <h3 className="font-semibold text-base truncate">{activeTemplate.template_name}</h3>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="icon" className="shrink-0 h-9 w-9">
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

        {/* Start Inspection Card — dominant CTA */}
        <div
          className="rounded-2xl overflow-hidden"
          style={{ background: 'linear-gradient(135deg, hsl(213, 52%, 24%), hsl(213, 52%, 34%))', boxShadow: '0 8px 24px rgba(30,58,95,0.25)' }}
        >
          <div className="px-6 py-7 flex flex-col items-center gap-4">
            <div className="w-14 h-14 rounded-full flex items-center justify-center" style={{ backgroundColor: 'rgba(255,255,255,0.12)' }}>
              <PlayCircle className="h-7 w-7 text-white" strokeWidth={2} />
            </div>
            <div className="text-center space-y-1">
              <p className="font-bold text-lg text-white">{activeTemplate.template_name}</p>
              <div className="flex items-center justify-center gap-3 text-xs" style={{ color: 'rgba(255,255,255,0.7)' }}>
                <span>{activeTemplate.daily_check_template_items.length} inspection items</span>
                <span>·</span>
                <span>PDF auto-saved</span>
                <span>·</span>
                <span>{new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}</span>
              </div>
            </div>
            <button
              className="w-full h-14 rounded-xl text-base font-bold flex items-center justify-center gap-2 transition-opacity hover:opacity-90"
              style={{ backgroundColor: 'rgba(255,255,255,0.15)', color: 'white', border: '1.5px solid rgba(255,255,255,0.3)' }}
              onClick={() => navigate(`/checks/${ride.id}/${frequency}/execute`)}
            >
              <PlayCircle className="h-5 w-5" strokeWidth={2.5} />
              Start Inspection
            </button>
          </div>
        </div>

        {/* Open Defects */}
        <Card className="rounded-2xl border-warning/30 bg-warning/5">
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2 text-warning">
              <AlertTriangle className="h-5 w-5" />
              Open Defects
            </CardTitle>
            <CardDescription>
              Any unresolved defects reported for this equipment
            </CardDescription>
          </CardHeader>
          <CardContent>
            <DefectsList 
              key={defectRefreshKey}
              rideId={ride.id} 
              rideName={ride.ride_name}
              showResolved={false}
              onDefectUpdated={() => setDefectRefreshKey(prev => prev + 1)}
            />
          </CardContent>
        </Card>

        {/* Recent Checks */}
        {recentChecks.length > 0 && (
          <Card className="border-muted">
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Clock className="h-4 w-4 text-muted-foreground" />
                Recent {frequency === 'preopening' ? 'Pre-Opening' : frequency.charAt(0).toUpperCase() + frequency.slice(1)} Checks
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-0">
              <div className="divide-y divide-border">
                {recentChecks.map((check) => (
                  <div 
                    key={check.id} 
                    className="flex items-center justify-between py-3 first:pt-0 last:pb-0 cursor-pointer hover:bg-muted/50 -mx-4 px-4 rounded-md transition-colors"
                    onClick={() => {
                      setSelectedCheck(check);
                      setShowCheckDetail(true);
                    }}
                  >
                    <div className="min-w-0 flex-1">
                      <p className="font-medium text-sm truncate">{check.inspector_name}</p>
                      <p className="text-xs text-muted-foreground">
                        {new Date(check.check_date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant={check.status === 'completed' ? 'default' : 'secondary'} className="text-xs shrink-0">
                        <CheckCircle className="h-3 w-3 mr-1" />
                        Done
                      </Badge>
                      <Eye className="h-4 w-4 text-muted-foreground" />
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
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
    <div id="inspection-checklist-form" className="space-y-5">
      {/* Inspection header strip — who / when */}
      <div className="flex items-center justify-between gap-2 px-1">
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <Clock className="h-3.5 w-3.5 shrink-0" />
          {checkStartedAt ? (
            <span>Started at <strong className="text-foreground">{checkStartedAt.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}</strong> · {checkStartedAt.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}</span>
          ) : (
            <span>{new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}</span>
          )}
        </div>
        {!isOnline && (
          <Badge variant="outline" className="text-xs border-warning text-warning gap-1">
            <CloudOff className="h-3 w-3" /> Offline
          </Badge>
        )}
      </div>

      {/* Offline / sync banner — compact */}
      {(!isOnline || usingCachedTemplate || pendingCount > 0) && (
        <div className={`flex items-center justify-between gap-2 px-3 py-2 rounded-xl text-xs border ${
          !isOnline ? 'bg-warning/8 border-warning/30 text-warning' : pendingCount > 0 ? 'bg-info/8 border-info/30 text-info' : 'bg-muted border-muted-foreground/20 text-muted-foreground'
        }`}>
          <div className="flex items-center gap-1.5">
            {!isOnline ? <CloudOff className="h-3.5 w-3.5 shrink-0" /> : pendingCount > 0 ? <RefreshCw className={`h-3.5 w-3.5 shrink-0 ${isSyncing ? 'animate-spin' : ''}`} /> : <WifiOff className="h-3.5 w-3.5 shrink-0" />}
            <span>
              {!isOnline ? 'Offline — check saved locally and synced when online' : pendingCount > 0 ? `${pendingCount} check${pendingCount > 1 ? 's' : ''} pending sync` : 'Using cached template'}
            </span>
          </div>
          {isOnline && pendingCount > 0 && !isSyncing && (
            <button onClick={syncAll} className="font-semibold underline underline-offset-2 shrink-0">Sync</button>
          )}
        </div>
      )}

      {/* Checklist Header — clean single row, no duplicate cogs */}

      <div className="flex items-center justify-between gap-2">
        <h3 className="font-semibold text-base truncate">{activeTemplate.template_name}</h3>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="icon" className="shrink-0 h-9 w-9">
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
            <DropdownMenuSeparator />
            <AlertDialog onOpenChange={(open) => open && checkLinkedRecords()}>
              <AlertDialogTrigger asChild>
                <DropdownMenuItem onSelect={(e) => e.preventDefault()}>
                  <Archive className="h-4 w-4 mr-2" />
                  Archive Template
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
                            <li>• Date range: <strong className="text-foreground">
                              {new Date(linkedChecksInfo.earliest!).toLocaleDateString('en-GB')} — {new Date(linkedChecksInfo.latest!).toLocaleDateString('en-GB')}
                            </strong></li>
                          </ul>
                          <span className="block mt-2 text-xs text-muted-foreground">
                            Archiving preserves all historical data.
                          </span>
                        </div>
                      ) : null}
                    </div>
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction onClick={handleArchiveTemplate}>
                    Archive
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
            <DropdownMenuSeparator />
            <AlertDialog onOpenChange={(open) => open && checkLinkedRecords()}>
              <AlertDialogTrigger asChild>
                <DropdownMenuItem onSelect={(e) => e.preventDefault()} className="text-destructive focus:text-destructive">
                  <Trash2 className="h-4 w-4 mr-2" />
                  Delete Permanently
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
                          <span className="block text-destructive font-medium">
                            ⚠️ Warning: This template has linked check records
                          </span>
                          <ul className="mt-2 text-sm space-y-1 text-muted-foreground">
                            <li>• Total records: <strong className="text-foreground">{linkedChecksInfo.count}</strong></li>
                            <li>• Date range: <strong className="text-foreground">
                              {new Date(linkedChecksInfo.earliest!).toLocaleDateString('en-GB')} — {new Date(linkedChecksInfo.latest!).toLocaleDateString('en-GB')}
                            </strong></li>
                          </ul>
                          <span className="block mt-2 text-xs text-destructive">
                            Consider archiving instead to preserve historical data.
                          </span>
                        </div>
                      ) : (
                        <span className="block mt-2 text-muted-foreground">This action cannot be undone.</span>
                      )}
                    </div>
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction
                    onClick={handleDeleteTemplate}
                    className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                  >
                    Delete Permanently
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* Step 1: Inspector Details — collapsible card */}
      <Card className="rounded-2xl overflow-hidden">
        <button
          type="button"
          onClick={() => setDetailsExpanded(!detailsExpanded)}
          className="w-full flex items-center justify-between p-4 text-left hover:bg-muted/30 transition-colors"
        >
          <div className="flex items-center gap-3">
            <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold ${
              inspectorName.trim() ? 'bg-success text-success-foreground' : 'bg-primary/15 text-primary'
            }`}>
              1
            </div>
            <div>
              <p className="font-semibold text-sm">Inspector Details</p>
              <p className="text-xs text-muted-foreground">
                {inspectorName.trim() ? `${inspectorName}${location ? ` • ${location}` : ''}` : 'Name, location & conditions'}
              </p>
            </div>
          </div>
          {detailsExpanded ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
        </button>
        {detailsExpanded && (
          <CardContent className="pt-0 pb-4 space-y-4">
            <Separator />
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="checkedBy">Checked By *</Label>
                <Input
                  id="checkedBy"
                  value={inspectorName}
                  onChange={(e) => setInspectorName(e.target.value)}
                  placeholder="Enter staff name"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="weather">Weather Conditions</Label>
                <Input
                  id="weather"
                  value={weatherConditions}
                  onChange={(e) => setWeatherConditions(e.target.value)}
                  placeholder="e.g. Sunny, 20°C, Light wind"
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="location" className="flex items-center gap-2">
                <MapPin className="h-4 w-4" />
                Location
              </Label>
              <div className="flex gap-2">
                <Input
                  id="location"
                  value={location}
                  onChange={(e) => setLocation(e.target.value)}
                  placeholder="Enter location or use GPS"
                  className="flex-1"
                />
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  onClick={getGPSLocation}
                  disabled={gettingLocation}
                  title="Get GPS location"
                >
                  {gettingLocation ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Locate className="h-4 w-4" />
                  )}
                </Button>
              </div>
            </div>
          </CardContent>
        )}
      </Card>

      {/* Step 2: Inspection Items */}
      <Card className="rounded-2xl overflow-hidden">
        <div className="p-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold ${
              getProgress() === 100 ? 'bg-success text-success-foreground' : 'bg-primary/15 text-primary'
            }`}>
              2
            </div>
            <div>
              <p className="font-semibold text-sm">Inspection Items</p>
              <p className="text-xs text-muted-foreground">
                {Object.values(itemResults).filter(r => r === 'pass' || r === 'fail' || r === 'na').length} of {activeTemplate.daily_check_template_items.length} completed
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {getProgress() === 100 && (
              <Badge className="bg-success text-success-foreground">
                <CheckCircle className="h-3 w-3 mr-1" />
                Done
              </Badge>
            )}
            <DefectReportDialog 
              rideId={ride.id} 
              rideName={ride.ride_name}
              onDefectReported={() => setDefectRefreshKey(prev => prev + 1)}
            />
          </div>
        </div>
        
        {/* Progress bar with percentage */}
        <div className="px-4 pb-3 space-y-1">
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>Progress</span>
            <span className="font-semibold text-foreground">{Math.round(getProgress())}%</span>
          </div>
          <Progress value={getProgress()} className="h-2.5" />
        </div>

        <CardContent className="pt-0 space-y-3">
          {activeTemplate.daily_check_template_items
            .sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0))
            .map((item, index) => {
              const currentResult = itemResults[item.id];
              return (
              <div 
                key={item.id} 
                className={`p-3 rounded-xl border-2 transition-all duration-200 ${
                  currentResult === 'pass'
                    ? 'bg-success/5 border-success/30' 
                    : currentResult === 'fail'
                    ? 'bg-destructive/5 border-destructive/30'
                    : currentResult === 'na'
                    ? 'bg-muted/50 border-muted-foreground/20'
                    : 'border-border hover:border-primary/20'
                }`}
              >
                <div className="flex items-start justify-between gap-2 mb-2">
                  <span className="text-sm font-medium leading-snug">
                    {item.check_item_text}
                  </span>
                  <span className="text-[10px] text-muted-foreground font-mono shrink-0 mt-0.5">
                    #{index + 1}
                  </span>
                </div>
                
                <div className="flex gap-2">
                  <button 
                    type="button"
                    onClick={() => handleResultChange(item.id, 'pass')}
                    className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg border-2 font-semibold text-sm transition-all active:scale-[0.97] ${
                      currentResult === 'pass' 
                        ? 'border-success bg-success text-success-foreground shadow-sm' 
                        : 'border-border hover:border-success/50 text-muted-foreground hover:text-success'
                    }`}
                  >
                    <CheckCircle className="h-4 w-4" />
                    Pass
                  </button>
                  <button 
                    type="button"
                    onClick={() => handleResultChange(item.id, 'fail')}
                    className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg border-2 font-semibold text-sm transition-all active:scale-[0.97] ${
                      currentResult === 'fail' 
                        ? 'border-destructive bg-destructive text-destructive-foreground shadow-sm' 
                        : 'border-border hover:border-destructive/50 text-muted-foreground hover:text-destructive'
                    }`}
                  >
                    <XCircle className="h-4 w-4" />
                    Fail
                  </button>
                  <button 
                    type="button"
                    onClick={() => handleResultChange(item.id, 'na')}
                    className={`w-14 flex items-center justify-center py-2 rounded-lg border-2 font-medium text-xs transition-all active:scale-[0.97] ${
                      currentResult === 'na' 
                        ? 'border-muted-foreground bg-muted text-muted-foreground shadow-sm' 
                        : 'border-border hover:border-muted-foreground/50 text-muted-foreground'
                    }`}
                  >
                    N/A
                  </button>
                </div>
                
                {(currentResult === 'fail' || notes[item.id]) && (
                  <Textarea
                    placeholder={currentResult === 'fail' ? "Describe the failure..." : "Add notes (optional)"}
                    value={notes[item.id] || ''}
                    onChange={(e) => handleNoteChange(item.id, e.target.value)}
                    className={`mt-2 min-h-[60px] text-sm resize-none rounded-lg ${currentResult === 'fail' && !notes[item.id] ? 'border-destructive' : ''}`}
                    rows={2}
                  />
                )}

                {/* Per-item fail actions */}
                {currentResult === 'fail' && (
                  <div className="mt-2 space-y-2">
                    <div className="flex gap-2">
                      <DefectReportDialog
                        rideId={ride.id}
                        rideName={ride.ride_name}
                        onDefectReported={() => setDefectRefreshKey(prev => prev + 1)}
                        trigger={
                          <Button type="button" variant="outline" size="sm" className="text-xs gap-1.5 text-destructive border-destructive/30 hover:bg-destructive/10">
                            <AlertTriangle className="h-3 w-3" />
                            Report Defect
                          </Button>
                        }
                      />
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="text-xs gap-1.5 text-primary border-primary/30 hover:bg-primary/10"
                        onClick={() => setShowMaintenanceForItem(showMaintenanceForItem === item.id ? null : item.id)}
                      >
                        <Wrench className="h-3 w-3" />
                        Log Repair
                      </Button>
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
                  </div>
                )}
              </div>
              );
            })}
        </CardContent>
      </Card>

      {/* Open Defects */}
      <Card className="rounded-2xl border-warning/30 bg-warning/5">
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center gap-2 text-warning">
            <AlertTriangle className="h-5 w-5" />
            Open Defects
          </CardTitle>
          <CardDescription>
            Any unresolved defects reported for this equipment
          </CardDescription>
        </CardHeader>
        <CardContent>
          <DefectsList 
            key={defectRefreshKey}
            rideId={ride.id} 
            rideName={ride.ride_name}
            showResolved={false}
            onDefectUpdated={() => setDefectRefreshKey(prev => prev + 1)}
          />
        </CardContent>
      </Card>

      {/* Inspector Declaration */}
      <div className="rounded-2xl border border-border bg-card p-4 space-y-3">
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Inspector Declaration</p>
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

      {/* Complete & Save — dominant CTA */}
      <Button
        onClick={handleSubmitChecks} 
        disabled={submitting || !inspectorName.trim() || !declarationChecked}
        size="lg"
        className="w-full h-14 text-base font-bold shadow-lg rounded-2xl"
      >
        {submitting ? (
          <>
            <Loader2 className="h-5 w-5 mr-2 animate-spin" />
            Saving Record...
          </>
        ) : (
          <>
            <CheckCircle className="h-5 w-5 mr-2" />
            Complete &amp; Save Inspection
          </>
        )}
      </Button>
      {(!inspectorName.trim() || !declarationChecked) && (
        <p className="text-xs text-center text-muted-foreground -mt-2">
          {!inspectorName.trim() ? 'Enter your name in "Checked By" to submit' : 'Check the declaration above to submit'}
        </p>
      )}

      {/* Recent Checks - Compact mobile-friendly */}
      {recentChecks.length > 0 && (
        <Card className="border-muted">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Clock className="h-4 w-4 text-muted-foreground" />
              Recent {frequency === 'preopening' ? 'Pre-Opening' : frequency.charAt(0).toUpperCase() + frequency.slice(1)} Checks
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            <div className="divide-y divide-border">
              {recentChecks.map((check) => (
                <div 
                  key={check.id} 
                  className="flex items-center justify-between py-3 first:pt-0 last:pb-0 cursor-pointer hover:bg-muted/50 -mx-4 px-4 rounded-md transition-colors"
                  onClick={() => {
                    setSelectedCheck(check);
                    setShowCheckDetail(true);
                  }}
                >
                  <div className="min-w-0 flex-1">
                    <p className="font-medium text-sm truncate">{check.inspector_name}</p>
                    <p className="text-xs text-muted-foreground">
                      {new Date(check.check_date).toLocaleDateString('en-GB', { 
                        day: 'numeric', 
                        month: 'short',
                        year: 'numeric'
                      })}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge 
                      variant={check.status === 'completed' ? 'default' : 'secondary'}
                      className="text-xs shrink-0"
                    >
                      <CheckCircle className="h-3 w-3 mr-1" />
                      Done
                    </Badge>
                    <Eye className="h-4 w-4 text-muted-foreground" />
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Check Detail Dialog */}
      <CheckDetailDialog
        check={selectedCheck}
        open={showCheckDetail}
        onOpenChange={setShowCheckDetail}
      />
    </div>
  );
};

export default InspectionChecklist;