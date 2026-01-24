import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { processCompanyLogo } from "@/utils/processCompanyLogo";
import { Image, Upload, X } from "lucide-react";

export type CompanyLogoValue = {
  file: File | null;
  previewUrl: string | null; // data URL
  remove: boolean;
};

type CompanyLogoFieldProps = {
  label?: string;
  disabled?: boolean;
  value: CompanyLogoValue;
  onChange: (next: CompanyLogoValue) => void;
  existingPreviewUrl?: string | null;
  // Copy shown under label
  helperText?: string;
};

export function CompanyLogoField({
  label = "Company Logo",
  disabled,
  value,
  onChange,
  existingPreviewUrl,
  helperText,
}: CompanyLogoFieldProps) {
  const { toast } = useToast();
  const [isProcessing, setIsProcessing] = useState(false);
  const [status, setStatus] = useState<{ kind: "idle" | "ready" | "error"; text: string }>(
    () => ({ kind: "idle", text: "" }),
  );

  const effectivePreviewUrl = useMemo(() => {
    if (value.previewUrl) return value.previewUrl;
    if (existingPreviewUrl && !value.remove) return existingPreviewUrl;
    return null;
  }, [existingPreviewUrl, value.previewUrl, value.remove]);

  const handleLogoChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = "";

    if (!file.type.startsWith("image/")) {
      setStatus({ kind: "error", text: "Not an image file." });
      toast({
        title: "Invalid File Format",
        description: "Please upload an image (JPG, PNG, or WebP).",
        variant: "destructive",
      });
      return;
    }

    const fileSizeMB = (file.size / (1024 * 1024)).toFixed(1);
    if (file.size > 5 * 1024 * 1024) {
      setStatus({ kind: "error", text: `File too large (${fileSizeMB}MB). Max is 5MB.` });
      toast({
        title: "File Too Large",
        description: `Your file is ${fileSizeMB}MB. Please upload an image smaller than 5MB.`,
        variant: "destructive",
      });
      return;
    }

    setIsProcessing(true);
    setStatus({ kind: "idle", text: "" });

    try {
      const result = await processCompanyLogo(file, { minPx: 200, outputSize: 512, outputType: "image/png" });

      onChange({ file: result.processedFile, previewUrl: result.previewDataUrl, remove: false });
      setStatus({
        kind: "ready",
        text: `Logo ready (${result.inputWidth}×${result.inputHeight}px → ${result.outputSize}×${result.outputSize}px). Click save to apply.`,
      });
      toast({
        title: "Logo Ready",
        description: "Preview generated. Save the form to apply it.",
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Could not process this image.";
      onChange({ file: null, previewUrl: null, remove: false });
      setStatus({ kind: "error", text: message });
      toast({
        title: "Image Not Accepted",
        description: message,
        variant: "destructive",
      });
    } finally {
      setIsProcessing(false);
    }
  };

  const handleRemove = () => {
    onChange({ file: null, previewUrl: null, remove: true });
    setStatus({ kind: "ready", text: "Logo will be removed when you save." });
  };

  return (
    <div className="space-y-2">
      <Label className="flex items-center gap-2 text-sm">
        <Image className="h-4 w-4 text-muted-foreground" />
        {label}
      </Label>

      {helperText ? (
        <p className="text-xs text-muted-foreground">{helperText}</p>
      ) : null}

      <div className="flex items-center gap-4">
        {/* Preview / placeholder */}
        <div className="relative">
          <div className="w-20 h-20 rounded-lg border bg-muted flex items-center justify-center overflow-hidden">
            {isProcessing ? (
              <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary" />
            ) : effectivePreviewUrl ? (
              <img
                src={effectivePreviewUrl}
                alt="Company logo preview"
                className="w-full h-full object-contain"
              />
            ) : (
              <div className="flex flex-col items-center justify-center gap-1 text-muted-foreground">
                <Upload className="h-5 w-5" />
                <span className="text-[10px]">Upload</span>
              </div>
            )}
          </div>

          {!isProcessing && effectivePreviewUrl ? (
            <Button
              type="button"
              variant="destructive"
              size="icon"
              className="absolute -top-2 -right-2 h-6 w-6"
              onClick={handleRemove}
              disabled={disabled}
            >
              <X className="h-3 w-3" />
            </Button>
          ) : null}
        </div>

        {/* Actions */}
        <label className="cursor-pointer">
          <input
            type="file"
            accept="image/jpeg,image/png,image/webp"
            onChange={handleLogoChange}
            className="hidden"
            disabled={disabled || isProcessing}
          />
          <Button type="button" variant="outline" size="sm" asChild>
            <span>
              <Upload className="h-4 w-4 mr-2" />
              {effectivePreviewUrl ? "Change" : "Choose"}
            </span>
          </Button>
        </label>
      </div>

      {status.text ? (
        <p className={status.kind === "error" ? "text-xs text-destructive" : "text-xs text-muted-foreground"}>
          {status.text}
        </p>
      ) : null}
    </div>
  );
}
