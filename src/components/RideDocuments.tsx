import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Upload, FileText, Download, Trash2, Calendar, Shield, Wrench, BookOpen } from 'lucide-react';
import { Tables } from '@/integrations/supabase/types';
import { useToast } from '@/hooks/use-toast';

type Ride = Tables<'rides'> & {
  ride_categories: {
    name: string;
    description: string | null;
  };
};

interface RideDocumentsProps {
  ride: Ride;
}

const documentCategories = [
  { id: 'safety', name: 'Safety Documents', icon: Shield, color: 'bg-red-100 text-red-700' },
  { id: 'maintenance', name: 'Maintenance Records', icon: Wrench, color: 'bg-blue-100 text-blue-700' },
  { id: 'inspection', name: 'Inspection Certificates', icon: FileText, color: 'bg-green-100 text-green-700' },
  { id: 'manual', name: 'Operation Manuals', icon: BookOpen, color: 'bg-purple-100 text-purple-700' },
  { id: 'other', name: 'Other Documents', icon: FileText, color: 'bg-gray-100 text-gray-700' },
];

// Mock data for demonstration
const mockDocuments = [
  {
    id: '1',
    name: 'Annual Safety Inspection Certificate',
    category: 'inspection',
    uploadDate: '2024-01-15',
    expiryDate: '2025-01-15',
    size: '2.3 MB',
    type: 'PDF'
  },
  {
    id: '2',
    name: 'Operation Manual',
    category: 'manual',
    uploadDate: '2024-01-10',
    expiryDate: null,
    size: '5.7 MB',
    type: 'PDF'
  }
];

const RideDocuments = ({ ride }: RideDocumentsProps) => {
  const { toast } = useToast();
  const [selectedCategory, setSelectedCategory] = useState('');
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [expiryDate, setExpiryDate] = useState('');
  const [documents] = useState(mockDocuments); // This would come from Supabase in real implementation

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setUploadFile(file);
    }
  };

  const handleUpload = async () => {
    if (!uploadFile || !selectedCategory) {
      toast({
        title: "Missing information",
        description: "Please select a file and category",
        variant: "destructive",
      });
      return;
    }

    // This would upload to Supabase Storage in real implementation
    toast({
      title: "Document uploaded",
      description: `${uploadFile.name} has been uploaded successfully`,
    });

    // Reset form
    setUploadFile(null);
    setSelectedCategory('');
    setExpiryDate('');
  };

  const getCategoryIcon = (categoryId: string) => {
    const category = documentCategories.find(cat => cat.id === categoryId);
    return category?.icon || FileText;
  };

  const getCategoryColor = (categoryId: string) => {
    const category = documentCategories.find(cat => cat.id === categoryId);
    return category?.color || 'bg-gray-100 text-gray-700';
  };

  const getCategoryName = (categoryId: string) => {
    const category = documentCategories.find(cat => cat.id === categoryId);
    return category?.name || 'Unknown';
  };

  const isExpiringSoon = (expiryDate: string) => {
    const expiry = new Date(expiryDate);
    const today = new Date();
    const daysUntilExpiry = Math.ceil((expiry.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
    return daysUntilExpiry <= 30 && daysUntilExpiry > 0;
  };

  const isExpired = (expiryDate: string) => {
    const expiry = new Date(expiryDate);
    const today = new Date();
    return expiry < today;
  };

  return (
    <div className="space-y-6">
      {/* Upload Section */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Upload className="h-5 w-5" />
            <span>Upload New Document</span>
          </CardTitle>
          <CardDescription>
            Add a new document for {ride.ride_name}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="file">Select File</Label>
              <Input
                id="file"
                type="file"
                onChange={handleFileSelect}
                accept=".pdf,.doc,.docx,.jpg,.jpeg,.png"
              />
              {uploadFile && (
                <p className="text-sm text-muted-foreground">
                  Selected: {uploadFile.name} ({(uploadFile.size / 1024 / 1024).toFixed(2)} MB)
                </p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="category">Document Category</Label>
              <Select value={selectedCategory} onValueChange={setSelectedCategory}>
                <SelectTrigger>
                  <SelectValue placeholder="Select category" />
                </SelectTrigger>
                <SelectContent>
                  {documentCategories.map((category) => (
                    <SelectItem key={category.id} value={category.id}>
                      <div className="flex items-center space-x-2">
                        <category.icon className="h-4 w-4" />
                        <span>{category.name}</span>
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
              />
            </div>

            <div className="flex items-end">
              <Button onClick={handleUpload} className="w-full">
                Upload Document
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Document Categories */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {documentCategories.map((category) => {
          const categoryDocs = documents.filter(doc => doc.category === category.id);
          const Icon = category.icon;
          
          return (
            <Card key={category.id} className="hover:shadow-elegant transition-shadow">
              <CardHeader className="pb-4">
                <CardTitle className="flex items-center space-x-2">
                  <div className={`p-2 rounded ${category.color}`}>
                    <Icon className="h-4 w-4" />
                  </div>
                  <span className="text-sm">{category.name}</span>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <div className="text-center">
                    <div className="text-2xl font-bold">{categoryDocs.length}</div>
                    <p className="text-xs text-muted-foreground">Documents</p>
                  </div>
                  
                  {categoryDocs.length > 0 && (
                    <div className="space-y-2">
                      {categoryDocs.slice(0, 2).map((doc) => (
                        <div key={doc.id} className="p-2 bg-muted rounded text-xs">
                          <div className="flex items-center justify-between">
                            <span className="truncate font-medium">{doc.name}</span>
                            <div className="flex space-x-1">
                              <Button size="sm" variant="ghost" className="h-6 w-6 p-0">
                                <Download className="h-3 w-3" />
                              </Button>
                              <Button size="sm" variant="ghost" className="h-6 w-6 p-0">
                                <Trash2 className="h-3 w-3" />
                              </Button>
                            </div>
                          </div>
                          {doc.expiryDate && (
                            <div className="flex items-center space-x-1 mt-1">
                              <Calendar className="h-3 w-3" />
                              <span className={`text-xs ${
                                isExpired(doc.expiryDate) ? 'text-red-600' :
                                isExpiringSoon(doc.expiryDate) ? 'text-yellow-600' :
                                'text-muted-foreground'
                              }`}>
                                Expires: {new Date(doc.expiryDate).toLocaleDateString()}
                              </span>
                            </div>
                          )}
                        </div>
                      ))}
                      {categoryDocs.length > 2 && (
                        <p className="text-xs text-muted-foreground text-center">
                          +{categoryDocs.length - 2} more documents
                        </p>
                      )}
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Global Documents Section */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Shield className="h-5 w-5" />
            <span>Global Documents</span>
          </CardTitle>
          <CardDescription>
            Documents that apply to all rides (insurance, operator licenses, etc.)
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8">
            <FileText className="mx-auto h-16 w-16 text-muted-foreground" />
            <h3 className="text-lg font-semibold mt-4">No global documents</h3>
            <p className="text-muted-foreground">
              Global documents like insurance certificates will appear here
            </p>
            <Button className="mt-4">
              Add Global Document
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default RideDocuments;