import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Switch } from '@/components/ui/switch';
import { CalendarIcon, X, Camera, FileText, Save, FolderOpen, Info, Link, ShieldCheck, Clock, Building2 } from 'lucide-react';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useEffectiveUserId } from '@/hooks/useEffectiveUserId';
import { Tables } from '@/integrations/supabase/types';
import { compressImage } from '@/utils/imageCompression';

type Ride = Tables<'rides'> & {
  ride_categories: {
    name: string;
    description: string | null;
  };
};

type Defect = Tables<'defects'>;

interface MaintenanceLoggerProps {
  ride: Ride;
  onMaintenanceLogged?: () => void;
}

const MAINTENANCE_TYPES = [
  { value: 'preventive', label: 'Preventive Maintenance' },
  { value: 'corrective', label: 'Corrective Maintenance' },
  { value: 'reactive', label: 'Reactive Repair' },
  { value: 'emergency', label: 'Emergency Repair' },
  { value: 'modification', label: 'Modification / Upgrade' },
  { value: 'inspection_linked', label: 'Inspection-Linked Repair' },
  { value: 'inspection', label: 'Inspection & Testing' },
  { value: 'lubrication', label: 'Lubrication' },
  { value: 'electrical', label: 'Electrical Work' },
  { value: 'mechanical', label: 'Mechanical Work' },
  { value: 'hydraulic', label: 'Hydraulic Work' },
  { value: 'structural', label: 'Structural Work' },
  { value: 'safety', label: 'Safety System Work' },
  { value: 'other', label: 'Other' },
];

// Section label component for visual grouping
const SectionLabel = ({ icon: Icon, label }: { icon: React.ElementType; label: string }) => (
  <div className="flex items-center gap-2 pt-2">
    <Icon className="h-4 w-4 text-muted-foreground" strokeWidth={2} />
    <span className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">{label}</span>
    <div className="flex-1 h-px bg-border" />
  </div>
);

const ALLOWED_TYPES = [
  'image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/heic', 'image/tiff', 'image/bmp',
  'application/pdf', 'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.ms-powerpoint',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  'text/plain', 'text/csv',
  'video/mp4', 'video/quicktime', 'video/x-msvideo', 'video/webm', 'video/mpeg',
  'application/zip', 'application/x-rar-compressed',
];

const MAX_PHOTOS = 5;

const MaintenanceLogger = ({ ride, onMaintenanceLogged }: MaintenanceLoggerProps) => {
  const [loading, setLoading] = useState(false);
  const [calendarOpen, setCalendarOpen] = useState(false);
  const [verificationCalendarOpen, setVerificationCalendarOpen] = useState(false);
  const [uploadedFiles, setUploadedFiles] = useState<File[]>([]);
  const [openDefects, setOpenDefects] = useState<Defect[]>([]);
  const { toast } = useToast();
  const { effectiveUserId } = useEffectiveUserId();

  const [formData, setFormData] = useState({
    maintenance_date: new Date(),
    maintenance_type: '',
    description: '',
    performed_by: '',
    parts_replaced: '',
    cost: '',
    notes: '',
    // New fields
    linked_defect_id: '',
    service_provider_type: '', // 'internal' | 'external'
    service_company: '',
    engineer_name: '',
    equipment_out_of_service: false,
    downtime_duration: '',
    requires_verification: false,
    verified_by: '',
    verification_date: null as Date | null,
  });

  // Load open defects for this ride
  useEffect(() => {
    const fetchDefects = async () => {
      const { data } = await supabase
        .from('defects')
        .select('*')
        .eq('ride_id', ride.id)
        .in('status', ['open', 'acknowledged', 'in_progress'])
        .order('reported_at', { ascending: false });
      if (data) setOpenDefects(data);
    };
    fetchDefects();
  }, [ride.id]);

  const imageCount = uploadedFiles.filter(f => f.type.startsWith('image/')).length;

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files || []);
    const processedFiles: File[] = [];
    let newImageCount = 0;
    const currentImageCount = uploadedFiles.filter(f => f.type.startsWith('image/')).length;

    for (const file of files) {
      const isImage = file.type.startsWith('image/');
      const isValidType = ALLOWED_TYPES.includes(file.type) || isImage;
      const isValidSize = file.size <= 10 * 1024 * 1024;

      if (isImage && currentImageCount + newImageCount >= MAX_PHOTOS) {
        toast({ title: "Photo Limit Reached", description: `Maximum ${MAX_PHOTOS} photos allowed.`, variant: "destructive" });
        continue;
      }
      if (!isValidType) {
        toast({ title: "Invalid File Type", description: `${file.name} is not supported.`, variant: "destructive" });
        continue;
      }
      if (!isValidSize) {
        toast({ title: "File Too Large", description: `${file.name} exceeds 10MB.`, variant: "destructive" });
        continue;
      }

      if (isImage && file.size > 500000) {
        try {
          const compressed = await compressImage(file);
          processedFiles.push(compressed.size < file.size ? compressed : file);
        } catch {
          processedFiles.push(file);
        }
        newImageCount++;
      } else {
        processedFiles.push(file);
        if (isImage) newImageCount++;
      }
    }

    setUploadedFiles(prev => [...prev, ...processedFiles]);
  };

  const removeFile = (index: number) => setUploadedFiles(prev => prev.filter((_, i) => i !== index));

  const uploadFilesToStorage = async (files: File[]): Promise<string[]> => {
    const uploadedPaths: string[] = [];
    for (const file of files) {
      const fileExt = file.name.split('.').pop();
      const fileName = `${Date.now()}-${Math.random().toString(36).substring(2)}.${fileExt}`;
      const filePath = `maintenance/${ride.id}/${fileName}`;
      const { error } = await supabase.storage.from('ride-documents').upload(filePath, file);
      if (error) throw new Error(`Failed to upload ${file.name}`);
      uploadedPaths.push(filePath);
    }
    return uploadedPaths;
  };

  const saveDocuments = async (filePaths: string[]): Promise<string[]> => {
    const documentIds: string[] = [];
    for (let i = 0; i < filePaths.length; i++) {
      const originalFile = uploadedFiles[i];
      if (!effectiveUserId) throw new Error('User not authenticated');
      const { data, error } = await supabase
        .from('documents')
        .insert([{
          user_id: effectiveUserId,
          ride_id: ride.id,
          document_name: originalFile.name,
          document_type: 'maintenance',
          file_path: filePaths[i],
          mime_type: originalFile.type,
          file_size: originalFile.size,
          notes: `Maintenance record: ${formData.description}`,
        }])
        .select('id')
        .single();
      if (error) throw new Error(`Failed to save document record for ${originalFile.name}`);
      if (data) documentIds.push(data.id);
    }
    return documentIds;
  };

  const handleSubmit = async () => {
    if (!formData.maintenance_type || !formData.description || !formData.performed_by) {
      toast({ title: "Validation Error", description: "Please fill in all required fields.", variant: "destructive" });
      return;
    }

    setLoading(true);
    try {
      if (!effectiveUserId) {
        toast({ title: "Error", description: "You must be logged in.", variant: "destructive" });
        return;
      }

      let documentIds: string[] = [];
      if (uploadedFiles.length > 0) {
        const filePaths = await uploadFilesToStorage(uploadedFiles);
        documentIds = await saveDocuments(filePaths);
      }

      // Build notes combining additional notes + verification + downtime info
      const noteParts: string[] = [];
      if (formData.notes) noteParts.push(formData.notes);
      if (formData.service_provider_type) {
        const provider = formData.service_provider_type === 'external'
          ? `External — ${formData.service_company || 'Unknown'} / ${formData.engineer_name || 'Unknown engineer'}`
          : `Internal — ${formData.engineer_name || ''}`;
        noteParts.push(`Service provider: ${provider}`);
      }
      if (formData.equipment_out_of_service) {
        noteParts.push(`Equipment out of service. Downtime: ${formData.downtime_duration || 'Not recorded'}`);
      }
      if (formData.requires_verification) {
        const verif = formData.verified_by
          ? `Verified by: ${formData.verified_by}${formData.verification_date ? ` on ${format(formData.verification_date, 'd MMM yyyy')}` : ''}`
          : 'Verification required — pending';
        noteParts.push(verif);
      }
      if (formData.linked_defect_id) {
        const defect = openDefects.find(d => d.id === formData.linked_defect_id);
        if (defect) noteParts.push(`Linked defect: ${defect.description.substring(0, 60)}...`);
      }

      const { error } = await supabase.from('maintenance_records').insert([{
        user_id: effectiveUserId,
        ride_id: ride.id,
        maintenance_date: formData.maintenance_date.toISOString().split('T')[0],
        maintenance_type: formData.maintenance_type,
        description: formData.description,
        performed_by: formData.performed_by,
        parts_replaced: formData.parts_replaced || null,
        cost: formData.cost ? parseFloat(formData.cost) : null,
        notes: noteParts.length > 0 ? noteParts.join(' | ') : null,
        document_ids: documentIds.length > 0 ? documentIds : null,
      }]);

      if (error) throw error;

      // If linked to a defect, update its status to in_progress
      if (formData.linked_defect_id) {
        await supabase.from('defects').update({ status: 'in_progress' }).eq('id', formData.linked_defect_id);
      }

      toast({ title: "Maintenance Record Logged", description: "Record saved successfully." });

      setFormData({
        maintenance_date: new Date(), maintenance_type: '', description: '', performed_by: '',
        parts_replaced: '', cost: '', notes: '', linked_defect_id: '', service_provider_type: '',
        service_company: '', engineer_name: '', equipment_out_of_service: false, downtime_duration: '',
        requires_verification: false, verified_by: '', verification_date: null,
      });
      setUploadedFiles([]);
      onMaintenanceLogged?.();

    } catch (error) {
      console.error('Error logging maintenance:', error);
      toast({ title: "Error", description: "Failed to log maintenance record.", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card>
      <CardContent className="pt-6 space-y-6">

        {/* Info banner */}
        <div className="flex items-start gap-3 rounded-lg border border-border bg-muted/30 p-3">
          <Info className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
          <p className="text-xs text-muted-foreground leading-relaxed">
            All attachments are stored in the equipment document register under "Maintenance". Generated reports will also appear there.
          </p>
        </div>

        {/* ── SECTION 1: Maintenance Details ── */}
        <SectionLabel icon={CalendarIcon} label="Maintenance Details" />

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Date */}
          <div className="space-y-2">
            <Label>Maintenance Date <span className="text-destructive">*</span></Label>
            <Popover open={calendarOpen} onOpenChange={setCalendarOpen}>
              <PopoverTrigger asChild>
                <Button variant="outline" className={cn("w-full justify-start text-left font-normal", !formData.maintenance_date && "text-muted-foreground")}>
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {formData.maintenance_date ? format(formData.maintenance_date, "d MMM yyyy") : "Select date"}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar mode="single" selected={formData.maintenance_date}
                  onSelect={(date) => { setFormData({ ...formData, maintenance_date: date || new Date() }); setCalendarOpen(false); }}
                  initialFocus className="pointer-events-auto" />
              </PopoverContent>
            </Popover>
          </div>

          {/* Type */}
          <div className="space-y-2">
            <Label>Maintenance Type <span className="text-destructive">*</span></Label>
            <Select value={formData.maintenance_type} onValueChange={(v) => setFormData({ ...formData, maintenance_type: v })}>
              <SelectTrigger><SelectValue placeholder="Select maintenance type" /></SelectTrigger>
              <SelectContent>
                {MAINTENANCE_TYPES.map((type) => (
                  <SelectItem key={type.value} value={type.value}>{type.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Performed By */}
          <div className="space-y-2">
            <Label htmlFor="performed_by">Performed By <span className="text-destructive">*</span></Label>
            <Input id="performed_by" value={formData.performed_by}
              onChange={(e) => setFormData({ ...formData, performed_by: e.target.value })}
              placeholder="Name of person who performed maintenance" />
          </div>

          {/* Cost */}
          <div className="space-y-2">
            <Label htmlFor="cost" className="flex items-center gap-1.5">
              Cost (£) <span className="text-xs text-muted-foreground font-normal">(optional)</span>
            </Label>
            <Input id="cost" type="number" step="0.01" min="0" value={formData.cost}
              onChange={(e) => setFormData({ ...formData, cost: e.target.value })} placeholder="0.00" />
          </div>
        </div>

        {/* Linked Defect */}
        {openDefects.length > 0 && (
          <div className="space-y-2">
            <Label className="flex items-center gap-1.5">
              <Link className="h-3.5 w-3.5" />
              Linked Defect
              <span className="text-xs text-muted-foreground font-normal">(optional)</span>
            </Label>
            <Select value={formData.linked_defect_id} onValueChange={(v) => setFormData({ ...formData, linked_defect_id: v })}>
              <SelectTrigger>
                <SelectValue placeholder="Link to an open defect…" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="">None</SelectItem>
                {openDefects.map((d) => (
                  <SelectItem key={d.id} value={d.id}>
                    <span className="capitalize text-xs font-medium text-destructive mr-2">[{d.severity.replace('_', ' ')}]</span>
                    {d.description.length > 60 ? d.description.substring(0, 60) + '…' : d.description}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {formData.linked_defect_id && (
              <p className="text-xs text-muted-foreground">The linked defect status will be updated to "In Progress" when saved.</p>
            )}
          </div>
        )}

        {/* Out of Service toggle */}
        <div className="flex items-center justify-between rounded-lg border border-border p-3">
          <div>
            <p className="text-sm font-medium">Equipment Out of Service</p>
            <p className="text-xs text-muted-foreground">Was equipment taken offline for this work?</p>
          </div>
          <Switch checked={formData.equipment_out_of_service}
            onCheckedChange={(v) => setFormData({ ...formData, equipment_out_of_service: v })} />
        </div>

        {formData.equipment_out_of_service && (
          <div className="space-y-2">
            <Label htmlFor="downtime" className="flex items-center gap-1.5">
              <Clock className="h-3.5 w-3.5" />
              Downtime Duration
            </Label>
            <Input id="downtime" value={formData.downtime_duration}
              onChange={(e) => setFormData({ ...formData, downtime_duration: e.target.value })}
              placeholder="e.g. 2 hours, half day, 3 days" />
          </div>
        )}

        {/* ── SECTION 2: Work Performed ── */}
        <SectionLabel icon={FileText} label="Work Performed" />

        {/* Description */}
        <div className="space-y-2">
          <Label htmlFor="description">Work Description <span className="text-destructive">*</span></Label>
          <Textarea id="description" value={formData.description}
            onChange={(e) => setFormData({ ...formData, description: e.target.value })}
            placeholder="Describe the maintenance work performed…" rows={3} />
        </div>

        {/* Parts Replaced */}
        <div className="space-y-2">
          <Label htmlFor="parts_replaced" className="flex items-center gap-1.5">
            Parts Replaced
            <span className="text-xs text-muted-foreground font-normal">(optional)</span>
          </Label>
          <Textarea id="parts_replaced" value={formData.parts_replaced}
            onChange={(e) => setFormData({ ...formData, parts_replaced: e.target.value })}
            placeholder="List any parts replaced, e.g. bearings, bolts, seals…" rows={2} />
        </div>

        {/* Additional Notes */}
        <div className="space-y-2">
          <Label htmlFor="notes" className="flex items-center gap-1.5">
            Additional Notes
            <span className="text-xs text-muted-foreground font-normal">(optional)</span>
          </Label>
          <Textarea id="notes" value={formData.notes}
            onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
            placeholder="Any additional observations, recommendations or follow-up actions…" rows={2} />
        </div>

        {/* ── SECTION 3: Service Provider ── */}
        <SectionLabel icon={Building2} label="Service Provider" />

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label>Provider Type <span className="text-xs text-muted-foreground font-normal">(optional)</span></Label>
            <Select value={formData.service_provider_type} onValueChange={(v) => setFormData({ ...formData, service_provider_type: v })}>
              <SelectTrigger><SelectValue placeholder="Internal or external?" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="internal">Internal — Own team</SelectItem>
                <SelectItem value="external">External — Contractor</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {formData.service_provider_type === 'external' && (
            <div className="space-y-2">
              <Label htmlFor="service_company">Company Name</Label>
              <Input id="service_company" value={formData.service_company}
                onChange={(e) => setFormData({ ...formData, service_company: e.target.value })}
                placeholder="Contractor / service company name" />
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="engineer_name">Engineer / Technician Name</Label>
            <Input id="engineer_name" value={formData.engineer_name}
              onChange={(e) => setFormData({ ...formData, engineer_name: e.target.value })}
              placeholder="Name of engineer or technician" />
          </div>
        </div>

        {/* ── SECTION 4: Verification ── */}
        <SectionLabel icon={ShieldCheck} label="Verification" />

        <div className="flex items-center justify-between rounded-lg border border-border p-3">
          <div>
            <p className="text-sm font-medium">Supervisor Sign-off Required</p>
            <p className="text-xs text-muted-foreground">Record verification of this work by a competent person</p>
          </div>
          <Switch checked={formData.requires_verification}
            onCheckedChange={(v) => setFormData({ ...formData, requires_verification: v })} />
        </div>

        {formData.requires_verification && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="verified_by">Verified By</Label>
              <Input id="verified_by" value={formData.verified_by}
                onChange={(e) => setFormData({ ...formData, verified_by: e.target.value })}
                placeholder="Name of verifying person" />
            </div>
            <div className="space-y-2">
              <Label>Verification Date</Label>
              <Popover open={verificationCalendarOpen} onOpenChange={setVerificationCalendarOpen}>
                <PopoverTrigger asChild>
                  <Button variant="outline" className={cn("w-full justify-start text-left font-normal", !formData.verification_date && "text-muted-foreground")}>
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {formData.verification_date ? format(formData.verification_date, "d MMM yyyy") : "Select date"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar mode="single" selected={formData.verification_date || undefined}
                    onSelect={(date) => { setFormData({ ...formData, verification_date: date || null }); setVerificationCalendarOpen(false); }}
                    initialFocus className="pointer-events-auto" />
                </PopoverContent>
              </Popover>
            </div>
          </div>
        )}

        {/* ── SECTION 5: Evidence & Attachments ── */}
        <SectionLabel icon={FolderOpen} label="Evidence & Attachments" />

        <input type="file" multiple
          accept="image/*,.pdf,.doc,.docx,.txt,.csv,.xls,.xlsx,.ppt,.pptx,.mp4,.mov,.avi,.webm,.mpeg,.zip,.rar,.tiff,.tif,.bmp"
          onChange={handleFileUpload} className="hidden" id="file-upload" />
        <input type="file" multiple accept="image/*" capture="environment"
          onChange={handleFileUpload} className="hidden" id="camera-upload" />

        <div className="grid grid-cols-2 gap-3">
          <Button type="button" variant="outline"
            className="h-20 flex flex-col items-center justify-center gap-2 border-2 border-dashed border-border bg-muted/20 hover:border-primary hover:bg-muted/40 rounded-xl transition-all group"
            onClick={() => document.getElementById('camera-upload')?.click()}>
            <Camera className="h-5 w-5 text-muted-foreground group-hover:text-primary transition-colors" strokeWidth={2} />
            <span className="text-sm font-medium">Take Photo</span>
          </Button>
          <Button type="button" variant="outline"
            className="h-20 flex flex-col items-center justify-center gap-2 border-2 border-dashed border-border bg-muted/20 hover:border-primary hover:bg-muted/40 rounded-xl transition-all group"
            onClick={() => document.getElementById('file-upload')?.click()}>
            <FolderOpen className="h-5 w-5 text-muted-foreground group-hover:text-primary transition-colors" strokeWidth={2} />
            <span className="text-sm font-medium">Choose File</span>
          </Button>
        </div>

        <p className="text-xs text-muted-foreground">
          Max 10MB per file. Supports: Images (max {MAX_PHOTOS}), PDF, Word, Excel, PowerPoint, Text, Videos, ZIP
        </p>

        {imageCount > 0 && (
          <p className="text-xs text-primary font-medium">📷 {imageCount}/{MAX_PHOTOS} photos added</p>
        )}

        {/* Uploaded file previews */}
        {uploadedFiles.length > 0 && (
          <div className="space-y-2">
            <Label>Attached Files ({uploadedFiles.length})</Label>
            <div className="flex flex-wrap gap-2">
              {uploadedFiles.map((file, index) => (
                <div key={index} className="relative group border rounded-lg overflow-hidden bg-muted/30 w-16 h-16">
                  {file.type.startsWith('image/') ? (
                    <img src={URL.createObjectURL(file)} alt={file.name} className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full flex flex-col items-center justify-center p-1">
                      <FileText className="h-5 w-5 text-muted-foreground" />
                      <span className="text-[8px] text-center text-muted-foreground line-clamp-1 mt-0.5">{file.name.split('.').pop()}</span>
                    </div>
                  )}
                  <Button type="button" variant="destructive" size="icon"
                    className="absolute top-0.5 right-0.5 h-4 w-4 opacity-0 group-hover:opacity-100 transition-opacity"
                    onClick={() => removeFile(index)}>
                    <X className="h-2.5 w-2.5" />
                  </Button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── CTAs ── */}
        <div className="flex flex-col sm:flex-row gap-3 pt-2 border-t border-border">
          <Button onClick={handleSubmit} disabled={loading} className="flex-1 sm:flex-none">
            {loading ? (
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2" />
            ) : (
              <Save className="h-4 w-4 mr-2" />
            )}
            {loading ? 'Saving…' : 'Log Maintenance Record'}
          </Button>
          <Button type="button" variant="ghost" size="sm" className="text-muted-foreground"
            onClick={() => {
              setFormData({
                maintenance_date: new Date(), maintenance_type: '', description: '', performed_by: '',
                parts_replaced: '', cost: '', notes: '', linked_defect_id: '', service_provider_type: '',
                service_company: '', engineer_name: '', equipment_out_of_service: false, downtime_duration: '',
                requires_verification: false, verified_by: '', verification_date: null,
              });
              setUploadedFiles([]);
            }}>
            Reset Form
          </Button>
        </div>

      </CardContent>
    </Card>
  );
};

export default MaintenanceLogger;
