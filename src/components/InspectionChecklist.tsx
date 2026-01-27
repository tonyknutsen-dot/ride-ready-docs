import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Progress } from '@/components/ui/progress';
import { Download, FileText, CheckCircle, Clock, AlertTriangle, Mail, Printer, Plus, Settings, Trash2, Archive, MapPin, Locate, Loader2 } from 'lucide-react';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Tables } from '@/integrations/supabase/types';
import { useQueryClient } from '@tanstack/react-query';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
import TemplateBuilder from './TemplateBuilder';
import { EmptyState } from '@/components/EmptyState';
import DefectReportDialog from './DefectReportDialog';
import DefectsList from './DefectsList';

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
}

const InspectionChecklist = ({ ride, frequency }: InspectionChecklistProps) => {
  const [activeTemplate, setActiveTemplate] = useState<Template | null>(null);
  const [recentChecks, setRecentChecks] = useState<Check[]>([]);
  const [checkedItems, setCheckedItems] = useState<{ [key: string]: boolean }>({});
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
  const { toast } = useToast();
  const { user } = useAuth();
  const queryClient = useQueryClient();

  useEffect(() => {
    if (user) {
      loadActiveTemplate();
      loadRecentChecks();
    }
  }, [user, ride.id, frequency]);

  const loadActiveTemplate = async () => {
    try {
      const { data, error } = await supabase
        .from('daily_check_templates')
        .select(`
          *,
          daily_check_template_items (*)
        `)
        .eq('user_id', user?.id)
        .eq('ride_id', ride.id)
        .eq('check_frequency', frequency)
        .eq('is_active', true)
        .eq('is_archived', false)
        .maybeSingle();

      if (error && error.code !== 'PGRST116') {
        throw error;
      }

      setActiveTemplate(data);
    } catch (error) {
      console.error('Error loading active template:', error);
      toast({
        title: "Error",
        description: "Failed to load inspection template",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const loadRecentChecks = async () => {
    try {
      const { data, error } = await supabase
        .from('checks')
        .select('*')
        .eq('user_id', user?.id)
        .eq('ride_id', ride.id)
        .eq('check_frequency', frequency)
        .order('check_date', { ascending: false })
        .limit(5);

      if (error) throw error;
      setRecentChecks(data || []);
    } catch (error) {
      console.error('Error loading recent checks:', error);
    }
  };

  const handleCheckChange = (itemId: string, checked: boolean) => {
    setCheckedItems(prev => ({
      ...prev,
      [itemId]: checked
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
    const checkedCount = Object.values(checkedItems).filter(Boolean).length;
    return totalItems > 0 ? (checkedCount / totalItems) * 100 : 0;
  };

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
      
      // Try to get address using reverse geocoding (free service)
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
          toast({
            title: "Location detected",
            description: shortAddress,
          });
        } else {
          // Fallback to coordinates
          setLocation(`${latitude.toFixed(6)}, ${longitude.toFixed(6)}`);
          toast({
            title: "Location captured",
            description: "Coordinates saved (address lookup unavailable)",
          });
        }
      } catch {
        // Fallback to coordinates if geocoding fails
        setLocation(`${latitude.toFixed(6)}, ${longitude.toFixed(6)}`);
        toast({
          title: "Location captured",
          description: "Coordinates saved (address lookup failed)",
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

  const generatePDFBlob = async (): Promise<Blob | null> => {
    if (!activeTemplate) return null;

    try {
      // Fetch profile for company branding
      const { data: profile } = await supabase
        .from('profiles')
        .select('*')
        .eq('user_id', user?.id)
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

      const pdf = new jsPDF();
      const pageWidth = pdf.internal.pageSize.getWidth();
      const pageHeight = pdf.internal.pageSize.getHeight();
      const margin = 20;
      let currentY = margin;

      // Helper function to add footer to each page
      const addFooter = () => {
        const totalPages = pdf.getNumberOfPages();
        for (let i = 1; i <= totalPages; i++) {
          pdf.setPage(i);
          pdf.setFontSize(8);
          pdf.setTextColor(128);
          pdf.text('tarmacbuddy.com', pageWidth / 2, pageHeight - 10, { align: 'center' });
          pdf.text(`Page ${i} of ${totalPages}`, pageWidth - 20, pageHeight - 10, { align: 'right' });
          pdf.text(`Generated: ${new Date().toLocaleDateString('en-GB')} ${new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}`, 20, pageHeight - 10, { align: 'left' });
          pdf.setTextColor(0);
        }
      };

      // === HEADER SECTION ===
      // Logo on left, company info centered
      if (logoDataUrl) {
        try {
          pdf.addImage(logoDataUrl, 'AUTO', margin, currentY - 5, 18, 18);
        } catch (e) {
          console.log('Could not add logo to PDF');
        }
      }

      // Company name - always centered on page
      pdf.setFontSize(16);
      pdf.setFont('helvetica', 'bold');
      pdf.setTextColor(40, 40, 40);
      const companyName = profile?.company_name || profile?.showmen_name || 'Safety Inspection Report';
      pdf.text(companyName, pageWidth / 2, currentY, { align: 'center' });
      currentY += 6;

      // Controller name below company
      if (profile?.controller_name) {
        pdf.setFontSize(9);
        pdf.setFont('helvetica', 'normal');
        pdf.setTextColor(100);
        pdf.text(`Controller: ${profile.controller_name}`, pageWidth / 2, currentY, { align: 'center' });
        currentY += 5;
      }

      currentY += 8;

      // Report title with underline
      pdf.setFontSize(13);
      pdf.setFont('helvetica', 'bold');
      pdf.setTextColor(50, 50, 50);
      const reportTitle = `${frequency.toUpperCase()} SAFETY CHECK REPORT`;
      pdf.text(reportTitle, pageWidth / 2, currentY, { align: 'center' });
      currentY += 6;

      // Date
      pdf.setFontSize(9);
      pdf.setFont('helvetica', 'normal');
      pdf.setTextColor(80);
      pdf.text(`Date: ${new Date().toLocaleDateString('en-GB')}`, pageWidth / 2, currentY, { align: 'center' });
      currentY += 8;

      // Divider line
      pdf.setDrawColor(180);
      pdf.line(margin, currentY, pageWidth - margin, currentY);
      currentY += 10;

      // === EQUIPMENT DETAILS SECTION WITH IMAGE ===
      pdf.setFontSize(11);
      pdf.setFont('helvetica', 'bold');
      pdf.setTextColor(50, 50, 50);
      pdf.text('Equipment Details', margin, currentY);
      currentY += 8;

      // Calculate layout - if image exists, put it on the right
      const hasImage = !!rideImageDataUrl;
      const imageX = pageWidth - 45;
      const imageY = currentY;
      const imageW = 30;
      const imageH = 22;

      pdf.setFontSize(10);
      pdf.setFont('helvetica', 'normal');
      pdf.setTextColor(0);

      const leftCol = margin;
      const labelWidth = 32;

      pdf.setFont('helvetica', 'bold');
      pdf.text('Name:', leftCol, currentY);
      pdf.setFont('helvetica', 'normal');
      pdf.text(ride.ride_name, leftCol + labelWidth, currentY);
      currentY += 6;

      pdf.setFont('helvetica', 'bold');
      pdf.text('Category:', leftCol, currentY);
      pdf.setFont('helvetica', 'normal');
      pdf.text(ride.ride_categories?.name || '-', leftCol + labelWidth, currentY);
      currentY += 6;

      if (ride.manufacturer) {
        pdf.setFont('helvetica', 'bold');
        pdf.text('Manufacturer:', leftCol, currentY);
        pdf.setFont('helvetica', 'normal');
        pdf.text(ride.manufacturer, leftCol + labelWidth, currentY);
        currentY += 6;
      }
      if (ride.serial_number) {
        pdf.setFont('helvetica', 'bold');
        pdf.text('Serial No:', leftCol, currentY);
        pdf.setFont('helvetica', 'normal');
        pdf.text(ride.serial_number, leftCol + labelWidth, currentY);
        currentY += 6;
      }
      if (ride.year_manufactured) {
        pdf.setFont('helvetica', 'bold');
        pdf.text('Year:', leftCol, currentY);
        pdf.setFont('helvetica', 'normal');
        pdf.text(ride.year_manufactured.toString(), leftCol + labelWidth, currentY);
        currentY += 6;
      }
      if (ride.owner_name) {
        pdf.setFont('helvetica', 'bold');
        pdf.text('Owner:', leftCol, currentY);
        pdf.setFont('helvetica', 'normal');
        pdf.text(ride.owner_name, leftCol + labelWidth, currentY);
        currentY += 6;
      }

      // Add ride image on the right side if available
      if (rideImageDataUrl) {
        try {
          pdf.addImage(rideImageDataUrl, 'JPEG', imageX, imageY, imageW, imageH);
          currentY = Math.max(currentY, imageY + imageH + 5);
        } catch (e) {
          console.log('Could not add ride image to PDF');
        }
      }

      currentY += 5;

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
      const passedItems = Object.values(checkedItems).filter(Boolean).length;
      const failedItems = totalItems - passedItems;
      const allPassed = failedItems === 0;

      currentY += 4;
      pdf.setFont('helvetica', 'bold');
      pdf.text('Result:', leftCol, currentY);
      pdf.setFont('helvetica', 'normal');
      if (allPassed) {
        pdf.setTextColor(34, 139, 34); // Green
        pdf.text('ALL CHECKS PASSED', leftCol + labelWidth, currentY);
      } else {
        pdf.setTextColor(220, 53, 69); // Red
        pdf.text(`${failedItems} ITEM(S) FAILED`, leftCol + labelWidth, currentY);
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
          const isChecked = checkedItems[item.id];
          const itemNote = notes[item.id] || '';

          // Check for page overflow
          if (currentY > 250) {
            pdf.addPage();
            currentY = margin;
          }

          // Status indicator with color
          pdf.setFont('helvetica', 'bold');
          if (isChecked) {
            pdf.setTextColor(34, 139, 34); // Green
            pdf.text('✓ PASS', leftCol, currentY);
          } else {
            pdf.setTextColor(220, 53, 69); // Red
            pdf.text('✗ FAIL', leftCol, currentY);
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

      // === INSPECTOR NOTES SECTION ===
      if (inspectorNotes || environmentNotes) {
        currentY += 5;

        if (currentY > 250) {
          pdf.addPage();
          currentY = margin;
        }

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

      // Add footer to all pages
      addFooter();

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

    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${frequency}-check-${ride.ride_name}-${new Date().toISOString().split('T')[0]}.pdf`;
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
            time: new Date().toLocaleDateString(),
            _optimistic: true
          },
          ...old.recentActivity.slice(0, 3)
        ]
      };
    });

    try {
      // Create inspection check record
      const { data: check, error: checkError } = await supabase
        .from('checks')
        .insert({
          user_id: user?.id,
          ride_id: ride.id,
          template_id: activeTemplate.id,
          inspector_name: inspectorName.trim(),
          notes: inspectorNotes.trim() || null,
          check_frequency: frequency,
          status: 'completed',
          weather_conditions: weatherConditions.trim() || null,
          environment_notes: environmentNotes.trim() || null,
          compliance_officer: complianceOfficer.trim() || null,
          signature_data: signatureData.trim() || null,
          location: location.trim() || null
        })
        .select()
        .single();

      if (checkError) throw checkError;

      // Create inspection results
      const results = activeTemplate.daily_check_template_items.map(item => ({
        check_id: check.id,
        template_item_id: item.id,
        is_checked: checkedItems[item.id] || false,
        notes: notes[item.id]?.trim() || null
      }));

      const { error: resultsError } = await supabase
        .from('check_results')
        .insert(results);

      if (resultsError) throw resultsError;

      // Generate and save PDF to documents (non-blocking)
      generatePDFBlob().then(async (pdfBlob) => {
        if (pdfBlob) {
          const fileName = `${frequency}-check-${ride.ride_name}-${new Date().toISOString()}.pdf`;
          const filePath = `${user?.id}/${ride.id}/check-records/${fileName}`;
          
          const { error: uploadError } = await supabase.storage
            .from('ride-documents')
            .upload(filePath, pdfBlob, {
              contentType: 'application/pdf',
              upsert: false
            });

          if (!uploadError) {
            await supabase
              .from('documents')
              .insert({
                user_id: user?.id,
                ride_id: ride.id,
                document_name: `${frequency.charAt(0).toUpperCase() + frequency.slice(1)} Check - ${new Date().toLocaleDateString()}`,
                document_type: 'Check Record',
                file_path: filePath,
                mime_type: 'application/pdf',
                file_size: pdfBlob.size,
                notes: `Checked by: ${inspectorName}${weatherConditions ? ` | Weather: ${weatherConditions}` : ''}`
              });
            // Invalidate to pick up the new document
            queryClient.invalidateQueries({ queryKey: ['overview'] });
          }
        }
      });

      toast({
        title: "Check completed ✓",
        description: `${frequency.charAt(0).toUpperCase() + frequency.slice(1)} check saved for ${ride.ride_name}`
      });

      // Reset form
      setCheckedItems({});
      setNotes({});
      setInspectorName('');
      setInspectorNotes('');
      setWeatherConditions('');
      setEnvironmentNotes('');
      setComplianceOfficer('');
      setSignatureData('');
      setLocation('');

      // Reload recent checks
      await loadRecentChecks();
      
      // Invalidate queries to sync
      queryClient.invalidateQueries({ queryKey: ['overview'] });
      queryClient.invalidateQueries({ queryKey: ['checks'] });
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
        }}
        onCancel={() => setShowTemplateBuilder(false)}
      />
    );
  }

  if (!activeTemplate) {
    return (
      <EmptyState
        icon={FileText}
        title="No Active Template Found"
        description={`First, build your ${frequency} safety check template. Then you can start recording checks.`}
        actionLabel="Build Template"
        onAction={() => setShowTemplateBuilder(true)}
      />
    );
  }

  return (
    <div id="inspection-checklist-form" className="space-y-6">
      <Alert>
        <AlertDescription>
          Complete all required check items, add detailed notes where necessary, and submit to save your {frequency} check record. You can export the results as a PDF.
        </AlertDescription>
      </Alert>
      <Card>
        <CardHeader className="space-y-3">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <CardTitle className="text-base sm:text-lg">{activeTemplate.template_name}</CardTitle>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={() => setShowTemplateBuilder(true)} className="flex-1 sm:flex-none">
                <Settings className="h-4 w-4 sm:mr-2" />
                <span className="hidden sm:inline">Edit Template</span>
              </Button>
              <Button variant="outline" size="sm" onClick={generatePDF} className="flex-1 sm:flex-none">
                <Download className="h-4 w-4 sm:mr-2" />
                <span className="hidden sm:inline">Export PDF</span>
              </Button>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="sm" className="flex-1 sm:flex-none">
                    <Settings className="h-4 w-4 sm:mr-2" />
                    <span className="hidden sm:inline">More</span>
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
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
                                    {new Date(linkedChecksInfo.earliest!).toLocaleDateString()} — {new Date(linkedChecksInfo.latest!).toLocaleDateString()}
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
                                    {new Date(linkedChecksInfo.earliest!).toLocaleDateString()} — {new Date(linkedChecksInfo.latest!).toLocaleDateString()}
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
          </div>
          <CardDescription>
            {activeTemplate.description}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-6">
            {/* Staff Information */}
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

            {/* Location Field with GPS */}
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
              <p className="text-xs text-muted-foreground">
                Tap the GPS button to auto-detect your location, or type it manually
              </p>
            </div>

            {/* Progress */}
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span>Progress</span>
                <span>{Math.round(getProgress())}% complete</span>
              </div>
              <Progress value={getProgress()} className="w-full" />
            </div>

            {/* Check Items */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h4 className="font-semibold">Inspection Items</h4>
                <DefectReportDialog 
                  rideId={ride.id} 
                  rideName={ride.ride_name}
                  onDefectReported={() => setDefectRefreshKey(prev => prev + 1)}
                />
              </div>
            {activeTemplate.daily_check_template_items
                .sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0))
                .map((item) => (
                  <Card key={item.id} className="p-4">
                    <div className="space-y-3">
                      <div className="flex items-start space-x-3">
                        <Checkbox
                          id={item.id}
                          checked={checkedItems[item.id] || false}
                          onCheckedChange={(checked) => 
                            handleCheckChange(item.id, checked as boolean)
                          }
                        />
                        <div className="flex-1">
                          <Label htmlFor={item.id} className="text-sm font-medium">
                            {item.check_item_text}
                          </Label>
                          <div className="text-xs text-muted-foreground mt-1">
                            Category: {item.category}
                          </div>
                        </div>
                      </div>
                      <Textarea
                        placeholder="Add notes for this item (optional)"
                        value={notes[item.id] || ''}
                        onChange={(e) => handleNoteChange(item.id, e.target.value)}
                        className="mt-2"
                        rows={2}
                      />
                    </div>
                  </Card>
                ))}
            </div>

            {/* Open Defects Warning */}
            <Card className="border-orange-200 dark:border-orange-800 bg-orange-50/50 dark:bg-orange-950/20">
              <CardHeader className="pb-2">
                <CardTitle className="text-base flex items-center gap-2 text-orange-700 dark:text-orange-400">
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

            <Button
              onClick={handleSubmitChecks} 
              disabled={submitting}
              className="w-full"
            >
              {submitting ? 'Submitting...' : `Complete ${frequency.charAt(0).toUpperCase() + frequency.slice(1)} Inspection`}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Recent Checks */}
      {recentChecks.length > 0 && (
        <Card>
          <CardHeader>
          <CardTitle className="flex items-center space-x-2">
              <Clock className="h-5 w-5" />
              <span>Recent {frequency.charAt(0).toUpperCase() + frequency.slice(1)} Checks</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {recentChecks.map((check) => (
                <div key={check.id} className="flex justify-between items-center p-3 border rounded-lg">
                  <div>
                    <div className="font-medium">{check.inspector_name}</div>
                    <div className="text-sm text-muted-foreground">
                      {new Date(check.check_date).toLocaleDateString()}
                    </div>
                  </div>
                  <Badge variant={check.status === 'completed' ? 'default' : 'secondary'}>
                    <CheckCircle className="h-3 w-3 mr-1" />
                    {check.status}
                  </Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default InspectionChecklist;