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
import { CalendarIcon, Upload, X, Camera, FileText, Save, Plus, FolderOpen, Info } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Tables } from '@/integrations/supabase/types';
import { compressImage } from '@/utils/imageCompression';

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

  // Allowed MIME types for maintenance documents
  const ALLOWED_TYPES = [
    // Images
    'image/jpeg',
    'image/png',
    'image/gif',
    'image/webp',
    'image/heic',
    'image/tiff',
    'image/bmp',
    // Documents
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/vnd.ms-powerpoint',
    'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    // Text files
    'text/plain',
    'text/csv',
    // Videos
    'video/mp4',
    'video/quicktime',
    'video/x-msvideo',
    'video/webm',
    'video/mpeg',
    // Archives
    'application/zip',
    'application/x-rar-compressed',
  ];

  // Count how many images are already uploaded
  const imageCount = uploadedFiles.filter(f => f.type.startsWith('image/')).length;
  const MAX_PHOTOS = 5;

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files || []);
    const processedFiles: File[] = [];
    
    // Track how many images we're adding
    let newImageCount = 0;
    const currentImageCount = uploadedFiles.filter(f => f.type.startsWith('image/')).length;
    
    for (const file of files) {
      const isImage = file.type.startsWith('image/');
      const isValidType = ALLOWED_TYPES.includes(file.type) || isImage;
      const isValidSize = file.size <= 10 * 1024 * 1024; // 10MB limit
      
      // Check photo limit
      if (isImage && currentImageCount + newImageCount >= MAX_PHOTOS) {
        toast({
          title: "Photo Limit Reached",
          description: `Maximum ${MAX_PHOTOS} photos allowed per maintenance record.`,
          variant: "destructive",
        });
        continue;
      }
      
      if (!isValidType) {
        toast({
          title: "Invalid File Type",
          description: `${file.name} is not supported. Supported: Images, PDFs, Word, Excel, PowerPoint, Text, Videos, ZIP.`,
          variant: "destructive",
        });
        continue;
      }
      
      if (!isValidSize) {
        toast({
          title: "File Too Large",
          description: `${file.name} is too large. Please upload files smaller than 10MB.`,
          variant: "destructive",
        });
        continue;
      }
      
      // Compress images larger than 500KB
      if (isImage && file.size > 500000) {
        try {
          const compressed = await compressImage(file);
          if (compressed.size < file.size) {
            toast({
              title: "Image compressed",
              description: `${file.name}: ${(file.size / 1024 / 1024).toFixed(1)}MB → ${(compressed.size / 1024 / 1024).toFixed(1)}MB`,
            });
          }
          processedFiles.push(compressed);
          newImageCount++;
        } catch (error) {
          console.error('Compression failed:', error);
          processedFiles.push(file);
          newImageCount++;
        }
      } else {
        processedFiles.push(file);
        if (isImage) newImageCount++;
      }
    }

    setUploadedFiles(prev => [...prev, ...processedFiles]);
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
        <Alert className="bg-primary/5 border-primary/20">
          <Info className="h-4 w-4 text-primary" />
          <AlertDescription>
            Attached photos and documents will be saved to your Documents list under "Maintenance". Generated reports will also appear there.
          </AlertDescription>
        </Alert>

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
                  {formData.maintenance_date ? format(formData.maintenance_date, "d MMM yyyy") : "Select date"}
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
            <Label htmlFor="cost" className="flex items-center gap-1.5">
              Cost (£)
              <span className="text-xs text-muted-foreground font-normal">(optional)</span>
            </Label>
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
          
          {/* Hidden file inputs */}
          <input
            type="file"
            multiple
            accept="image/*,.pdf,.doc,.docx,.txt,.csv,.xls,.xlsx,.ppt,.pptx,.mp4,.mov,.avi,.webm,.mpeg,.zip,.rar,.tiff,.tif,.bmp"
            onChange={handleFileUpload}
            className="hidden"
            id="file-upload"
          />
          <input
            type="file"
            multiple
            accept="image/*"
            capture="environment"
            onChange={handleFileUpload}
            className="hidden"
            id="camera-upload"
          />

          {/* Dual Upload Buttons */}
          <div className="grid grid-cols-2 gap-3">
            <Button
              type="button"
              variant="outline"
              className="h-20 flex flex-col items-center justify-center gap-2 border-2 border-dashed hover:border-primary/50 hover:bg-muted/30"
              onClick={() => document.getElementById('camera-upload')?.click()}
            >
              <Camera className="h-6 w-6 text-muted-foreground" />
              <span className="text-sm font-medium">Take Photo</span>
            </Button>
            <Button
              type="button"
              variant="outline"
              className="h-20 flex flex-col items-center justify-center gap-2 border-2 border-dashed hover:border-primary/50 hover:bg-muted/30"
              onClick={() => document.getElementById('file-upload')?.click()}
            >
              <FolderOpen className="h-6 w-6 text-muted-foreground" />
              <span className="text-sm font-medium">Choose File</span>
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">
            Max 10MB per file. Supports: Images (max {MAX_PHOTOS}), PDF, Word, Excel, PowerPoint, Text, Videos, ZIP
          </p>
          {imageCount > 0 && (
            <p className="text-xs text-primary font-medium">
              📷 {imageCount}/{MAX_PHOTOS} photos added
            </p>
          )}
        </div>

        {/* Uploaded Files */}
        {uploadedFiles.length > 0 && (
          <div className="space-y-2">
            <Label>Uploaded Files ({uploadedFiles.length})</Label>
            <div className="flex flex-wrap gap-2">
              {uploadedFiles.map((file, index) => (
                <div key={index} className="relative group border rounded-md overflow-hidden bg-muted/30 w-16 h-16">
                  {file.type.startsWith('image/') ? (
                    <img
                      src={URL.createObjectURL(file)}
                      alt={file.name}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="w-full h-full flex flex-col items-center justify-center p-1">
                      <FileText className="h-5 w-5 text-muted-foreground" />
                      <span className="text-[8px] text-center text-muted-foreground line-clamp-1 mt-0.5">{file.name.split('.').pop()}</span>
                    </div>
                  )}
                  <Button
                    type="button"
                    variant="destructive"
                    size="icon"
                    className="absolute top-0.5 right-0.5 h-4 w-4 opacity-0 group-hover:opacity-100 transition-opacity"
                    onClick={() => removeFile(index)}
                  >
                    <X className="h-2.5 w-2.5" />
                  </Button>
                </div>
              ))}
            </div>
          </div>
        )}

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