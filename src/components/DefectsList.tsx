import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { AlertTriangle, Clock, Wrench, AlertOctagon, ChevronDown, ChevronUp, Check, Eye, WifiOff, PauseCircle } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { format } from 'date-fns';
import { setCache, getCache } from '@/lib/offlineCache';
import { useDailyStatus } from '@/hooks/useDailyStatus';
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

const DefectsList = ({ rideId, rideName, showResolved = false, onDefectUpdated }: DefectsListProps) => {
  const navigate = useNavigate();
  const [defects, setDefects] = useState<Defect[]>([]);
  const [loading, setLoading] = useState(true);
  const [isOfflineData, setIsOfflineData] = useState(false);
  const [expandedDefect, setExpandedDefect] = useState<string | null>(null);
  const [resolveDialogOpen, setResolveDialogOpen] = useState(false);
  const [selectedDefect, setSelectedDefect] = useState<Defect | null>(null);
  const [photoUrls, setPhotoUrls] = useState<{ [defectId: string]: string[] }>({});
  const [viewingPhoto, setViewingPhoto] = useState<string | null>(null);
  const { toast } = useToast();
  const { user } = useAuth();
  const { isOperating, canToggle, toggleOperating, toggling } = useDailyStatus(rideId);

  const cacheKey = `defects:${rideId}:${showResolved ? 'all' : 'open'}`;

  useEffect(() => {
    loadDefects();
  }, [rideId, showResolved]);

  const loadDefects = async () => {
    const isOnline = navigator.onLine;

    // If offline, try cache first and don't make network calls
    if (!isOnline) {
      try {
        const cached = await getCache<Defect[]>(cacheKey);
        if (cached) {
          setDefects(cached.data);
          setIsOfflineData(true);
          setLoading(false);
          return;
        }
      } catch (e) {
        console.warn('Failed to read defects cache:', e);
      }
      // No cache available offline
      setDefects([]);
      setIsOfflineData(true);
      setLoading(false);
      return;
    }

    // Online: fetch from Supabase
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
      
      // Write to cache on success
      setCache(cacheKey, defectsData).catch(console.error);
      
      // Load photo URLs for defects with photos
      if (data) {
        const photosToLoad: { [key: string]: string[] } = {};
        for (const defect of defectsData) {
          if (defect.photo_paths && defect.photo_paths.length > 0) {
            const urls: string[] = [];
            for (const path of defect.photo_paths) {
              const { data: urlData } = await supabase.storage
                .from('defect-photos')
                .createSignedUrl(path, 3600);
              if (urlData?.signedUrl) {
                urls.push(urlData.signedUrl);
              }
            }
            if (urls.length > 0) {
              photosToLoad[defect.id] = urls;
            }
          }
        }
        setPhotoUrls(photosToLoad);
      }
    } catch (error) {
      console.error('Error loading defects:', error);
      // Only show error toast when online
      if (navigator.onLine) {
        toast({
          title: "Error",
          description: "Failed to load defects",
          variant: "destructive"
        });
      } else {
        // Went offline mid-request, try cache
        try {
          const cached = await getCache<Defect[]>(cacheKey);
          if (cached) {
            setDefects(cached.data);
            setIsOfflineData(true);
          }
        } catch (_) { /* ignore */ }
      }
    } finally {
      setLoading(false);
    }
  };

  const openResolveDialog = (defect: Defect) => {
    setSelectedDefect({ ...defect, ride_id: rideId } as any);
    setResolveDialogOpen(true);
  };

  const getSeverityInfo = (severity: DefectSeverity) => {
    switch (severity) {
      case 'non_urgent':
        return { label: 'Non-Urgent', icon: Clock, color: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200' };
      case 'urgent':
        return { label: 'Urgent', icon: Wrench, color: 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200' };
      case 'stop_operation':
        return { label: 'Stop Operation', icon: AlertOctagon, color: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200' };
    }
  };

  const getStatusBadge = (status: DefectStatus) => {
    switch (status) {
      case 'open':
        return <Badge variant="destructive">Open</Badge>;
      case 'acknowledged':
        return <Badge variant="secondary">Acknowledged</Badge>;
      case 'in_progress':
        return <Badge className="bg-blue-500 hover:bg-blue-600">In Progress</Badge>;
      case 'awaiting_review':
        return <Badge className="bg-purple-500 hover:bg-purple-600">Awaiting Review</Badge>;
      case 'resolved':
        return <Badge className="bg-green-500 hover:bg-green-600">Resolved</Badge>;
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
      <span>Offline: showing cached defects{defects.length === 0 ? ' — none cached yet' : ''}</span>
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
      <div className="space-y-3">
        {defects.map((defect) => {
          const severityInfo = getSeverityInfo(defect.severity);
          const SeverityIcon = severityInfo.icon;
          const isExpanded = expandedDefect === defect.id;
          const hasPhotos = photoUrls[defect.id]?.length > 0;

          return (
            <Card 
              key={defect.id} 
              className={defect.severity === 'stop_operation' && defect.status !== 'resolved' 
                ? 'border-destructive/50 bg-destructive/5' 
                : ''
              }
            >
              <CardContent className="p-4">
                <div 
                  className="flex items-start justify-between cursor-pointer"
                  onClick={() => setExpandedDefect(isExpanded ? null : defect.id)}
                >
                  <div className="flex-1 space-y-2">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${severityInfo.color}`}>
                        <SeverityIcon className="h-3 w-3" />
                        {severityInfo.label}
                      </span>
                      {getStatusBadge(defect.status)}
                    </div>
                    <p className="font-medium line-clamp-2">{defect.description}</p>
                    <p className="text-xs text-muted-foreground">
                      Reported: {format(new Date(defect.reported_at), 'dd/MM/yyyy HH:mm')}
                      {defect.location_on_ride && ` • ${defect.location_on_ride}`}
                    </p>
                  </div>
                  <Button variant="ghost" size="icon">
                    {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                  </Button>
                </div>

                {isExpanded && (
                  <div className="mt-4 pt-4 border-t space-y-4">
                    {/* Photos */}
                    {hasPhotos && (
                      <div className="space-y-2">
                        <Label className="text-sm font-medium">Photos</Label>
                        <div className="grid grid-cols-4 gap-2">
                          {photoUrls[defect.id].map((url, idx) => (
                            <div 
                              key={idx}
                              className="aspect-square cursor-pointer"
                              onClick={() => setViewingPhoto(url)}
                            >
                              <img
                                src={url}
                                alt={`Defect photo ${idx + 1}`}
                                className="w-full h-full object-cover rounded-lg border hover:opacity-80 transition-opacity"
                              />
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Resolution info if resolved */}
                    {defect.status === 'resolved' && (
                      <div className="p-3 bg-green-50 dark:bg-green-950/30 rounded-lg space-y-1">
                        <div className="flex items-center gap-2 text-green-700 dark:text-green-400 font-medium">
                          <Check className="h-4 w-4" />
                          Resolved
                        </div>
                        {defect.resolved_by && (
                          <p className="text-sm text-muted-foreground">By: {defect.resolved_by}</p>
                        )}
                        {defect.resolved_at && (
                          <p className="text-sm text-muted-foreground">
                            On: {format(new Date(defect.resolved_at), 'dd/MM/yyyy HH:mm')}
                          </p>
                        )}
                        {defect.resolution_notes && (
                          <p className="text-sm mt-2">{defect.resolution_notes}</p>
                        )}
                      </div>
                    )}

                    {/* Actions */}
                    {defect.status !== 'resolved' && (
                      <div className="space-y-2">
                        {/* Stop-operation specific actions */}
                        {defect.severity === 'stop_operation' && (
                          <div className="flex flex-wrap gap-2">
                            <Button
                              size="sm"
                              variant="outline"
                              className="gap-1.5 text-xs"
                              onClick={(e) => {
                                e.stopPropagation();
                                navigate(`/maintenance?rideId=${rideId}`);
                              }}
                            >
                              <Wrench className="h-3.5 w-3.5" />
                              Go to maintenance
                            </Button>
                            {isOperating && canToggle && (
                              <Button
                                size="sm"
                                variant="outline"
                                className="gap-1.5 text-xs border-destructive/30 text-destructive hover:bg-destructive/10"
                                disabled={toggling}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  toggleOperating('Critical defect — marked not operating');
                                }}
                              >
                                <PauseCircle className="h-3.5 w-3.5" />
                                {toggling ? '…' : 'Mark not operating'}
                              </Button>
                            )}
                          </div>
                        )}
                        
                        <div className="flex gap-2">
                          <Button 
                            size="sm" 
                            variant="outline"
                            onClick={(e) => {
                              e.stopPropagation();
                              openResolveDialog(defect);
                            }}
                          >
                            Update Status
                          </Button>
                          <Button 
                            size="sm"
                            onClick={(e) => {
                              e.stopPropagation();
                              setSelectedDefect({ ...defect, ride_id: rideId } as any);
                              setResolveDialogOpen(true);
                            }}
                          >
                            <Check className="h-4 w-4 mr-2" />
                            {defect.severity === 'stop_operation' ? 'Close Defect' : 'Mark Resolved'}
                          </Button>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Defect Closure / Status Update Dialog */}
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

      {/* Photo Viewer */}
      <Dialog open={!!viewingPhoto} onOpenChange={() => setViewingPhoto(null)}>
        <DialogContent className="max-w-3xl p-0">
          {viewingPhoto && (
            <img
              src={viewingPhoto}
              alt="Defect photo"
              className="w-full h-auto max-h-[80vh] object-contain"
            />
          )}
        </DialogContent>
      </Dialog>
    </>
  );
};

export default DefectsList;
