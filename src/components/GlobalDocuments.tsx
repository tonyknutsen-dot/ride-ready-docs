import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent } from '@/components/ui/card';
import { Upload, FileText, ArrowLeft, Settings } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import DocumentUpload from './DocumentUpload';
import DocumentList from './DocumentList';

const GlobalDocuments = () => {
  const { user } = useAuth();
  const [refreshKey, setRefreshKey] = useState(0);
  const [selectedRide, setSelectedRide] = useState<{id: string, name: string, category: string} | null>(null);

  useEffect(() => {
    const selectedRideId = sessionStorage.getItem('selectedRideForUpload');
    if (selectedRideId) {
      loadSelectedRide(selectedRideId);
      sessionStorage.removeItem('selectedRideForUpload');
    }
  }, []);

  const loadSelectedRide = async (rideId: string) => {
    try {
      const { data, error } = await supabase
        .from('rides')
        .select(`
          id,
          ride_name,
          ride_categories (
            name
          )
        `)
        .eq('id', rideId)
        .eq('user_id', user?.id)
        .single();

      if (error) throw error;

      if (data) {
        setSelectedRide({
          id: data.id,
          name: data.ride_name,
          category: data.ride_categories.name
        });
      }
    } catch (error) {
      console.error('Error loading selected ride:', error);
    }
  };

  const clearSelectedRide = () => {
    setSelectedRide(null);
  };

  const handleUploadSuccess = () => {
    setRefreshKey(prev => prev + 1);
  };

  const handleDocumentDeleted = () => {
    setRefreshKey(prev => prev + 1);
  };

  return (
    <div className="space-y-5">
      {/* Selected Ride Banner */}
      {selectedRide && (
        <Card className="bg-primary/5 border-primary/20 shadow-card">
          <CardContent className="p-4">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                  <Settings className="h-5 w-5 text-primary" />
                </div>
                <div className="min-w-0">
                  <p className="font-medium text-sm truncate">{selectedRide.name}</p>
                  <p className="text-xs text-muted-foreground">{selectedRide.category}</p>
                </div>
              </div>
              <Button variant="ghost" size="sm" onClick={clearSelectedRide} className="shrink-0 h-9">
                <ArrowLeft className="h-4 w-4 mr-1" />
                Back
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Header */}
      <div className="space-y-2">
        <h2 className="text-xl font-bold tracking-tight">
          {selectedRide ? 'Ride Documents' : 'Global Documents'}
        </h2>
        <p className="text-sm text-muted-foreground">
          {selectedRide 
            ? `Documents for ${selectedRide.name}`
            : 'Store documents that apply across your entire business.'
          }
        </p>
      </div>

      {/* Info Box - Only show for global docs */}
      {!selectedRide && (
        <Card className="bg-muted/30 border-muted shadow-card">
          <CardContent className="p-4 text-sm space-y-3">
            <p className="font-medium">What belongs here?</p>
            <div className="space-y-2 text-muted-foreground">
              <div>
                <p className="font-medium text-foreground text-xs">📋 Insurance Documents</p>
                <p className="text-xs">Public Liability, Employers Liability, Equipment insurance</p>
              </div>
              <div>
                <p className="font-medium text-foreground text-xs">📄 Business Documents</p>
                <p className="text-xs">Showmen's Guild membership, Trading licenses, H&S policies</p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Tabs */}
      <Tabs defaultValue="documents" className="space-y-4">
        <TabsList className="grid w-full grid-cols-2 gap-1 p-1 bg-muted/50 h-auto">
          <TabsTrigger value="documents" className="flex items-center justify-center gap-2 py-3 text-sm">
            <FileText className="h-4 w-4" />
            <span>View Files</span>
          </TabsTrigger>
          <TabsTrigger value="upload" className="flex items-center justify-center gap-2 py-3 text-sm">
            <Upload className="h-4 w-4" />
            <span>Upload New</span>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="documents">
          <DocumentList 
            key={refreshKey}
            isGlobal={!selectedRide}
            rideId={selectedRide?.id}
            onDocumentDeleted={handleDocumentDeleted}
          />
        </TabsContent>

        <TabsContent value="upload">
          <DocumentUpload 
            rideId={selectedRide?.id}
            rideName={selectedRide?.name}
            onUploadSuccess={handleUploadSuccess}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default GlobalDocuments;
