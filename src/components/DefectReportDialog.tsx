import { useState, useRef, useEffect } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { AlertTriangle, Camera, X, Upload, Loader2, AlertOctagon, Clock, Wrench, ChevronRight, ShieldAlert } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useEffectiveUserId } from '@/hooks/useEffectiveUserId';
import { useStaff } from '@/contexts/StaffContext';
import { compressImage, isLikelyCameraPhoto } from '@/utils/imageCompression';

const MAX_PHOTOS_PER_DEFECT = 5;

type DefectSeverity = 'non_urgent' | 'urgent' | 'stop_operation';

interface RideOption {
  id: string;
  ride_name: string;
}

interface DefectReportDialogProps {
  rideId?: string;
  rideName?: string;
  checkId?: string;
  checkFrequency?: string;
  onDefectReported?: () => void;
  onCriticalDefectReported?: () => void;
  trigger?: React.ReactNode;
  defaultDescription?: string;
}

const DefectReportDialog = ({ 
  rideId, rideName, checkId, checkFrequency,
  onDefectReported, onCriticalDefectReported, trigger,
  defaultDescription,
}: DefectReportDialogProps) => {
  const [open, setOpen] = useState(false);
  const [description, setDescription] = useState(defaultDescription || '');
  const [severity, setSeverity] = useState<DefectSeverity>('non_urgent');
  const [locationOnRide, setLocationOnRide] = useState('');
  const [photos, setPhotos] = useState<File[]>([]);
  const [photoPreviewUrls, setPhotoPreviewUrls] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();
  const { user } = useAuth();
  const { effectiveUserId, isStaff, actualUserId } = useEffectiveUserId();
  const { isStaff: isStaffContext } = useStaff();

  const needsRideSelection = !rideId;
  const [selectedRideId, setSelectedRideId] = useState<string | null>(null);
  const [selectedRideName, setSelectedRideName] = useState<string | null>(null);
  const [rides, setRides] = useState<RideOption[]>([]);
  const [loadingRides, setLoadingRides] = useState(false);

  const effectiveRideId = rideId || selectedRideId;
  const effectiveRideName = rideName || selectedRideName;

  useEffect(() => {
    if (open && needsRideSelection && effectiveUserId) {
      loadRides();
    }
  }, [open, needsRideSelection, effectiveUserId]);

  const loadRides = async () => {
    setLoadingRides(true);
    try {
      let query = supabase.from('rides').select('id, ride_name').order('ride_name');
      if (!isStaffContext) query = query.eq('user_id', effectiveUserId);
      const { data, error } = await query;
      if (error) throw error;
      setRides(data || []);
    } catch { setRides([]); }
    finally { setLoadingRides(false); }
  };

  const handlePhotoSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;
    const remainingSlots = MAX_PHOTOS_PER_DEFECT - photos.length;
    if (remainingSlots <= 0) {
      toast({ title: "Photo limit reached", description: `Maximum ${MAX_PHOTOS_PER_DEFECT} photos`, variant: "destructive" });
      return;
    }
    const filesToAdd = files.slice(0, remainingSlots);
    const processedFiles = await Promise.all(
      filesToAdd.map(async (file) => {
        if (isLikelyCameraPhoto(file)) {
          try { return await compressImage(file, 1920, 1920, 0.85); } catch { return file; }
        }
        return file;
      })
    );
    const newPreviewUrls = processedFiles.map(file => URL.createObjectURL(file));
    setPhotos(prev => [...prev, ...processedFiles]);
    setPhotoPreviewUrls(prev => [...prev, ...newPreviewUrls]);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const removePhoto = (index: number) => {
    URL.revokeObjectURL(photoPreviewUrls[index]);
    setPhotos(prev => prev.filter((_, i) => i !== index));
    setPhotoPreviewUrls(prev => prev.filter((_, i) => i !== index));
  };

  const uploadPhotos = async (): Promise<string[]> => {
    if (photos.length === 0 || !effectiveRideId) return [];
    const uploadedPaths: string[] = [];
    for (const photo of photos) {
      const fileName = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}.jpg`;
      const filePath = `${user?.id}/${effectiveRideId}/${fileName}`;
      const { error } = await supabase.storage.from('defect-photos').upload(filePath, photo, { contentType: 'image/jpeg', upsert: false });
      if (error) throw new Error('Failed to upload photo');
      uploadedPaths.push(filePath);
    }
    return uploadedPaths;
  };

  const handleSubmit = async () => {
    if (!description.trim()) {
      toast({ title: "Description required", description: "Please describe the defect", variant: "destructive" });
      return;
    }
    if (!effectiveRideId) {
      toast({ title: "Equipment required", description: "Please select the equipment", variant: "destructive" });
      return;
    }
    if (!user) {
      toast({ title: "Not authenticated", description: "Please log in", variant: "destructive" });
      return;
    }

    setSubmitting(true);
    try {
      const photoPaths = await uploadPhotos();
      const { error } = await supabase.from('defects').insert({
        ride_id: effectiveRideId,
        check_id: checkId || null,
        user_id: effectiveUserId,
        description: description.trim(),
        severity,
        location_on_ride: locationOnRide.trim() || null,
        photo_paths: photoPaths,
        status: 'open'
      });
      if (error) throw error;

      if (isStaff && effectiveUserId && actualUserId !== effectiveUserId) {
        const severityLabel = severity === 'stop_operation' ? '🛑 STOP USE' : severity === 'urgent' ? '⚠️ Important' : 'Low';
        await supabase.from('notifications').insert({
          user_id: effectiveUserId,
          title: `Defect reported: ${effectiveRideName}`,
          message: `${severityLabel} defect on ${effectiveRideName}: ${description.trim().substring(0, 100)}`,
          type: severity === 'stop_operation' ? 'alert' : 'warning',
          related_table: 'defects',
        });
      }

      toast({
        title: "Defect reported",
        description: severity === 'stop_operation'
          ? "⛔ STOP USE: Equipment must not be used until repaired"
          : "The defect has been logged",
        variant: severity === 'stop_operation' ? 'destructive' : 'default'
      });

      setDescription('');
      setSeverity('non_urgent');
      setLocationOnRide('');
      setSelectedRideId(null);
      setSelectedRideName(null);
      photoPreviewUrls.forEach(url => URL.revokeObjectURL(url));
      setPhotos([]);
      setPhotoPreviewUrls([]);
      setOpen(false);
      onDefectReported?.();
      if (severity === 'stop_operation') onCriticalDefectReported?.();
    } catch (error: any) {
      toast({ title: "Error", description: error.message || "Failed to report defect", variant: "destructive" });
    } finally {
      setSubmitting(false);
    }
  };

  const handleClose = () => {
    setOpen(false);
    setSelectedRideId(null);
    setSelectedRideName(null);
  };

  const severities: { value: DefectSeverity; label: string; description: string; operational: string; icon: typeof Clock; color: string; activeBorder: string }[] = [
    { value: 'non_urgent', label: 'Low', description: 'Minor issue — fix at next maintenance', operational: 'Monitor', icon: Clock, color: 'text-yellow-600 dark:text-yellow-400', activeBorder: 'border-yellow-500 bg-yellow-50 dark:bg-yellow-950/20' },
    { value: 'urgent', label: 'Important', description: 'Needs attention soon — use with caution', operational: 'Repair required', icon: Wrench, color: 'text-orange-600 dark:text-orange-400', activeBorder: 'border-orange-500 bg-orange-50 dark:bg-orange-950/20' },
    { value: 'stop_operation', label: 'Stop Use', description: 'CRITICAL — equipment must NOT be used', operational: 'Do not operate', icon: AlertOctagon, color: 'text-destructive', activeBorder: 'border-destructive bg-destructive/5' },
  ];

  const showRideSelector = needsRideSelection && !selectedRideId;

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) handleClose(); else setOpen(true); }}>
      <DialogTrigger asChild>
        {trigger || (
          <Button variant="outline" size="sm" className="gap-2 text-orange-600 border-orange-300 hover:bg-orange-50 dark:text-orange-400 dark:border-orange-700 dark:hover:bg-orange-950">
            <AlertTriangle className="h-4 w-4" />
            Report Defect
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="w-[95vw] max-w-[95vw] sm:max-w-lg max-h-[85dvh] flex flex-col p-0 gap-0">
        {showRideSelector ? (
          <>
            <div className="px-6 pt-6 pb-3 shrink-0">
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-xl bg-orange-100 dark:bg-orange-900/30 flex items-center justify-center shrink-0">
                    <AlertTriangle className="h-4 w-4 text-orange-600 dark:text-orange-400" />
                  </div>
                  Report Defect
                </DialogTitle>
                <DialogDescription className="pt-1">
                  Select the piece of equipment with the defect.
                </DialogDescription>
              </DialogHeader>
            </div>
            <div className="flex-1 overflow-y-auto px-6 pb-[max(16px,env(safe-area-inset-bottom))]">
              <div className="py-3 space-y-1.5">
                {loadingRides ? (
                  <div className="flex items-center justify-center py-10">
                    <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                  </div>
                ) : rides.length === 0 ? (
                  <div className="text-center py-10 space-y-2">
                    <Wrench className="h-8 w-8 text-muted-foreground/30 mx-auto" />
                    <p className="text-sm text-muted-foreground">No equipment found. Add equipment first.</p>
                  </div>
                ) : (
                  rides.map((ride) => (
                    <button
                      key={ride.id}
                      type="button"
                      onClick={() => {
                        setSelectedRideId(ride.id);
                        setSelectedRideName(ride.ride_name);
                      }}
                      className="w-full flex items-center justify-between gap-3 px-3.5 py-3 rounded-xl border border-border bg-card hover:bg-accent/50 hover:border-primary/20 transition-all text-left active:scale-[0.98] group"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="w-8 h-8 rounded-lg bg-muted/60 flex items-center justify-center shrink-0 group-hover:bg-primary/10 transition-colors">
                          <Wrench className="h-3.5 w-3.5 text-muted-foreground group-hover:text-primary transition-colors" />
                        </div>
                        <span className="text-sm font-medium text-foreground truncate">{ride.ride_name}</span>
                      </div>
                      <ChevronRight className="h-4 w-4 text-muted-foreground/40 group-hover:text-muted-foreground shrink-0 transition-colors" />
                    </button>
                  ))
                )}
              </div>
            </div>
            <div className="sticky bottom-0 bg-background/95 backdrop-blur border-t px-6 py-3 pb-[max(12px,env(safe-area-inset-bottom))] shrink-0">
              <Button type="button" variant="outline" onClick={handleClose} className="rounded-lg w-full">Cancel</Button>
            </div>
          </>
        ) : (
          <>
            <div className="px-6 pt-6 pb-3 shrink-0">
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-xl bg-orange-100 dark:bg-orange-900/30 flex items-center justify-center shrink-0">
                    <AlertTriangle className="h-4 w-4 text-orange-600 dark:text-orange-400" />
                  </div>
                  Report Defect
                </DialogTitle>
                <DialogDescription className="pt-1">
                  <span className="flex items-center gap-1.5 flex-wrap">
                    Logging on <strong className="text-foreground">{effectiveRideName}</strong>
                    {needsRideSelection && (
                      <button
                        type="button"
                        onClick={() => { setSelectedRideId(null); setSelectedRideName(null); }}
                        className="text-primary hover:underline text-xs font-medium"
                      >
                        Change
                      </button>
                    )}
                  </span>
                </DialogDescription>
              </DialogHeader>
            </div>

            <div className="flex-1 overflow-y-auto px-6 pb-[max(16px,env(safe-area-inset-bottom))]">
              <div className="space-y-5 py-4">
                {/* Severity */}
                <div className="space-y-2.5">
                  <Label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Severity *</Label>
                  <RadioGroup value={severity} onValueChange={(v) => setSeverity(v as DefectSeverity)} className="space-y-2">
                    {severities.map((sev) => {
                      const Icon = sev.icon;
                      const isActive = severity === sev.value;
                      return (
                        <label
                          key={sev.value}
                          className={`flex items-start gap-3 p-3.5 border rounded-xl cursor-pointer transition-all ${
                            isActive ? sev.activeBorder : 'border-border hover:border-muted-foreground/30'
                          }`}
                        >
                          <RadioGroupItem value={sev.value} className="mt-0.5" />
                          <div className="flex-1">
                            <div className={`flex items-center gap-2 font-semibold text-sm ${sev.color}`}>
                              <Icon className="h-4 w-4" />
                              {sev.label}
                            </div>
                            <p className="text-xs text-muted-foreground mt-0.5">{sev.description}</p>
                            <p className="text-[10px] text-muted-foreground/75 mt-0.5">Operational: {sev.operational}</p>
                          </div>
                        </label>
                      );
                    })}
                  </RadioGroup>
                </div>

                {/* Description */}
                <div className="space-y-1.5">
                  <Label htmlFor="defect-description" className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Description *</Label>
                  <Textarea
                    id="defect-description"
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="Describe the defect..."
                    rows={3}
                    className="rounded-xl"
                    onFocus={(e) => requestAnimationFrame(() => setTimeout(() => e.target.scrollIntoView({ block: 'center', behavior: 'smooth' }), 120))}
                  />
                </div>

                {/* Location */}
                <div className="space-y-1.5">
                  <Label htmlFor="location-on-ride" className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Location on equipment</Label>
                  <Input
                    id="location-on-ride"
                    value={locationOnRide}
                    onChange={(e) => setLocationOnRide(e.target.value)}
                    placeholder="e.g. Front car, left side"
                    className="rounded-xl h-10"
                    onFocus={(e) => requestAnimationFrame(() => setTimeout(() => e.target.scrollIntoView({ block: 'center', behavior: 'smooth' }), 120))}
                  />
                </div>

                {/* Photos */}
                <div className="space-y-2.5">
                  <div className="flex items-center justify-between">
                    <Label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Evidence photos</Label>
                    <span className="text-[10px] text-muted-foreground">{photos.length}/{MAX_PHOTOS_PER_DEFECT}</span>
                  </div>
                  {photoPreviewUrls.length > 0 && (
                    <div className="grid grid-cols-3 gap-2">
                      {photoPreviewUrls.map((url, index) => (
                        <div key={index} className="relative aspect-square">
                          <img src={url} alt="" className="w-full h-full object-cover rounded-xl border border-border" />
                          <button type="button" onClick={() => removePhoto(index)} className="absolute -top-2 -right-2 p-1 bg-destructive text-destructive-foreground rounded-full shadow-md">
                            <X className="h-3 w-3" />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                  {photos.length < MAX_PHOTOS_PER_DEFECT && (
                    <div className="flex gap-2">
                      <input ref={fileInputRef} type="file" accept="image/*" capture="environment" multiple onChange={handlePhotoSelect} className="hidden" />
                      <Button type="button" variant="outline" onClick={() => fileInputRef.current?.click()} className="flex-1 gap-2 h-10 rounded-xl">
                        <Camera className="h-4 w-4" /> Take Photo
                      </Button>
                      <Button type="button" variant="outline" onClick={() => {
                        if (fileInputRef.current) {
                          fileInputRef.current.removeAttribute('capture');
                          fileInputRef.current.click();
                          setTimeout(() => fileInputRef.current?.setAttribute('capture', 'environment'), 100);
                        }
                      }} className="flex-1 gap-2 h-10 rounded-xl">
                        <Upload className="h-4 w-4" /> Upload
                      </Button>
                    </div>
                  )}
                </div>

                {/* Stop-use warning */}
                {severity === 'stop_operation' && (
                  <div className="flex items-center gap-2.5 px-3.5 py-3 rounded-xl bg-destructive/10 border border-destructive/25">
                    <ShieldAlert className="h-4 w-4 text-destructive shrink-0" />
                    <p className="text-xs font-semibold text-destructive">
                      This will flag the equipment as "Do not operate" until the defect is closed.
                    </p>
                  </div>
                )}
              </div>
            </div>

            <div className="sticky bottom-0 bg-background/95 backdrop-blur border-t px-6 py-3 pb-[max(12px,env(safe-area-inset-bottom))] flex flex-col-reverse sm:flex-row sm:justify-end gap-2 sm:gap-2 shrink-0">
              <Button type="button" variant="outline" onClick={handleClose} disabled={submitting} className="rounded-lg">Cancel</Button>
              <Button
                type="button"
                onClick={handleSubmit}
                disabled={submitting || !description.trim()}
                variant={severity === 'stop_operation' ? 'destructive' : 'default'}
                className="rounded-lg gap-1.5"
              >
                {submitting ? <><Loader2 className="h-4 w-4 animate-spin" />Reporting...</> : 'Report Defect'}
              </Button>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default DefectReportDialog;
