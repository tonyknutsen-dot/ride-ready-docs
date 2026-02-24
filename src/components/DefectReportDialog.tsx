import { useState, useRef } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { AlertTriangle, Camera, X, Upload, Loader2, AlertOctagon, Clock, Wrench } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useEffectiveUserId } from '@/hooks/useEffectiveUserId';
import { compressImage, isLikelyCameraPhoto } from '@/utils/imageCompression';

const MAX_PHOTOS_PER_DEFECT = 5;

type DefectSeverity = 'non_urgent' | 'urgent' | 'stop_operation';

interface DefectReportDialogProps {
  rideId: string;
  rideName: string;
  checkId?: string;
  checkFrequency?: string;
  onDefectReported?: () => void;
  onCriticalDefectReported?: () => void;
  trigger?: React.ReactNode;
}

const DefectReportDialog = ({ 
  rideId, rideName, checkId, checkFrequency,
  onDefectReported, onCriticalDefectReported, trigger 
}: DefectReportDialogProps) => {
  const [open, setOpen] = useState(false);
  const [description, setDescription] = useState('');
  const [severity, setSeverity] = useState<DefectSeverity>('non_urgent');
  const [locationOnRide, setLocationOnRide] = useState('');
  const [photos, setPhotos] = useState<File[]>([]);
  const [photoPreviewUrls, setPhotoPreviewUrls] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();
  const { user } = useAuth();
  const { effectiveUserId, isStaff, actualUserId } = useEffectiveUserId();

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
    if (photos.length === 0) return [];
    const uploadedPaths: string[] = [];
    for (const photo of photos) {
      const fileName = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}.jpg`;
      const filePath = `${user?.id}/${rideId}/${fileName}`;
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
    if (!user) {
      toast({ title: "Not authenticated", description: "Please log in", variant: "destructive" });
      return;
    }

    setSubmitting(true);
    try {
      const photoPaths = await uploadPhotos();
      const { error } = await supabase.from('defects').insert({
        ride_id: rideId,
        check_id: checkId || null,
        user_id: effectiveUserId,
        description: description.trim(),
        severity,
        location_on_ride: locationOnRide.trim() || null,
        photo_paths: photoPaths,
        status: 'open'
      });
      if (error) throw error;

      // Notify controller if staff
      if (isStaff && effectiveUserId && actualUserId !== effectiveUserId) {
        const severityLabel = severity === 'stop_operation' ? '🛑 STOP USE' : severity === 'urgent' ? '⚠️ Important' : 'Low';
        await supabase.from('notifications').insert({
          user_id: effectiveUserId,
          title: `Defect reported: ${rideName}`,
          message: `${severityLabel} defect on ${rideName}: ${description.trim().substring(0, 100)}`,
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

      // Reset
      setDescription('');
      setSeverity('non_urgent');
      setLocationOnRide('');
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

  const severities: { value: DefectSeverity; label: string; description: string; icon: typeof Clock; color: string }[] = [
    { value: 'non_urgent', label: 'Low', description: 'Minor issue — fix at next maintenance', icon: Clock, color: 'text-yellow-600 dark:text-yellow-400' },
    { value: 'urgent', label: 'Important', description: 'Needs attention soon — use with caution', icon: Wrench, color: 'text-orange-600 dark:text-orange-400' },
    { value: 'stop_operation', label: 'Stop Use', description: 'CRITICAL — equipment must NOT be used', icon: AlertOctagon, color: 'text-destructive' },
  ];

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger || (
          <Button variant="outline" size="sm" className="gap-2 text-orange-600 border-orange-300 hover:bg-orange-50 dark:text-orange-400 dark:border-orange-700 dark:hover:bg-orange-950">
            <AlertTriangle className="h-4 w-4" />
            Report Defect
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="w-[95vw] max-w-[95vw] sm:max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-orange-500" />
            Report Defect
          </DialogTitle>
          <DialogDescription>
            Log a defect on <strong>{rideName}</strong>.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5 py-4">
          {/* Severity */}
          <div className="space-y-3">
            <Label className="text-sm font-medium">Severity *</Label>
            <RadioGroup value={severity} onValueChange={(v) => setSeverity(v as DefectSeverity)} className="space-y-2">
              {severities.map((sev) => {
                const Icon = sev.icon;
                return (
                  <label
                    key={sev.value}
                    className={`flex items-start gap-3 p-3 border rounded-lg cursor-pointer transition-colors ${
                      severity === sev.value
                        ? sev.value === 'stop_operation' ? 'border-destructive bg-destructive/5' : 'border-primary bg-primary/5'
                        : 'border-border hover:border-muted-foreground/50'
                    }`}
                  >
                    <RadioGroupItem value={sev.value} className="mt-0.5" />
                    <div className="flex-1">
                      <div className={`flex items-center gap-2 font-medium ${sev.color}`}>
                        <Icon className="h-4 w-4" />
                        {sev.label}
                      </div>
                      <p className="text-xs text-muted-foreground mt-1">{sev.description}</p>
                    </div>
                  </label>
                );
              })}
            </RadioGroup>
          </div>

          {/* Description */}
          <div className="space-y-2">
            <Label htmlFor="defect-description">Description *</Label>
            <Textarea id="defect-description" value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Describe the defect..." rows={3} />
          </div>

          {/* Location */}
          <div className="space-y-2">
            <Label htmlFor="location-on-ride">Location on equipment</Label>
            <Input id="location-on-ride" value={locationOnRide} onChange={(e) => setLocationOnRide(e.target.value)} placeholder="e.g. Front car, left side" />
          </div>

          {/* Photos */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label>Photos</Label>
              <span className="text-xs text-muted-foreground">{photos.length}/{MAX_PHOTOS_PER_DEFECT}</span>
            </div>
            {photoPreviewUrls.length > 0 && (
              <div className="grid grid-cols-3 gap-2">
                {photoPreviewUrls.map((url, index) => (
                  <div key={index} className="relative aspect-square">
                    <img src={url} alt="" className="w-full h-full object-cover rounded-lg border" />
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
                <Button type="button" variant="outline" onClick={() => fileInputRef.current?.click()} className="flex-1 gap-2">
                  <Camera className="h-4 w-4" /> Take Photo
                </Button>
                <Button type="button" variant="outline" onClick={() => {
                  if (fileInputRef.current) {
                    fileInputRef.current.removeAttribute('capture');
                    fileInputRef.current.click();
                    setTimeout(() => fileInputRef.current?.setAttribute('capture', 'environment'), 100);
                  }
                }} className="flex-1 gap-2">
                  <Upload className="h-4 w-4" /> Upload
                </Button>
              </div>
            )}
          </div>
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="outline" onClick={() => setOpen(false)} disabled={submitting}>Cancel</Button>
          <Button onClick={handleSubmit} disabled={submitting || !description.trim()} variant={severity === 'stop_operation' ? 'destructive' : 'default'}>
            {submitting ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Reporting...</> : 'Report Defect'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default DefectReportDialog;
