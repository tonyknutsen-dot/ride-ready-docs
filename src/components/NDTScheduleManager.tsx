import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { TestTube, Plus } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { Tables } from '@/integrations/supabase/types';
import { Ride } from '@/types/ride';
import NDTScheduleForm from './ndt/NDTScheduleForm';
import NDTScheduleCard from './ndt/NDTScheduleCard';

type NDTSchedule = Tables<'ndt_schedules'>;
type Document = Tables<'documents'>;

interface NDTScheduleManagerProps {
  ride: Ride;
}

interface NDTScheduleFormData {
  schedule_name: string;
  component_description: string;
  ndt_method: string;
  frequency_months: number;
  last_inspection_date: string;
  notes: string;
}

const NDTScheduleManager = ({ ride }: NDTScheduleManagerProps) => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [schedules, setSchedules] = useState<NDTSchedule[]>([]);
  const [scheduleDocuments, setScheduleDocuments] = useState<Record<string, Document>>({});
  const [loading, setLoading] = useState(true);
  const [showDialog, setShowDialog] = useState(false);
  const [editingSchedule, setEditingSchedule] = useState<NDTSchedule | null>(null);

  useEffect(() => {
    if (user) {
      loadSchedules();
    }
  }, [user, ride.id]);

  const loadSchedules = async () => {
    try {
      const { data, error } = await supabase
        .from('ndt_schedules')
        .select('*')
        .eq('user_id', user?.id)
        .eq('ride_id', ride.id)
        .order('next_inspection_due', { ascending: true });

      if (error) throw error;

      setSchedules(data || []);

      // Load linked documents
      const documentIds = (data || [])
        .filter(s => s.schedule_document_id)
        .map(s => s.schedule_document_id as string);

      if (documentIds.length > 0) {
        const { data: docs, error: docsError } = await supabase
          .from('documents')
          .select('*')
          .in('id', documentIds);

        if (!docsError && docs) {
          const docMap: Record<string, Document> = {};
          docs.forEach(doc => {
            docMap[doc.id] = doc;
          });
          setScheduleDocuments(docMap);
        }
      }
    } catch (error: any) {
      console.error('Error loading NDT schedules:', error);
      toast({
        title: "Error loading schedules",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleEdit = (schedule: NDTSchedule) => {
    setEditingSchedule(schedule);
    setShowDialog(true);
  };

  const handleAddNew = () => {
    setEditingSchedule(null);
    setShowDialog(true);
  };

  const calculateNextDueDate = (lastDate: string, frequencyMonths: number): string => {
    if (!lastDate) return '';
    const date = new Date(lastDate);
    date.setMonth(date.getMonth() + frequencyMonths);
    return date.toISOString().split('T')[0];
  };

  const handleSave = async (formData: NDTScheduleFormData) => {
    if (!formData.schedule_name.trim() || !formData.component_description.trim() || !formData.ndt_method) {
      toast({
        title: "Missing information",
        description: "Please fill in all required fields",
        variant: "destructive",
      });
      return;
    }

    const nextDueDate = formData.last_inspection_date 
      ? calculateNextDueDate(formData.last_inspection_date, formData.frequency_months)
      : null;

    try {
      if (editingSchedule) {
        const { error } = await supabase
          .from('ndt_schedules')
          .update({
            ...formData,
            next_inspection_due: nextDueDate,
          })
          .eq('id', editingSchedule.id);

        if (error) throw error;

        toast({
          title: "Schedule updated",
          description: "NDT schedule has been updated successfully",
        });
      } else {
        const { error } = await supabase
          .from('ndt_schedules')
          .insert({
            ...formData,
            user_id: user?.id,
            ride_id: ride.id,
            next_inspection_due: nextDueDate,
          });

        if (error) throw error;

        toast({
          title: "Schedule created",
          description: "NDT schedule has been created successfully",
        });
      }

      setShowDialog(false);
      setEditingSchedule(null);
      loadSchedules();
    } catch (error: any) {
      console.error('Error saving NDT schedule:', error);
      toast({
        title: "Error saving schedule",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const handleDelete = async (scheduleId: string) => {
    try {
      const { error } = await supabase
        .from('ndt_schedules')
        .delete()
        .eq('id', scheduleId);

      if (error) throw error;

      toast({
        title: "Schedule deleted",
        description: "NDT schedule has been deleted successfully",
      });

      loadSchedules();
    } catch (error: any) {
      console.error('Error deleting schedule:', error);
      toast({
        title: "Error deleting schedule",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="pt-6">
          <div className="text-center py-4">
            <TestTube className="mx-auto h-8 w-8 text-muted-foreground animate-pulse" />
            <p className="text-muted-foreground mt-2">Loading NDT schedules...</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <Alert>
        <AlertDescription>
          <strong>NDT Schedule Tracking:</strong> Track when NDT (Non-Destructive Testing) inspections are due for ride components. Actual NDT inspections must be conducted by independent qualified NDT inspectors.
        </AlertDescription>
      </Alert>

      <div className="flex items-center justify-between">
        <div className="space-y-2">
          <h3 className="text-xl font-semibold">NDT Inspection Tracking</h3>
          <p className="text-muted-foreground">
            Track NDT inspection requirements for {ride.ride_name}. Actual inspections conducted by independent NDT inspectors.
          </p>
        </div>
        <Button onClick={handleAddNew} className="flex items-center space-x-2">
          <Plus className="h-4 w-4" />
          <span>Add Schedule</span>
        </Button>
      </div>

      {schedules.length === 0 ? (
        <Card>
          <CardContent className="pt-6">
            <div className="text-center py-8">
              <TestTube className="mx-auto h-16 w-16 text-muted-foreground" />
              <h3 className="text-lg font-semibold mt-4">No NDT tracking schedules</h3>
              <p className="text-muted-foreground mb-4">
                Create tracking schedules for NDT inspections required for your equipment. Actual inspections will be conducted by independent NDT inspectors.
              </p>
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {schedules.map((schedule) => (
            <NDTScheduleCard
              key={schedule.id}
              schedule={schedule}
              scheduleDocument={schedule.schedule_document_id ? scheduleDocuments[schedule.schedule_document_id] : null}
              rideId={ride.id}
              onEdit={handleEdit}
              onDelete={handleDelete}
              onRefresh={loadSchedules}
            />
          ))}
        </div>
      )}

      <NDTScheduleForm
        open={showDialog}
        onOpenChange={setShowDialog}
        editingSchedule={editingSchedule}
        onSave={handleSave}
      />
    </div>
  );
};

export default NDTScheduleManager;
