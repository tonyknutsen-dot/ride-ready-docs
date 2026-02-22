import { useState, useEffect, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Switch } from '@/components/ui/switch';
import { ShieldCheck, FileText, Camera, FolderOpen, CalendarClock, Globe2, Repeat } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { useTerminology } from '@/hooks/useTerminology';
import { compressImage } from '@/utils/imageCompression';
import { EmptyState } from '@/components/EmptyState';
import { useOptimisticDocumentUpload } from '@/hooks/useOptimisticMutations';

// Document categories with grouped types
const DOCUMENT_CATEGORIES = {
  'Inspection Reports': [
    { id: 'declaration_of_compliance', name: '📜 Annual Inspection Certificate', description: 'Annual safety certificate to operate', featured: true },
    { id: 'electrical_inspection', name: 'Electrical Inspection Report', description: 'Electrical safety inspection reports' },
    { id: 'inservice_inspection', name: 'In-Service Inspection Report', description: 'Regular in-service inspection reports' },
  ],
  'Checks': [
    { id: 'daily_check', name: 'Daily Check Record', description: 'Daily pre-opening check documentation' },
    { id: 'monthly_check', name: 'Monthly Check Record', description: 'Monthly inspection documentation' },
    { id: 'yearly_check', name: 'Yearly Check Record', description: 'Annual check documentation' },
  ],
  'NDT': [
    { id: 'ndt_schedule', name: 'NDT Schedule', description: 'Non-destructive testing schedules' },
    { id: 'ndt_report', name: 'NDT Report', description: 'Non-destructive testing inspection reports' },
  ],
  'Design & Review': [
    { id: 'design_review', name: 'Design Review Report', description: 'Design review documents' },
    { id: 'conformity_design', name: 'Conformity to Design', description: 'Design conformity certificates' },
    { id: 'initial_test_report', name: 'Initial Test Report', description: 'Initial testing and commissioning reports' },
  ],
  'Risk Assessments': [
    { id: 'risk_assessment', name: 'Risk Assessment', description: 'General, fire, confined space, working at height assessments' },
    { id: 'method_statement', name: 'Method Statement', description: 'Work method statements and procedures' },
  ],
  'Maintenance': [
    { id: 'maintenance_report', name: 'Maintenance Report', description: 'Generated maintenance reports' },
    { id: 'maintenance_log', name: 'Maintenance Log', description: 'Maintenance documentation' },
  ],
  'Manuals & Procedures': [
    { id: 'operator_manual', name: 'Operator Manual', description: 'Operating manuals and instructions' },
    { id: 'controller_manual', name: 'Controller Manual', description: 'Control system manuals' },
    { id: 'build_up_down', name: 'Build Up and Down Procedure', description: 'Procedures for ride assembly and dismantling' },
    { id: 'emergency_action_plan', name: 'Emergency Action Plan', description: 'Emergency response and action procedures' },
    { id: 'evacuation_plan', name: 'Evacuation Plan', description: 'Evacuation procedures and plans' },
  ],
  'Insurance & Certificates': [
    { id: 'insurance', name: '🛡️ Insurance Documents', description: 'Liability, employers, equipment insurance', suggestGlobal: true },
    { id: 'safety_certificate', name: '🏅 Safety Certificate', description: 'Safety certificates from inspecting bodies' },
    { id: 'doc_certificate', name: '📋 Declaration of Conformity (DOC)', description: 'EU Declaration of Conformity certificate' },
    { id: 'pssr_certificate', name: '⚙️ PSSR Certificate', description: 'Pressure Systems Safety Regulations certificate' },
    { id: 'loler_certificate', name: '🏗️ LOLER Certificate', description: 'Lifting Operations and Lifting Equipment Regulations certificate' },
    { id: 'puwer_certificate', name: '🔧 PUWER Certificate', description: 'Provision and Use of Work Equipment Regulations certificate' },
    { id: 'certificate', name: 'Certificate', description: 'Other certificates' },
  ],
  'Other': [
    { id: 'photo', name: 'Device Photo', description: 'Pictures of the ride for identification' },
    { id: 'other', name: 'Other Documents', description: 'Other document types' },
  ],
};

// Flatten for select dropdown with category headers
const getDocumentTypes = (_isUK: boolean) => {
  const types: Array<{ id: string; name: string; description: string; category: string; featured?: boolean; suggestGlobal?: boolean }> = [];
  
  Object.entries(DOCUMENT_CATEGORIES).forEach(([category, items]) => {
    items.forEach(item => {
      types.push({ ...item, category });
    });
  });
  
  return types;
};

interface DocumentUploadProps {
  rideId?: string;
  rideName?: string;
  onUploadSuccess: () => void;
}

const DocumentUpload = ({ rideId, rideName, onUploadSuccess }: DocumentUploadProps) => {
  const { user } = useAuth();
  const { terminology } = useTerminology();
  const { toast } = useToast();
  const uploadMutation = useOptimisticDocumentUpload();
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [documentType, setDocumentType] = useState('');
  const [documentName, setDocumentName] = useState('');
  const [expiryDate, setExpiryDate] = useState('');
  const [notes, setNotes] = useState('');
  const [uploading, setUploading] = useState(false);
  const [existingDocuments, setExistingDocuments] = useState<any[]>([]);
  const [isGlobal, setIsGlobal] = useState(false);
  const [autoCreateEvent, setAutoCreateEvent] = useState(false);
  const [recurrenceType, setRecurrenceType] = useState('annual');
  const [customIntervalDays, setCustomIntervalDays] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);

  // Get document types based on user's country
  const documentTypes = getDocumentTypes(terminology.isUK);

  // Auto-detect existing documents with same name for automatic versioning
  useEffect(() => {
    if (documentName && documentType && user) {
      loadExistingDocuments();
    }
  }, [documentName, documentType, rideId, user]);

  // Auto-suggest global for insurance documents
  useEffect(() => {
    const selectedType = documentTypes.find(t => t.id === documentType);
    if (selectedType && (selectedType as any).suggestGlobal && !rideId) {
      setIsGlobal(true);
    }
  }, [documentType, rideId]);

  const loadExistingDocuments = async () => {
    if (!user || !documentName || !documentType) return;

    try {
      let query = supabase
        .from('documents')
        .select('*')
        .eq('user_id', user.id)
        .eq('document_name', documentName)
        .eq('document_type', documentType)
        .order('uploaded_at', { ascending: false });

      if (rideId && !isGlobal) {
        query = query.eq('ride_id', rideId);
      } else if (isGlobal) {
        query = query.eq('is_global', true);
      }

      const { data, error } = await query;
      if (!error && data) {
        setExistingDocuments(data);
      }
    } catch (error) {
      console.error('Error loading existing documents:', error);
    }
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      let processedFile = file;
      if (file.type.startsWith('image/') && file.size > 500000) {
        try {
          processedFile = await compressImage(file);
          if (processedFile.size < file.size) {
            toast({
              title: "Image compressed",
              description: `Reduced from ${(file.size / 1024 / 1024).toFixed(1)}MB to ${(processedFile.size / 1024 / 1024).toFixed(1)}MB`,
            });
          }
        } catch (error) {
          console.error('Compression failed, using original:', error);
        }
      }
      setSelectedFile(processedFile);
      if (!documentName) {
        setDocumentName(file.name.split('.')[0]);
      }
    }
  };

  const handleUpload = async () => {
    if (!selectedFile || !documentType || !documentName || !user) {
      toast({
        title: "Missing information",
        description: "Please fill in all required fields",
        variant: "destructive",
      });
      return;
    }

    setUploading(true);

    const autoVersionNumber = existingDocuments.length > 0 
      ? `${existingDocuments.length + 1}.0` 
      : '1.0';

    uploadMutation.mutate(
      {
        file: selectedFile,
        documentName,
        documentType,
        rideId: rideId || null,
        rideName,
        isGlobal,
        expiryDate: expiryDate || undefined,
        notes: notes || undefined,
        versionNumber: autoVersionNumber,
        versionNotes: undefined,
        replacingDocumentId: null,
        autoCreateEvent,
        recurrenceType: autoCreateEvent ? recurrenceType : 'none',
        recurrenceIntervalDays: autoCreateEvent && recurrenceType === 'custom' ? parseInt(customIntervalDays) || null : null,
      },
      {
        onSuccess: () => {
          setSelectedFile(null);
          setDocumentType('');
          setDocumentName('');
          setExpiryDate('');
          setNotes('');
          setIsGlobal(false);
          setAutoCreateEvent(false);
          setRecurrenceType('annual');
          setCustomIntervalDays('');
          setExistingDocuments([]);
          if (fileInputRef.current) fileInputRef.current.value = '';
          if (cameraInputRef.current) cameraInputRef.current.value = '';
          setUploading(false);
          onUploadSuccess();
        },
        onError: () => {
          setUploading(false);
        },
      }
    );
  };

  // Early return after all hooks
  if (!rideId && !isGlobal) {
    return (
      <EmptyState
        icon={FolderOpen}
        title="Pick a ride first to add a document"
        description="or check 'Global Document' below"
        variant="compact"
      />
    );
  }

  return (
    <div className="space-y-4">
      {/* Hidden file inputs */}
      <Input
        ref={fileInputRef}
        id="file"
        type="file"
        onChange={handleFileSelect}
        accept=".pdf,.doc,.docx,.jpg,.jpeg,.png,.xlsx,.xls,.txt,.csv,.zip,.rar,.mp4,.mov,.avi,.tiff,.tif,.bmp,.gif,.ppt,.pptx,.dwg,.dxf"
        disabled={uploading}
        className="hidden"
      />
      <Input
        ref={cameraInputRef}
        id="camera"
        type="file"
        onChange={handleFileSelect}
        accept="image/*"
        capture="environment"
        disabled={uploading}
        className="hidden"
      />

      {/* Asset Context Strip */}
      {rideName && (
        <div className="flex items-center gap-2.5 px-3 py-2.5 rounded-xl" style={{ background: 'hsl(214 100% 97%)', border: '1px solid hsl(213 52% 85%)' }}>
          <div className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: 'hsl(213 52% 24% / 0.12)' }}>
            <ShieldCheck className="h-3.5 w-3.5" style={{ color: 'hsl(213 52% 24%)' }} />
          </div>
          <div className="min-w-0">
            <p className="text-[10px] font-medium uppercase tracking-wide" style={{ color: 'hsl(213 52% 40%)' }}>Registering evidence for</p>
            <p className="text-xs font-semibold truncate" style={{ color: 'hsl(213 52% 24%)' }}>{rideName}</p>
          </div>
        </div>
      )}

      {/* Upload Method Cards */}
      {!selectedFile ? (
        <div className="grid grid-cols-2 gap-3">
          <button
            type="button"
            className="h-28 flex flex-col items-center justify-center gap-3 rounded-2xl border transition-all group disabled:opacity-50"
            style={{ background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', boxShadow: '0 4px 10px rgba(0,0,0,0.05)' }}
            onClick={() => cameraInputRef.current?.click()}
            disabled={uploading}
            onMouseEnter={e => { (e.currentTarget as HTMLElement).style.borderColor = 'hsl(213 52% 24% / 0.5)'; (e.currentTarget as HTMLElement).style.boxShadow = '0 6px 16px rgba(30,58,95,0.1)'; }}
            onMouseLeave={e => { (e.currentTarget as HTMLElement).style.borderColor = 'hsl(var(--border))'; (e.currentTarget as HTMLElement).style.boxShadow = '0 4px 10px rgba(0,0,0,0.05)'; }}
          >
            <div className="w-11 h-11 rounded-xl flex items-center justify-center" style={{ background: 'hsl(214 100% 97%)' }}>
              <Camera className="h-5 w-5" style={{ color: 'hsl(213 52% 24%)' }} strokeWidth={2} />
            </div>
            <span className="text-sm font-semibold" style={{ color: 'hsl(var(--foreground))' }}>Capture Photo</span>
            <span className="text-[10px]" style={{ color: 'hsl(var(--muted-foreground))' }}>Camera</span>
          </button>
          <button
            type="button"
            className="h-28 flex flex-col items-center justify-center gap-3 rounded-2xl border transition-all group disabled:opacity-50"
            style={{ background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', boxShadow: '0 4px 10px rgba(0,0,0,0.05)' }}
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
            onMouseEnter={e => { (e.currentTarget as HTMLElement).style.borderColor = 'hsl(213 52% 24% / 0.5)'; (e.currentTarget as HTMLElement).style.boxShadow = '0 6px 16px rgba(30,58,95,0.1)'; }}
            onMouseLeave={e => { (e.currentTarget as HTMLElement).style.borderColor = 'hsl(var(--border))'; (e.currentTarget as HTMLElement).style.boxShadow = '0 4px 10px rgba(0,0,0,0.05)'; }}
          >
            <div className="w-11 h-11 rounded-xl flex items-center justify-center" style={{ background: 'hsl(214 100% 97%)' }}>
              <FolderOpen className="h-5 w-5" style={{ color: 'hsl(213 52% 24%)' }} strokeWidth={2} />
            </div>
            <span className="text-sm font-semibold" style={{ color: 'hsl(var(--foreground))' }}>Upload File</span>
            <span className="text-[10px]" style={{ color: 'hsl(var(--muted-foreground))' }}>PDF, Word, Image…</span>
          </button>
        </div>
      ) : (
        <div 
          className="relative rounded-xl p-4 cursor-pointer transition-all"
          style={{ border: '2px solid hsl(142 72% 29%)', background: 'linear-gradient(135deg, hsl(142 72% 29% / 0.08), hsl(213 52% 24% / 0.05))', boxShadow: '0 2px 8px rgba(22,163,74,0.12)' }}
          onClick={() => {
            setSelectedFile(null);
            if (fileInputRef.current) fileInputRef.current.value = '';
            if (cameraInputRef.current) cameraInputRef.current.value = '';
          }}
        >
          <div className="flex items-center gap-4">
            {selectedFile.type.startsWith('image/') ? (
              <img
                src={URL.createObjectURL(selectedFile)}
                alt="Preview"
                className="h-14 w-14 rounded-xl object-cover"
                style={{ border: '2px solid hsl(142 72% 29% / 0.3)' }}
                onLoad={(e) => URL.revokeObjectURL((e.target as HTMLImageElement).src)}
              />
            ) : (
              <div className="h-14 w-14 rounded-xl flex items-center justify-center" style={{ background: 'hsl(213 52% 24% / 0.1)' }}>
                <FileText className="h-7 w-7" style={{ color: 'hsl(213 52% 24%)' }} />
              </div>
            )}
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold truncate">{selectedFile.name}</p>
              <p className="text-xs" style={{ color: 'hsl(var(--muted-foreground))' }}>{(selectedFile.size / 1024 / 1024).toFixed(2)} MB</p>
              <p className="text-xs font-medium mt-1" style={{ color: 'hsl(142 72% 29%)' }}>✓ Evidence ready · Tap to change</p>
            </div>
          </div>
        </div>
      )}

      {/* Form Fields */}
      <div className="space-y-3">
        {/* Document Category */}
        <div className="space-y-1.5">
          <Label className="text-xs font-semibold uppercase tracking-wide" style={{ color: 'hsl(var(--muted-foreground))' }}>Document Type</Label>
          <Select value={documentType} onValueChange={setDocumentType} disabled={uploading}>
            <SelectTrigger className="h-11">
              <SelectValue placeholder="Select compliance document type..." />
            </SelectTrigger>
            <SelectContent className="max-h-80">
              {Object.entries(DOCUMENT_CATEGORIES).map(([category, items]) => (
                <div key={category}>
                  <div className="px-2 py-1.5 text-xs font-semibold text-muted-foreground bg-muted/50 sticky top-0">
                    {category}
                  </div>
                  {items.map((item) => (
                    <SelectItem key={item.id} value={item.id} className="pl-4">
                      <span className={item.featured ? 'text-primary font-medium' : ''}>{item.name}</span>
                    </SelectItem>
                  ))}
                </div>
              ))}
            </SelectContent>
          </Select>
          <p className="text-[11px]" style={{ color: 'hsl(var(--muted-foreground))' }}>Select the correct type for accurate compliance tracking.</p>
        </div>

        {/* Document Name */}
        <div className="space-y-1.5">
          <Label className="text-xs font-semibold uppercase tracking-wide" style={{ color: 'hsl(var(--muted-foreground))' }}>Document Name</Label>
          <Input
            value={documentName}
            onChange={(e) => setDocumentName(e.target.value)}
            placeholder="e.g., ADIPS Annual Inspection Certificate 2026"
            disabled={uploading}
            className="h-11"
          />
          <p className="text-[11px]" style={{ color: 'hsl(var(--muted-foreground))' }}>Use the official certificate or report title.</p>
        </div>

        {/* Expiry Section — elevated importance */}
        <div className="space-y-2 rounded-xl p-3" style={{ background: 'hsl(var(--muted) / 0.4)', border: '1px solid hsl(var(--border))' }}>
          <div className="flex items-center gap-2">
            <CalendarClock className="h-4 w-4" style={{ color: 'hsl(213 52% 24%)' }} />
            <Label className="text-xs font-semibold uppercase tracking-wide" style={{ color: 'hsl(213 52% 24%)' }}>Compliance Expiry Tracking</Label>
          </div>
          <Input
            type="date"
            value={expiryDate}
            onChange={(e) => setExpiryDate(e.target.value)}
            disabled={uploading}
            className={`h-11 ${!expiryDate ? 'text-muted-foreground' : ''}`}
          />
          <p className="text-[11px]" style={{ color: 'hsl(var(--muted-foreground))' }}>Set expiry to receive automated alerts before the document lapses.</p>

          {/* Auto-create recurring compliance event */}
          {expiryDate && (
            <div className="mt-3 space-y-2.5 rounded-xl p-3" style={{ background: 'hsl(var(--muted) / 0.3)', border: '1px solid hsl(var(--border))' }}>
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2 flex-1 min-w-0">
                  <Repeat className="h-4 w-4 flex-shrink-0" style={{ color: 'hsl(213 52% 24%)' }} />
                  <div>
                    <Label htmlFor="auto-create-event" className="text-xs font-semibold cursor-pointer">Auto-create recurring event</Label>
                    <p className="text-[10px]" style={{ color: 'hsl(var(--muted-foreground))' }}>Creates a compliance reminder on expiry</p>
                  </div>
                </div>
                <Switch
                  id="auto-create-event"
                  checked={autoCreateEvent}
                  onCheckedChange={setAutoCreateEvent}
                  disabled={uploading}
                />
              </div>

              {autoCreateEvent && (
                <div className="space-y-2 pt-1">
                  <Select value={recurrenceType} onValueChange={setRecurrenceType} disabled={uploading}>
                    <SelectTrigger className="h-9 text-sm">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="annual">Annual (every 12 months)</SelectItem>
                      <SelectItem value="6_monthly">6 Monthly</SelectItem>
                      <SelectItem value="quarterly">Quarterly (every 3 months)</SelectItem>
                      <SelectItem value="monthly">Monthly</SelectItem>
                      <SelectItem value="custom">Custom interval</SelectItem>
                    </SelectContent>
                  </Select>
                  {recurrenceType === 'custom' && (
                    <Input
                      type="number"
                      value={customIntervalDays}
                      onChange={(e) => setCustomIntervalDays(e.target.value)}
                      placeholder="Number of days"
                      min={1}
                      max={3650}
                      className="h-9 text-sm"
                      disabled={uploading}
                    />
                  )}
                  <p className="text-[10px]" style={{ color: 'hsl(var(--muted-foreground))' }}>
                    Next event will be created automatically after completion.
                  </p>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Notes */}
        <div className="space-y-1.5">
          <Label className="text-xs font-semibold uppercase tracking-wide" style={{ color: 'hsl(var(--muted-foreground))' }}>Compliance Notes <span className="normal-case font-normal">(optional)</span></Label>
          <Input
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="e.g., Issued by: ADIPS Inspector · Ref: 12345"
            disabled={uploading}
            className="h-11"
          />
        </div>

        {/* Global Document Toggle */}
        <div 
          className={`flex items-center gap-3 p-3.5 rounded-xl border-2 transition-all cursor-pointer ${
            isGlobal 
              ? 'border-accent bg-gradient-to-r from-accent/10 to-info/5 shadow-sm' 
              : 'border-border hover:border-accent/40 hover:bg-accent/5'
          }`}
          onClick={() => setIsGlobal(!isGlobal)}
        >
          <Checkbox
            id="is-global"
            checked={isGlobal}
            onCheckedChange={(checked) => setIsGlobal(checked as boolean)}
            disabled={uploading}
            className="border-accent data-[state=checked]:bg-accent data-[state=checked]:border-accent"
          />
          <Globe2 className="h-4 w-4 flex-shrink-0" style={{ color: 'hsl(var(--muted-foreground))' }} />
          <div className="flex-1 min-w-0">
            <Label htmlFor="is-global" className="text-sm font-medium cursor-pointer">Global Document</Label>
            <p className="text-[11px]" style={{ color: 'hsl(var(--muted-foreground))' }}>Applies to all equipment (e.g., company insurance)</p>
          </div>
        </div>

        {/* Existing versions info */}
        {existingDocuments.length > 0 && (
          <div className="rounded-lg border border-info/30 bg-info/5 p-3">
            <p className="text-sm font-medium text-info flex items-center gap-2">
              📋 {existingDocuments.length} previous version{existingDocuments.length !== 1 ? 's' : ''} found
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              This will be saved as version {existingDocuments.length + 1} (uploaded {new Date().toLocaleDateString('en-GB')})
            </p>
          </div>
        )}
      </div>

      {/* Register Button */}
      <Button 
        onClick={handleUpload} 
        disabled={uploading || !selectedFile || !documentName || !documentType} 
        className="w-full h-12 text-sm font-semibold rounded-xl gap-2"
      >
        <ShieldCheck className="h-4 w-4" />
        {uploading ? 'Registering...' : 'Register Compliance Document'}
      </Button>

      {/* Trust footer */}
      <div className="flex flex-col items-center gap-1 pt-1">
        <div className="flex items-center gap-4 flex-wrap justify-center">
          {['Expiry alerts enabled', 'Audit logged', 'Shareable with authorities'].map(item => (
            <span key={item} className="flex items-center gap-1 text-[11px]" style={{ color: 'hsl(var(--muted-foreground))' }}>
              <span className="text-green-600">✓</span> {item}
            </span>
          ))}
        </div>
      </div>

      {/* Privacy confirmation after successful upload */}
      {uploadMutation.isSuccess && (
        <div className="rounded-lg border border-success/30 bg-success/10 p-3 animate-fade-in">
          <p className="text-sm font-medium text-success flex items-center gap-2">
            <span>✓</span>
            Encrypted and stored securely. Only you can access this file.
          </p>
        </div>
      )}
    </div>
  );
};

export default DocumentUpload;
