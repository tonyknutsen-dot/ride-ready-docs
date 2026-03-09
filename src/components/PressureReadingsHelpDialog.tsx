import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from '@/components/ui/dialog';
import { Gauge, MapPin, Layers, Clock, Wrench, FileText, Ruler } from 'lucide-react';

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
          How Inflatable Pressure Readings Work
        </DialogTitle>
        <DialogDescription>
          Track inflatable pressure sessions with full instrument traceability.
        </DialogDescription>
      </DialogHeader>
      <div className="space-y-4 text-[13px] text-muted-foreground">
        <div className="flex gap-3">
          <Layers className="h-4 w-4 text-primary shrink-0 mt-0.5" />
          <div>
            <p className="font-medium text-foreground">Inflatables only</p>
            <p>This module is exclusively for inflatables. Rides, stalls, games, and other equipment are not shown here. Each pressure session belongs to one specific inflatable.</p>
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
            <p className="font-medium text-foreground">Multi-sectional inflatables</p>
            <p>Some inflatables have multiple air chambers or sections (e.g. Front Arch, Rear Arch). If yours is multi-sectional, you'll configure each section in the equipment setup — then every pressure session will require one reading per section before it can be marked complete.</p>
          </div>
        </div>
        <div className="flex gap-3">
          <Ruler className="h-4 w-4 text-primary shrink-0 mt-0.5" />
          <div>
            <p className="font-medium text-foreground">Pressure unit</p>
            <p>Each session has a unit (PSI, Bar, mmH₂O, or kPa). All readings in a session use the same unit. Choose this when starting a new session.</p>
          </div>
        </div>
        <div className="flex gap-3">
          <MapPin className="h-4 w-4 text-primary shrink-0 mt-0.5" />
          <div>
            <p className="font-medium text-foreground">Reading point / location</p>
            <p>For each section, you can record exactly where on the inflatable the reading was taken (e.g. "Valve A", "Near seam"). This helps with consistency across sessions.</p>
          </div>
        </div>
        <div className="flex gap-3">
          <Clock className="h-4 w-4 text-primary shrink-0 mt-0.5" />
          <div>
            <p className="font-medium text-foreground">Session types & multiple sessions per day</p>
            <p>Choose when the session happens: Pre-opening, During operation, or After adjustment. You can log as many sessions as needed on the same day.</p>
          </div>
        </div>
        <div className="flex gap-3">
          <Wrench className="h-4 w-4 text-primary shrink-0 mt-0.5" />
          <div>
            <p className="font-medium text-foreground">Instrument traceability</p>
            <p>Every session records the pressure reader used (make, model, serial number, calibration date) for full traceability. You can save instruments to your library for quick selection.</p>
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
