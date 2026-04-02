import { useState, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { AlertTriangle, Camera, X, Upload, Loader2, AlertOctagon, Clock, Wrench, ShieldAlert } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useEffectiveUserId } from '@/hooks/useEffectiveUserId';
import { useStaff } from '@/contexts/StaffContext';
import { compressImage, isLikelyCameraPhoto } from '@/utils/imageCompression';
import { useBillingWriteGuard } from '@/hooks/useBillingWriteGuard';
import { useAuditLog } from '@/hooks/useAuditLog';

const MAX_PHOTOS_PER_DEFECT = 5;

type DefectSeverity = 'non_urgent' | 'urgent' | 'stop_operation';

interface DefectReportFormProps {
  rideId: string;
  rideName: string;
  checkId?: string;
  checkFrequency?: string;
  onDefectReported?: () => void;
  onCriticalDefectReported?: () => void;
}

const severities: { value: DefectSeverity; label: string; description: string; operational: string; icon: typeof Clock; color: string; activeBorder: string }[] = [
  { value: 'non_urgent', label: 'Low', description: 'Minor issue — fix at next maintenance', operational: 'Monitor', icon: Clock, color: 'text-yellow-600 dark:text-yellow-400', activeBorder: 'border-yellow-500 bg-yellow-50 dark:bg-yellow-950/20' },
  { value: 'urgent', label: 'Important', description: 'Needs attention soon — use with caution', operational: 'Repair required', icon: Wrench, color: 'text-orange-600 dark:text-orange-400', activeBorder: 'border-orange-500 bg-orange-50 dark:bg-orange-950/20' },
  { value: 'stop_operation', label: 'Stop Use', description: 'CRITICAL — equipment must NOT be used', operational: 'Do not operate', icon: AlertOctagon, color: 'text-destructive', activeBorder: 'border-destructive bg-destructive/5' },
];

const DefectReportForm = ({
  rideId,
  rideName,
  checkId,
  checkFrequency,
  onDefectReported,
  onCriticalDefectReported,
}: DefectReportFormProps) => {
  const [description, setDescription] = useState('');
  const [severity, setSeverity] = useState<DefectSeverity>('non_urgent');
  const [locationOnRide, setLocationOnRide] = useState('');
  const [photos, setPhotos] = useState<File[]>([]);
  const [photoPreviewUrls, setPhotoPreviewUrls] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const lastSubmitRef = useRef<{ rideId: string; description: string; time: number } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();
  const { guardWrite } = useBillingWriteGuard();
  const { user } = useAuth();
  const { effectiveUserId, isStaff, actualUserId } = useEffectiveUserId();
  const { logEvent } = useAuditLog();

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
    if (guardWrite()) return;
    if (!description.trim()) {
      toast({ title: "Description required", description: "Please describe the defect", variant: "destructive" });
      return;
    }
    if (!user) {
      toast({ title: "Not authenticated", description: "Please log in", variant: "destructive" });
      return;
    }

    // Duplicate prevention: block same ride + same description within 60 seconds
    const now = Date.now();
    const trimmedDesc = description.trim();
    if (lastSubmitRef.current
      && lastSubmitRef.current.rideId === rideId
      && lastSubmitRef.current.description === trimmedDesc
      && now - lastSubmitRef.current.time < 60_000) {
      toast({ title: "Possible duplicate", description: "This defect was just reported. Please wait before submitting again.", variant: "destructive" });
      return;
    }

    setSubmitting(true);
    try {
      const photoPaths = await uploadPhotos();
      const { error } = await supabase.from('defects').insert({
        ride_id: rideId,
        check_id: checkId || null,
        user_id: effectiveUserId,
        reported_by_user_id: user.id,
        description: trimmedDesc,
        severity,
        location_on_ride: locationOnRide.trim() || null,
        photo_paths: photoPaths,
        status: 'open'
      } as any);
      if (error) throw error;

      lastSubmitRef.current = { rideId, description: trimmedDesc, time: Date.now() };

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

      logEvent('create', 'defect', undefined, { 
        ride: rideName, severity, description: description.trim().substring(0, 100),
        location: locationOnRide.trim() || null,
        photos: photoPaths.length,
        check_id: checkId || null,
      }, {
        after: { severity, status: 'open', description: description.trim().substring(0, 200), location_on_ride: locationOnRide.trim() || null },
        equipmentName: rideName,
        contextHint: checkId ? `from ${checkFrequency || 'check'}` : 'standalone defect report',
      });

      toast({
        title: "Defect reported",
        description: severity === 'stop_operation'
          ? "⛔ STOP USE: Equipment must not be used until repaired"
          : "The defect has been logged",
        variant: severity === 'stop_operation' ? 'destructive' : 'default'
      });

      onDefectReported?.();
      if (severity === 'stop_operation') onCriticalDefectReported?.();
    } catch (error: any) {
      toast({ title: "Error", description: error.message || "Failed to report defect", variant: "destructive" });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Card className="border-2 border-border">
      <CardHeader className="pb-4">
        <CardTitle className="text-base flex items-center gap-2">
          <AlertTriangle className="h-4 w-4 text-destructive" />
          Defect Details
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-5">
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
          <Textarea id="defect-description" value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Describe the defect..." rows={3} className="rounded-xl" />
        </div>

        {/* Location */}
        <div className="space-y-1.5">
          <Label htmlFor="location-on-ride" className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Location on equipment</Label>
          <Input id="location-on-ride" value={locationOnRide} onChange={(e) => setLocationOnRide(e.target.value)} placeholder="e.g. Front car, left side" className="rounded-xl h-10" />
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

        {/* Submit */}
        <Button
          onClick={handleSubmit}
          disabled={submitting || !description.trim()}
          variant={severity === 'stop_operation' ? 'destructive' : 'default'}
          className="w-full h-11 rounded-xl gap-1.5"
        >
          {submitting ? <><Loader2 className="h-4 w-4 animate-spin" />Reporting...</> : 'Report Defect'}
        </Button>
      </CardContent>
    </Card>
  );
};

export default DefectReportForm;
