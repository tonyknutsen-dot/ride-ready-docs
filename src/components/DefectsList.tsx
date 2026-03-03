import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { AlertOctagon, Clock, Wrench, Check, WifiOff, ChevronRight, Camera } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { format, formatDistanceToNow } from 'date-fns';
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

const SEVERITY_CONFIG: Record<DefectSeverity, {
  label: string; icon: typeof AlertOctagon; badgeClass: string; ringClass: string;
}> = {
  stop_operation: { label: 'Stop Use', icon: AlertOctagon, badgeClass: 'bg-destructive text-destructive-foreground', ringClass: 'bg-destructive/10 text-destructive' },
  urgent: { label: 'Important', icon: Wrench, badgeClass: 'bg-orange-500 text-white dark:bg-orange-600', ringClass: 'bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-300' },
  non_urgent: { label: 'Low', icon: Clock, badgeClass: 'bg-yellow-500 text-white dark:bg-yellow-600', ringClass: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/40 dark:text-yellow-300' },
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
  const navigate = useNavigate();

  const cacheKey = `defects:${rideId}:${showResolved ? 'all' : 'open'}`;

  useEffect(() => { loadDefects(); }, [rideId, showResolved]);

  const loadDefects = async () => {
    if (!navigator.onLine) {
      try {
        const cached = await getCache<Defect[]>(cacheKey);
        if (cached) { setDefects(cached.data); setIsOfflineData(true); }
      } catch { /* ignore */ }
      setLoading(false);
      return;
    }
    try {
      let query = supabase.from('defects').select('*').eq('ride_id', rideId).eq('user_id', user?.id).order('reported_at', { ascending: false });
      if (!showResolved) query = query.neq('status', 'resolved');
      const { data, error } = await query;
      if (error) throw error;
      const defectsData = (data || []) as unknown as Defect[];
      setDefects(defectsData);
      setIsOfflineData(false);
      setCache(cacheKey, defectsData).catch(console.error);
      if (data) {
        const photosToLoad: { [key: string]: string[] } = {};
        for (const defect of defectsData) {
          if (defect.photo_paths && defect.photo_paths.length > 0) {
            const urls: string[] = [];
            for (const path of defect.photo_paths) {
              const { data: urlData } = await supabase.storage.from('defect-photos').createSignedUrl(path, 3600);
              if (urlData?.signedUrl) urls.push(urlData.signedUrl);
            }
            if (urls.length > 0) photosToLoad[defect.id] = urls;
          }
        }
        setPhotoUrls(photosToLoad);
      }
    } catch (error) {
      console.error('Error loading defects:', error);
      if (navigator.onLine) toast({ title: "Error", description: "Failed to load defects", variant: "destructive" });
    } finally { setLoading(false); }
  };

  const openInRegister = (defect: Defect) => {
    navigate(`/defects?rideId=${rideId}&defectId=${defect.id}&status=${defect.status === 'resolved' ? 'closed' : 'open'}`);
  };

  if (loading) {
    return (
      <div className="flex justify-center py-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
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
          const sev = SEVERITY_CONFIG[defect.severity];
          const SevIcon = sev.icon;
          const isResolved = defect.status === 'resolved';
          const hasPhotos = photoUrls[defect.id]?.length > 0;

          return (
            <Card
              key={defect.id}
              className={`cursor-pointer transition-all hover:shadow-md active:scale-[0.995] ${
                defect.severity === 'stop_operation' && !isResolved
                  ? 'border-destructive/40 bg-destructive/5 hover:border-destructive/60'
                  : 'hover:border-primary/30'
              }`}
              onClick={() => openInRegister(defect)}
            >
              <CardContent className="p-3">
                <div className="flex items-start gap-2.5">
                  {/* Severity icon */}
                  <div className={`mt-0.5 w-7 h-7 rounded-full flex items-center justify-center shrink-0 ${sev.ringClass}`}>
                    <SevIcon className="h-3.5 w-3.5" />
                  </div>

                  <div className="flex-1 min-w-0 space-y-1">
                    <p className="text-sm font-medium text-foreground line-clamp-2 leading-snug">{defect.description}</p>
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <Badge className={`text-[10px] px-1.5 py-0 ${sev.badgeClass}`}>{sev.label}</Badge>
                      {isResolved ? (
                        <Badge variant="secondary" className="text-[10px] px-1.5 py-0 bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300">Closed</Badge>
                      ) : (
                        <Badge variant="destructive" className="text-[10px] px-1.5 py-0">Open</Badge>
                      )}
                      {hasPhotos && <Camera className="h-3 w-3 text-muted-foreground" />}
                      <span className="text-[11px] text-muted-foreground">
                        {formatDistanceToNow(new Date(defect.reported_at), { addSuffix: true })}
                      </span>
                    </div>

                    {/* Resolution preview */}
                    {isResolved && defect.resolution_notes && (
                      <p className="text-[11px] text-muted-foreground italic line-clamp-1">✓ {defect.resolution_notes}</p>
                    )}
                  </div>

                  <div className="flex flex-col items-end gap-2 shrink-0">
                    {!isResolved && (
                      <Button
                        size="sm" variant="outline" className="text-xs gap-1 h-7"
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedDefect({ ...defect, ride_id: rideId } as any);
                          setResolveDialogOpen(true);
                        }}
                      >
                        <Check className="h-3 w-3" /> Close
                      </Button>
                    )}
                    <ChevronRight className="h-4 w-4 text-muted-foreground/40" />
                  </div>
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
        onDefectUpdated={() => { loadDefects(); onDefectUpdated?.(); }}
      />

      {/* Photo viewer */}
      <Dialog open={!!viewingPhoto} onOpenChange={() => setViewingPhoto(null)}>
        <DialogContent className="max-w-3xl p-0">
          {viewingPhoto && <img src={viewingPhoto} alt="Defect photo" className="w-full h-auto max-h-[80vh] object-contain" />}
        </DialogContent>
      </Dialog>
    </>
  );
};

export default DefectsList;
