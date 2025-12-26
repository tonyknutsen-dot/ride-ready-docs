import { useState, useEffect, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Upload, FileText } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';

const documentTypes = [
  { id: 'doc', name: '📜 DOC Certificate (Declaration of Compliance)', description: '⭐ REQUIRED - Your single-sheet certificate to operate in the UK', featured: true },
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
  const { toast } = useToast();
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
      <div className="p-4 rounded-lg border border-dashed text-center text-sm text-muted-foreground">
        Pick a ride first to add a document, or check "Global Document" below.
      </div>
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

  // Auto-suggest global for insurance documents
  useEffect(() => {
    const selectedType = documentTypes.find(t => t.id === documentType);
    if (selectedType && (selectedType as any).suggestGlobal && !rideId) {
      setIsGlobal(true);
    }
  }, [documentType, rideId]);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setSelectedFile(file);
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

    try {
      // Create file path: userId/rideId/filename or userId/global/filename for global docs
      const fileExt = selectedFile.name.split('.').pop();
      const fileName = `${Date.now()}-${selectedFile.name}`;
      const filePath = isGlobal 
        ? `${user.id}/global/${fileName}`
        : `${user.id}/${rideId}/${fileName}`;

      // Upload file to Supabase Storage
      const { error: uploadError } = await supabase.storage
        .from('ride-documents')
        .upload(filePath, selectedFile);

      if (uploadError) {
        throw uploadError;
      }

      // Save document metadata to database
      const documentData: any = {
        user_id: user.id,
        ride_id: isGlobal ? null : rideId,
        document_name: documentName,
        document_type: documentType,
        file_path: filePath,
        file_size: selectedFile.size,
        mime_type: selectedFile.type,
        is_global: isGlobal,
        expires_at: expiryDate || null,
        notes: notes || null,
        version_number: useVersionControl ? versionNumber : '1.0',
        is_latest_version: true,
        version_notes: useVersionControl ? versionNotes : null,
        replaced_document_id: replacingDocumentId,
      };

      const { error: dbError } = await supabase
        .from('documents')
        .insert(documentData);

      if (dbError) {
        throw dbError;
      }

      // If this is a version update, mark the old document as not latest
      if (replacingDocumentId) {
        await supabase
          .from('documents')
          .update({ is_latest_version: false })
          .eq('id', replacingDocumentId);
      }

      toast({
        title: isGlobal ? "Global document saved" : `Saved to ${rideName || 'this ride'}`,
        description: "View files →",
      });

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
      
      // Clear the file input element
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
      
      onUploadSuccess();

    } catch (error: any) {
      console.error('Upload error:', error);
      toast({
        title: "Upload failed",
        description: error.message || "Failed to upload document",
        variant: "destructive",
      });
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* File Drop Zone */}
      <div 
        className={`relative border-2 border-dashed rounded-lg p-6 text-center transition-colors cursor-pointer hover:border-primary/50 hover:bg-muted/30 active:scale-[0.99] ${
          selectedFile ? 'border-primary bg-primary/5' : 'border-muted-foreground/25'
        }`}
        onClick={() => fileInputRef.current?.click()}
      >
        <Input
          ref={fileInputRef}
          id="file"
          type="file"
          onChange={handleFileSelect}
          accept={documentType === 'photo'
            ? 'image/*'
            : '.pdf,.doc,.docx,.jpg,.jpeg,.png,.xlsx,.xls,.txt,.csv,.zip,.rar,.mp4,.mov,.avi,.tiff,.tif,.bmp,.gif,.ppt,.pptx,.dwg,.dxf'}
          // @ts-ignore - capture attribute opens camera on mobile
          capture={documentType === 'photo' ? 'environment' : undefined}
          disabled={uploading}
          className="hidden"
        />
        
        {selectedFile ? (
          <div className="flex items-center justify-center gap-3">
            {selectedFile.type.startsWith('image/') ? (
              <img
                src={URL.createObjectURL(selectedFile)}
                alt="Preview"
                className="h-12 w-12 rounded-lg object-cover"
                onLoad={(e) => URL.revokeObjectURL((e.target as HTMLImageElement).src)}
              />
            ) : (
              <div className="h-12 w-12 rounded-lg bg-muted flex items-center justify-center">
                <FileText className="h-6 w-6 text-muted-foreground" />
              </div>
            )}
            <div className="text-left">
              <p className="text-sm font-medium truncate max-w-[200px]">{selectedFile.name}</p>
              <p className="text-xs text-muted-foreground">{(selectedFile.size / 1024 / 1024).toFixed(2)} MB</p>
            </div>
          </div>
        ) : (
          <>
            <Upload className="h-8 w-8 mx-auto text-muted-foreground/50 mb-2" />
            <p className="text-sm font-medium">Tap to select file</p>
            <p className="text-xs text-muted-foreground mt-1">PDF, images, documents</p>
          </>
        )}
      </div>

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
              {documentTypes.map((type) => (
                <SelectItem key={type.id} value={type.id}>
                  <span className={(type as any).featured ? 'text-primary font-medium' : ''}>{type.name}</span>
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
          className={`flex items-center gap-3 p-3 rounded-lg border transition-colors cursor-pointer ${
            isGlobal ? 'border-primary bg-primary/5' : 'border-border hover:bg-muted/30'
          }`}
          onClick={() => setIsGlobal(!isGlobal)}
        >
          <Checkbox
            id="is-global"
            checked={isGlobal}
            onCheckedChange={(checked) => setIsGlobal(checked as boolean)}
            disabled={uploading}
          />
          <div className="flex-1 min-w-0">
            <Label htmlFor="is-global" className="text-sm font-medium cursor-pointer">
              Global Document
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
