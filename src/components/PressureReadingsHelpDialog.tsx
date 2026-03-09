import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from '@/components/ui/dialog';
import { Gauge, MapPin, Layers, Clock, Wrench, FileText } from 'lucide-react';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export const PressureReadingsHelpDialog = ({ open, onOpenChange }: Props) => (
  <Dialog open={open} onOpenChange={onOpenChange}>
    <DialogContent className="max-w-md">
      <DialogHeader>
        <DialogTitle className="flex items-center gap-2">
          <Gauge className="h-5 w-5 text-primary" />
          How Pressure Readings Work
        </DialogTitle>
        <DialogDescription>
          Track inflatable pressure sessions with full instrument traceability.
        </DialogDescription>
      </DialogHeader>
      <div className="space-y-4 text-[13px] text-muted-foreground">
        <div className="flex gap-3">
          <Layers className="h-4 w-4 text-primary shrink-0 mt-0.5" />
          <div>
            <p className="font-medium text-foreground">Per-inflatable, not shared</p>
            <p>Each pressure session belongs to one specific inflatable — unlike wind readings which are shared across multiple assets.</p>
          </div>
        </div>
        <div className="flex gap-3">
          <MapPin className="h-4 w-4 text-primary shrink-0 mt-0.5" />
          <div>
            <p className="font-medium text-foreground">Site / location required</p>
            <p>Every session records where the inflatable was operating when readings were taken.</p>
          </div>
        </div>
        <div className="flex gap-3">
          <Layers className="h-4 w-4 text-primary shrink-0 mt-0.5" />
          <div>
            <p className="font-medium text-foreground">Multi-sectional support</p>
            <p>For multi-section inflatables, at least one reading is required for each section before the session can be marked complete.</p>
          </div>
        </div>
        <div className="flex gap-3">
          <Clock className="h-4 w-4 text-primary shrink-0 mt-0.5" />
          <div>
            <p className="font-medium text-foreground">Multiple sessions per day</p>
            <p>You can log as many pressure sessions as needed — pre-opening, in-service, rechecks, etc.</p>
          </div>
        </div>
        <div className="flex gap-3">
          <Wrench className="h-4 w-4 text-primary shrink-0 mt-0.5" />
          <div>
            <p className="font-medium text-foreground">Instrument traceability</p>
            <p>Every session records the pressure reader used (make, model, serial number, calibration date) for full traceability.</p>
          </div>
        </div>
        <div className="flex gap-3">
          <FileText className="h-4 w-4 text-primary shrink-0 mt-0.5" />
          <div>
            <p className="font-medium text-foreground">Reports & documents</p>
            <p>Export CSV or PDF reports, save them to Documents, send or share — following the same workflow as all other modules.</p>
          </div>
        </div>
      </div>
    </DialogContent>
  </Dialog>
);
