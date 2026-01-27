import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { AlertTriangle, Clock, Wrench, AlertOctagon, ChevronDown, ChevronUp, Check, Eye, Loader2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { format } from 'date-fns';

type DefectSeverity = 'non_urgent' | 'urgent' | 'stop_operation';
type DefectStatus = 'open' | 'acknowledged' | 'in_progress' | 'resolved';

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
  const [defects, setDefects] = useState<Defect[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedDefect, setExpandedDefect] = useState<string | null>(null);
  const [resolveDialogOpen, setResolveDialogOpen] = useState(false);
  const [selectedDefect, setSelectedDefect] = useState<Defect | null>(null);
  const [resolutionNotes, setResolutionNotes] = useState('');
  const [resolvedBy, setResolvedBy] = useState('');
  const [newStatus, setNewStatus] = useState<DefectStatus>('resolved');
  const [updating, setUpdating] = useState(false);
  const [photoUrls, setPhotoUrls] = useState<{ [defectId: string]: string[] }>({});
  const [viewingPhoto, setViewingPhoto] = useState<string | null>(null);
  const { toast } = useToast();
  const { user } = useAuth();

  useEffect(() => {
    loadDefects();
  }, [rideId, showResolved]);

  const loadDefects = async () => {
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
      
      // Type assertion since we know the structure
      setDefects((data || []) as unknown as Defect[]);
      
      // Load photo URLs for defects with photos
      if (data) {
        const photosToLoad: { [key: string]: string[] } = {};
        for (const defect of data as unknown as Defect[]) {
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
      toast({
        title: "Error",
        description: "Failed to load defects",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const openResolveDialog = (defect: Defect) => {
    setSelectedDefect(defect);
    setResolvedBy('');
    setResolutionNotes('');
    setNewStatus(defect.status === 'open' ? 'acknowledged' : 'resolved');
    setResolveDialogOpen(true);
  };

  const handleUpdateStatus = async () => {
    if (!selectedDefect) return;

    setUpdating(true);
    try {
      const updateData: any = {
        status: newStatus
      };

      if (newStatus === 'resolved') {
        updateData.resolved_at = new Date().toISOString();
        updateData.resolved_by = resolvedBy.trim() || null;
        updateData.resolution_notes = resolutionNotes.trim() || null;
      }

      const { error } = await supabase
        .from('defects')
        .update(updateData)
        .eq('id', selectedDefect.id);

      if (error) throw error;

      toast({
        title: "Defect updated",
        description: newStatus === 'resolved' 
          ? "Defect marked as resolved" 
          : `Status changed to ${newStatus.replace('_', ' ')}`
      });

      setResolveDialogOpen(false);
      loadDefects();
      onDefectUpdated?.();
    } catch (error: any) {
      console.error('Error updating defect:', error);
      toast({
        title: "Error",
        description: "Failed to update defect",
        variant: "destructive"
      });
    } finally {
      setUpdating(false);
    }
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

  if (defects.length === 0) {
    return (
      <Card>
        <CardContent className="py-8 text-center text-muted-foreground">
          <AlertTriangle className="h-12 w-12 mx-auto mb-4 opacity-50" />
          <p>No {showResolved ? '' : 'open '}defects reported for this equipment</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <>
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
                            setSelectedDefect(defect);
                            setNewStatus('resolved');
                            setResolveDialogOpen(true);
                          }}
                        >
                          <Check className="h-4 w-4 mr-2" />
                          Mark Resolved
                        </Button>
                      </div>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Update Status Dialog */}
      <Dialog open={resolveDialogOpen} onOpenChange={setResolveDialogOpen}>
        <DialogContent className="w-[95vw] max-w-[95vw] sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Update Defect Status</DialogTitle>
            <DialogDescription>
              Change the status of this defect
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>New Status</Label>
              <Select value={newStatus} onValueChange={(v) => setNewStatus(v as DefectStatus)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="acknowledged">Acknowledged</SelectItem>
                  <SelectItem value="in_progress">In Progress</SelectItem>
                  <SelectItem value="resolved">Resolved</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {newStatus === 'resolved' && (
              <>
                <div className="space-y-2">
                  <Label htmlFor="resolved-by">Resolved By</Label>
                  <Input
                    id="resolved-by"
                    value={resolvedBy}
                    onChange={(e) => setResolvedBy(e.target.value)}
                    placeholder="Name of person who fixed it"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="resolution-notes">Resolution Notes</Label>
                  <Textarea
                    id="resolution-notes"
                    value={resolutionNotes}
                    onChange={(e) => setResolutionNotes(e.target.value)}
                    placeholder="What was done to fix the defect?"
                    rows={3}
                  />
                </div>
              </>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setResolveDialogOpen(false)} disabled={updating}>
              Cancel
            </Button>
            <Button onClick={handleUpdateStatus} disabled={updating}>
              {updating ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              Update Status
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

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
