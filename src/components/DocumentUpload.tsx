import { useState, useEffect, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { FileText, Camera, FolderOpen, Globe2 } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { compressImage } from '@/utils/imageCompression';
import { EmptyState } from '@/components/EmptyState';
import { useOptimisticDocumentUpload } from '@/hooks/useOptimisticMutations';

// Simplified showmen-friendly categories
const DOCUMENT_CATEGORIES = {
  'Inspection / Test': [
    { id: 'declaration_of_compliance', name: 'Annual Inspection Certificate' },
    { id: 'electrical_inspection', name: 'Electrical Inspection' },
    { id: 'inservice_inspection', name: 'In-Service Inspection' },
    { id: 'initial_test_report', name: 'Initial Test Report' },
    { id: 'ndt_report', name: 'NDT Report' },
    { id: 'daily_check', name: 'Daily Check Record' },
    { id: 'monthly_check', name: 'Monthly Check Record' },
    { id: 'yearly_check', name: 'Yearly Check Record' },
  ],
  'Insurance & Certificates': [
    { id: 'insurance', name: 'Insurance Document', suggestGlobal: true },
    { id: 'safety_certificate', name: 'Safety Certificate' },
    { id: 'doc_certificate', name: 'Declaration of Conformity' },
    { id: 'pssr_certificate', name: 'PSSR Certificate' },
    { id: 'loler_certificate', name: 'LOLER Certificate' },
    { id: 'puwer_certificate', name: 'PUWER Certificate' },
    { id: 'certificate', name: 'Other Certificate' },
  ],
  'Manual / Procedure': [
    { id: 'operator_manual', name: 'Operator Manual' },
    { id: 'controller_manual', name: 'Controller Manual' },
    { id: 'build_up_down', name: 'Build Up & Down Procedure' },
    { id: 'emergency_action_plan', name: 'Emergency Action Plan' },
    { id: 'evacuation_plan', name: 'Evacuation Plan' },
    { id: 'risk_assessment', name: 'Risk Assessment' },
    { id: 'method_statement', name: 'Method Statement' },
  ],
  'Maintenance': [
    { id: 'maintenance_report', name: 'Maintenance Report' },
    { id: 'maintenance_log', name: 'Maintenance Log' },
  ],
  'Other': [
    { id: 'design_review', name: 'Design Review Report' },
    { id: 'conformity_design', name: 'Conformity to Design' },
    { id: 'ndt_schedule', name: 'NDT Schedule' },
    { id: 'other', name: 'Other Document' },
  ],
};

// Flatten for select dropdown
const getDocumentTypes = () => {
  const types: Array<{ id: string; name: string; category: string; suggestGlobal?: boolean }> = [];
  Object.entries(DOCUMENT_CATEGORIES).forEach(([category, items]) => {
    items.forEach(item => {
      types.push({ ...item, category });
    });
  });
  return types;
};

// Auto-expiry categories (insurance, certificates)
const AUTO_REPEAT_TYPES = new Set(['insurance', 'safety_certificate', 'doc_certificate', 'pssr_certificate', 'loler_certificate', 'puwer_certificate', 'certificate', 'declaration_of_compliance']);

interface DocumentUploadProps {
  rideId?: string;
  rideName?: string;
  onUploadSuccess: () => void;
  prefillDocType?: string;
  prefillDocName?: string;
  replacingDocumentId?: string;
}

const DocumentUpload = ({ rideId, rideName, onUploadSuccess, prefillDocType, prefillDocName, replacingDocumentId }: DocumentUploadProps) => {
  const { user } = useAuth();
  const { toast } = useToast();
  const uploadMutation = useOptimisticDocumentUpload();
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [documentType, setDocumentType] = useState(prefillDocType || '');
  const [documentName, setDocumentName] = useState(prefillDocName || '');
  const [expiryDate, setExpiryDate] = useState('');
  const [notes, setNotes] = useState('');
  const [uploading, setUploading] = useState(false);
  const [existingDocuments, setExistingDocuments] = useState<any[]>([]);
  const [isGlobal, setIsGlobal] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);

  const documentTypes = getDocumentTypes();

  useEffect(() => {
    if (documentName && documentType && user) {
      loadExistingDocuments();
    }
  }, [documentName, documentType, rideId, user]);

  // Auto-suggest global for insurance documents
  useEffect(() => {
    const selectedType = documentTypes.find(t => t.id === documentType);
    if (selectedType?.suggestGlobal && !rideId) {
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
        description: "Please select a file, type, and name",
        variant: "destructive",
      });
      return;
    }

    setUploading(true);

    const autoVersionNumber = existingDocuments.length > 0 
      ? `${existingDocuments.length + 1}.0` 
      : '1.0';

    // Auto-enable repeat annually for insurance/certificate types with expiry
    const repeatAnnually = expiryDate ? AUTO_REPEAT_TYPES.has(documentType) : false;

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
        replacingDocumentId: replacingDocumentId || null,
        repeatAnnually,
      },
      {
        onSuccess: async () => {
          // If replacing, mark old doc as not latest
          if (replacingDocumentId) {
            await supabase
              .from('documents')
              .update({ is_latest_version: false })
              .eq('id', replacingDocumentId);
          }

          setSelectedFile(null);
          setDocumentType('');
          setDocumentName('');
          setExpiryDate('');
          setNotes('');
          setIsGlobal(false);
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
    <div className="space-y-5">
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
        <div className="flex items-center gap-3 px-4 py-3 rounded-xl bg-primary/6 border border-primary/15 shadow-sm">
          <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
            <FileText className="h-4 w-4 text-primary" />
          </div>
          <div className="min-w-0">
            <p className="text-[10px] font-semibold uppercase tracking-widest text-primary/60">Uploading for</p>
            <p className="text-sm font-bold truncate text-foreground">{rideName}</p>
          </div>
        </div>
      )}

      {/* Replacing banner */}
      {replacingDocumentId && prefillDocName && (
        <div className="flex items-center gap-2.5 px-4 py-3 rounded-xl bg-warning/10 border border-warning/30 shadow-sm">
          <p className="text-xs font-medium text-warning-foreground">
            Replacing <strong>{prefillDocName}</strong> — the old version will be archived.
          </p>
        </div>
      )}

      {/* Upload Method Cards */}
      {!selectedFile ? (
        <div className="grid grid-cols-2 gap-3">
          <button
            type="button"
            className="h-[120px] flex flex-col items-center justify-center gap-3 rounded-2xl border-2 border-foreground/8 bg-card shadow-[0_2px_8px_rgba(15,23,42,0.04)] transition-all active:scale-[0.97] hover:border-primary/30 hover:shadow-md disabled:opacity-50"
            onClick={() => cameraInputRef.current?.click()}
            disabled={uploading}
          >
            <div className="w-12 h-12 rounded-xl flex items-center justify-center bg-primary/8 border border-primary/15">
              <Camera className="h-5.5 w-5.5 text-primary" strokeWidth={2} />
            </div>
            <span className="text-sm font-bold tracking-tight text-foreground">Take Photo</span>
          </button>
          <button
            type="button"
            className="h-[120px] flex flex-col items-center justify-center gap-3 rounded-2xl border-2 border-foreground/8 bg-card shadow-[0_2px_8px_rgba(15,23,42,0.04)] transition-all active:scale-[0.97] hover:border-primary/30 hover:shadow-md disabled:opacity-50"
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
          >
            <div className="w-12 h-12 rounded-xl flex items-center justify-center bg-primary/8 border border-primary/15">
              <FolderOpen className="h-5.5 w-5.5 text-primary" strokeWidth={2} />
            </div>
            <span className="text-sm font-bold tracking-tight text-foreground">Choose File</span>
          </button>
        </div>
      ) : (
        <div 
          className="relative rounded-xl p-4 cursor-pointer transition-all border-2 border-success/40 bg-success/5 shadow-sm active:scale-[0.98]"
          onClick={() => {
            setSelectedFile(null);
            if (fileInputRef.current) fileInputRef.current.value = '';
            if (cameraInputRef.current) cameraInputRef.current.value = '';
          }}
        >
          <div className="flex items-center gap-3.5">
            {selectedFile.type.startsWith('image/') ? (
              <img
                src={URL.createObjectURL(selectedFile)}
                alt="Preview"
                className="h-14 w-14 rounded-xl object-cover border-2 border-success/30 shadow-sm"
                onLoad={(e) => URL.revokeObjectURL((e.target as HTMLImageElement).src)}
              />
            ) : (
              <div className="h-14 w-14 rounded-xl flex items-center justify-center bg-success/10 border border-success/20">
                <FileText className="h-7 w-7 text-success" />
              </div>
            )}
            <div className="flex-1 min-w-0">
              <p className="text-sm font-bold truncate text-foreground">{selectedFile.name}</p>
              <p className="text-xs text-muted-foreground mt-0.5">{(selectedFile.size / 1024 / 1024).toFixed(2)} MB</p>
              <p className="text-xs font-semibold mt-1 text-success">✓ Ready · Tap to change</p>
            </div>
          </div>
        </div>
      )}

      {/* Divider */}
      <div className="relative">
        <div className="absolute inset-0 flex items-center">
          <div className="w-full border-t border-foreground/8" />
        </div>
        <div className="relative flex justify-center">
          <span className="bg-background px-3 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">Details</span>
        </div>
      </div>

      {/* Form Fields */}
      <div className="space-y-4">
        {/* Document Type */}
        <div className="space-y-1.5">
          <Label className="text-xs font-bold uppercase tracking-wider text-foreground/70">Document Type</Label>
          <Select value={documentType} onValueChange={setDocumentType} disabled={uploading}>
            <SelectTrigger className="h-12 border-foreground/15 shadow-[inset_0_1px_3px_rgba(0,0,0,0.04)] font-medium">
              <SelectValue placeholder="What type of document?" />
            </SelectTrigger>
            <SelectContent className="max-h-80">
              {Object.entries(DOCUMENT_CATEGORIES).map(([category, items]) => (
                <div key={category}>
                  <div className="px-2 py-1.5 text-[11px] font-bold uppercase tracking-wider text-muted-foreground bg-muted/60 sticky top-0 border-b border-border/50">
                    {category}
                  </div>
                  {items.map((item) => (
                    <SelectItem key={item.id} value={item.id} className="pl-4">
                      {item.name}
                    </SelectItem>
                  ))}
                </div>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Document Name */}
        <div className="space-y-1.5">
          <Label className="text-xs font-bold uppercase tracking-wider text-foreground/70">Document Name</Label>
          <Input
            value={documentName}
            onChange={(e) => setDocumentName(e.target.value)}
            placeholder="e.g., Annual Inspection 2026"
            disabled={uploading}
            className="h-12 border-foreground/15 shadow-[inset_0_1px_3px_rgba(0,0,0,0.04)] font-medium"
          />
        </div>

        {/* Expiry Date */}
        <div className="space-y-2 rounded-xl p-3.5 bg-muted/30 border border-foreground/8">
          <Label className="text-xs font-bold uppercase tracking-wider text-foreground/70">Expiry Date <span className="normal-case font-normal text-muted-foreground">(if applicable)</span></Label>
          <Input
            type="date"
            value={expiryDate}
            onChange={(e) => setExpiryDate(e.target.value)}
            disabled={uploading}
            className={`h-12 border-foreground/15 shadow-[inset_0_1px_3px_rgba(0,0,0,0.04)] font-medium ${!expiryDate ? 'text-muted-foreground' : ''}`}
          />
          <p className="text-[11px] text-muted-foreground flex items-center gap-1">
            <span className="text-primary">●</span> You'll get a reminder before it expires.
          </p>
        </div>

        {/* Notes */}
        <div className="space-y-1.5">
          <Label className="text-xs font-bold uppercase tracking-wider text-foreground/70">Notes <span className="normal-case font-normal text-muted-foreground">(optional)</span></Label>
          <Input
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="e.g., Inspector name, reference number"
            disabled={uploading}
            className="h-12 border-foreground/15 shadow-[inset_0_1px_3px_rgba(0,0,0,0.04)] font-medium"
          />
        </div>

        {/* Document Scope Selection */}
        <div className="space-y-2">
          <Label className="text-xs font-bold uppercase tracking-wider text-foreground/70">Document Scope</Label>
          <div 
            className={`flex items-center gap-3 p-3.5 rounded-xl border-2 transition-all cursor-pointer shadow-sm ${
              isGlobal 
                ? 'border-primary/40 bg-primary/5 shadow-primary/5' 
                : 'border-foreground/8 hover:border-primary/20 bg-card'
            }`}
            onClick={() => setIsGlobal(!isGlobal)}
          >
            <Checkbox
              id="is-global"
              checked={isGlobal}
              onCheckedChange={(checked) => setIsGlobal(checked as boolean)}
              disabled={uploading}
            />
            <div className="w-8 h-8 rounded-lg bg-muted/60 flex items-center justify-center flex-shrink-0">
              <Globe2 className="h-4 w-4 text-muted-foreground" />
            </div>
            <div className="flex-1 min-w-0">
              <Label htmlFor="is-global" className="text-sm font-bold cursor-pointer text-foreground">
                {isGlobal ? 'Global — shared across all equipment' : 'This ride only'}
              </Label>
              <p className="text-[11px] text-muted-foreground mt-0.5">
                {isGlobal 
                  ? 'Shared document such as insurance or company-wide compliance documents'
                  : 'Only applies to this specific piece of equipment'}
              </p>
            </div>
          </div>
        </div>

        {/* Existing versions info */}
        {existingDocuments.length > 0 && (
          <div className="rounded-xl border border-primary/20 bg-primary/5 p-3.5 shadow-sm">
            <p className="text-sm font-bold text-primary">
              {existingDocuments.length} previous version{existingDocuments.length !== 1 ? 's' : ''} found
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              This will be saved as version {existingDocuments.length + 1}
            </p>
          </div>
        )}
      </div>

      {/* Upload Button */}
      <Button 
        onClick={handleUpload} 
        disabled={uploading || !selectedFile || !documentName || !documentType} 
        className="t-btn-primary w-full min-h-[48px] rounded-xl text-sm font-bold gap-2 tracking-tight shadow-lg"
      >
        <FileText className="h-4 w-4" />
        {uploading ? 'Uploading...' : replacingDocumentId ? 'Upload Replacement' : 'Upload Document'}
      </Button>
    </div>
  );
};

export default DocumentUpload;
