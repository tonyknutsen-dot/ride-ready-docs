import { useState, useEffect } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { AlertOctagon, Clock, Wrench, Check, WifiOff } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { format } from 'date-fns';
import { setCache, getCache } from '@/lib/offlineCache';
import DefectClosureDialog from '@/components/DefectClosureDialog';

type DefectSeverity = 'non_urgent' | 'urgent' | 'stop_operation';
type DefectStatus = 'open' | 'acknowledged' | 'in_progress' | 'awaiting_review' | 'resolved';

interface Defect {
  id: string;
  description: string;
  severity: DefectSeverity;
  status: DefectStatus;
  location_on_ride: string | null;
  photo_paths: string[];
  reported_at: string;
  resolved_at: string | null;
  resolved_by: string | null;
  resolution_notes: string | null;
}

interface DefectsListProps {
  rideId: string;
  rideName: string;
  showResolved?: boolean;
  onDefectUpdated?: () => void;
}

const getSeverityLabel = (severity: DefectSeverity) => {
  switch (severity) {
    case 'non_urgent': return 'Low';
    case 'urgent': return 'Important';
    case 'stop_operation': return 'Stop Use';
  }
};

const getSeverityStyle = (severity: DefectSeverity) => {
  switch (severity) {
    case 'non_urgent':
      return { color: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200', icon: Clock };
    case 'urgent':
      return { color: 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200', icon: Wrench };
    case 'stop_operation':
      return { color: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200', icon: AlertOctagon };
  }
};

const DefectsList = ({ rideId, rideName, showResolved = false, onDefectUpdated }: DefectsListProps) => {
  const [defects, setDefects] = useState<Defect[]>([]);
  const [loading, setLoading] = useState(true);
  const [isOfflineData, setIsOfflineData] = useState(false);
  const [resolveDialogOpen, setResolveDialogOpen] = useState(false);
  const [selectedDefect, setSelectedDefect] = useState<Defect | null>(null);
  const [viewingPhoto, setViewingPhoto] = useState<string | null>(null);
  const [photoUrls, setPhotoUrls] = useState<{ [defectId: string]: string[] }>({});
  const { toast } = useToast();
  const { user } = useAuth();

  const cacheKey = `defects:${rideId}:${showResolved ? 'all' : 'open'}`;

  useEffect(() => {
    loadDefects();
  }, [rideId, showResolved]);

  const loadDefects = async () => {
    if (!navigator.onLine) {
      try {
        const cached = await getCache<Defect[]>(cacheKey);
        if (cached) {
          setDefects(cached.data);
          setIsOfflineData(true);
        }
      } catch (e) { /* ignore */ }
      setLoading(false);
      return;
    }

    try {
      let query = supabase
        .from('defects')
        .select('*')
        .eq('ride_id', rideId)
        .eq('user_id', user?.id)
        .order('reported_at', { ascending: false });

      if (!showResolved) {
        query = query.neq('status', 'resolved');
      }

      const { data, error } = await query;
      if (error) throw error;

      const defectsData = (data || []) as unknown as Defect[];
      setDefects(defectsData);
      setIsOfflineData(false);
      setCache(cacheKey, defectsData).catch(console.error);

      // Load photo URLs
      if (data) {
        const photosToLoad: { [key: string]: string[] } = {};
        for (const defect of defectsData) {
          if (defect.photo_paths && defect.photo_paths.length > 0) {
            const urls: string[] = [];
            for (const path of defect.photo_paths) {
              const { data: urlData } = await supabase.storage
                .from('defect-photos')
                .createSignedUrl(path, 3600);
              if (urlData?.signedUrl) urls.push(urlData.signedUrl);
            }
            if (urls.length > 0) photosToLoad[defect.id] = urls;
          }
        }
        setPhotoUrls(photosToLoad);
      }
    } catch (error) {
      console.error('Error loading defects:', error);
      if (navigator.onLine) {
        toast({ title: "Error", description: "Failed to load defects", variant: "destructive" });
      }
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center py-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  const offlineBanner = isOfflineData ? (
    <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-muted text-muted-foreground text-xs mb-3">
      <WifiOff className="h-3.5 w-3.5 flex-shrink-0" />
      <span>Offline: showing cached defects</span>
    </div>
  ) : null;

  if (defects.length === 0) {
    return (
      <>
        {offlineBanner}
        <p className="text-[11px] text-muted-foreground py-1">None</p>
      </>
    );
  }

  return (
    <>
      {offlineBanner}
      <div className="space-y-2">
        {defects.map((defect) => {
          const style = getSeverityStyle(defect.severity);
          const SeverityIcon = style.icon;
          const isResolved = defect.status === 'resolved';
          const hasPhotos = photoUrls[defect.id]?.length > 0;

          return (
            <Card
              key={defect.id}
              className={defect.severity === 'stop_operation' && !isResolved
                ? 'border-destructive/50 bg-destructive/5'
                : ''
              }
            >
              <CardContent className="p-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0 space-y-1.5">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${style.color}`}>
                        <SeverityIcon className="h-3 w-3" />
                        {getSeverityLabel(defect.severity)}
                      </span>
                      {isResolved ? (
                        <Badge className="bg-green-500 hover:bg-green-600 text-[10px]">Closed</Badge>
                      ) : (
                        <Badge variant="destructive" className="text-[10px]">Open</Badge>
                      )}
                    </div>
                    <p className="text-sm text-foreground line-clamp-2">{defect.description}</p>
                    <p className="text-[11px] text-muted-foreground">
                      {format(new Date(defect.reported_at), 'dd/MM/yyyy HH:mm')}
                      {defect.location_on_ride && ` • ${defect.location_on_ride}`}
                    </p>

                    {/* Resolution info */}
                    {isResolved && defect.resolution_notes && (
                      <p className="text-xs text-muted-foreground italic mt-1">
                        ✓ {defect.resolution_notes}
                      </p>
                    )}

                    {/* Photos inline */}
                    {hasPhotos && (
                      <div className="flex gap-1.5 mt-1.5">
                        {photoUrls[defect.id].slice(0, 3).map((url, idx) => (
                          <div
                            key={idx}
                            className="w-12 h-12 cursor-pointer"
                            onClick={() => setViewingPhoto(url)}
                          >
                            <img src={url} alt="" className="w-full h-full object-cover rounded border" />
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Close button for open defects */}
                  {!isResolved && (
                    <Button
                      size="sm"
                      variant="outline"
                      className="shrink-0 text-xs gap-1"
                      onClick={() => {
                        setSelectedDefect({ ...defect, ride_id: rideId } as any);
                        setResolveDialogOpen(true);
                      }}
                    >
                      <Check className="h-3 w-3" />
                      Close
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Closure dialog */}
      <DefectClosureDialog
        open={resolveDialogOpen}
        onOpenChange={setResolveDialogOpen}
        defect={selectedDefect as any}
        rideName={rideName}
        onDefectUpdated={() => {
          loadDefects();
          onDefectUpdated?.();
        }}
      />

      {/* Photo viewer */}
      <Dialog open={!!viewingPhoto} onOpenChange={() => setViewingPhoto(null)}>
        <DialogContent className="max-w-3xl p-0">
          {viewingPhoto && (
            <img src={viewingPhoto} alt="Defect photo" className="w-full h-auto max-h-[80vh] object-contain" />
          )}
        </DialogContent>
      </Dialog>
    </>
  );
};

export default DefectsList;
