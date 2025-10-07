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
import { toast } from '@/hooks/use-toast';
import { Plus, Trash2, Download, Mail, Printer } from 'lucide-react';
import { format } from 'date-fns';
import jsPDF from 'jspdf';
import 'jspdf-autotable';

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
          </DialogHeader>
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2">
              <Label htmlFor="hazard_description">Hazard Description *</Label>
              <Textarea
                id="hazard_description"
                value={itemFormData.hazard_description}
                onChange={(e) => setItemFormData({ ...itemFormData, hazard_description: e.target.value })}
              />
            </div>
            <div className="col-span-2">
              <Label htmlFor="who_at_risk">Who is at Risk *</Label>
              <Input
                id="who_at_risk"
                value={itemFormData.who_at_risk}
                onChange={(e) => setItemFormData({ ...itemFormData, who_at_risk: e.target.value })}
              />
            </div>
            <div className="col-span-2">
              <Label htmlFor="existing_controls">Existing Controls</Label>
              <Textarea
                id="existing_controls"
                value={itemFormData.existing_controls}
                onChange={(e) => setItemFormData({ ...itemFormData, existing_controls: e.target.value })}
              />
            </div>
            <div>
              <Label htmlFor="likelihood">Likelihood</Label>
              <Select value={itemFormData.likelihood} onValueChange={(value) => setItemFormData({ ...itemFormData, likelihood: value })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="rare">Rare</SelectItem>
                  <SelectItem value="unlikely">Unlikely</SelectItem>
                  <SelectItem value="possible">Possible</SelectItem>
                  <SelectItem value="likely">Likely</SelectItem>
                  <SelectItem value="certain">Certain</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="severity">Severity</Label>
              <Select value={itemFormData.severity} onValueChange={(value) => setItemFormData({ ...itemFormData, severity: value })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="negligible">Negligible</SelectItem>
                  <SelectItem value="minor">Minor</SelectItem>
                  <SelectItem value="moderate">Moderate</SelectItem>
                  <SelectItem value="major">Major</SelectItem>
                  <SelectItem value="catastrophic">Catastrophic</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="col-span-2">
              <Label htmlFor="risk_level">Overall Risk Level</Label>
              <Select value={itemFormData.risk_level} onValueChange={(value) => setItemFormData({ ...itemFormData, risk_level: value })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="low">Low</SelectItem>
                  <SelectItem value="medium">Medium</SelectItem>
                  <SelectItem value="high">High</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="col-span-2">
              <Label htmlFor="additional_actions">Additional Actions Required</Label>
              <Textarea
                id="additional_actions"
                value={itemFormData.additional_actions}
                onChange={(e) => setItemFormData({ ...itemFormData, additional_actions: e.target.value })}
              />
            </div>
            <div>
              <Label htmlFor="action_owner">Action Owner</Label>
              <Input
                id="action_owner"
                value={itemFormData.action_owner}
                onChange={(e) => setItemFormData({ ...itemFormData, action_owner: e.target.value })}
              />
            </div>
            <div>
              <Label htmlFor="target_date">Target Date</Label>
              <Input
                id="target_date"
                type="date"
                value={itemFormData.target_date}
                onChange={(e) => setItemFormData({ ...itemFormData, target_date: e.target.value })}
              />
            </div>
            <div className="col-span-2">
              <Label htmlFor="status">Status</Label>
              <Select value={itemFormData.status} onValueChange={(value) => setItemFormData({ ...itemFormData, status: value })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="open">Open</SelectItem>
                  <SelectItem value="in_progress">In Progress</SelectItem>
                  <SelectItem value="completed">Completed</SelectItem>
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