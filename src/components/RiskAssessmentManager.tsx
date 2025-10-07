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
import { Plus, Trash2, Download, Mail, Printer, CalendarIcon } from 'lucide-react';
import { format } from 'date-fns';
import jsPDF from 'jspdf';
import 'jspdf-autotable';
import { cn } from '@/lib/utils';

interface RiskAssessmentManagerProps {
  ride: {
    id: string;
    ride_name: string;
    manufacturer?: string;
  };
}

interface RiskAssessment {
  id: string;
  assessment_date: string;
  assessor_name: string;
  review_date?: string;
  overall_status: string;
  notes?: string;
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
}

export const RiskAssessmentManager: React.FC<RiskAssessmentManagerProps> = ({ ride }) => {
  const { user } = useAuth();
  const [assessments, setAssessments] = useState<RiskAssessment[]>([]);
  const [selectedAssessment, setSelectedAssessment] = useState<RiskAssessment | null>(null);
  const [assessmentItems, setAssessmentItems] = useState<RiskAssessmentItem[]>([]);
  const [showNewAssessment, setShowNewAssessment] = useState(false);
  const [showItemDialog, setShowItemDialog] = useState(false);
  const [editingItem, setEditingItem] = useState<RiskAssessmentItem | null>(null);
  const [loading, setLoading] = useState(true);

  const [formData, setFormData] = useState({
    assessor_name: '',
    assessment_date: format(new Date(), 'yyyy-MM-dd'),
    review_date: '',
    overall_status: 'pending',
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

  useEffect(() => {
    loadAssessments();
  }, [ride.id, user]);

  useEffect(() => {
    if (selectedAssessment) {
      loadAssessmentItems();
    }
  }, [selectedAssessment]);

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
        overall_status: 'pending',
        notes: ''
      });
      loadAssessments();
      setSelectedAssessment(data);
    }
  };

  const handleSaveItem = async () => {
    if (!selectedAssessment) return;

    // Convert empty strings to null for date fields
    const itemData = {
      ...itemFormData,
      target_date: itemFormData.target_date || null
    };

    if (editingItem) {
      const { error } = await supabase
        .from('risk_assessment_items')
        .update(itemData)
        .eq('id', editingItem.id);

      if (error) {
        toast({ title: 'Error updating item', description: error.message, variant: 'destructive' });
      } else {
        toast({ title: 'Success', description: 'Risk item updated' });
        setShowItemDialog(false);
        setEditingItem(null);
        resetItemForm();
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
        toast({ title: 'Success', description: 'Risk item added' });
        setShowItemDialog(false);
        resetItemForm();
        loadAssessmentItems();
      }
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
  };

  const getRiskColor = (level: string) => {
    switch (level) {
      case 'low': return 'bg-green-100 text-green-800';
      case 'medium': return 'bg-yellow-100 text-yellow-800';
      case 'high': return 'bg-red-100 text-red-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const exportToPDF = () => {
    if (!selectedAssessment) return;

    const doc = new jsPDF();
    
    doc.setFontSize(16);
    doc.text('Risk Assessment', 14, 20);
    doc.setFontSize(10);
    doc.text(`Ride: ${ride.ride_name}`, 14, 30);
    doc.text(`Assessor: ${selectedAssessment.assessor_name}`, 14, 36);
    doc.text(`Date: ${format(new Date(selectedAssessment.assessment_date), 'dd/MM/yyyy')}`, 14, 42);

    const tableData = assessmentItems.map(item => [
      item.hazard_description,
      item.who_at_risk,
      item.existing_controls || '-',
      item.risk_level.toUpperCase(),
      item.additional_actions || '-',
      item.status
    ]);

    (doc as any).autoTable({
      startY: 50,
      head: [['Hazard', 'Who at Risk', 'Controls', 'Risk Level', 'Actions', 'Status']],
      body: tableData,
      styles: { fontSize: 8 },
      headStyles: { fillColor: [66, 139, 202] }
    });

    doc.save(`risk-assessment-${ride.ride_name}-${format(new Date(), 'yyyy-MM-dd')}.pdf`);
    toast({ title: 'Success', description: 'PDF downloaded' });
  };

  const handlePrint = () => {
    window.print();
  };

  if (loading) {
    return <div className="p-8 text-center">Loading risk assessments...</div>;
  }

  if (!selectedAssessment) {
    return (
      <div className="space-y-4">
        <div className="flex justify-between items-center">
          <h3 className="text-xl font-semibold">Risk Assessments for {ride.ride_name}</h3>
          <Button onClick={() => setShowNewAssessment(true)}>
            <Plus className="mr-2 h-4 w-4" /> New Assessment
          </Button>
        </div>

        <div className="grid gap-4">
          {assessments.map((assessment) => (
            <Card key={assessment.id} className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => setSelectedAssessment(assessment)}>
              <CardHeader>
                <CardTitle>{format(new Date(assessment.assessment_date), 'dd MMM yyyy')}</CardTitle>
                <CardDescription>By {assessment.assessor_name}</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex items-center gap-2">
                  <span className="text-sm text-muted-foreground">Status:</span>
                  <span className={`px-2 py-1 rounded text-xs font-medium ${
                    assessment.overall_status === 'completed' ? 'bg-green-100 text-green-800' :
                    assessment.overall_status === 'in_progress' ? 'bg-blue-100 text-blue-800' :
                    'bg-gray-100 text-gray-800'
                  }`}>
                    {assessment.overall_status}
                  </span>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

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
    <div className="space-y-6">
      {/* Header Section */}
      <div className="space-y-4">
        <Button variant="ghost" onClick={() => setSelectedAssessment(null)} className="mb-2">
          ← Back to Assessments
        </Button>
        
        <Card>
          <CardHeader>
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div>
                <CardTitle className="text-2xl">Risk Assessment</CardTitle>
                <CardDescription className="text-base mt-1">
                  {format(new Date(selectedAssessment.assessment_date), 'dd MMMM yyyy')} • {selectedAssessment.assessor_name}
                </CardDescription>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button variant="outline" size="sm" onClick={handlePrint}>
                  <Printer className="h-4 w-4 mr-2" /> Print
                </Button>
                <Button variant="outline" size="sm" onClick={exportToPDF}>
                  <Download className="h-4 w-4 mr-2" /> PDF
                </Button>
                <Button onClick={() => setShowItemDialog(true)} className="btn-bold-primary">
                  <Plus className="h-4 w-4 mr-2" /> Add Risk Item
                </Button>
              </div>
            </div>
          </CardHeader>
        </Card>
      </div>

      {/* Risk Items Section */}
      {assessmentItems.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <div className="mx-auto w-12 h-12 rounded-full bg-muted flex items-center justify-center mb-4">
              <Plus className="h-6 w-6 text-muted-foreground" />
            </div>
            <h3 className="text-lg font-semibold mb-2">No Risk Items Yet</h3>
            <p className="text-sm text-muted-foreground mb-4">
              Start by adding hazards and risks to assess
            </p>
            <Button onClick={() => setShowItemDialog(true)} className="btn-bold-primary">
              <Plus className="h-4 w-4 mr-2" /> Add Your First Risk Item
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {assessmentItems.map((item) => (
            <Card key={item.id} className="hover:shadow-md transition-shadow">
              <CardContent className="pt-6">
                <div className="space-y-4">
                  {/* Header with Risk Level and Actions */}
                  <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <span className={`px-3 py-1 rounded-full text-xs font-bold ${getRiskColor(item.risk_level)}`}>
                          {item.risk_level.toUpperCase()}
                        </span>
                        <span className="px-2 py-1 rounded-md text-xs bg-muted">
                          {item.status}
                        </span>
                      </div>
                      <h4 className="font-semibold text-lg">{item.hazard_description}</h4>
                    </div>
                    <div className="flex gap-2 shrink-0">
                      <Button 
                        variant="outline" 
                        size="sm"
                        onClick={() => {
                          setEditingItem(item);
                          setItemFormData(item);
                          setShowItemDialog(true);
                        }}
                      >
                        Edit
                      </Button>
                      <Button 
                        variant="outline" 
                        size="sm"
                        onClick={() => handleDeleteItem(item.id)}
                      >
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                  </div>

                  {/* Content Grid */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                    <div>
                      <p className="text-xs font-medium text-muted-foreground uppercase mb-1">Who at Risk</p>
                      <p>{item.who_at_risk}</p>
                    </div>
                    
                    {item.existing_controls && (
                      <div>
                        <p className="text-xs font-medium text-muted-foreground uppercase mb-1">Existing Controls</p>
                        <p>{item.existing_controls}</p>
                      </div>
                    )}
                    
                    {item.additional_actions && (
                      <div>
                        <p className="text-xs font-medium text-muted-foreground uppercase mb-1">Additional Actions</p>
                        <p>{item.additional_actions}</p>
                      </div>
                    )}
                    
                    {item.action_owner && (
                      <div>
                        <p className="text-xs font-medium text-muted-foreground uppercase mb-1">Action Owner</p>
                        <p>{item.action_owner}</p>
                      </div>
                    )}
                    
                    {item.target_date && (
                      <div>
                        <p className="text-xs font-medium text-muted-foreground uppercase mb-1">Target Date</p>
                        <p>{format(new Date(item.target_date), 'dd MMM yyyy')}</p>
                      </div>
                    )}
                    
                    <div>
                      <p className="text-xs font-medium text-muted-foreground uppercase mb-1">Risk Assessment</p>
                      <p>Likelihood: {item.likelihood} • Severity: {item.severity}</p>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={showItemDialog} onOpenChange={(open) => {
        setShowItemDialog(open);
        if (!open) {
          setEditingItem(null);
          resetItemForm();
        }
      }}>
        <DialogContent className="max-w-2xl w-[95vw] max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingItem ? 'Edit' : 'Add'} Risk Item</DialogTitle>
            <DialogDescription>
              A risk assessment helps identify hazards and controls to keep everyone safe. Answer each question as accurately as possible.
            </DialogDescription>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2">
              <Label htmlFor="hazard_description">Hazard Description *</Label>
              <p className="text-xs text-muted-foreground mb-2">What is the danger or hazard? Describe what could cause harm or injury.</p>
              <Select value={itemFormData.hazard_description} onValueChange={(value) => setItemFormData({ ...itemFormData, hazard_description: value })}>
                <SelectTrigger>
                  <SelectValue placeholder="Select a hazard or choose Custom to add your own" />
                </SelectTrigger>
                <SelectContent className="bg-background z-50">
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
                  
                  {/* Electrical Hazards */}
                  <SelectItem value="__electrical" disabled className="font-semibold text-primary">── Electrical Hazards ──</SelectItem>
                  <SelectItem value="Electrical shock from exposed wiring">Electrical shock from exposed wiring</SelectItem>
                  <SelectItem value="Short circuit or electrical fire">Short circuit or electrical fire</SelectItem>
                  <SelectItem value="Overloaded electrical circuits">Overloaded electrical circuits</SelectItem>
                  <SelectItem value="Water ingress to electrical components">Water ingress to electrical components</SelectItem>
                  <SelectItem value="Inadequate earthing or grounding">Inadequate earthing or grounding</SelectItem>
                  
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
                  
                  {/* Patron Safety */}
                  <SelectItem value="__patron" disabled className="font-semibold text-primary">── Patron Safety ──</SelectItem>
                  <SelectItem value="Rider entrapment or ejection">Rider entrapment or ejection</SelectItem>
                  <SelectItem value="Inadequate restraint systems">Inadequate restraint systems</SelectItem>
                  <SelectItem value="Patron not meeting height or health restrictions">Patron not meeting height or health restrictions</SelectItem>
                  <SelectItem value="Loose articles becoming projectiles">Loose articles becoming projectiles</SelectItem>
                  <SelectItem value="Overcrowding or queue management issues">Overcrowding or queue management issues</SelectItem>
                  
                  {/* Emergency & Fire */}
                  <SelectItem value="__emergency" disabled className="font-semibold text-primary">── Emergency & Fire ──</SelectItem>
                  <SelectItem value="Fire or explosion risk">Fire or explosion risk</SelectItem>
                  <SelectItem value="Inadequate emergency evacuation routes">Inadequate emergency evacuation routes</SelectItem>
                  <SelectItem value="Fire suppression system failure">Fire suppression system failure</SelectItem>
                  <SelectItem value="Fuel or oil leak creating fire hazard">Fuel or oil leak creating fire hazard</SelectItem>
                  <SelectItem value="Emergency stop system malfunction">Emergency stop system malfunction</SelectItem>
                  
                  <SelectItem value="Custom">Custom (enter below)</SelectItem>
                </SelectContent>
              </Select>
              {itemFormData.hazard_description === 'Custom' && (
                <Textarea
                  className="mt-2"
                  placeholder="Enter your custom hazard description"
                  value={itemFormData.hazard_description}
                  onChange={(e) => setItemFormData({ ...itemFormData, hazard_description: e.target.value })}
                />
              )}
            </div>
            <div className="col-span-2">
              <Label>Who is at Risk * (Select all that apply)</Label>
              <p className="text-xs text-muted-foreground mb-2">Identify who could be harmed by this hazard</p>
              <div className="grid grid-cols-2 gap-3 mt-2 p-4 border rounded-md">
                {['Public', 'Staff', 'Contractors', 'Spectators', 'Operators', 'Maintenance personnel', 'All persons'].map((option) => {
                  const selectedGroups = itemFormData.who_at_risk ? itemFormData.who_at_risk.split(', ') : [];
                  const isChecked = selectedGroups.includes(option);
                  
                  return (
                    <div key={option} className="flex items-center space-x-2">
                      <Checkbox
                        id={`risk-${option}`}
                        checked={isChecked}
                        onCheckedChange={(checked) => {
                          let newGroups = [...selectedGroups];
                          if (checked) {
                            if (!newGroups.includes(option)) {
                              newGroups.push(option);
                            }
                          } else {
                            newGroups = newGroups.filter(g => g !== option);
                          }
                          setItemFormData({ ...itemFormData, who_at_risk: newGroups.join(', ') });
                        }}
                      />
                      <Label htmlFor={`risk-${option}`} className="text-sm font-normal cursor-pointer">
                        {option}
                      </Label>
                    </div>
                  );
                })}
              </div>
            </div>
            <div className="col-span-2">
              <Label htmlFor="existing_controls">Existing Controls</Label>
              <p className="text-xs text-muted-foreground mb-2">What safety measures are already in place to prevent or reduce this risk?</p>
              <Select value={itemFormData.existing_controls} onValueChange={(value) => setItemFormData({ ...itemFormData, existing_controls: value })}>
                <SelectTrigger>
                  <SelectValue placeholder="Select existing controls or choose Custom to add your own" />
                </SelectTrigger>
                <SelectContent className="bg-background z-50">
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
                  
                  {/* Emergency Preparedness */}
                  <SelectItem value="__emergency" disabled className="font-semibold text-primary">── Emergency Preparedness ──</SelectItem>
                  <SelectItem value="Emergency evacuation procedures established">Emergency evacuation procedures established</SelectItem>
                  <SelectItem value="First aid station and trained personnel available">First aid station and trained personnel available</SelectItem>
                  <SelectItem value="Emergency contact numbers displayed">Emergency contact numbers displayed</SelectItem>
                  <SelectItem value="Fire extinguishers positioned and serviced">Fire extinguishers positioned and serviced</SelectItem>
                  <SelectItem value="Emergency lighting installed">Emergency lighting installed</SelectItem>
                  <SelectItem value="Communication systems for emergencies">Communication systems for emergencies</SelectItem>
                  
                  {/* Training & Competency */}
                  <SelectItem value="__training" disabled className="font-semibold text-primary">── Training & Competency ──</SelectItem>
                  <SelectItem value="Operator training and certification program">Operator training and certification program</SelectItem>
                  <SelectItem value="Refresher training conducted annually">Refresher training conducted annually</SelectItem>
                  <SelectItem value="Induction training for new staff">Induction training for new staff</SelectItem>
                  <SelectItem value="Toolbox talks on specific hazards">Toolbox talks on specific hazards</SelectItem>
                  <SelectItem value="Competency assessments completed">Competency assessments completed</SelectItem>
                  
                  <SelectItem value="Custom">Custom (enter below)</SelectItem>
                </SelectContent>
              </Select>
              {itemFormData.existing_controls === 'Custom' && (
                <Textarea
                  className="mt-2"
                  placeholder="Enter your custom existing controls"
                  value={itemFormData.existing_controls}
                  onChange={(e) => setItemFormData({ ...itemFormData, existing_controls: e.target.value })}
                />
              )}
            </div>
            <div>
              <Label htmlFor="likelihood">Likelihood</Label>
              <p className="text-xs text-muted-foreground mb-2">How likely is this hazard to cause harm?</p>
              <Select value={itemFormData.likelihood} onValueChange={(value) => setItemFormData({ ...itemFormData, likelihood: value })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="rare">Rare - May occur only in exceptional circumstances</SelectItem>
                  <SelectItem value="unlikely">Unlikely - Could occur at some time</SelectItem>
                  <SelectItem value="possible">Possible - Might occur at some time</SelectItem>
                  <SelectItem value="likely">Likely - Will probably occur in most circumstances</SelectItem>
                  <SelectItem value="certain">Certain - Expected to occur in most circumstances</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="severity">Severity</Label>
              <p className="text-xs text-muted-foreground mb-2">How serious would the injury or harm be?</p>
              <Select value={itemFormData.severity} onValueChange={(value) => setItemFormData({ ...itemFormData, severity: value })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="negligible">Negligible - No injury or minimal impact</SelectItem>
                  <SelectItem value="minor">Minor - First aid treatment, minor injuries</SelectItem>
                  <SelectItem value="moderate">Moderate - Medical attention required</SelectItem>
                  <SelectItem value="major">Major - Serious injury or long-term health effects</SelectItem>
                  <SelectItem value="catastrophic">Catastrophic - Death or permanent disability</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="col-span-2">
              <Label htmlFor="risk_level">Overall Risk Level</Label>
              <p className="text-xs text-muted-foreground mb-2">Combine likelihood and severity to determine overall risk. High risk requires immediate action.</p>
              <Select value={itemFormData.risk_level} onValueChange={(value) => setItemFormData({ ...itemFormData, risk_level: value })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="low">Low - Acceptable risk with controls in place</SelectItem>
                  <SelectItem value="medium">Medium - Risk requires additional controls</SelectItem>
                  <SelectItem value="high">High - Unacceptable risk, immediate action required</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="col-span-2">
              <Label htmlFor="additional_actions">Additional Actions Required</Label>
              <p className="text-xs text-muted-foreground mb-2">What extra steps need to be taken to further reduce the risk?</p>
              <Select value={itemFormData.additional_actions} onValueChange={(value) => setItemFormData({ ...itemFormData, additional_actions: value })}>
                <SelectTrigger>
                  <SelectValue placeholder="Select additional actions or choose Custom to add your own" />
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
              <Label htmlFor="action_owner">Action Owner</Label>
              <p className="text-xs text-muted-foreground mb-2">Who is responsible for completing the additional actions?</p>
              <Input
                id="action_owner"
                placeholder="e.g., Site Manager, Chief Engineer"
                value={itemFormData.action_owner}
                onChange={(e) => setItemFormData({ ...itemFormData, action_owner: e.target.value })}
              />
            </div>
            <div>
              <Label htmlFor="target_date">Target Date</Label>
              <p className="text-xs text-muted-foreground mb-2">When should the actions be completed by?</p>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn(
                      "w-full justify-start text-left font-normal h-10",
                      !itemFormData.target_date && "text-muted-foreground"
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
            </div>
            <div className="col-span-2">
              <Label htmlFor="status">Status</Label>
              <p className="text-xs text-muted-foreground mb-2">What is the current status of this risk item?</p>
              <Select value={itemFormData.status} onValueChange={(value) => setItemFormData({ ...itemFormData, status: value })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent className="bg-background z-50">
                  <SelectItem value="open">
                    <div className="flex flex-col">
                      <span className="font-medium">Open</span>
                      <span className="text-xs text-muted-foreground">Not yet started - This risk needs attention</span>
                    </div>
                  </SelectItem>
                  <SelectItem value="in_progress">
                    <div className="flex flex-col">
                      <span className="font-medium">In Progress</span>
                      <span className="text-xs text-muted-foreground">Currently being addressed - Actions are underway</span>
                    </div>
                  </SelectItem>
                  <SelectItem value="completed">
                    <div className="flex flex-col">
                      <span className="font-medium">Completed</span>
                      <span className="text-xs text-muted-foreground">Fully addressed - Controls implemented and verified</span>
                    </div>
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => {
              setShowItemDialog(false);
              setEditingItem(null);
              resetItemForm();
            }}>Cancel</Button>
            <Button onClick={handleSaveItem}>Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};