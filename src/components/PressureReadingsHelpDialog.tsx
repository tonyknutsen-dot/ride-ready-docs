import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from '@/components/ui/dialog';
import { Gauge, MapPin, Layers, Clock, Wrench, FileText, Ruler, HelpCircle } from 'lucide-react';

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
          <HelpCircle className="h-4 w-4 text-primary shrink-0 mt-0.5" />
          <div>
            <p className="font-medium text-foreground">What is a pressure session?</p>
            <p>A pressure session is a single event where you take pressure readings from one inflatable at a specific site and time. You can log multiple sessions per day — for example before opening, during operation, and at end of day.</p>
          </div>
        </div>
        <div className="flex gap-3">
          <Clock className="h-4 w-4 text-primary shrink-0 mt-0.5" />
          <div>
            <p className="font-medium text-foreground">Session types</p>
            <p><strong>Pre-opening</strong> — before the public arrives. <strong>During operation</strong> — while the inflatable is in use. <strong>End of day</strong> — after the last users have left. Choose the one that matches when readings are being taken.</p>
          </div>
        </div>
        <div className="flex gap-3">
          <Ruler className="h-4 w-4 text-primary shrink-0 mt-0.5" />
          <div>
            <p className="font-medium text-foreground">Pressure unit</p>
            <p>Each session uses one unit for all readings: <strong>PSI</strong>, <strong>Bar</strong>, <strong>mbar</strong>, or <strong>mmH₂O</strong>. Choose whichever your pressure gauge displays. You can set a default unit in the inflatable setup so it's pre-selected each time.</p>
          </div>
        </div>
        <div className="flex gap-3">
          <Layers className="h-4 w-4 text-primary shrink-0 mt-0.5" />
          <div>
            <p className="font-medium text-foreground">Multi-sectional inflatables</p>
            <p>Some inflatables have multiple air chambers (e.g. Front Arch, Rear Arch). Configure sections in the <strong>inflatable setup page</strong> — then every pressure session will automatically show one reading row per section. You cannot complete a session until every section has a reading.</p>
          </div>
        </div>
        <div className="flex gap-3">
          <MapPin className="h-4 w-4 text-primary shrink-0 mt-0.5" />
          <div>
            <p className="font-medium text-foreground">Reading point / location</p>
            <p><strong>Site / location</strong> is where the inflatable is operating (e.g. "Riverside Park"). <strong>Reading point</strong> is the exact spot on each section where the gauge was placed (e.g. "Valve A", "Near seam"). This helps ensure consistency across sessions.</p>
          </div>
        </div>
        <div className="flex gap-3">
          <Wrench className="h-4 w-4 text-primary shrink-0 mt-0.5" />
          <div>
            <p className="font-medium text-foreground">Pressure reader details</p>
            <p>Every session records the pressure gauge used — make, model, serial number, and calibration date. This provides full instrument traceability for compliance and audit purposes. Save your instruments to the library for quick selection.</p>
          </div>
        </div>
        <div className="flex gap-3">
          <FileText className="h-4 w-4 text-primary shrink-0 mt-0.5" />
          <div>
            <p className="font-medium text-foreground">Reports & documents</p>
            <p>Export CSV or PDF reports, save them to the inflatable's document register, or share them — following the same workflow as all other modules in the app.</p>
          </div>
        </div>
      </div>
    </DialogContent>
  </Dialog>
);
