import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Badge } from '@/components/ui/badge';
import { CalendarIcon, Upload, X, Camera, FileText, Save, Plus } from 'lucide-react';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Tables } from '@/integrations/supabase/types';

type Ride = Tables<'rides'> & {
  ride_categories: {
    name: string;
    description: string | null;
  };
};

interface MaintenanceLoggerProps {
  ride: Ride;
  onMaintenanceLogged?: () => void;
}

const MAINTENANCE_TYPES = [
  { value: 'preventive', label: 'Preventive Maintenance' },
  { value: 'corrective', label: 'Corrective Maintenance' },
  { value: 'emergency', label: 'Emergency Repair' },
  { value: 'inspection', label: 'Inspection & Testing' },
  { value: 'lubrication', label: 'Lubrication' },
  { value: 'electrical', label: 'Electrical Work' },
  { value: 'mechanical', label: 'Mechanical Work' },
  { value: 'hydraulic', label: 'Hydraulic Work' },
  { value: 'structural', label: 'Structural Work' },
  { value: 'safety', label: 'Safety System Work' },
  { value: 'other', label: 'Other' },
];

const MaintenanceLogger = ({ ride, onMaintenanceLogged }: MaintenanceLoggerProps) => {
  const [loading, setLoading] = useState(false);
  const [calendarOpen, setCalendarOpen] = useState(false);
  const [uploadedFiles, setUploadedFiles] = useState<File[]>([]);
  const { toast } = useToast();

  const [formData, setFormData] = useState({
    maintenance_date: new Date(),
    maintenance_type: '',
    description: '',
    performed_by: '',
    parts_replaced: '',
    cost: '',
    notes: '',
  });

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files || []);
    const validFiles = files.filter(file => {
      const isValidType = file.type.startsWith('image/') || file.type === 'application/pdf' || file.type.startsWith('application/');
      const isValidSize = file.size <= 10 * 1024 * 1024; // 10MB limit
      
      if (!isValidType) {
        toast({
          title: "Invalid File Type",
          description: `${file.name} is not a supported file type. Please upload images, PDFs, or documents.`,
          variant: "destructive",
        });
        return false;
      }
      
      if (!isValidSize) {
        toast({
          title: "File Too Large",
          description: `${file.name} is too large. Please upload files smaller than 10MB.`,
          variant: "destructive",
        });
        return false;
      }
      
      return true;
    });

    setUploadedFiles(prev => [...prev, ...validFiles]);
  };

  const removeFile = (index: number) => {
    setUploadedFiles(prev => prev.filter((_, i) => i !== index));
  };

  const uploadFilesToStorage = async (files: File[]): Promise<string[]> => {
    const uploadedPaths: string[] = [];

    for (const file of files) {
      const fileExt = file.name.split('.').pop();
      const fileName = `${Date.now()}-${Math.random().toString(36).substring(2)}.${fileExt}`;
      const filePath = `maintenance/${ride.id}/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from('ride-documents')
        .upload(filePath, file);

      if (uploadError) {
        console.error('Error uploading file:', uploadError);
        throw new Error(`Failed to upload ${file.name}`);
      }

      uploadedPaths.push(filePath);
    }

    return uploadedPaths;
  };

  const saveDocuments = async (filePaths: string[]): Promise<string[]> => {
    const documentIds: string[] = [];

    for (let i = 0; i < filePaths.length; i++) {
      const filePath = filePaths[i];
      const originalFile = uploadedFiles[i];
      
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('User not authenticated');

      const { data, error } = await supabase
        .from('documents')
        .insert([{
          user_id: user.id,
          ride_id: ride.id,
          document_name: originalFile.name,
          document_type: 'maintenance',
          file_path: filePath,
          mime_type: originalFile.type,
          file_size: originalFile.size,
          notes: `Maintenance record: ${formData.description}`,
        }])
        .select('id')
        .single();

      if (error) {
        console.error('Error saving document record:', error);
        throw new Error(`Failed to save document record for ${originalFile.name}`);
      }

      if (data) {
        documentIds.push(data.id);
      }
    }

    return documentIds;
  };

  const handleSubmit = async () => {
    if (!formData.maintenance_type || !formData.description || !formData.performed_by) {
      toast({
        title: "Validation Error",
        description: "Please fill in all required fields",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        toast({
          title: "Error",
          description: "You must be logged in to log maintenance",
          variant: "destructive",
        });
        return;
      }

      // Upload files if any
      let documentIds: string[] = [];
      if (uploadedFiles.length > 0) {
        const filePaths = await uploadFilesToStorage(uploadedFiles);
        documentIds = await saveDocuments(filePaths);
      }

      // Save maintenance record
      const maintenanceData = {
        user_id: user.id,
        ride_id: ride.id,
        maintenance_date: formData.maintenance_date.toISOString().split('T')[0],
        maintenance_type: formData.maintenance_type,
        description: formData.description,
        performed_by: formData.performed_by,
        parts_replaced: formData.parts_replaced || null,
        cost: formData.cost ? parseFloat(formData.cost) : null,
        notes: formData.notes || null,
        document_ids: documentIds.length > 0 ? documentIds : null,
      };

      const { error } = await supabase
        .from('maintenance_records')
        .insert([maintenanceData]);

      if (error) throw error;

      toast({
        title: "Success",
        description: "Maintenance record logged successfully",
      });

      // Reset form
      setFormData({
        maintenance_date: new Date(),
        maintenance_type: '',
        description: '',
        performed_by: '',
        parts_replaced: '',
        cost: '',
        notes: '',
      });
      setUploadedFiles([]);

      onMaintenanceLogged?.();

    } catch (error) {
      console.error('Error logging maintenance:', error);
      toast({
        title: "Error",
        description: "Failed to log maintenance record",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center space-x-2">
          <Plus className="h-5 w-5" />
          <span>Log Maintenance Activity</span>
        </CardTitle>
        <CardDescription>
          Record maintenance work performed on {ride.ride_name} with photos and documentation
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Maintenance Date */}
          <div className="space-y-2">
            <Label>Maintenance Date *</Label>
            <Popover open={calendarOpen} onOpenChange={setCalendarOpen}>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className={cn(
                    "w-full justify-start text-left font-normal",
                    !formData.maintenance_date && "text-muted-foreground"
                  )}
                >
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {formData.maintenance_date ? format(formData.maintenance_date, "PPP") : "Select date"}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="single"
                  selected={formData.maintenance_date}
                  onSelect={(date) => {
                    setFormData({ ...formData, maintenance_date: date || new Date() });
                    setCalendarOpen(false);
                  }}
                  initialFocus
                  className="pointer-events-auto"
                />
              </PopoverContent>
            </Popover>
          </div>

          {/* Maintenance Type */}
          <div className="space-y-2">
            <Label>Maintenance Type *</Label>
            <Select
              value={formData.maintenance_type}
              onValueChange={(value) => setFormData({ ...formData, maintenance_type: value })}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select maintenance type" />
              </SelectTrigger>
              <SelectContent>
                {MAINTENANCE_TYPES.map((type) => (
                  <SelectItem key={type.value} value={type.value}>
                    {type.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Performed By */}
          <div className="space-y-2">
            <Label htmlFor="performed_by">Performed By *</Label>
            <Input
              id="performed_by"
              value={formData.performed_by}
              onChange={(e) => setFormData({ ...formData, performed_by: e.target.value })}
              placeholder="Name of person who performed maintenance"
            />
          </div>

          {/* Cost */}
          <div className="space-y-2">
            <Label htmlFor="cost">Cost (£)</Label>
            <Input
              id="cost"
              type="number"
              step="0.01"
              min="0"
              value={formData.cost}
              onChange={(e) => setFormData({ ...formData, cost: e.target.value })}
              placeholder="0.00"
            />
          </div>
        </div>

        {/* Description */}
        <div className="space-y-2">
          <Label htmlFor="description">Work Description *</Label>
          <Textarea
            id="description"
            value={formData.description}
            onChange={(e) => setFormData({ ...formData, description: e.target.value })}
            placeholder="Describe the maintenance work performed..."
            rows={3}
          />
        </div>

        {/* Parts Replaced */}
        <div className="space-y-2">
          <Label htmlFor="parts_replaced">Parts Replaced</Label>
          <Textarea
            id="parts_replaced"
            value={formData.parts_replaced}
            onChange={(e) => setFormData({ ...formData, parts_replaced: e.target.value })}
            placeholder="List any parts that were replaced..."
            rows={2}
          />
        </div>

        {/* Additional Notes */}
        <div className="space-y-2">
          <Label htmlFor="notes">Additional Notes</Label>
          <Textarea
            id="notes"
            value={formData.notes}
            onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
            placeholder="Any additional notes or observations..."
            rows={2}
          />
        </div>

        {/* File Upload */}
        <div className="space-y-2">
          <Label>Photos & Documents</Label>
          <div className="border-2 border-dashed border-muted-foreground/25 rounded-lg p-6">
            <div className="text-center">
              <div className="flex justify-center space-x-4 mb-2">
                <Camera className="h-8 w-8 text-muted-foreground" />
                <FileText className="h-8 w-8 text-muted-foreground" />
              </div>
              <p className="text-sm text-muted-foreground mb-2">
                Upload photos of work performed, receipts, or other documents
              </p>
              <input
                type="file"
                multiple
                accept="image/*,.pdf,.doc,.docx,.txt"
                onChange={handleFileUpload}
                className="hidden"
                id="file-upload"
              />
              <Button
                type="button"
                variant="outline"
                onClick={() => document.getElementById('file-upload')?.click()}
              >
                <Upload className="h-4 w-4 mr-2" />
                Choose Files
              </Button>
              <p className="text-xs text-muted-foreground mt-1">
                Max 10MB per file. Supports: Images, PDF, Word docs
              </p>
            </div>
          </div>

          {/* Uploaded Files */}
          {uploadedFiles.length > 0 && (
            <div className="space-y-2">
              <Label>Uploaded Files ({uploadedFiles.length})</Label>
              <div className="space-y-2">
                {uploadedFiles.map((file, index) => (
                  <div key={index} className="flex items-center justify-between p-2 border rounded">
                    <div className="flex items-center space-x-2">
                      {file.type.startsWith('image/') ? (
                        <Camera className="h-4 w-4 text-blue-500" />
                      ) : (
                        <FileText className="h-4 w-4 text-green-500" />
                      )}
                      <span className="text-sm">{file.name}</span>
                      <Badge variant="outline" className="text-xs">
                        {(file.size / 1024 / 1024).toFixed(1)}MB
                      </Badge>
                    </div>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => removeFile(index)}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Submit Button */}
        <div className="flex justify-end">
          <Button onClick={handleSubmit} disabled={loading}>
            {loading ? (
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
            ) : (
              <Save className="h-4 w-4 mr-2" />
            )}
            {loading ? 'Saving...' : 'Log Maintenance'}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};

export default MaintenanceLogger;