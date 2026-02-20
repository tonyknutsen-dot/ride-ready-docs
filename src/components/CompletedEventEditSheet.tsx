import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { CalendarIcon, Save, Loader2, Upload, Camera, X } from "lucide-react";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { formatDateUK } from "@/utils/dateFormat";
import { compressImage } from "@/utils/imageCompression";

interface CompletedEventEditSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  event: {
    id: string;
    eventName: string;
    eventType: string;
    category: string;
    rideName: string;
    rideId: string | null;
    completedAt: string;
    inspectorCompany: string | null;
    certificateReference: string | null;
    completionNotes: string | null;
    evidenceUrls: string[];
    documentId: string | null;
  };
}

const CompletedEventEditSheet = ({ open, onOpenChange, event }: CompletedEventEditSheetProps) => {
  const queryClient = useQueryClient();
  const [saving, setSaving] = useState(false);
  const [completionDate, setCompletionDate] = useState<Date>(
    event.completedAt ? new Date(event.completedAt) : new Date()
  );
  const [inspectorCompany, setInspectorCompany] = useState(event.inspectorCompany || "");
  const [certificateReference, setCertificateReference] = useState(event.certificateReference || "");
  const [notes, setNotes] = useState(event.completionNotes || "");
  const [newFiles, setNewFiles] = useState<File[]>([]);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    setNewFiles(prev => [...prev, ...files]);
  };

  const handleCameraCapture = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    setNewFiles(prev => [...prev, ...files]);
  };

  const removeNewFile = (index: number) => {
    setNewFiles(prev => prev.filter((_, i) => i !== index));
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      // Upload any new files
      let uploadedPaths: string[] = [];
      for (const file of newFiles) {
        let fileToUpload = file;
        if (file.type.startsWith("image/") && file.size > 500_000) {
          fileToUpload = await compressImage(file);
        }
        const ext = file.name.split(".").pop() || "file";
        const path = `evidence/${event.id}/${Date.now()}_${Math.random().toString(36).slice(2)}.${ext}`;
        const { error } = await supabase.storage
          .from("ride-documents")
          .upload(path, fileToUpload, { contentType: file.type });
        if (!error) uploadedPaths.push(path);
      }

      const allEvidence = [...(event.evidenceUrls || []), ...uploadedPaths];

      // Update the compliance event
      const { error: eventError } = await supabase
        .from("compliance_events")
        .update({
          completed_at: completionDate.toISOString(),
          inspector_company: inspectorCompany || null,
          certificate_reference: certificateReference || null,
          completion_notes: notes || null,
          evidence_urls: allEvidence.length > 0 ? allEvidence : [],
        })
        .eq("id", event.id);

      if (eventError) throw eventError;

      // Update the linked document if exists
      if (event.documentId) {
        const noteParts = [
          inspectorCompany ? `Inspector: ${inspectorCompany}` : null,
          certificateReference ? `Ref: ${certificateReference}` : null,
          notes,
          `Compliance event: ${event.eventName}`,
          `Event ID: ${event.id}`,
        ].filter(Boolean).join("\n");

        const dateStr = format(completionDate, "dd MMM yyyy");
        const docName = `${event.eventType} – Completed ${dateStr}`;

        await supabase
          .from("documents")
          .update({
            document_name: docName,
            notes: noteParts,
          })
          .eq("id", event.documentId);
      }

      toast.success("Completion record updated");
      queryClient.invalidateQueries({ queryKey: ["compliance-completed"] });
      onOpenChange(false);
    } catch (err: any) {
      toast.error(err.message || "Failed to save");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-md overflow-y-auto">
        <SheetHeader>
          <SheetTitle className="text-base">Edit Completion</SheetTitle>
          <p className="text-xs text-muted-foreground">{event.eventName} · {event.rideName}</p>
        </SheetHeader>

        <div className="space-y-4 mt-4">
          {/* Completion Date */}
          <div className="space-y-1.5">
            <Label className="text-xs font-medium">Completion Date</Label>
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className={cn("w-full justify-start text-left font-normal", !completionDate && "text-muted-foreground")}
                >
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {completionDate ? formatDateUK(completionDate) : "Pick a date"}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="single"
                  selected={completionDate}
                  onSelect={(d) => d && setCompletionDate(d)}
                  initialFocus
                  className={cn("p-3 pointer-events-auto")}
                />
              </PopoverContent>
            </Popover>
          </div>

          {/* Inspector / Company */}
          <div className="space-y-1.5">
            <Label className="text-xs font-medium">Inspector / Company</Label>
            <Input
              value={inspectorCompany}
              onChange={(e) => setInspectorCompany(e.target.value)}
              placeholder="e.g. ADIPS Inspector, LEAPS"
              className="text-sm"
            />
          </div>

          {/* Certificate / Report Reference */}
          <div className="space-y-1.5">
            <Label className="text-xs font-medium">Certificate / Report Reference</Label>
            <Input
              value={certificateReference}
              onChange={(e) => setCertificateReference(e.target.value)}
              placeholder="Certificate or report number"
              className="text-sm font-mono"
            />
          </div>

          {/* Notes */}
          <div className="space-y-1.5">
            <Label className="text-xs font-medium">Notes</Label>
            <Textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Completion notes…"
              rows={3}
              className="text-sm"
            />
          </div>

          {/* Evidence */}
          <div className="space-y-1.5">
            <Label className="text-xs font-medium">
              Attachments ({(event.evidenceUrls?.length || 0) + newFiles.length})
            </Label>
            {event.evidenceUrls && event.evidenceUrls.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {event.evidenceUrls.map((url, i) => (
                  <Badge key={i} variant="secondary" className="text-[10px]">
                    {url.split("/").pop()?.slice(0, 20) || `File ${i + 1}`}
                  </Badge>
                ))}
              </div>
            )}
            {newFiles.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {newFiles.map((f, i) => (
                  <Badge key={`new-${i}`} variant="outline" className="text-[10px] gap-1">
                    {f.name.slice(0, 20)}
                    <button onClick={() => removeNewFile(i)}>
                      <X className="h-2.5 w-2.5" />
                    </button>
                  </Badge>
                ))}
              </div>
            )}
            <div className="flex gap-2">
              <Button variant="outline" size="sm" className="gap-1.5 text-xs" asChild>
                <label>
                  <Camera className="h-3.5 w-3.5" />
                  Photo
                  <input type="file" accept="image/*" capture="environment" className="hidden" onChange={handleCameraCapture} />
                </label>
              </Button>
              <Button variant="outline" size="sm" className="gap-1.5 text-xs" asChild>
                <label>
                  <Upload className="h-3.5 w-3.5" />
                  Upload
                  <input type="file" multiple className="hidden" onChange={handleFileUpload} />
                </label>
              </Button>
            </div>
          </div>

          {/* Save */}
          <Button onClick={handleSave} disabled={saving} className="w-full gap-2">
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            Save Changes
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
};

export default CompletedEventEditSheet;
