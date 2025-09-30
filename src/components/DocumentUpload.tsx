import { useState, useEffect, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Upload, Info } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import RequestDocumentTypeDialog from './RequestDocumentTypeDialog';

const documentTypes = [
  { id: 'build_up_down', name: 'Build Up and Down Procedure', description: 'Procedures for ride assembly and dismantling' },
  { id: 'conformity_design', name: 'Conformity to Design', description: 'Design conformity certificates' },
  { id: 'controller_manual', name: 'Controller Manual', description: 'Control system manuals' },
  { id: 'design_review', name: 'Design Review', description: 'Design review documents' },
  { id: 'docs', name: 'DOCs', description: 'Department of Culture approval documents' },
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
  const [useVersionControl, setUseVersionControl] = useState(false);
  const [versionNumber, setVersionNumber] = useState('1.0');
  const [versionNotes, setVersionNotes] = useState('');
  const [existingDocuments, setExistingDocuments] = useState<any[]>([]);
  const [replacingDocumentId, setReplacingDocumentId] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Early return: require ride
  if (!rideId) {
    return (
      <Card>
        <CardContent className="pt-6 text-center space-y-4">
          <p className="text-muted-foreground">Pick a ride first to upload documents.</p>
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
      // Create file path: userId/rideId/filename
      const fileExt = selectedFile.name.split('.').pop();
      const fileName = `${Date.now()}-${selectedFile.name}`;
      const filePath = `${user.id}/${rideId}/${fileName}`;

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
        ride_id: rideId,
        document_name: documentName,
        document_type: documentType,
        file_path: filePath,
        file_size: selectedFile.size,
        mime_type: selectedFile.type,
        is_global: false,
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
        title: `Saved to ${rideName || 'your files'}`,
        description: "View files →",
      });

      // Reset form completely
      setSelectedFile(null);
      setDocumentType('');
      setDocumentName('');
      setExpiryDate('');
      setNotes('');
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
    <Card>
      <CardHeader>
        <CardTitle>You're adding a file to {rideName || 'this ride'}</CardTitle>
        <CardDescription>
          Upload documents for this ride. Supported formats: PDF, Word, Excel, Images (max 50MB).
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="space-y-2">
          <Label htmlFor="file" className="text-base font-semibold">Select File *</Label>
          <Input
            ref={fileInputRef}
            id="file"
            type="file"
            onChange={handleFileSelect}
            accept=".pdf,.doc,.docx,.jpg,.jpeg,.png,.xlsx,.xls,.txt,.csv,.zip,.rar,.mp4,.mov,.avi,.tiff,.tif,.bmp,.gif,.ppt,.pptx,.dwg,.dxf"
            disabled={uploading}
            className="h-11 text-base cursor-pointer"
          />
          <p className="text-xs text-muted-foreground mt-1">
            Supported: PDF, Word, Excel, PowerPoint, Images, Video, CAD files, Archives
          </p>
          {selectedFile && (
            <p className="text-sm text-muted-foreground">
              Selected: {selectedFile.name} ({(selectedFile.size / 1024 / 1024).toFixed(2)} MB)
            </p>
          )}
        </div>

        <div className="space-y-2">
          <Label htmlFor="name" className="text-base font-semibold">File name shown in your list *</Label>
          <Input
            id="name"
            value={documentName}
            onChange={(e) => setDocumentName(e.target.value)}
            placeholder="e.g., Risk Assessment 2024"
            disabled={uploading}
            className="h-11 text-base"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="type" className="text-base font-semibold">What is this? *</Label>
          <Select value={documentType} onValueChange={setDocumentType} disabled={uploading}>
            <SelectTrigger className="h-11 text-base">
              <SelectValue placeholder="Risk Assessment, Method Statement, Insurance, Certificate, Other" />
            </SelectTrigger>
            <SelectContent>
              {documentTypes.map((type) => (
                <SelectItem key={type.id} value={type.id}>
                  <div>
                    <div className="font-medium">{type.name}</div>
                    <div className="text-xs text-muted-foreground">{type.description}</div>
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
            className="p-0 h-auto text-xs"
          >
            Don't see your type? Request one
          </Button>
        </div>

        <div className="space-y-2">
          <Label htmlFor="expiry" className="text-base font-semibold">Expiry Date (optional)</Label>
          <Input
            id="expiry"
            type="date"
            value={expiryDate}
            onChange={(e) => setExpiryDate(e.target.value)}
            disabled={uploading}
            className="h-11 text-base"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="notes" className="text-base font-semibold">Notes (optional)</Label>
          <Textarea
            id="notes"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Additional notes about this document"
            disabled={uploading}
            rows={3}
            className="text-base"
          />
        </div>

        {/* Version Control - Collapsible */}
        <div className="space-y-3 pt-2 border-t">
          <div className="flex items-center justify-between">
            <Label htmlFor="version-toggle" className="text-base font-semibold cursor-pointer flex items-center gap-2">
              Track versions (optional)
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Info className="h-4 w-4 text-muted-foreground cursor-help" />
                  </TooltipTrigger>
                  <TooltipContent className="max-w-xs">
                    <p>Version control lets you upload newer versions of the same document while keeping track of previous versions.</p>
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
              className="w-5 h-5 cursor-pointer"
            />
          </div>
          
          {useVersionControl && (
            <div className="space-y-3 pl-4 border-l-2 border-muted">
              <p className="text-sm text-muted-foreground">
                This will create a new version and mark previous versions as superseded.
              </p>

              {existingDocuments.length > 0 && (
                <div className="space-y-2">
                  <Label className="text-sm font-medium">Replace existing document (optional)</Label>
                  <Select
                    value={replacingDocumentId || "new"}
                    onValueChange={(value) => setReplacingDocumentId(value === "new" ? null : value)}
                    disabled={uploading}
                  >
                    <SelectTrigger className="h-10">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="new">Create as new document</SelectItem>
                      {existingDocuments.map((doc) => (
                        <SelectItem key={doc.id} value={doc.id}>
                          Replace v{doc.version_number} (uploaded {new Date(doc.uploaded_at).toLocaleDateString()})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              <div className="space-y-2">
                <Label htmlFor="version" className="text-sm">Version Number</Label>
                <Input
                  id="version"
                  type="text"
                  placeholder="e.g., 1.0, 2.1"
                  value={versionNumber}
                  onChange={(e) => setVersionNumber(e.target.value)}
                  disabled={uploading}
                  className="h-10"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="version-notes" className="text-sm">Version Notes</Label>
                <Textarea
                  id="version-notes"
                  placeholder="What changed in this version?"
                  value={versionNotes}
                  onChange={(e) => setVersionNotes(e.target.value)}
                  disabled={uploading}
                  rows={2}
                />
              </div>
            </div>
          )}
        </div>

        <Button onClick={handleUpload} disabled={uploading} className="btn-bold-primary w-full md:w-auto">
          <Upload className="mr-2 h-4 w-4" />
          {uploading ? 'Uploading...' : 'Upload'}
        </Button>
      </CardContent>
      <RequestDocumentTypeDialog />
    </Card>
  );
};

export default DocumentUpload;
