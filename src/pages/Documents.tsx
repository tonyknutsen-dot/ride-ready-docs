import { useState, useEffect } from 'react';
import { FileText, Globe, ChevronDown, FolderOpen, Upload, ArrowRight } from 'lucide-react';
import DocumentHelpDialog from '@/components/documents/DocumentHelpDialog';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import PageHeader from '@/components/PageHeader';
import DocumentList from '@/components/DocumentList';
import { useAuth } from '@/contexts/AuthContext';
import { useStaff } from '@/contexts/StaffContext';
import { useEffectiveUserId } from '@/hooks/useEffectiveUserId';
import { supabase } from '@/integrations/supabase/client';
import StaffAccountBanner from '@/components/StaffAccountBanner';
import { Link } from 'react-router-dom';

interface RideWithDocs {
  id: string;
  ride_name: string;
  category_name: string;
  document_count: number;
}

const Documents = () => {
  const { user } = useAuth();
  const { isStaff } = useStaff();
  const { effectiveUserId } = useEffectiveUserId();
  const [ridesWithDocs, setRidesWithDocs] = useState<RideWithDocs[]>([]);
  const [globalDocCount, setGlobalDocCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [refreshKey, setRefreshKey] = useState(0);
  const [expandedRides, setExpandedRides] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (effectiveUserId) {
      loadRidesWithDocuments();
    }
  }, [effectiveUserId, refreshKey]);

  const loadRidesWithDocuments = async () => {
    try {
      // For staff, don't filter by user_id - RLS handles access
      // For owners, filter by effectiveUserId
      let ridesQuery = supabase
        .from('rides')
        .select(`
          id,
          ride_name,
          ride_categories(name)
        `)
        .order('ride_name');
      
      if (!isStaff) {
        ridesQuery = ridesQuery.eq('user_id', effectiveUserId);
      }
      
      const { data: rides, error: ridesError } = await ridesQuery;

      if (ridesError) throw ridesError;

      // Get document counts per ride (exclude maintenance and photo docs)
      let docsQuery = supabase
        .from('documents')
        .select('id, ride_id, is_global')
        .neq('document_type', 'maintenance')
        .neq('document_type', 'photo');
      
      if (!isStaff) {
        docsQuery = docsQuery.eq('user_id', effectiveUserId);
      }
      
      const { data: docs, error: docsError } = await docsQuery;

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
      <StaffAccountBanner />
      <header className="border-b-2 border-primary/30 bg-gradient-to-r from-primary/5 to-transparent backdrop-blur-sm sticky top-0 z-40">
        <div className="container mx-auto px-4 py-4">
          <PageHeader
            icon={<FileText className="h-5 w-5 text-primary" />}
            iconBgClass="from-primary/20 to-primary/10"
            title="All Documents"
            subtitle={`${totalDocs} document${totalDocs !== 1 ? 's' : ''} across ${ridesWithDocs.length} ride${ridesWithDocs.length !== 1 ? 's' : ''}`}
            showBackButton
            backTo="/overview"
            actions={<DocumentHelpDialog />}
          />
        </div>
      </header>
      
      <main className="container mx-auto px-4 py-4 space-y-3">
        {/* Upload hint */}
        <Alert className="border-info/30 bg-info/5 py-2.5">
          <Upload className="h-4 w-4 text-info" />
          <AlertDescription className="flex items-center justify-between gap-2 flex-wrap">
            <span className="text-xs">To upload documents, go to a specific equipment page.</span>
            <Button variant="link" size="sm" asChild className="p-0 h-auto text-info text-xs">
              <Link to="/rides" className="flex items-center gap-1">
                Equipment <ArrowRight className="h-3 w-3" />
              </Link>
            </Button>
          </AlertDescription>
        </Alert>

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
              <div className="rounded-xl border border-info/30 bg-info/5 overflow-hidden">
                <Collapsible defaultOpen>
                  <CollapsibleTrigger asChild>
                    <Button
                      variant="ghost"
                      className="w-full justify-between px-3.5 py-3 h-auto rounded-none hover:bg-info/10"
                    >
                      <div className="flex items-center gap-2.5">
                        <div className="p-2 bg-info/20 rounded-lg">
                          <Globe className="h-4 w-4 text-info" />
                        </div>
                        <div className="text-left">
                          <div className="text-sm font-semibold text-foreground">Global Documents</div>
                          <div className="text-[11px] text-muted-foreground">Shared across all equipment</div>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge variant="secondary" className="text-xs">
                          {globalDocCount}
                        </Badge>
                        <ChevronDown className="h-4 w-4 text-muted-foreground transition-transform" />
                      </div>
                    </Button>
                  </CollapsibleTrigger>
                  <CollapsibleContent className="px-3 pb-3 border-t border-info/20">
                    <DocumentList 
                      key={`global-${refreshKey}`}
                      isGlobal
                      onDocumentDeleted={handleDocumentDeleted}
                      grouped
                    />
                  </CollapsibleContent>
                </Collapsible>
              </div>
            )}

            {/* Equipment Documents Section Header */}
            {ridesWithDocs.length > 0 && (
              <div className="flex items-center gap-2.5 pt-4 pb-1">
                <div className="p-1.5 bg-primary/10 rounded-lg">
                  <FolderOpen className="h-3.5 w-3.5 text-primary" />
                </div>
                <h2 className="text-xs font-semibold text-primary uppercase tracking-wider">
                  Equipment Documents
                </h2>
                <div className="flex-1 h-px bg-border" />
                <span className="text-[11px] text-muted-foreground">
                  {ridesWithDocs.reduce((sum, r) => sum + r.document_count, 0)} files
                </span>
              </div>
            )}

            {/* Equipment folders */}
            <div className="space-y-1.5">
              {ridesWithDocs.map(ride => (
                <Collapsible 
                  key={ride.id} 
                  open={expandedRides.has(ride.id)}
                  onOpenChange={() => toggleRide(ride.id)}
                >
                  <CollapsibleTrigger asChild>
                    <Button
                      variant="ghost"
                      className="w-full justify-between px-3 py-2.5 h-auto border border-border rounded-lg bg-card hover:border-primary/30 transition-all"
                    >
                      <div className="flex items-center gap-2.5">
                        <div className="p-1.5 bg-muted rounded-md">
                          <FolderOpen className="h-4 w-4 text-primary" />
                        </div>
                        <div className="text-left min-w-0">
                          <div className="text-sm font-semibold text-foreground truncate">{ride.ride_name}</div>
                          <div className="text-[11px] text-muted-foreground">{ride.category_name}</div>
                        </div>
                      </div>
                      <div className="flex items-center gap-1.5 shrink-0">
                        {ride.document_count > 0 ? (
                          <Badge variant="secondary" className="text-[11px] px-1.5 py-0">
                            {ride.document_count}
                          </Badge>
                        ) : (
                          <span className="text-[11px] text-muted-foreground">—</span>
                        )}
                        <ChevronDown className={`h-3.5 w-3.5 text-muted-foreground transition-transform ${expandedRides.has(ride.id) ? 'rotate-180' : ''}`} />
                      </div>
                    </Button>
                  </CollapsibleTrigger>
                  <CollapsibleContent className="pt-2 px-1 border-t border-border/40 mt-1">
                    <DocumentList 
                      key={`${ride.id}-${refreshKey}`}
                      rideId={ride.id}
                      rideName={ride.ride_name}
                      onDocumentDeleted={handleDocumentDeleted}
                      excludeGlobal
                      grouped
                    />
                  </CollapsibleContent>
                </Collapsible>
              ))}
            </div>

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
