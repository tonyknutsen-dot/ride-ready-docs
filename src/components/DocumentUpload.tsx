import { useState, useEffect, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Upload, Info, FileText } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import RequestDocumentTypeDialog from './RequestDocumentTypeDialog';

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
  { id: 'insurance', name: 'Insurance Documents', description: 'Insurance certificates and policies' },
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
      <Card>
        <CardContent className="py-6">
          <div className="text-sm">Pick a ride first to add a document, or check the "Global Document" option below.</div>
        </CardContent>
      </Card>
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
    <Card className="shadow-sm">
      <CardHeader className="space-y-1 pb-4">
        <CardTitle className="text-xl">Upload Document</CardTitle>
        <CardDescription className="text-sm">
          {isGlobal 
            ? 'Adding a global document (applies to all equipment)'
            : `Adding to: ${rideName || 'this ride'}`
          }
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">
        {/* Document Type & File Selection - Side by side on desktop */}
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="type" className="text-sm font-medium">Document Type *</Label>
            <Select value={documentType} onValueChange={setDocumentType} disabled={uploading}>
              <SelectTrigger className="h-10">
                <SelectValue placeholder="Select document type..." />
              </SelectTrigger>
              <SelectContent>
                {documentTypes.map((type) => (
                  <SelectItem key={type.id} value={type.id}>
                    <div className={(type as any).featured ? 'py-1' : ''}>
                      <div className={`font-medium ${(type as any).featured ? 'text-primary' : ''}`}>{type.name}</div>
                      <div className={`text-xs ${(type as any).featured ? 'text-primary/70 font-medium' : 'text-muted-foreground'}`}>{type.description}</div>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button
              type="button"
              variant="link"
              size="sm"
              onClick={() => {}}
              className="p-0 h-auto text-xs text-muted-foreground hover:text-primary"
            >
              Don't see your type? Request one
            </Button>
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="file" className="text-sm font-medium">Select File *</Label>
            <div className="flex flex-col gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => fileInputRef.current?.click()}
                disabled={uploading}
                className="w-full justify-start gap-2 h-auto py-3"
              >
                <Upload className="h-4 w-4" />
                <span className="flex-1 text-left truncate">
                  {selectedFile ? selectedFile.name : 'Choose a file...'}
                </span>
              </Button>
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
            </div>
            {documentType === 'photo' && (
              <p className="text-xs text-muted-foreground">
                Tip: Take a clear photo of the whole device and ID plate
              </p>
            )}
          </div>
        </div>

        {/* File Preview */}
        {selectedFile && (
          <div className="rounded-lg border bg-muted/30 p-4">
            <div className="flex items-start gap-3">
              {selectedFile.type.startsWith('image/') && documentType === 'photo' ? (
                <img
                  src={URL.createObjectURL(selectedFile)}
                  alt="Preview"
                  className="h-16 w-16 rounded border object-cover"
                  onLoad={(e) => URL.revokeObjectURL((e.target as HTMLImageElement).src)}
                />
              ) : (
                <div className="flex h-16 w-16 items-center justify-center rounded border bg-background">
                  <FileText className="h-8 w-8 text-muted-foreground" />
                </div>
              )}
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{selectedFile.name}</p>
                <p className="text-xs text-muted-foreground">{(selectedFile.size / 1024 / 1024).toFixed(2)} MB</p>
              </div>
            </div>
          </div>
        )}

        {/* Document Details */}
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="name" className="text-sm font-medium">Document Name *</Label>
            <Input
              id="name"
              value={documentName}
              onChange={(e) => setDocumentName(e.target.value)}
              placeholder="e.g., Risk Assessment 2024"
              disabled={uploading}
              className="h-10"
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="expiry" className="text-sm font-medium">Expiry Date (optional)</Label>
              <Input
                id="expiry"
                type="date"
                value={expiryDate}
                onChange={(e) => setExpiryDate(e.target.value)}
                disabled={uploading}
                className="h-10"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="notes" className="text-sm font-medium">Notes (optional)</Label>
              <Textarea
                id="notes"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Additional notes..."
                disabled={uploading}
                rows={1}
                className="resize-none"
              />
            </div>
          </div>
        </div>

        {/* Global Document Checkbox */}
        <div className="space-y-3 pt-3 border-t">
          <div className="flex items-start gap-3">
            <Checkbox
              id="is-global"
              checked={isGlobal}
              onCheckedChange={(checked) => setIsGlobal(checked as boolean)}
              disabled={uploading}
            />
            <div className="space-y-1">
              <Label htmlFor="is-global" className="text-sm font-medium cursor-pointer">
                This is a Global Document
              </Label>
              <p className="text-xs text-muted-foreground leading-relaxed">
                Global documents apply to all your equipment (e.g., Public Liability Insurance covering all rides, 
                Showmen's Guild membership, business licenses). They'll appear at the top of every ride's document list.
              </p>
            </div>
          </div>
        </div>

        {/* Version Control - Only show if user has it enabled in settings */}
        {userVersioningEnabled && (
          <div className="space-y-3 pt-3 border-t">
            <div className="flex items-center justify-between">
              <Label htmlFor="version-toggle" className="text-sm font-medium cursor-pointer flex items-center gap-2">
                Version Control
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Info className="h-4 w-4 text-muted-foreground cursor-help" />
                    </TooltipTrigger>
                    <TooltipContent className="max-w-xs">
                      <p>Track document versions and keep history of previous versions</p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              </Label>
              <input
                id="version-toggle"
                type="checkbox"
                checked={useVersionControl}
                onChange={(e) => setUseVersionControl(e.target.checked)}
                disabled={uploading}
                className="w-4 h-4 cursor-pointer accent-primary"
              />
            </div>
            
            {useVersionControl && (
            <div className="space-y-3 pl-3 border-l-2 border-primary/20 mt-3">
              <p className="text-xs text-muted-foreground">
                Create a new version and mark previous versions as superseded
              </p>

              {existingDocuments.length > 0 && (
                <div className="space-y-2">
                  <Label className="text-sm font-medium">Replace Document</Label>
                  <Select
                    value={replacingDocumentId || "new"}
                    onValueChange={(value) => setReplacingDocumentId(value === "new" ? null : value)}
                    disabled={uploading}
                  >
                    <SelectTrigger className="h-9">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="new">Create as new document</SelectItem>
                      {existingDocuments.map((doc) => (
                        <SelectItem key={doc.id} value={doc.id}>
                          v{doc.version_number} ({new Date(doc.uploaded_at).toLocaleDateString()})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="version" className="text-sm">Version</Label>
                  <Input
                    id="version"
                    type="text"
                    placeholder="e.g., 2.0"
                    value={versionNumber}
                    onChange={(e) => setVersionNumber(e.target.value)}
                    disabled={uploading}
                    className="h-9"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="version-notes" className="text-sm">What Changed</Label>
                  <Input
                    id="version-notes"
                    placeholder="Brief description..."
                    value={versionNotes}
                    onChange={(e) => setVersionNotes(e.target.value)}
                    disabled={uploading}
                    className="h-9"
                  />
                </div>
              </div>
              </div>
            )}
          </div>
        )}

        {/* Upload Button */}
        <div className="flex gap-3 pt-2">
          <Button 
            onClick={handleUpload} 
            disabled={uploading || !selectedFile || !documentName || !documentType} 
            className="flex-1 sm:flex-none h-10"
          >
            <Upload className="mr-2 h-4 w-4" />
            {uploading ? 'Uploading...' : 'Upload Document'}
          </Button>
        </div>
      </CardContent>
      <RequestDocumentTypeDialog />
    </Card>
  );
};

export default DocumentUpload;
