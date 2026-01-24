import { useState, useEffect } from 'react';
import { FileText, Globe, ChevronDown, FolderOpen } from 'lucide-react';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import PageHeader from '@/components/PageHeader';
import DocumentList from '@/components/DocumentList';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';

interface RideWithDocs {
  id: string;
  ride_name: string;
  category_name: string;
  document_count: number;
}

const Documents = () => {
  const { user } = useAuth();
  const [ridesWithDocs, setRidesWithDocs] = useState<RideWithDocs[]>([]);
  const [globalDocCount, setGlobalDocCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [refreshKey, setRefreshKey] = useState(0);
  const [expandedRides, setExpandedRides] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (user) {
      loadRidesWithDocuments();
    }
  }, [user, refreshKey]);

  const loadRidesWithDocuments = async () => {
    try {
      // Get all rides with their document counts
      const { data: rides, error: ridesError } = await supabase
        .from('rides')
        .select(`
          id,
          ride_name,
          ride_categories(name)
        `)
        .eq('user_id', user?.id)
        .order('ride_name');

      if (ridesError) throw ridesError;

      // Get document counts per ride
      const { data: docs, error: docsError } = await supabase
        .from('documents')
        .select('id, ride_id, is_global')
        .eq('user_id', user?.id)
        .neq('document_type', 'maintenance');

      if (docsError) throw docsError;

      // Count global docs
      const globalDocs = docs?.filter(d => d.is_global) || [];
      setGlobalDocCount(globalDocs.length);

      // Count docs per ride
      const docCountMap: Record<string, number> = {};
      docs?.forEach(d => {
        if (d.ride_id && !d.is_global) {
          docCountMap[d.ride_id] = (docCountMap[d.ride_id] || 0) + 1;
        }
      });

      const ridesWithCounts: RideWithDocs[] = (rides || []).map(r => ({
        id: r.id,
        ride_name: r.ride_name,
        category_name: (r.ride_categories as any)?.name || 'Unknown',
        document_count: docCountMap[r.id] || 0,
      }));

      // Sort by document count (rides with docs first)
      ridesWithCounts.sort((a, b) => b.document_count - a.document_count);

      setRidesWithDocs(ridesWithCounts);
    } catch (error) {
      console.error('Error loading rides with documents:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleDocumentDeleted = () => {
    setRefreshKey(prev => prev + 1);
  };

  const toggleRide = (rideId: string) => {
    setExpandedRides(prev => {
      const next = new Set(prev);
      if (next.has(rideId)) {
        next.delete(rideId);
      } else {
        next.add(rideId);
      }
      return next;
    });
  };

  const totalDocs = ridesWithDocs.reduce((sum, r) => sum + r.document_count, 0) + globalDocCount;

  return (
    <div className="min-h-screen bg-background pb-28 md:pb-8">
      <header className="border-b-2 border-primary/30 bg-gradient-to-r from-primary/5 to-transparent backdrop-blur-sm sticky top-0 z-40">
        <div className="container mx-auto px-4 py-4">
          <PageHeader
            icon={<FileText className="h-5 w-5 text-primary" />}
            iconBgClass="from-primary/20 to-primary/10"
            title="All Documents"
            subtitle={`${totalDocs} document${totalDocs !== 1 ? 's' : ''} across ${ridesWithDocs.length} ride${ridesWithDocs.length !== 1 ? 's' : ''}`}
            showBackButton
            backTo="/overview"
          />
        </div>
      </header>
      
      <main className="container mx-auto px-4 py-5 space-y-4">
        {loading ? (
          <div className="py-8 text-center">
            <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-info to-primary mx-auto flex items-center justify-center mb-3">
              <FileText className="h-7 w-7 text-white animate-pulse" />
            </div>
            <p className="text-muted-foreground font-medium">Loading documents...</p>
          </div>
        ) : (
          <>
            {/* Global Documents Section */}
            {globalDocCount > 0 && (
              <Collapsible defaultOpen>
                <CollapsibleTrigger asChild>
                  <Button
                    variant="ghost"
                    className="w-full justify-between p-4 h-auto border-2 border-info/30 rounded-xl bg-gradient-to-r from-info/10 to-info/5 hover:from-info/15 hover:to-info/10"
                  >
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-info/20 rounded-lg">
                        <Globe className="h-5 w-5 text-info" />
                      </div>
                      <div className="text-left">
                        <div className="font-semibold text-foreground">Global Documents</div>
                        <div className="text-xs text-muted-foreground">Available across all equipment</div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant="secondary" className="bg-info/20 text-info border-0">
                        {globalDocCount} file{globalDocCount !== 1 ? 's' : ''}
                      </Badge>
                      <ChevronDown className="h-4 w-4 text-muted-foreground transition-transform group-data-[state=open]:rotate-180" />
                    </div>
                  </Button>
                </CollapsibleTrigger>
                <CollapsibleContent className="pt-3 pl-2">
                  <DocumentList 
                    key={`global-${refreshKey}`}
                    isGlobal
                    onDocumentDeleted={handleDocumentDeleted}
                    grouped
                  />
                </CollapsibleContent>
              </Collapsible>
            )}

            {/* Rides with Documents */}
            {ridesWithDocs.map(ride => (
              <Collapsible 
                key={ride.id} 
                open={expandedRides.has(ride.id)}
                onOpenChange={() => toggleRide(ride.id)}
              >
                <CollapsibleTrigger asChild>
                  <Button
                    variant="ghost"
                    className="w-full justify-between p-4 h-auto border-2 border-border/60 rounded-xl hover:border-primary/30 hover:bg-primary/5"
                  >
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-primary/10 rounded-lg">
                        <FolderOpen className="h-5 w-5 text-primary" />
                      </div>
                      <div className="text-left">
                        <div className="font-semibold text-foreground">{ride.ride_name}</div>
                        <div className="text-xs text-muted-foreground">{ride.category_name}</div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {ride.document_count > 0 ? (
                        <Badge variant="secondary" className="bg-primary/10 text-primary border-0">
                          {ride.document_count} file{ride.document_count !== 1 ? 's' : ''}
                        </Badge>
                      ) : (
                        <span className="text-xs text-muted-foreground">No documents</span>
                      )}
                      <ChevronDown className={`h-4 w-4 text-muted-foreground transition-transform ${expandedRides.has(ride.id) ? 'rotate-180' : ''}`} />
                    </div>
                  </Button>
                </CollapsibleTrigger>
                <CollapsibleContent className="pt-3 pl-2">
                  <DocumentList 
                    key={`${ride.id}-${refreshKey}`}
                    rideId={ride.id}
                    rideName={ride.ride_name}
                    onDocumentDeleted={handleDocumentDeleted}
                    grouped
                  />
                </CollapsibleContent>
              </Collapsible>
            ))}

            {/* Empty state */}
            {ridesWithDocs.length === 0 && globalDocCount === 0 && (
              <div className="py-12 text-center">
                <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-primary/20 to-info/20 mx-auto flex items-center justify-center mb-4">
                  <FileText className="h-10 w-10 text-primary" />
                </div>
                <h3 className="text-lg font-semibold mt-4">No documents yet</h3>
                <p className="text-muted-foreground">
                  Upload documents from individual ride pages
                </p>
              </div>
            )}
          </>
        )}
      </main>
    </div>
  );
};

export default Documents;
