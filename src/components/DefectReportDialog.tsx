import { useState, useRef } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Badge } from '@/components/ui/badge';
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
  rideId, 
  rideName, 
  checkId,
  checkFrequency,
  onDefectReported,
  onCriticalDefectReported,
  trigger 
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
      toast({
        title: "Photo limit reached",
        description: `Maximum ${MAX_PHOTOS_PER_DEFECT} photos allowed per defect`,
        variant: "destructive"
      });
      return;
    }

    const filesToAdd = files.slice(0, remainingSlots);
    
    // Compress photos if from camera
    const processedFiles = await Promise.all(
      filesToAdd.map(async (file) => {
        if (isLikelyCameraPhoto(file)) {
          try {
            return await compressImage(file, 1920, 1920, 0.85);
          } catch {
            return file;
          }
        }
        return file;
      })
    );

    // Create preview URLs
    const newPreviewUrls = processedFiles.map(file => URL.createObjectURL(file));
    
    setPhotos(prev => [...prev, ...processedFiles]);
    setPhotoPreviewUrls(prev => [...prev, ...newPreviewUrls]);

    // Reset input
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
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

      const { error } = await supabase.storage
        .from('defect-photos')
        .upload(filePath, photo, {
          contentType: 'image/jpeg',
          upsert: false
        });

      if (error) {
        console.error('Error uploading photo:', error);
        throw new Error('Failed to upload photo');
      }

      uploadedPaths.push(filePath);
    }

    return uploadedPaths;
  };

  const handleSubmit = async () => {
    if (!description.trim()) {
      toast({
        title: "Description required",
        description: "Please describe the defect",
        variant: "destructive"
      });
      return;
    }

    if (!user) {
      toast({
        title: "Not authenticated",
        description: "Please log in to report defects",
        variant: "destructive"
      });
      return;
    }

    setSubmitting(true);

    try {
      // Upload photos first
      const photoPaths = await uploadPhotos();

      // Insert defect record - use effectiveUserId so staff data syncs with operator
      const { error } = await supabase
        .from('defects')
        .insert({
          ride_id: rideId,
          check_id: checkId || null,
          user_id: effectiveUserId,
          description: description.trim(),
          severity: severity,
          location_on_ride: locationOnRide.trim() || null,
          photo_paths: photoPaths,
          status: 'open'
        });

      if (error) throw error;

      // Notify the controller (org owner) when a staff member reports a defect
      if (isStaff && effectiveUserId && actualUserId !== effectiveUserId) {
        const severityLabel = severity === 'stop_operation' ? '🛑 STOP OPERATION' : severity === 'urgent' ? '⚠️ Urgent' : 'Non-urgent';
        await supabase.from('notifications').insert({
          user_id: effectiveUserId,
          title: `Staff defect report: ${rideName}`,
          message: `${severityLabel} defect reported on ${rideName}: ${description.trim().substring(0, 100)}${description.trim().length > 100 ? '...' : ''}`,
          type: severity === 'stop_operation' ? 'alert' : 'warning',
          related_table: 'defects',
        }).then(({ error: notifError }) => {
          if (notifError) console.error('Failed to notify controller:', notifError);
        });
      }

      toast({
        title: "Defect reported",
        description: severity === 'stop_operation' 
          ? "⚠️ CRITICAL: Equipment marked as requiring repair before operation"
          : "The defect has been logged successfully",
        variant: severity === 'stop_operation' ? 'destructive' : 'default'
      });

      // Reset form
      setDescription('');
      setSeverity('non_urgent');
      setLocationOnRide('');
      photoPreviewUrls.forEach(url => URL.revokeObjectURL(url));
      setPhotos([]);
      setPhotoPreviewUrls([]);
      setOpen(false);

      onDefectReported?.();

      // Trigger critical defect flow if stop_operation
      if (severity === 'stop_operation') {
        onCriticalDefectReported?.();
      }
    } catch (error: any) {
      console.error('Error reporting defect:', error);
      toast({
        title: "Error",
        description: error.message || "Failed to report defect",
        variant: "destructive"
      });
    } finally {
      setSubmitting(false);
    }
  };

  const getSeverityInfo = (sev: DefectSeverity) => {
    switch (sev) {
      case 'non_urgent':
        return { 
          label: 'Non-Urgent', 
          description: 'Minor issue - can be addressed at next scheduled maintenance',
          icon: Clock,
          color: 'text-yellow-600 dark:text-yellow-400',
          badgeVariant: 'secondary' as const
        };
      case 'urgent':
        return { 
          label: 'Urgent', 
          description: 'Needs attention soon - equipment can continue operating with caution',
          icon: Wrench,
          color: 'text-orange-600 dark:text-orange-400',
          badgeVariant: 'default' as const
        };
      case 'stop_operation':
        return { 
          label: 'Stop Operation', 
          description: 'CRITICAL - Equipment must NOT be operated until repaired',
          icon: AlertOctagon,
          color: 'text-destructive',
          badgeVariant: 'destructive' as const
        };
    }
  };

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
            Report a defect found on <strong>{rideName}</strong>. Include photos and select the appropriate severity level.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5 py-4">
          {/* Severity Selection */}
          <div className="space-y-3">
            <Label className="text-sm font-medium">Severity Level *</Label>
            <RadioGroup 
              value={severity} 
              onValueChange={(value) => setSeverity(value as DefectSeverity)}
              className="space-y-3"
            >
              {(['non_urgent', 'urgent', 'stop_operation'] as DefectSeverity[]).map((sev) => {
                const info = getSeverityInfo(sev);
                const Icon = info.icon;
                return (
                  <label 
                    key={sev}
                    className={`flex items-start gap-3 p-3 border rounded-lg cursor-pointer transition-colors ${
                      severity === sev 
                        ? sev === 'stop_operation' 
                          ? 'border-destructive bg-destructive/5' 
                          : 'border-primary bg-primary/5'
                        : 'border-border hover:border-muted-foreground/50'
                    }`}
                  >
                    <RadioGroupItem value={sev} className="mt-0.5" />
                    <div className="flex-1">
                      <div className={`flex items-center gap-2 font-medium ${info.color}`}>
                        <Icon className="h-4 w-4" />
                        {info.label}
                      </div>
                      <p className="text-xs text-muted-foreground mt-1">
                        {info.description}
                      </p>
                    </div>
                  </label>
                );
              })}
            </RadioGroup>
          </div>

          {/* Description */}
          <div className="space-y-2">
            <Label htmlFor="defect-description">Description *</Label>
            <Textarea
              id="defect-description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Describe the defect in detail..."
              rows={3}
            />
          </div>

          {/* Location on Ride */}
          <div className="space-y-2">
            <Label htmlFor="location-on-ride">Location on Equipment</Label>
            <Input
              id="location-on-ride"
              value={locationOnRide}
              onChange={(e) => setLocationOnRide(e.target.value)}
              placeholder="e.g. Front car, left side, seat belt buckle"
            />
          </div>

          {/* Photo Upload */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label>Photos</Label>
              <span className="text-xs text-muted-foreground">
                {photos.length}/{MAX_PHOTOS_PER_DEFECT} photos
              </span>
            </div>

            {/* Photo Previews */}
            {photoPreviewUrls.length > 0 && (
              <div className="grid grid-cols-3 gap-2">
                {photoPreviewUrls.map((url, index) => (
                  <div key={index} className="relative aspect-square">
                    <img
                      src={url}
                      alt={`Defect photo ${index + 1}`}
                      className="w-full h-full object-cover rounded-lg border"
                    />
                    <button
                      type="button"
                      onClick={() => removePhoto(index)}
                      className="absolute -top-2 -right-2 p-1 bg-destructive text-destructive-foreground rounded-full shadow-md hover:bg-destructive/90"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </div>
                ))}
              </div>
            )}

            {/* Upload Button */}
            {photos.length < MAX_PHOTOS_PER_DEFECT && (
              <div className="flex gap-2">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  capture="environment"
                  multiple
                  onChange={handlePhotoSelect}
                  className="hidden"
                />
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => fileInputRef.current?.click()}
                  className="flex-1 gap-2"
                >
                  <Camera className="h-4 w-4" />
                  Take Photo
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    if (fileInputRef.current) {
                      fileInputRef.current.removeAttribute('capture');
                      fileInputRef.current.click();
                      // Re-add capture attribute after click
                      setTimeout(() => {
                        fileInputRef.current?.setAttribute('capture', 'environment');
                      }, 100);
                    }
                  }}
                  className="flex-1 gap-2"
                >
                  <Upload className="h-4 w-4" />
                  Upload
                </Button>
              </div>
            )}
          </div>
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="outline" onClick={() => setOpen(false)} disabled={submitting}>
            Cancel
          </Button>
          <Button 
            onClick={handleSubmit} 
            disabled={submitting || !description.trim()}
            variant={severity === 'stop_operation' ? 'destructive' : 'default'}
          >
            {submitting ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Reporting...
              </>
            ) : (
              'Report Defect'
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default DefectReportDialog;
