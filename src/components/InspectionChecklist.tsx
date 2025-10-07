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
import { Download, FileText, CheckCircle, Clock, AlertTriangle, Mail, Printer, Plus } from 'lucide-react';
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

  const generatePDF = async () => {
    if (!activeTemplate) return;

    try {
      const pdf = new jsPDF();
      const pageWidth = pdf.internal.pageSize.getWidth();
      const margin = 20;
      let currentY = margin;

      // Header
      pdf.setFontSize(20);
      pdf.text(`${frequency.charAt(0).toUpperCase() + frequency.slice(1)} Inspection Report`, margin, currentY);
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
      pdf.text('Inspection Items:', margin, currentY);
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

      pdf.save(`${frequency}-inspection-${ride.ride_name}-${new Date().toISOString().split('T')[0]}.pdf`);
      
      toast({
        title: "PDF Generated",
        description: "Inspection report has been downloaded"
      });
    } catch (error) {
      console.error('Error generating PDF:', error);
      toast({
        title: "Error",
        description: "Failed to generate PDF",
        variant: "destructive"
      });
    }
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

      toast({
        title: "Inspection completed",
        description: `${frequency.charAt(0).toUpperCase() + frequency.slice(1)} inspection has been saved successfully`
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

  if (loading) {
    return (
      <div className="flex justify-center py-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!activeTemplate) {
    if (showTemplateBuilder) {
      return (
        <TemplateBuilder
          ride={ride}
          frequency={frequency}
          onSuccess={() => {
            setShowTemplateBuilder(false);
            loadActiveTemplate();
            toast({
              title: "Template created",
              description: "Your template has been created. Don't forget to activate it!"
            });
          }}
          onCancel={() => setShowTemplateBuilder(false)}
        />
      );
    }

    return (
      <Card>
        <CardContent className="pt-6">
          <div className="text-center py-8 space-y-4">
            <FileText className="mx-auto h-16 w-16 text-muted-foreground" />
            <h3 className="text-lg font-semibold mt-4">No Active Template Found</h3>
            <p className="text-muted-foreground">
              Create a {frequency} inspection template to start performing checks
            </p>
            <Button onClick={() => setShowTemplateBuilder(true)} className="mt-4">
              <Plus className="h-4 w-4 mr-2" />
              Create Template
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
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span>{activeTemplate.template_name}</span>
            <div className="flex items-center space-x-2">
              <Button variant="outline" size="sm" onClick={generatePDF}>
                <Download className="h-4 w-4 mr-2" />
                Export PDF
              </Button>
            </div>
          </CardTitle>
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
                .sort((a, b) => a.sort_order - b.sort_order)
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