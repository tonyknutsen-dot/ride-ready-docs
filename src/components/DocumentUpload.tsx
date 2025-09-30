import { useState, useEffect, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Upload, FileText, Info } from 'lucide-react';
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
  isGlobal?: boolean;
  onUploadSuccess: () => void;
}

const DocumentUpload = ({ rideId, rideName, isGlobal = false, onUploadSuccess }: DocumentUploadProps) => {
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

  // Load existing documents with same name for version control
  useEffect(() => {
    if (documentName && useVersionControl) {
      loadExistingDocuments();
    }
  }, [documentName, useVersionControl, rideId, isGlobal]);

  const loadExistingDocuments = async () => {
    if (!user || !documentName) return;

    try {
      const { data, error } = await supabase
        .from('documents')
        .select('*')
        .eq('user_id', user.id)
        .eq('document_name', documentName)
        .eq('is_global', isGlobal)
        .eq('ride_id', isGlobal ? null : rideId)
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
      // Create file path: userId/rideId/filename or userId/global/filename
      const folder = isGlobal ? 'global' : rideId;
      const fileExt = selectedFile.name.split('.').pop();
      const fileName = `${Date.now()}-${selectedFile.name}`;
      const filePath = `${user.id}/${folder}/${fileName}`;

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
        <CardTitle className="flex items-center space-x-2">
          <Upload className="h-5 w-5" />
          <span>Upload {isGlobal ? 'Global' : 'Ride'} Document</span>
        </CardTitle>
        <CardDescription>
          {isGlobal 
            ? 'Upload documents that apply to all your rides' 
            : 'Upload documents specific to this ride'
          }
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="file">Select File *</Label>
            <Input
              ref={fileInputRef}
              id="file"
              type="file"
              onChange={handleFileSelect}
              accept=".pdf,.doc,.docx,.jpg,.jpeg,.png,.xlsx,.xls,.txt,.csv,.zip,.rar,.mp4,.mov,.avi,.tiff,.tif,.bmp,.gif,.ppt,.pptx,.dwg,.dxf"
              disabled={uploading}
            />
            <p className="text-xs text-muted-foreground mt-1">
              Supported: PDF, Word, Excel, PowerPoint, Images (JPG, PNG, TIFF, BMP, GIF), 
              Video (MP4, MOV, AVI), CAD files (DWG, DXF), Archives (ZIP, RAR), Text files
            </p>
            {selectedFile && (
              <p className="text-sm text-muted-foreground">
                {selectedFile.name} ({(selectedFile.size / 1024 / 1024).toFixed(2)} MB)
              </p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="name">Document Name *</Label>
            <Input
              id="name"
              value={documentName}
              onChange={(e) => setDocumentName(e.target.value)}
              placeholder="Enter document name"
              disabled={uploading}
            />
          </div>
        </div>

        {/* Version Control Section */}
        <div className="space-y-4 border rounded-lg p-4 bg-muted/50">
          <div className="flex items-center space-x-2">
            <Checkbox 
              id="version-control" 
              checked={useVersionControl}
              onCheckedChange={(checked) => setUseVersionControl(checked as boolean)}
              disabled={uploading}
            />
            <Label htmlFor="version-control" className="flex items-center space-x-2">
              <span>Enable version control</span>
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Info className="h-4 w-4 text-muted-foreground cursor-help" />
                  </TooltipTrigger>
                  <TooltipContent className="max-w-xs">
                    <p>Version control lets you upload newer versions of the same document while keeping track of previous versions. This is useful for documents that get updated regularly, like risk assessments or manuals.</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </Label>
          </div>
          
          {useVersionControl && (
            <div className="space-y-4 ml-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="version">Version Number</Label>
                  <Input
                    id="version"
                    value={versionNumber}
                    onChange={(e) => setVersionNumber(e.target.value)}
                    placeholder="e.g., 1.0, 2.1"
                    disabled={uploading}
                  />
                </div>
                
                {existingDocuments.length > 0 && (
                  <div className="space-y-2">
                    <Label htmlFor="replacing">Replacing Document</Label>
                    <Select value={replacingDocumentId || ''} onValueChange={setReplacingDocumentId} disabled={uploading}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select document to replace" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="">None (New document)</SelectItem>
                        {existingDocuments.map((doc) => (
                          <SelectItem key={doc.id} value={doc.id}>
                            Version {doc.version_number} - {new Date(doc.created_at).toLocaleDateString()}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="version-notes">Version Notes</Label>
                <Textarea
                  id="version-notes"
                  value={versionNotes}
                  onChange={(e) => setVersionNotes(e.target.value)}
                  placeholder="What changed in this version?"
                  disabled={uploading}
                />
              </div>
              
              {existingDocuments.length > 0 && (
                <div className="text-sm text-muted-foreground">
                  <p className="font-medium">Existing versions:</p>
                  <ul className="list-disc list-inside ml-2">
                    {existingDocuments.slice(0, 3).map((doc) => (
                      <li key={doc.id}>
                        Version {doc.version_number} - {new Date(doc.created_at).toLocaleDateString()}
                        {doc.is_latest_version && ' (Current)'}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="type" className="text-base font-semibold">What is this? *</Label>
            <div className="flex gap-2">
              <div className="flex-1">
                <Select value={documentType} onValueChange={setDocumentType} disabled={uploading}>
                  <SelectTrigger className="h-11 text-base">
                    <SelectValue placeholder="Risk Assessment, Insurance, Certificate..." />
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
              </div>
              <RequestDocumentTypeDialog />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="expiry" className="text-base font-semibold">Expiry Date (Optional)</Label>
            <Input
              id="expiry"
              type="date"
              value={expiryDate}
              onChange={(e) => setExpiryDate(e.target.value)}
              disabled={uploading}
              className="h-11 text-base"
            />
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="notes" className="text-base font-semibold">Notes (Optional)</Label>
          <Textarea
            id="notes"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Additional notes about this document"
            disabled={uploading}
            className="text-base"
          />
        </div>

        {/* Version Control Section - Collapsed */}
        <div className="space-y-4 border rounded-lg p-4 bg-muted/50">
          <div className="flex items-center space-x-2">
            <Checkbox 
              id="version-control" 
              checked={useVersionControl}
              onCheckedChange={(checked) => setUseVersionControl(checked as boolean)}
              disabled={uploading}
            />
            <Label htmlFor="version-control" className="flex items-center space-x-2 text-base font-semibold">
              <span>Track versions (optional)</span>
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Info className="h-4 w-4 text-muted-foreground cursor-help" />
                  </TooltipTrigger>
                  <TooltipContent className="max-w-xs">
                    <p>Version control lets you upload newer versions of the same document while keeping track of previous versions. This is useful for documents that get updated regularly, like risk assessments or manuals.</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </Label>
          </div>
          
          {useVersionControl && (
            <div className="space-y-4 ml-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="version" className="text-base font-semibold">Version Number</Label>
                  <Input
                    id="version"
                    value={versionNumber}
                    onChange={(e) => setVersionNumber(e.target.value)}
                    placeholder="e.g., 1.0, 2.1"
                    disabled={uploading}
                    className="h-11 text-base"
                  />
                </div>
                
                {existingDocuments.length > 0 && (
                  <div className="space-y-2">
                    <Label htmlFor="replacing" className="text-base font-semibold">Replacing Document</Label>
                    <Select value={replacingDocumentId || ''} onValueChange={setReplacingDocumentId} disabled={uploading}>
                      <SelectTrigger className="h-11 text-base">
                        <SelectValue placeholder="Select document to replace" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="">None (New document)</SelectItem>
                        {existingDocuments.map((doc) => (
                          <SelectItem key={doc.id} value={doc.id}>
                            Version {doc.version_number} - {new Date(doc.created_at).toLocaleDateString()}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="version-notes" className="text-base font-semibold">Version Notes</Label>
                <Textarea
                  id="version-notes"
                  value={versionNotes}
                  onChange={(e) => setVersionNotes(e.target.value)}
                  placeholder="What changed in this version?"
                  disabled={uploading}
                  className="text-base"
                />
              </div>
              
              {existingDocuments.length > 0 && (
                <div className="text-sm text-muted-foreground">
                  <p className="font-medium">Existing versions:</p>
                  <ul className="list-disc list-inside ml-2">
                    {existingDocuments.slice(0, 3).map((doc) => (
                      <li key={doc.id}>
                        Version {doc.version_number} - {new Date(doc.created_at).toLocaleDateString()}
                        {doc.is_latest_version && ' (Current)'}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}
        </div>

        <Button 
          onClick={handleUpload} 
          disabled={!selectedFile || !documentType || !documentName || uploading}
          className="w-full btn-bold-primary"
        >
          {uploading ? 'Uploading...' : 'Upload'}
        </Button>
      </CardContent>
    </Card>
  );
};

export default DocumentUpload;