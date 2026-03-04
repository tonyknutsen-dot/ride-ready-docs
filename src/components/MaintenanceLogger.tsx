import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Switch } from '@/components/ui/switch';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { CalendarIcon, X, Camera, FileText, Save, FolderOpen, Info, Link, Clock, Wrench, UserCog, Paperclip, RotateCcw, ChevronDown } from 'lucide-react';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';
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

// ── Section header ───────────────────────────────────────────────────────────
const LogSectionHeader = ({
  icon: Icon,
  title,
  iconColor,
  iconBg,
}: {
  icon: React.ElementType;
  title: string;
  iconColor: string;
  iconBg: string;
}) => (
  <div className="flex items-center gap-2.5 pb-3 border-b border-slate-100 mb-1">
    <div
      className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg"
      style={{ backgroundColor: iconBg }}
    >
      <Icon className="h-3.5 w-3.5" style={{ color: iconColor }} strokeWidth={2.2} />
    </div>
    <span className="text-[14px] font-semibold" style={{ color: '#1E293B', letterSpacing: '-0.1px' }}>{title}</span>
  </div>
);

// ── Reusable section card ───────────────────────────────────────────────────
const LogSectionCard = ({
  children,
  className = '',
  style = {},
}: {
  children: React.ReactNode;
  className?: string;
  style?: React.CSSProperties;
}) => (
  <div
    className={`rounded-2xl border p-4 space-y-3 ${className}`}
    style={{
      background: '#FFFFFF',
      borderColor: '#E2E8F0',
      boxShadow: '0 2px 8px rgba(15,23,42,0.05)',
      ...style,
    }}
  >
    {children}
  </div>
);

// ── Collapsible section ─────────────────────────────────────────────────────
const CollapsibleSection = ({
  icon: Icon,
  title,
  iconColor,
  iconBg,
  children,
  defaultOpen = false,
}: {
  icon: React.ElementType;
  title: string;
  iconColor: string;
  iconBg: string;
  children: React.ReactNode;
  defaultOpen?: boolean;
}) => {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <div
        className="rounded-2xl border overflow-hidden"
        style={{ background: '#FFFFFF', borderColor: '#E2E8F0', boxShadow: '0 2px 8px rgba(15,23,42,0.05)' }}
      >
        <CollapsibleTrigger asChild>
          <button
            type="button"
            className="w-full flex items-center justify-between gap-2.5 p-4 hover:bg-muted/30 transition-colors"
          >
            <div className="flex items-center gap-2.5">
              <div
                className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg"
                style={{ backgroundColor: iconBg }}
              >
                <Icon className="h-3.5 w-3.5" style={{ color: iconColor }} strokeWidth={2.2} />
              </div>
              <span className="text-[14px] font-semibold" style={{ color: '#1E293B' }}>{title}</span>
            </div>
            <ChevronDown
              className={cn('h-4 w-4 text-muted-foreground transition-transform duration-200', open && 'rotate-180')}
            />
          </button>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <div className="px-4 pb-4 pt-1 space-y-3 border-t" style={{ borderColor: '#F1F5F9' }}>
            {children}
          </div>
        </CollapsibleContent>
      </div>
    </Collapsible>
  );
};

// ── Field styles ─────────────────────────────────────────────────────────────
const fieldClass = 'h-11 rounded-[10px] border-[#CBD5E1] bg-[#F8FAFC] text-[#0F172A] placeholder:text-[#94A3B8] focus-visible:outline-none focus-visible:border-[#1E3A5F] focus-visible:shadow-[0_0_0_3px_rgba(30,58,95,0.15)]';
const textareaClass = 'rounded-[10px] border-[#CBD5E1] bg-[#F8FAFC] text-[#0F172A] placeholder:text-[#94A3B8] focus-visible:outline-none focus-visible:border-[#1E3A5F] focus-visible:shadow-[0_0_0_3px_rgba(30,58,95,0.15)] min-h-[80px]';

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
  const [uploadedFiles, setUploadedFiles] = useState<File[]>([]);
  const [openDefects, setOpenDefects] = useState<Defect[]>([]);
  const [someoneElse, setSomeoneElse] = useState(false);
  const [loggedInUserName, setLoggedInUserName] = useState('');
  const { toast } = useToast();
  const { user } = useAuth();
  const { effectiveUserId, isStaff, actualUserId } = useEffectiveUserId();

  const [formData, setFormData] = useState({
    maintenance_date: new Date(),
    maintenance_type: '',
    description: '',
    performed_by: '',
    parts_replaced: '',
    cost: '',
    notes: '',
    linked_defect_id: '',
    service_provider_type: '',
    service_company: '',
    engineer_name: '',
    equipment_out_of_service: false,
    downtime_duration: '',
  });

  // Fetch logged-in user's name for default "performed by"
  useEffect(() => {
    const fetchUserName = async () => {
      if (!user?.id) return;
      const { data } = await supabase
        .from('profiles')
        .select('controller_name, showmen_name, company_name')
        .eq('user_id', user.id)
        .maybeSingle();
      if (data) {
        const name = data.controller_name || data.showmen_name || data.company_name || user.email || '';
        setLoggedInUserName(name);
        // Only set default if performed_by is still empty
        setFormData(prev => prev.performed_by ? prev : { ...prev, performed_by: name });
      }
    };
    fetchUserName();
  }, [user?.id]);

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

  // When "someone else" is toggled off, revert to logged-in user
  useEffect(() => {
    if (!someoneElse && loggedInUserName) {
      setFormData(prev => ({ ...prev, performed_by: loggedInUserName }));
    } else if (someoneElse) {
      setFormData(prev => ({ ...prev, performed_by: '' }));
    }
  }, [someoneElse, loggedInUserName]);

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

      if (formData.linked_defect_id) {
        await supabase.from('defects').update({ status: 'in_progress' }).eq('id', formData.linked_defect_id);
      }

      // Notify if work was performed by someone else, or if staff logs for controller
      const performedBySomeoneElse = someoneElse && formData.performed_by !== loggedInUserName;
      const staffLoggingForController = isStaff && effectiveUserId && actualUserId !== effectiveUserId;

      if (performedBySomeoneElse || staffLoggingForController) {
        const notifUserId = effectiveUserId;
        if (notifUserId) {
          await supabase.from('notifications').insert({
            user_id: notifUserId,
            title: `Maintenance logged: ${ride.ride_name}`,
            message: `Work on ${ride.ride_name} performed by ${formData.performed_by}. Logged by ${loggedInUserName || 'a team member'}.`,
            type: 'info',
            related_table: 'maintenance_records',
          }).then(({ error: notifError }) => {
            if (notifError) console.error('Failed to send notification:', notifError);
          });
        }
      }

      toast({ title: "Maintenance Record Logged", description: "Record saved successfully." });

      setFormData({
        maintenance_date: new Date(), maintenance_type: '', description: '',
        performed_by: loggedInUserName,
        parts_replaced: '', cost: '', notes: '', linked_defect_id: '', service_provider_type: '',
        service_company: '', engineer_name: '', equipment_out_of_service: false, downtime_duration: '',
      });
      setSomeoneElse(false);
      setUploadedFiles([]);
      onMaintenanceLogged?.();

    } catch (error) {
      console.error('Error logging maintenance:', error);
      toast({ title: "Error", description: "Failed to log maintenance record.", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setFormData({
      maintenance_date: new Date(), maintenance_type: '', description: '',
      performed_by: loggedInUserName,
      parts_replaced: '', cost: '', notes: '', linked_defect_id: '', service_provider_type: '',
      service_company: '', engineer_name: '', equipment_out_of_service: false, downtime_duration: '',
    });
    setSomeoneElse(false);
    setUploadedFiles([]);
  };

  return (
    <div className="pb-6 space-y-3" style={{ background: '#F1F5F9', minHeight: '100%' }}>

      {/* ── Info banner ── */}
      <div className="flex items-start gap-3 rounded-xl border px-3.5 py-3"
        style={{ background: '#EFF6FF', borderColor: '#BFDBFE' }}>
        <Info className="shrink-0 mt-0.5 h-4 w-4" style={{ color: '#2563EB' }} />
        <p style={{ color: '#1D4ED8', fontSize: 12, lineHeight: '1.5' }}>
          Attachments are stored in the equipment document register under <strong>"Maintenance"</strong>.
        </p>
      </div>

      {/* ── CORE FIELDS: Date, Type, Description ── */}
      <LogSectionCard>
        <LogSectionHeader icon={Wrench} title="Maintenance Details" iconColor="#1E3A5F" iconBg="#DBEAFE" />

        <div className="grid grid-cols-2 gap-3">
          {/* Date */}
          <div className="space-y-1.5">
            <Label className="text-[13px] font-semibold" style={{ color: '#0F172A' }}>
              Date <span className="text-destructive">*</span>
            </Label>
            <Popover open={calendarOpen} onOpenChange={setCalendarOpen}>
              <PopoverTrigger asChild>
                <Button variant="outline" className={cn('w-full justify-start text-left font-normal h-11 rounded-[10px] border-[#CBD5E1] bg-[#F8FAFC] text-[#0F172A]', !formData.maintenance_date && 'text-[#94A3B8]')}>
                  <CalendarIcon className="mr-2 h-4 w-4 opacity-60" />
                  {formData.maintenance_date ? format(formData.maintenance_date, 'd MMM yyyy') : 'Select date'}
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
          <div className="space-y-1.5">
            <Label className="text-[13px] font-semibold" style={{ color: '#0F172A' }}>
              Type <span className="text-destructive">*</span>
            </Label>
            <Select value={formData.maintenance_type} onValueChange={(v) => setFormData({ ...formData, maintenance_type: v })}>
              <SelectTrigger className={fieldClass}><SelectValue placeholder="Select type" /></SelectTrigger>
              <SelectContent>{MAINTENANCE_TYPES.map((t) => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}</SelectContent>
            </Select>
          </div>
        </div>

        {/* Work Description */}
        <div className="space-y-1.5">
          <Label htmlFor="description" className="text-[13px] font-semibold" style={{ color: '#0F172A' }}>
            Work Summary <span className="text-destructive">*</span>
          </Label>
          <Textarea id="description" value={formData.description}
            onChange={(e) => setFormData({ ...formData, description: e.target.value })}
            placeholder="Describe the maintenance work performed…" rows={3} className={textareaClass} />
        </div>

        {/* Who did the work */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label className="text-[13px] font-semibold" style={{ color: '#0F172A' }}>
              Performed By <span className="text-destructive">*</span>
            </Label>
            {!someoneElse && loggedInUserName && (
              <span className="text-[12px] text-muted-foreground">You</span>
            )}
          </div>

          {!someoneElse && (
            <div className="flex items-center justify-between rounded-lg p-2.5 border" style={{ background: '#F8FAFC', borderColor: '#E2E8F0' }}>
              <span className="text-[13px] font-medium" style={{ color: '#0F172A' }}>
                {loggedInUserName || 'Loading…'}
              </span>
              <button
                type="button"
                onClick={() => setSomeoneElse(true)}
                className="text-[12px] font-medium text-primary hover:underline"
              >
                Someone else?
              </button>
            </div>
          )}

          {someoneElse && (
            <div className="space-y-2">
              <Input
                value={formData.performed_by}
                onChange={(e) => setFormData({ ...formData, performed_by: e.target.value })}
                placeholder="Name of person who performed the work"
                className={fieldClass}
              />
              <button
                type="button"
                onClick={() => setSomeoneElse(false)}
                className="text-[12px] font-medium text-muted-foreground hover:text-foreground"
              >
                ← I did this work
              </button>
            </div>
          )}
        </div>

        {/* Linked Defect */}
        {openDefects.length > 0 && (
          <div className="space-y-1.5">
            <Label className="text-[13px] font-semibold flex items-center gap-1.5" style={{ color: '#0F172A' }}>
              <Link className="h-3.5 w-3.5" style={{ color: '#1E3A5F' }} />
              Linked Defect <span className="text-[11px] font-normal text-slate-400">(optional)</span>
            </Label>
            <Select value={formData.linked_defect_id || "none"} onValueChange={(v) => setFormData({ ...formData, linked_defect_id: v === "none" ? "" : v })}>
              <SelectTrigger className={fieldClass}><SelectValue placeholder="Link to an open defect…" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="none">None</SelectItem>
                {openDefects.map((d) => (
                  <SelectItem key={d.id} value={d.id}>
                    <span className="capitalize text-xs font-medium text-destructive mr-2">[{d.severity.replace('_', ' ')}]</span>
                    {d.description.length > 60 ? d.description.substring(0, 60) + '…' : d.description}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {formData.linked_defect_id && (
              <p className="text-xs" style={{ color: '#64748B' }}>Linked defect status will be updated to "In Progress" when saved.</p>
            )}
          </div>
        )}
      </LogSectionCard>

      {/* ── EVIDENCE & ATTACHMENTS ── */}
      <LogSectionCard>
        <LogSectionHeader icon={Paperclip} title="Evidence & Attachments" iconColor="#7C3AED" iconBg="#EDE9FE" />

        <input type="file" multiple
          accept="image/*,.pdf,.doc,.docx,.txt,.csv,.xls,.xlsx,.ppt,.pptx,.mp4,.mov,.avi,.webm,.mpeg,.zip,.rar,.tiff,.tif,.bmp"
          onChange={handleFileUpload} className="hidden" id="file-upload" />
        <input type="file" multiple accept="image/*" capture="environment"
          onChange={handleFileUpload} className="hidden" id="camera-upload" />

        <div className="grid grid-cols-2 gap-2.5">
          <button type="button"
            className="h-16 flex flex-col items-center justify-center gap-1.5 rounded-xl border transition-colors cursor-pointer hover:border-[#1E3A5F] hover:bg-white"
            style={{ background: '#FFFFFF', borderColor: '#E2E8F0' }}
            onClick={() => document.getElementById('camera-upload')?.click()}>
            <Camera className="h-5 w-5" style={{ color: '#1E3A5F' }} strokeWidth={2} />
            <span className="text-[12px] font-semibold" style={{ color: '#1E293B' }}>Take Photo</span>
          </button>
          <button type="button"
            className="h-16 flex flex-col items-center justify-center gap-1.5 rounded-xl border transition-colors cursor-pointer hover:border-[#1E3A5F] hover:bg-white"
            style={{ background: '#FFFFFF', borderColor: '#E2E8F0' }}
            onClick={() => document.getElementById('file-upload')?.click()}>
            <FolderOpen className="h-5 w-5" style={{ color: '#1E3A5F' }} strokeWidth={2} />
            <span className="text-[12px] font-semibold" style={{ color: '#1E293B' }}>Choose File</span>
          </button>
        </div>

        {imageCount > 0 && (
          <p className="text-[12px] font-semibold text-center" style={{ color: '#1E3A5F' }}>
            📷 {imageCount}/{MAX_PHOTOS} photos added
          </p>
        )}

        {/* Attached file thumbnails */}
        {uploadedFiles.length > 0 && (
          <div className="space-y-1.5">
            <Label className="text-[12px] font-semibold" style={{ color: '#0F172A' }}>
              Attached ({uploadedFiles.length})
            </Label>
            <div className="flex flex-wrap gap-2">
              {uploadedFiles.map((file, index) => (
                <div key={index} className="relative group rounded-lg overflow-hidden w-14 h-14"
                  style={{ border: '1px solid #E2E8F0', background: '#F8FAFC' }}>
                  {file.type.startsWith('image/') ? (
                    <img src={URL.createObjectURL(file)} alt={file.name} className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full flex flex-col items-center justify-center p-1">
                      <FileText className="h-4 w-4" style={{ color: '#64748B' }} />
                      <span className="text-[7px] text-center line-clamp-1 mt-0.5" style={{ color: '#64748B' }}>
                        {file.name.split('.').pop()}
                      </span>
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
      </LogSectionCard>

      {/* ── COLLAPSIBLE: More Details ── */}
      <CollapsibleSection
        icon={Clock}
        title="More Details"
        iconColor="#B45309"
        iconBg="#FEF3C7"
      >
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label htmlFor="cost" className="text-[13px] font-semibold" style={{ color: '#0F172A' }}>
              Cost (£)
            </Label>
            <Input id="cost" type="number" step="0.01" min="0" value={formData.cost}
              onChange={(e) => setFormData({ ...formData, cost: e.target.value })}
              placeholder="0.00" className={fieldClass} />
          </div>
          <div className="space-y-1.5 flex flex-col">
            <Label className="text-[13px] font-semibold" style={{ color: '#0F172A' }}>Out of Service?</Label>
            <div className="flex items-center gap-2 mt-auto h-11">
              <Switch checked={formData.equipment_out_of_service}
                onCheckedChange={(v) => setFormData({ ...formData, equipment_out_of_service: v })} />
              <span className="text-[12px] text-muted-foreground">{formData.equipment_out_of_service ? 'Yes' : 'No'}</span>
            </div>
          </div>
        </div>

        {formData.equipment_out_of_service && (
          <div className="space-y-1.5">
            <Label htmlFor="downtime" className="text-[13px] font-semibold" style={{ color: '#0F172A' }}>
              Downtime Duration
            </Label>
            <Input id="downtime" value={formData.downtime_duration}
              onChange={(e) => setFormData({ ...formData, downtime_duration: e.target.value })}
              placeholder="e.g. 2 hours, half day" className={fieldClass} />
          </div>
        )}

        <div className="space-y-1.5">
          <Label htmlFor="parts_replaced" className="text-[13px] font-semibold" style={{ color: '#0F172A' }}>
            Parts Replaced
          </Label>
          <Textarea id="parts_replaced" value={formData.parts_replaced}
            onChange={(e) => setFormData({ ...formData, parts_replaced: e.target.value })}
            placeholder="List any parts replaced…"
            rows={2} className={textareaClass} style={{ minHeight: 60 }} />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="notes" className="text-[13px] font-semibold" style={{ color: '#0F172A' }}>
            Additional Notes
          </Label>
          <Textarea id="notes" value={formData.notes}
            onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
            placeholder="Any additional observations or follow-up actions…"
            rows={2} className={textareaClass} style={{ minHeight: 60 }} />
        </div>
      </CollapsibleSection>

      {/* ── COLLAPSIBLE: Contractor / Provider ── */}
      <CollapsibleSection
        icon={UserCog}
        title="Contractor / Provider"
        iconColor="#0F766E"
        iconBg="#CCFBF1"
      >
        <div className="space-y-1.5">
          <Label className="text-[13px] font-semibold" style={{ color: '#0F172A' }}>
            Provider Type
          </Label>
          <Select value={formData.service_provider_type} onValueChange={(v) => setFormData({ ...formData, service_provider_type: v })}>
            <SelectTrigger className={fieldClass}><SelectValue placeholder="Internal or external?" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="internal">Internal — Own team</SelectItem>
              <SelectItem value="external">External — Contractor</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {formData.service_provider_type === 'external' && (
          <div className="space-y-1.5">
            <Label htmlFor="service_company" className="text-[13px] font-semibold" style={{ color: '#0F172A' }}>Company Name</Label>
            <Input id="service_company" value={formData.service_company}
              onChange={(e) => setFormData({ ...formData, service_company: e.target.value })}
              placeholder="Contractor / service company name" className={fieldClass} />
          </div>
        )}

        <div className="space-y-1.5">
          <Label htmlFor="engineer_name" className="text-[13px] font-semibold" style={{ color: '#0F172A' }}>
            Engineer / Technician Name
          </Label>
          <Input id="engineer_name" value={formData.engineer_name}
            onChange={(e) => setFormData({ ...formData, engineer_name: e.target.value })}
            placeholder="Name of engineer or technician" className={fieldClass} />
        </div>
      </CollapsibleSection>

      {/* ── STICKY BOTTOM ACTION BAR ── */}
      <div className="sticky bottom-0 z-50 border-t px-4 py-3 flex flex-col gap-2 sm:flex-row sm:gap-3"
        style={{ background: 'rgba(255,255,255,0.95)', backdropFilter: 'blur(8px)', borderColor: '#E2E8F0', boxShadow: '0 -4px 16px rgba(15,23,42,0.08)' }}>
        <Button onClick={handleSubmit} disabled={loading}
          className="w-full sm:flex-1 h-12 text-[14px] font-semibold rounded-xl text-white"
          style={{ background: 'linear-gradient(135deg, #1E3A5F 0%, #2563EB 100%)', boxShadow: '0 4px 12px rgba(30,58,95,0.3)' }}>
          {loading
            ? <><div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2" />Saving…</>
            : <><Save className="h-4 w-4 mr-2" />Log Maintenance Record</>}
        </Button>
        <Button type="button" variant="outline" onClick={resetForm}
          className="w-full sm:w-auto h-12 px-4 rounded-xl font-medium text-[13px]"
          style={{ borderColor: '#CBD5E1', color: '#64748B' }}>
          <RotateCcw className="h-4 w-4 mr-1.5" />
          Reset
        </Button>
      </div>

    </div>
  );
};

export default MaintenanceLogger;
