import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Upload, FileText, ArrowLeft, Settings } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { FeatureGate } from '@/components/FeatureGate';
import { useIsMobile } from '@/hooks/use-mobile';
import DocumentUpload from './DocumentUpload';
import DocumentList from './DocumentList';

const GlobalDocuments = () => {
  const { user } = useAuth();
  const isMobile = useIsMobile();
  const [refreshKey, setRefreshKey] = useState(0);
  const [selectedRide, setSelectedRide] = useState<{id: string, name: string, category: string} | null>(null);

  // Hide on mobile
  if (isMobile) return null;

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
      <div className="space-y-6">
      {selectedRide && (
        <Card className="bg-primary/5 border-primary/20">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <Settings className="h-5 w-5 text-primary" />
                <div>
                  <p className="font-medium">Selected Ride: {selectedRide.name}</p>
                  <p className="text-sm text-muted-foreground">{selectedRide.category}</p>
                </div>
                <Badge variant="secondary" className="ml-2">Ride-Specific Upload</Badge>
              </div>
              <Button variant="ghost" size="sm" onClick={clearSelectedRide}>
                <ArrowLeft className="h-4 w-4 mr-1" />
                Back to Global
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="space-y-2">
        <h2 className="text-3xl font-bold">
          {selectedRide ? `${selectedRide.name} Documents` : 'Global Documents'}
        </h2>
        <p className="text-muted-foreground">
          {selectedRide 
            ? `Manage documents specific to ${selectedRide.name}. These documents will only apply to this ride.`
            : 'Manage documents that apply to all your rides, such as insurance certificates, operator licenses, and company policies.'
          }
        </p>
      </div>

      <Tabs defaultValue="documents" className="space-y-6">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="documents" className="flex items-center space-x-2">
            <FileText className="h-4 w-4" />
            <span>My Documents</span>
          </TabsTrigger>
          <TabsTrigger value="upload" className="flex items-center space-x-2">
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
    </FeatureGate>
  );
};

export default GlobalDocuments;