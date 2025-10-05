import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent } from '@/components/ui/card';
import { Upload, FileText, ArrowLeft, Settings } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { FeatureGate } from '@/components/FeatureGate';
import DocumentUpload from './DocumentUpload';
import DocumentList from './DocumentList';

const GlobalDocuments = () => {
  const { user } = useAuth();
  const [refreshKey, setRefreshKey] = useState(0);
  const [selectedRide, setSelectedRide] = useState<{id: string, name: string, category: string} | null>(null);

  useEffect(() => {
    // Check if a ride was selected from the quick upload
    const selectedRideId = sessionStorage.getItem('selectedRideForUpload');
    if (selectedRideId) {
      loadSelectedRide(selectedRideId);
      // Clear the session storage after using it
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
    <FeatureGate requiredPlan="advanced" feature="Global Documents">
      <div className="space-y-4">
        {selectedRide && (
          <Card className="bg-primary/5 border-primary/20">
            <CardContent className="p-3 sm:p-4">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                <div className="flex items-center gap-3">
                  <Settings className="h-4 w-4 sm:h-5 sm:w-5 text-primary flex-shrink-0" />
                  <div className="min-w-0">
                    <p className="font-medium text-sm sm:text-base truncate">{selectedRide.name}</p>
                    <p className="text-xs sm:text-sm text-muted-foreground">{selectedRide.category}</p>
                  </div>
                </div>
                <Button variant="ghost" size="sm" onClick={clearSelectedRide} className="self-start sm:self-center">
                  <ArrowLeft className="h-4 w-4 mr-1" />
                  Back
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        <div className="space-y-2">
          <h2 className="text-2xl font-bold tracking-tight">
            {selectedRide ? 'Ride Documents' : 'Global Documents'}
          </h2>
          <p className="text-sm text-muted-foreground">
            {selectedRide 
              ? `Documents for ${selectedRide.name}`
              : 'Store documents that apply across your entire business, not tied to a specific ride or piece of equipment.'
            }
          </p>
          {!selectedRide && (
            <div className="bg-muted/50 border rounded-lg p-3 text-sm">
              <p className="font-medium mb-1">Examples of Global Documents:</p>
              <ul className="list-disc list-inside space-y-0.5 text-muted-foreground">
                <li>Public Liability Insurance</li>
                <li>Employers Liability Insurance</li>
                <li>Business licenses and permits</li>
                <li>Showmen's Guild membership</li>
                <li>Health & Safety policies</li>
              </ul>
            </div>
          )}
        </div>

        <Tabs defaultValue="documents" className="space-y-4">
          <TabsList className="grid w-full grid-cols-2 gap-2 p-1.5 bg-muted/30 h-auto">
            <TabsTrigger value="documents" className="flex items-center justify-center gap-2 py-2.5">
              <FileText className="h-4 w-4" />
              <span className="text-xs sm:text-sm">View Files</span>
            </TabsTrigger>
            <TabsTrigger value="upload" className="flex items-center justify-center gap-2 py-2.5">
              <Upload className="h-4 w-4" />
              <span className="text-xs sm:text-sm">Upload New</span>
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
    </FeatureGate>
  );
};

export default GlobalDocuments;