import { useState, useEffect, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Upload, FileText, Camera, FolderOpen } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { useTerminology } from '@/hooks/useTerminology';
import { compressImage } from '@/utils/imageCompression';
import { EmptyState } from '@/components/EmptyState';
import { useOptimisticDocumentUpload } from '@/hooks/useOptimisticMutations';

// Base document types - will be filtered/modified based on user's country
const getDocumentTypes = (isUK: boolean) => [
  // Safety Certificates - Featured at top
  { id: 'declaration_of_compliance', name: '📜 Safety Compliance Certificate', description: '⭐ REQUIRED - Your annual safety certificate to operate', featured: true, category: 'safety' },
  ...(isUK ? [
    { id: 'adips_certificate', name: '🇬🇧 ADIPS Certificate', description: 'ADIPS Declaration of Compliance for amusement devices', featured: true, category: 'safety', ukOnly: true },
    { id: 'pipa_certificate', name: '🇬🇧 PIPA Certificate', description: 'PIPA certificate for inflatable play equipment', featured: true, category: 'safety', ukOnly: true },
  ] : []),
  
  // Other document types
  { id: 'build_up_down', name: 'Build Up and Down Procedure', description: 'Procedures for ride assembly and dismantling' },
  { id: 'conformity_design', name: 'Conformity to Design', description: 'Design conformity certificates' },
  { id: 'controller_manual', name: 'Controller Manual', description: 'Control system manuals' },
  { id: 'design_review', name: 'Design Review', description: 'Design review documents' },
  { id: 'electrical_inspection', name: 'Electrical Inspection Report', description: 'Electrical safety inspection reports' },
  { id: 'emergency_action_plan', name: 'Emergency Action Plan', description: 'Emergency response and action procedures' },
  { id: 'evacuation_plan', name: 'Evacuation Plan', description: 'Evacuation procedures and plans' },
  { id: 'initial_test_report', name: 'Initial Test Report', description: 'Initial testing and commissioning reports' },
  { id: 'inservice_inspection', name: 'In-Service Inspection Report', description: 'Regular in-service inspection reports' },
  { id: 'insurance', name: '🛡️ Insurance Documents', description: '💼 Liability, employers, equipment insurance - Usually Global Documents', suggestGlobal: true },
  { id: 'method_statement', name: 'Method Statement', description: 'Work method statements and procedures' },
  { id: 'ndt_inspection', name: 'NDT Inspection Report', description: 'Non-destructive testing reports' },
  { id: 'ndt_schedule', name: 'NDT Schedule', description: 'Non-destructive testing schedules' },
  { id: 'operator_manual', name: 'Operator Manual', description: 'Operating manuals and instructions' },
  { id: 'other', name: 'Other Documents', description: 'Other document types' },
  { id: 'photo', name: 'Device Photo', description: 'Pictures of the ride for identification and sharing' },
  { id: 'risk_assessment', name: 'Risk Assessment', description: 'General, fire, confined space, working at height, design, and maturity risk assessments' },
];

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
  const [userVersioningEnabled, setUserVersioningEnabled] = useState(true);
  const [useVersionControl, setUseVersionControl] = useState(false);
  const [versionNumber, setVersionNumber] = useState('1.0');
  const [versionNotes, setVersionNotes] = useState('');
  const [existingDocuments, setExistingDocuments] = useState<any[]>([]);
  const [replacingDocumentId, setReplacingDocumentId] = useState<string | null>(null);
  const [isGlobal, setIsGlobal] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);

  // Fetch user's versioning preference
  useEffect(() => {
    const fetchVersioningPreference = async () => {
      if (!user) return;
      
      const { data } = await supabase
        .from('profiles')
        .select('enable_document_versioning')
        .eq('user_id', user.id)
        .maybeSingle();
      
      if (data) {
        setUserVersioningEnabled(data.enable_document_versioning ?? true);
      }
    };
    
    fetchVersioningPreference();
  }, [user]);

  // Early return: require ride unless it's a global document
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

  // Load existing documents with same name for version control
  useEffect(() => {
    if (documentName && useVersionControl) {
      loadExistingDocuments();
    }
  }, [documentName, useVersionControl, rideId]);

  const loadExistingDocuments = async () => {
    if (!user || !documentName) return;

    try {
      const { data, error } = await supabase
        .from('documents')
        .select('*')
        .eq('user_id', user.id)
        .eq('document_name', documentName)
        .eq('ride_id', rideId)
        .order('created_at', { ascending: false });

      if (!error && data) {
        setExistingDocuments(data);
        if (data.length > 0) {
          // Auto-increment version number
          const latestVersion = data[0].version_number || '1.0';
          const [major, minor = 0] = latestVersion.split('.').map(Number);
          setVersionNumber(`${major}.${minor + 1}`);
        }
      }
    } catch (error) {
      console.error('Error loading existing documents:', error);
    }
  };

  // Get document types based on user's country
  const documentTypes = getDocumentTypes(terminology.isUK);

  // Auto-suggest global for insurance documents
  useEffect(() => {
    const selectedType = documentTypes.find(t => t.id === documentType);
    if (selectedType && (selectedType as any).suggestGlobal && !rideId) {
      setIsGlobal(true);
    }
  }, [documentType, rideId, documentTypes]);

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      // Compress image if it's from camera (large image file)
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

    // Use optimistic mutation
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
        versionNumber: useVersionControl ? versionNumber : '1.0',
        versionNotes: useVersionControl ? versionNotes : undefined,
        replacingDocumentId,
      },
      {
        onSuccess: () => {
          // Reset form completely
          setSelectedFile(null);
          setDocumentType('');
          setDocumentName('');
          setExpiryDate('');
          setNotes('');
          setIsGlobal(false);
          setUseVersionControl(false);
          setVersionNumber('1.0');
          setVersionNotes('');
          setReplacingDocumentId(null);
          setExistingDocuments([]);
          
          // Clear the file input elements
          if (fileInputRef.current) {
            fileInputRef.current.value = '';
          }
          if (cameraInputRef.current) {
            cameraInputRef.current.value = '';
          }
          
          setUploading(false);
          onUploadSuccess();
        },
        onError: () => {
          setUploading(false);
        },
      }
    );
  };

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

      {/* Dual Upload Buttons */}
      {!selectedFile ? (
        <div className="grid grid-cols-2 gap-3">
          <Button
            type="button"
            variant="outline"
            className="h-28 flex flex-col items-center justify-center gap-3 border-2 border-dashed border-info/40 hover:border-info hover:bg-gradient-to-br hover:from-info/10 hover:to-primary/5 transition-all group"
            onClick={() => cameraInputRef.current?.click()}
            disabled={uploading}
          >
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-info/20 to-primary/10 group-hover:from-info group-hover:to-info/80 flex items-center justify-center transition-all">
              <Camera className="h-6 w-6 text-info group-hover:text-white transition-colors" />
            </div>
            <span className="text-sm font-medium">Take Photo</span>
          </Button>
          <Button
            type="button"
            variant="outline"
            className="h-28 flex flex-col items-center justify-center gap-3 border-2 border-dashed border-primary/40 hover:border-primary hover:bg-gradient-to-br hover:from-primary/10 hover:to-info/5 transition-all group"
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
          >
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-primary/20 to-info/10 group-hover:from-primary group-hover:to-primary/80 flex items-center justify-center transition-all">
              <FolderOpen className="h-6 w-6 text-primary group-hover:text-white transition-colors" />
            </div>
            <span className="text-sm font-medium">Choose File</span>
          </Button>
        </div>
      ) : (
        <div 
          className="relative border-2 border-success rounded-xl p-4 bg-gradient-to-r from-success/10 to-primary/5 cursor-pointer hover:from-success/15 hover:to-primary/10 transition-all shadow-sm"
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
                className="h-16 w-16 rounded-xl object-cover border-2 border-success/30 shadow-md"
                onLoad={(e) => URL.revokeObjectURL((e.target as HTMLImageElement).src)}
              />
            ) : (
              <div className="h-16 w-16 rounded-xl bg-gradient-to-br from-primary/20 to-info/20 border border-primary/20 flex items-center justify-center">
                <FileText className="h-8 w-8 text-primary" />
              </div>
            )}
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold truncate">{selectedFile.name}</p>
              <p className="text-xs text-muted-foreground">{(selectedFile.size / 1024 / 1024).toFixed(2)} MB</p>
              <p className="text-xs text-success font-medium mt-1 flex items-center gap-1">
                ✓ Ready to upload • Tap to change
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Form Fields */}
      <div className="space-y-3">
        {/* Document Type */}
        <div className="space-y-1.5">
          <Label className="text-xs font-medium text-muted-foreground">Type</Label>
          <Select value={documentType} onValueChange={setDocumentType} disabled={uploading}>
            <SelectTrigger className="h-11">
              <SelectValue placeholder="Select type..." />
            </SelectTrigger>
            <SelectContent>
              {/* Terminology Note - only show for UK users */}
              {terminology.isUK && (
                <div className="px-2 py-1.5 text-[11px] text-muted-foreground border-b mb-1">
                  🇬🇧 <strong>UK {terminology.operatorPlural}:</strong> ADIPS = rides, PIPA = inflatables
                </div>
              )}
              {documentTypes.map((type) => (
                <SelectItem key={type.id} value={type.id}>
                  <div className="flex flex-col">
                    <span className={(type as any).featured ? 'text-primary font-medium' : ''}>{type.name}</span>
                    {(type as any).ukOnly && (
                      <span className="text-[10px] text-muted-foreground">{type.description}</span>
                    )}
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Document Name */}
        <div className="space-y-1.5">
          <Label className="text-xs font-medium text-muted-foreground">Name</Label>
          <Input
            value={documentName}
            onChange={(e) => setDocumentName(e.target.value)}
            placeholder="e.g., Risk Assessment 2024"
            disabled={uploading}
            className="h-11"
          />
        </div>

        {/* Expiry & Notes Row */}
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label className="text-xs font-medium text-muted-foreground">Expires</Label>
            <Input
              type="date"
              value={expiryDate}
              onChange={(e) => setExpiryDate(e.target.value)}
              disabled={uploading}
              className="h-11"
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs font-medium text-muted-foreground">Notes</Label>
            <Input
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Optional..."
              disabled={uploading}
              className="h-11"
            />
          </div>
        </div>

        {/* Global Document Toggle */}
        <div 
          className={`flex items-center gap-3 p-4 rounded-xl border-2 transition-all cursor-pointer ${
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
          <div className="flex-1 min-w-0">
            <Label htmlFor="is-global" className="text-sm font-medium cursor-pointer flex items-center gap-2">
              🌐 Global Document
            </Label>
            <p className="text-[11px] text-muted-foreground">Applies to all rides</p>
          </div>
        </div>

        {/* Version Control - Collapsible */}
        {userVersioningEnabled && (
          <div 
            className={`rounded-lg border transition-colors ${
              useVersionControl ? 'border-primary/30 bg-primary/5' : 'border-border'
            }`}
          >
            <div 
              className="flex items-center gap-3 p-3 cursor-pointer"
              onClick={() => setUseVersionControl(!useVersionControl)}
            >
              <Checkbox
                checked={useVersionControl}
                onCheckedChange={(checked) => setUseVersionControl(checked as boolean)}
                disabled={uploading}
              />
              <div className="flex-1">
                <span className="text-sm font-medium">Version Control</span>
              </div>
            </div>
            
            {useVersionControl && (
              <div className="px-3 pb-3 space-y-3 border-t border-border/50 pt-3">
                {existingDocuments.length > 0 && (
                  <Select
                    value={replacingDocumentId || "new"}
                    onValueChange={(value) => setReplacingDocumentId(value === "new" ? null : value)}
                    disabled={uploading}
                  >
                    <SelectTrigger className="h-10">
                      <SelectValue placeholder="Replace existing..." />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="new">New document</SelectItem>
                      {existingDocuments.map((doc) => (
                        <SelectItem key={doc.id} value={doc.id}>
                          v{doc.version_number} ({new Date(doc.uploaded_at).toLocaleDateString()})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
                <div className="grid grid-cols-2 gap-2">
                  <Input
                    placeholder="Version"
                    value={versionNumber}
                    onChange={(e) => setVersionNumber(e.target.value)}
                    disabled={uploading}
                    className="h-10"
                  />
                  <Input
                    placeholder="What changed"
                    value={versionNotes}
                    onChange={(e) => setVersionNotes(e.target.value)}
                    disabled={uploading}
                    className="h-10"
                  />
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Upload Button */}
      <Button 
        onClick={handleUpload} 
        disabled={uploading || !selectedFile || !documentName || !documentType} 
        className="w-full h-12 text-base"
      >
        <Upload className="mr-2 h-5 w-5" />
        {uploading ? 'Uploading...' : 'Upload'}
      </Button>
    </div>
  );
};

export default DocumentUpload;
