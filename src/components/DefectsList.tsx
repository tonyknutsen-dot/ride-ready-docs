import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { AlertOctagon, Clock, Wrench, Check, WifiOff, ChevronRight, Camera, MapPin } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { formatDistanceToNow } from 'date-fns';
import { setCache, getCache } from '@/lib/offlineCache';
import DefectClosureDialog from '@/components/DefectClosureDialog';
import { getDefectTier, SEVERITY_STRIP, SEVERITY_OPERATIONAL, SEVERITY_BADGE, SEVERITY_CARD, DEFECT_DISPLAY } from '@/utils/severityStyles';

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

const SEVERITY_ICONS: Record<DefectSeverity, typeof AlertOctagon> = {
  stop_operation: AlertOctagon,
  urgent: Wrench,
  non_urgent: Clock,
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
      <div className="space-y-2.5">
        {defects.map((defect) => {
          const tier = getDefectTier(defect.severity);
          const display = DEFECT_DISPLAY[defect.severity] || DEFECT_DISPLAY.non_urgent;
          const SevIcon = SEVERITY_ICONS[defect.severity] || Clock;
          const isResolved = defect.status === 'resolved';
          const hasPhotos = photoUrls[defect.id]?.length > 0;

          return (
            <Card
              key={defect.id}
              className={`cursor-pointer transition-all hover:shadow-md active:scale-[0.997] rounded-xl overflow-hidden ${
                !isResolved ? SEVERITY_CARD[tier] : 'hover:border-primary/20'
              }`}
              onClick={() => openInRegister(defect)}
            >
              <CardContent className="p-0">
                <div className="flex items-stretch">
                  {/* Severity color strip */}
                  <div className={`w-1 shrink-0 ${SEVERITY_STRIP[tier]}`} />

                  <div className="flex-1 p-3.5">
                    <div className="flex items-start gap-3">
                      {/* Severity icon */}
                      <div className={`mt-0.5 w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${SEVERITY_OPERATIONAL[tier]}`}>
                        <SevIcon className="h-3.5 w-3.5" />
                      </div>

                      <div className="flex-1 min-w-0 space-y-1.5">
                        <p className="text-[13px] font-semibold text-foreground line-clamp-2 leading-snug">{defect.description}</p>

                        {defect.location_on_ride && (
                          <div className="flex items-center gap-1.5">
                            <MapPin className="h-3 w-3 text-muted-foreground shrink-0" />
                            <p className="text-[11px] text-muted-foreground truncate">{defect.location_on_ride}</p>
                          </div>
                        )}

                        <div className="flex items-center gap-1.5 flex-wrap pt-0.5">
                          <Badge className={`text-[10px] px-1.5 py-0 font-semibold ${SEVERITY_BADGE[tier]}`}>{display.label}</Badge>
                          {isResolved ? (
                            <Badge variant="secondary" className="text-[10px] px-1.5 py-0 bg-success/10 text-success font-medium">Closed</Badge>
                          ) : (
                            <Badge variant="destructive" className="text-[10px] px-1.5 py-0 font-medium">Open</Badge>
                          )}
                          {hasPhotos && (
                            <span className="flex items-center gap-0.5 text-[10px] text-muted-foreground">
                              <Camera className="h-3 w-3" />
                              {photoUrls[defect.id]?.length}
                            </span>
                          )}
                          <span className="text-[11px] text-muted-foreground ml-auto">
                            {formatDistanceToNow(new Date(defect.reported_at), { addSuffix: true })}
                          </span>
                        </div>

                        {/* Operational status for stop-use */}
                        {!isResolved && defect.severity === 'stop_operation' && (
                          <p className="text-[11px] font-semibold text-destructive pt-0.5">{display.operationalIcon} {display.operational}</p>
                        )}

                        {/* Resolution preview */}
                        {isResolved && defect.resolution_notes && (
                          <p className="text-[11px] text-muted-foreground italic line-clamp-1">✓ {defect.resolution_notes}</p>
                        )}
                      </div>

                      <div className="flex flex-col items-end gap-2.5 shrink-0 pt-0.5">
                        {!isResolved && (
                          <Button
                            size="sm" variant="outline" className="text-xs gap-1.5 h-8 rounded-lg px-2.5"
                            onClick={(e) => {
                              e.stopPropagation();
                              setSelectedDefect({ ...defect, ride_id: rideId } as any);
                              setResolveDialogOpen(true);
                            }}
                          >
                            <Check className="h-3 w-3" /> Close
                          </Button>
                        )}
                        <ChevronRight className="h-4 w-4 text-muted-foreground/30" />
                      </div>
                    </div>
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
