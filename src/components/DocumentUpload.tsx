import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { Upload, FileText, Info } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';

const documentTypes = [
  { id: 'safety', name: 'Safety Documents', description: 'Safety certificates, risk assessments' },
  { id: 'maintenance', name: 'Maintenance Records', description: 'Service records, repairs' },
  { id: 'inspection', name: 'Inspection Certificates', description: 'Annual inspections, certifications' },
  { id: 'manual', name: 'Operation Manuals', description: 'User manuals, technical guides' },
  { id: 'insurance', name: 'Insurance Documents', description: 'Insurance certificates, policies' },
  { id: 'other', name: 'Other Documents', description: 'Miscellaneous documents' },
];

interface DocumentUploadProps {
  rideId?: string;
  isGlobal?: boolean;
  onUploadSuccess: () => void;
}

const DocumentUpload = ({ rideId, isGlobal = false, onUploadSuccess }: DocumentUploadProps) => {
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
        title: "Document uploaded successfully",
        description: `${documentName} has been uploaded`,
      });

      // Reset form
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
              <Info className="h-4 w-4 text-muted-foreground" />
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
            <Label htmlFor="type">Document Type *</Label>
            <Select value={documentType} onValueChange={setDocumentType} disabled={uploading}>
              <SelectTrigger>
                <SelectValue placeholder="Select document type" />
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

          <div className="space-y-2">
            <Label htmlFor="expiry">Expiry Date (Optional)</Label>
            <Input
              id="expiry"
              type="date"
              value={expiryDate}
              onChange={(e) => setExpiryDate(e.target.value)}
              disabled={uploading}
            />
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="notes">Notes (Optional)</Label>
          <Textarea
            id="notes"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Additional notes about this document"
            disabled={uploading}
          />
        </div>

        <Button 
          onClick={handleUpload} 
          disabled={!selectedFile || !documentType || !documentName || uploading}
          className="w-full"
        >
          {uploading ? 'Uploading...' : 'Upload Document'}
        </Button>
      </CardContent>
    </Card>
  );
};

export default DocumentUpload;