import { useState, useEffect } from 'react';
import { FileText, Globe, ChevronDown, FolderOpen, Upload, ArrowRight } from 'lucide-react';
import DocumentHelpDialog from '@/components/documents/DocumentHelpDialog';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
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
      let ridesQuery = supabase
        .from('rides')
        .select(`id, ride_name, ride_categories(name)`)
        .order('ride_name');

      if (!isStaff) {
        ridesQuery = ridesQuery.eq('user_id', effectiveUserId);
      }

      const { data: rides, error: ridesError } = await ridesQuery;
      if (ridesError) throw ridesError;

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

      const globalDocs = docs?.filter(d => d.is_global) || [];
      setGlobalDocCount(globalDocs.length);

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
  const equipmentDocCount = ridesWithDocs.reduce((sum, r) => sum + r.document_count, 0);

  return (
    <div className="min-h-screen bg-background pb-28 md:pb-8">
      <StaffAccountBanner />
      <header className="border-b-2 border-primary/30 bg-gradient-to-r from-primary/5 to-transparent backdrop-blur-sm sticky top-0 z-40">
        <div className="container mx-auto px-4 py-3">
          <PageHeader
            icon={<FileText className="h-5 w-5 text-primary" />}
            iconBgClass="from-primary/20 to-primary/10"
            title="All Documents"
            subtitle={`${totalDocs} document${totalDocs !== 1 ? 's' : ''} across ${ridesWithDocs.length} equipment`}
            showBackButton
            backTo="/overview"
            actions={<DocumentHelpDialog />}
          />
        </div>
      </header>

      <main className="container mx-auto px-4 py-3 space-y-3">
        {/* Upload hint — slim banner */}
        <div className="flex items-center gap-2 px-3 py-2 rounded-lg border border-info/20 bg-info/5">
          <Upload className="h-3.5 w-3.5 text-info shrink-0" />
          <span className="text-[11px] text-foreground/60 font-medium flex-1">Upload documents from individual equipment pages</span>
          <Button variant="link" size="sm" asChild className="p-0 h-auto text-info text-[11px] font-semibold shrink-0">
            <Link to="/rides" className="flex items-center gap-0.5">
              Equipment <ArrowRight className="h-3 w-3" />
            </Link>
          </Button>
        </div>

        {loading ? (
          <div className="py-8 text-center">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-info to-primary mx-auto flex items-center justify-center mb-3">
              <FileText className="h-6 w-6 text-white animate-pulse" />
            </div>
            <p className="text-sm text-muted-foreground font-medium">Loading documents…</p>
          </div>
        ) : (
          <>
            {/* ─── Shared Insurance Section ─── */}
            {globalDocCount > 0 && (
              <div className="rounded-lg border border-info/25 bg-info/5 overflow-hidden">
                <Collapsible defaultOpen>
                  <CollapsibleTrigger asChild>
                    <button className="w-full flex items-center justify-between px-3 py-2.5 hover:bg-info/10 transition-colors">
                      <div className="flex items-center gap-2">
                        <div className="p-1.5 bg-info/15 rounded-md">
                          <Globe className="h-3.5 w-3.5 text-info" />
                        </div>
                        <div className="text-left">
                          <div className="text-sm font-semibold text-foreground leading-tight">Shared Insurance</div>
                          <div className="text-[10px] text-foreground/50 font-medium">Applies to all equipment</div>
                        </div>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <Badge className="text-[10px] h-5 px-1.5 bg-info/15 text-info border-info/25 font-semibold">
                          {globalDocCount}
                        </Badge>
                        <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
                      </div>
                    </button>
                  </CollapsibleTrigger>
                  <CollapsibleContent className="px-2 pb-2 border-t border-info/15">
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

            {/* ─── Equipment Documents Section ─── */}
            {ridesWithDocs.length > 0 && (
              <>
                <div className="flex items-center gap-2 pt-2 pb-0.5">
                  <div className="p-1 bg-primary/10 rounded-md">
                    <FolderOpen className="h-3 w-3 text-primary" />
                  </div>
                  <h2 className="text-[11px] font-bold text-primary uppercase tracking-wider">
                    Equipment Documents
                  </h2>
                  <div className="flex-1 h-px bg-border" />
                  <span className="text-[10px] font-semibold text-foreground/40">
                    {equipmentDocCount} file{equipmentDocCount !== 1 ? 's' : ''}
                  </span>
                </div>

                <div className="space-y-1">
                  {ridesWithDocs.map(ride => (
                    <Collapsible
                      key={ride.id}
                      open={expandedRides.has(ride.id)}
                      onOpenChange={() => toggleRide(ride.id)}
                    >
                      <CollapsibleTrigger asChild>
                        <button className="w-full flex items-center gap-2.5 px-3 py-2 border border-border/60 rounded-lg bg-card hover:border-primary/25 transition-colors">
                          <div className="p-1.5 bg-muted rounded-md shrink-0">
                            <FolderOpen className="h-3.5 w-3.5 text-primary" />
                          </div>
                          <div className="flex-1 min-w-0 text-left">
                            <div className="text-sm font-semibold text-foreground truncate leading-tight">{ride.ride_name}</div>
                            <div className="text-[10px] font-medium text-foreground/45">{ride.category_name}</div>
                          </div>
                          <div className="flex items-center gap-1.5 shrink-0">
                            <Badge
                              variant={ride.document_count > 0 ? 'secondary' : 'outline'}
                              className={`text-[10px] h-5 px-1.5 font-semibold ${ride.document_count === 0 ? 'text-muted-foreground/60 border-border/50' : ''}`}
                            >
                              {ride.document_count}
                            </Badge>
                            <ChevronDown className={`h-3.5 w-3.5 text-muted-foreground transition-transform duration-200 ${expandedRides.has(ride.id) ? 'rotate-180' : ''}`} />
                          </div>
                        </button>
                      </CollapsibleTrigger>
                      <CollapsibleContent className="pt-1.5 px-1 border-t border-border/30 mt-0.5">
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
              </>
            )}

            {/* Empty state */}
            {ridesWithDocs.length === 0 && globalDocCount === 0 && (
              <div className="py-10 text-center">
                <div className="w-14 h-14 rounded-xl bg-muted mx-auto flex items-center justify-center mb-3">
                  <FileText className="h-7 w-7 text-muted-foreground" />
                </div>
                <h3 className="text-base font-semibold">No documents yet</h3>
                <p className="text-sm text-muted-foreground mt-1">
                  Upload documents from individual equipment pages
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