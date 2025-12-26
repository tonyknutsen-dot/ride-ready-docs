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
import { Download, FileText, CheckCircle, Clock, AlertTriangle, Mail, Printer, Plus, Settings, Trash2 } from 'lucide-react';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Tables } from '@/integrations/supabase/types';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
import TemplateBuilder from './TemplateBuilder';

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
  const [submitting, setSubmitting] = useState(false);
  const [loading, setLoading] = useState(true);
  const [showTemplateBuilder, setShowTemplateBuilder] = useState(false);
  const { toast } = useToast();
  const { user } = useAuth();

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
        .single();

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

  const generatePDFBlob = async (): Promise<Blob | null> => {
    if (!activeTemplate) return null;

    try {
      const pdf = new jsPDF();
      const pageWidth = pdf.internal.pageSize.getWidth();
      const margin = 20;
      let currentY = margin;

      // Header
      pdf.setFontSize(20);
      pdf.text(`${frequency.charAt(0).toUpperCase() + frequency.slice(1)} Check Report`, margin, currentY);
      currentY += 15;

      pdf.setFontSize(12);
      pdf.text(`Ride: ${ride.ride_name}`, margin, currentY);
      currentY += 8;
      pdf.text(`Inspector: ${inspectorName}`, margin, currentY);
      currentY += 8;
      pdf.text(`Date: ${new Date().toLocaleDateString()}`, margin, currentY);
      currentY += 8;
      pdf.text(`Weather: ${weatherConditions}`, margin, currentY);
      currentY += 15;

      // Check items
      pdf.setFontSize(14);
      pdf.text('Check Items:', margin, currentY);
      currentY += 10;

      pdf.setFontSize(10);
      activeTemplate.daily_check_template_items.forEach((item) => {
        const isChecked = checkedItems[item.id];
        const status = isChecked ? '✓ PASS' : '✗ FAIL';
        const note = notes[item.id] || '';
        
        pdf.text(`${status} - ${item.check_item_text}`, margin, currentY);
        currentY += 6;
        
        if (note) {
          pdf.text(`    Note: ${note}`, margin, currentY);
          currentY += 6;
        }
        
        if (currentY > 250) {
          pdf.addPage();
          currentY = margin;
        }
      });

      // Inspector notes
      if (inspectorNotes) {
        currentY += 10;
        pdf.setFontSize(12);
        pdf.text('Inspector Notes:', margin, currentY);
        currentY += 8;
        pdf.setFontSize(10);
        const splitNotes = pdf.splitTextToSize(inspectorNotes, pageWidth - 2 * margin);
        pdf.text(splitNotes, margin, currentY);
      }

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
        title: "Inspector name required",
        description: "Please enter the inspector's name",
        variant: "destructive"
      });
      return;
    }

    setSubmitting(true);

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
          signature_data: signatureData.trim() || null
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

      // Generate and save PDF to documents
      const pdfBlob = await generatePDFBlob();
      if (pdfBlob) {
        const fileName = `${frequency}-check-${ride.ride_name}-${new Date().toISOString()}.pdf`;
        const filePath = `${user?.id}/${ride.id}/check-records/${fileName}`;
        
        // Upload to storage
        const { error: uploadError } = await supabase.storage
          .from('ride-documents')
          .upload(filePath, pdfBlob, {
            contentType: 'application/pdf',
            upsert: false
          });

        if (!uploadError) {
          // Create document record
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
              notes: `Inspector: ${inspectorName}${weatherConditions ? ` | Weather: ${weatherConditions}` : ''}`
            });
        }
      }

      toast({
        title: "Check completed",
        description: `${frequency.charAt(0).toUpperCase() + frequency.slice(1)} check has been saved successfully`
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

      // Reload recent checks
      await loadRecentChecks();
    } catch (error) {
      console.error('Error submitting checks:', error);
      toast({
        title: "Error",
        description: "Failed to save inspection",
        variant: "destructive"
      });
    } finally {
      setSubmitting(false);
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
        description: "The template has been successfully deleted",
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
      <Card>
        <CardContent className="pt-6">
          <div className="text-center py-8 space-y-4">
            <FileText className="mx-auto h-16 w-16 text-muted-foreground" />
            <h3 className="text-lg font-semibold mt-4">No Active Template Found</h3>
            <p className="text-muted-foreground">
              First, build your {frequency} safety check template. Then you can start recording checks.
            </p>
            <Button onClick={() => setShowTemplateBuilder(true)} className="mt-4">
              <Plus className="h-4 w-4 mr-2" />
              Build Template
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div id="inspection-checklist-form" className="space-y-6">
      <Alert>
        <AlertDescription>
          Complete all required inspection items, add detailed notes where necessary, and submit to save your {frequency} inspection record. You can export the results as a PDF.
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
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button variant="outline" size="sm" className="flex-1 sm:flex-none">
                    <Trash2 className="h-4 w-4 sm:mr-2" />
                    <span className="hidden sm:inline">Delete</span>
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent className="w-[95vw] max-w-[95vw] sm:max-w-lg">
                  <AlertDialogHeader>
                    <AlertDialogTitle>Delete Template</AlertDialogTitle>
                    <AlertDialogDescription>
                      Are you sure you want to delete "{activeTemplate.template_name}"? 
                      This action cannot be undone.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction
                      onClick={handleDeleteTemplate}
                      className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                    >
                      Delete
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </div>
          </div>
          <CardDescription>
            {activeTemplate.description}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-6">
            {/* Inspector Information */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="inspector">Inspector Name *</Label>
                <Input
                  id="inspector"
                  value={inspectorName}
                  onChange={(e) => setInspectorName(e.target.value)}
                  placeholder="Enter inspector name"
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
              <h4 className="font-semibold">Inspection Items</h4>
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
              <span>Recent {frequency.charAt(0).toUpperCase() + frequency.slice(1)} Inspections</span>
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