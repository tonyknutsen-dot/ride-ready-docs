import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { Building, Plus, Edit, Trash2, Calendar, Upload, FileText } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { Tables } from '@/integrations/supabase/types';
import { format } from 'date-fns';

type Ride = Tables<'rides'> & {
  ride_categories: {
    name: string;
    description: string | null;
  };
};

type AnnualInspectionReport = Tables<'annual_inspection_reports'>;

interface AnnualInspectionManagerProps {
  ride: Ride;
}

const AnnualInspectionManager = ({ ride }: AnnualInspectionManagerProps) => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [reports, setReports] = useState<AnnualInspectionReport[]>([]);
  const [loading, setLoading] = useState(true);
  const [showDialog, setShowDialog] = useState(false);
  const [editingReport, setEditingReport] = useState<AnnualInspectionReport | null>(null);
  
  // Form state
  const [formData, setFormData] = useState({
    inspection_year: new Date().getFullYear(),
    inspector_name: '',
    inspection_company: '',
    inspection_date: '',
    certificate_number: '',
    inspection_status: 'pass' as 'pass' | 'fail' | 'conditional',
    conditions_notes: '',
    recommendations: '',
    next_inspection_due: ''
  });

  useEffect(() => {
    if (user) {
      loadReports();
    }
  }, [user, ride.id]);

  const loadReports = async () => {
    try {
      const { data, error } = await supabase
        .from('annual_inspection_reports')
        .select('*')
        .eq('user_id', user?.id)
        .eq('ride_id', ride.id)
        .order('inspection_year', { ascending: false });

      if (error) {
        throw error;
      }

      setReports(data || []);
    } catch (error: any) {
      console.error('Error loading annual reports:', error);
      toast({
        title: "Error loading reports",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setFormData({
      inspection_year: new Date().getFullYear(),
      inspector_name: '',
      inspection_company: '',
      inspection_date: '',
      certificate_number: '',
      inspection_status: 'pass',
      conditions_notes: '',
      recommendations: '',
      next_inspection_due: ''
    });
    setEditingReport(null);
  };

  const handleEdit = (report: AnnualInspectionReport) => {
    setEditingReport(report);
    setFormData({
      inspection_year: report.inspection_year,
      inspector_name: report.inspector_name,
      inspection_company: report.inspection_company,
      inspection_date: report.inspection_date,
      certificate_number: report.certificate_number || '',
      inspection_status: report.inspection_status as 'pass' | 'fail' | 'conditional',
      conditions_notes: report.conditions_notes || '',
      recommendations: report.recommendations || '',
      next_inspection_due: report.next_inspection_due || ''
    });
    setShowDialog(true);
  };

  const handleSave = async () => {
    if (!formData.inspector_name.trim() || !formData.inspection_company.trim() || !formData.inspection_date) {
      toast({
        title: "Missing information",
        description: "Please fill in all required fields",
        variant: "destructive",
      });
      return;
    }

    try {
      if (editingReport) {
        const { error } = await supabase
          .from('annual_inspection_reports')
          .update(formData)
          .eq('id', editingReport.id);

        if (error) throw error;

        toast({
          title: "Report updated",
          description: "Annual inspection report has been updated successfully",
        });
      } else {
        const { error } = await supabase
          .from('annual_inspection_reports')
          .insert({
            ...formData,
            user_id: user?.id,
            ride_id: ride.id,
          });

        if (error) throw error;

        toast({
          title: "Report created",
          description: "Annual inspection report has been created successfully",
        });
      }

      setShowDialog(false);
      resetForm();
      loadReports();
    } catch (error: any) {
      console.error('Error saving annual report:', error);
      toast({
        title: "Error saving report",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const handleDelete = async (reportId: string) => {
    try {
      const { error } = await supabase
        .from('annual_inspection_reports')
        .delete()
        .eq('id', reportId);

      if (error) throw error;

      toast({
        title: "Report deleted",
        description: "Annual inspection report has been deleted successfully",
      });

      loadReports();
    } catch (error: any) {
      console.error('Error deleting report:', error);
      toast({
        title: "Error deleting report",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'pass':
        return <Badge variant="default">Pass</Badge>;
      case 'fail':
        return <Badge variant="destructive">Fail</Badge>;
      case 'conditional':
        return <Badge variant="outline">Conditional</Badge>;
      default:
        return <Badge variant="secondary">Unknown</Badge>;
    }
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="pt-6">
          <div className="text-center py-4">
            <Building className="mx-auto h-8 w-8 text-muted-foreground animate-pulse" />
            <p className="text-muted-foreground mt-2">Loading annual inspection reports...</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="space-y-2">
          <h3 className="text-xl font-semibold">Annual In-Service Inspections</h3>
          <p className="text-muted-foreground">
            Manage annual in-service inspection reports for {ride.ride_name}
          </p>
        </div>
        <Dialog open={showDialog} onOpenChange={setShowDialog}>
          <DialogTrigger asChild>
            <Button onClick={resetForm} className="flex items-center space-x-2">
              <Plus className="h-4 w-4" />
              <span>Add Report</span>
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[600px]">
            <DialogHeader>
              <DialogTitle>
                {editingReport ? 'Edit' : 'Create'} Annual Inspection Report
              </DialogTitle>
              <DialogDescription>
                Record details of the annual in-service inspection
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 max-h-96 overflow-y-auto">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="inspection_year">Inspection Year</Label>
                  <Input
                    id="inspection_year"
                    type="number"
                    min="2000"
                    max="2100"
                    value={formData.inspection_year}
                    onChange={(e) => setFormData(prev => ({...prev, inspection_year: parseInt(e.target.value)}))}
                  />
                </div>
                <div>
                  <Label htmlFor="inspection_date">Inspection Date</Label>
                  <Input
                    id="inspection_date"
                    type="date"
                    value={formData.inspection_date}
                    onChange={(e) => setFormData(prev => ({...prev, inspection_date: e.target.value}))}
                  />
                </div>
              </div>
              <div>
                <Label htmlFor="inspector_name">Inspector Name</Label>
                <Input
                  id="inspector_name"
                  value={formData.inspector_name}
                  onChange={(e) => setFormData(prev => ({...prev, inspector_name: e.target.value}))}
                  placeholder="Name of the qualified inspector"
                />
              </div>
              <div>
                <Label htmlFor="inspection_company">Inspection Company</Label>
                <Input
                  id="inspection_company"
                  value={formData.inspection_company}
                  onChange={(e) => setFormData(prev => ({...prev, inspection_company: e.target.value}))}
                  placeholder="Name of the inspection body"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="certificate_number">Certificate Number</Label>
                  <Input
                    id="certificate_number"
                    value={formData.certificate_number}
                    onChange={(e) => setFormData(prev => ({...prev, certificate_number: e.target.value}))}
                    placeholder="Certificate or report number"
                  />
                </div>
                <div>
                  <Label htmlFor="inspection_status">Inspection Result</Label>
                  <Select 
                    value={formData.inspection_status} 
                    onValueChange={(value: 'pass' | 'fail' | 'conditional') => setFormData(prev => ({...prev, inspection_status: value}))}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select result" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="pass">Pass</SelectItem>
                      <SelectItem value="fail">Fail</SelectItem>
                      <SelectItem value="conditional">Conditional Pass</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div>
                <Label htmlFor="next_inspection_due">Next Inspection Due</Label>
                <Input
                  id="next_inspection_due"
                  type="date"
                  value={formData.next_inspection_due}
                  onChange={(e) => setFormData(prev => ({...prev, next_inspection_due: e.target.value}))}
                />
              </div>
              {formData.inspection_status !== 'pass' && (
                <div>
                  <Label htmlFor="conditions_notes">Conditions/Issues</Label>
                  <Textarea
                    id="conditions_notes"
                    value={formData.conditions_notes}
                    onChange={(e) => setFormData(prev => ({...prev, conditions_notes: e.target.value}))}
                    placeholder="Details of any conditions or issues found..."
                    rows={3}
                  />
                </div>
              )}
              <div>
                <Label htmlFor="recommendations">Recommendations</Label>
                <Textarea
                  id="recommendations"
                  value={formData.recommendations}
                  onChange={(e) => setFormData(prev => ({...prev, recommendations: e.target.value}))}
                  placeholder="Inspector recommendations for maintenance or repairs..."
                  rows={3}
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowDialog(false)}>
                Cancel
              </Button>
              <Button onClick={handleSave}>
                {editingReport ? 'Update' : 'Create'} Report
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {reports.length === 0 ? (
        <Card>
          <CardContent className="pt-6">
            <div className="text-center py-8">
              <Building className="mx-auto h-16 w-16 text-muted-foreground" />
              <h3 className="text-lg font-semibold mt-4">No annual inspection reports</h3>
              <p className="text-muted-foreground mb-4">
                Add annual in-service inspection reports from qualified inspection bodies.
              </p>
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {reports.map((report) => (
            <Card key={report.id}>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    <Building className="h-5 w-5" />
                    <div>
                      <CardTitle>Annual Inspection {report.inspection_year}</CardTitle>
                      <CardDescription>
                        {report.inspection_company} • {format(new Date(report.inspection_date), 'PPP')}
                      </CardDescription>
                    </div>
                  </div>
                  <div className="flex items-center space-x-2">
                    {getStatusBadge(report.inspection_status)}
                    <Button size="sm" variant="outline" onClick={() => handleEdit(report)}>
                      <Edit className="h-4 w-4" />
                    </Button>
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button size="sm" variant="outline">
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Delete Inspection Report</AlertDialogTitle>
                          <AlertDialogDescription>
                            Are you sure you want to delete the {report.inspection_year} annual inspection report? This action cannot be undone.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancel</AlertDialogCancel>
                          <AlertDialogAction
                            onClick={() => handleDelete(report.id)}
                            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                          >
                            Delete
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                  <div>
                    <p className="font-medium">Inspector</p>
                    <p className="text-muted-foreground">{report.inspector_name}</p>
                  </div>
                  <div>
                    <p className="font-medium">Certificate</p>
                    <p className="text-muted-foreground">{report.certificate_number || 'Not provided'}</p>
                  </div>
                  <div>
                    <p className="font-medium">Next Due</p>
                    <p className="text-muted-foreground flex items-center space-x-1">
                      <Calendar className="h-4 w-4" />
                      <span>
                        {report.next_inspection_due 
                          ? format(new Date(report.next_inspection_due), 'PPP')
                          : 'Not scheduled'
                        }
                      </span>
                    </p>
                  </div>
                </div>
                
                {report.conditions_notes && (
                  <div className="mt-4 p-3 bg-yellow-50 border border-yellow-200 rounded">
                    <p className="font-medium text-yellow-800 text-sm">Conditions/Issues:</p>
                    <p className="text-sm text-yellow-700">{report.conditions_notes}</p>
                  </div>
                )}
                
                {report.recommendations && (
                  <div className="mt-4 p-3 bg-muted rounded">
                    <p className="font-medium text-sm">Recommendations:</p>
                    <p className="text-sm text-muted-foreground">{report.recommendations}</p>
                  </div>
                )}
                
                {report.report_file_path && (
                  <div className="mt-4 flex items-center space-x-2">
                    <FileText className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm text-muted-foreground">Report document attached</span>
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
};

export default AnnualInspectionManager;