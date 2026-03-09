import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Save, Loader2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

interface PressureReaderProfile {
  id: string;
  reader_type: string;
  make: string;
  model: string;
  serial_number: string | null;
  label: string | null;
  unit: string;
  last_calibration_date: string | null;
  instrument_notes: string | null;
  is_default: boolean;
}

interface PressureReaderPickerProps {
  profiles: PressureReaderProfile[];
  selectedProfileId: string;
  onSelectProfile: (profileId: string) => void;
  onProfileSaved: (profile: PressureReaderProfile) => void;
  effectiveUserId: string | null;
  // Controlled fields
  readerType: string;
  setReaderType: (v: string) => void;
  make: string;
  setMake: (v: string) => void;
  model: string;
  setModel: (v: string) => void;
  serial: string;
  setSerial: (v: string) => void;
  unit: string;
  setUnit: (v: string) => void;
  calibrationDate: string;
  setCalibrationDate: (v: string) => void;
  instrumentNotes: string;
  setInstrumentNotes: (v: string) => void;
}

const READER_TYPES = [
  { value: 'digital', label: 'Digital gauge' },
  { value: 'analogue', label: 'Analogue gauge' },
  { value: 'electronic', label: 'Electronic sensor' },
  { value: 'other', label: 'Other' },
];

const UNIT_OPTIONS = [
  { value: 'psi', label: 'psi' },
  { value: 'bar', label: 'bar' },
  { value: 'kPa', label: 'kPa' },
  { value: 'mbar', label: 'mbar' },
];

const PressureReaderPicker = ({
  profiles,
  selectedProfileId,
  onSelectProfile,
  onProfileSaved,
  effectiveUserId,
  readerType, setReaderType,
  make, setMake,
  model, setModel,
  serial, setSerial,
  unit, setUnit,
  calibrationDate, setCalibrationDate,
  instrumentNotes, setInstrumentNotes,
}: PressureReaderPickerProps) => {
  const { toast } = useToast();
  const [savingProfile, setSavingProfile] = useState(false);

  const handleSelectProfile = (profileId: string) => {
    onSelectProfile(profileId);
    if (profileId === 'manual') {
      setReaderType('digital');
      setMake('');
      setModel('');
      setSerial('');
      setUnit('psi');
      setCalibrationDate('');
      setInstrumentNotes('');
    } else {
      const profile = profiles.find(p => p.id === profileId);
      if (profile) {
        setReaderType(profile.reader_type || 'digital');
        setMake(profile.make);
        setModel(profile.model);
        setSerial(profile.serial_number || '');
        setUnit(profile.unit || 'psi');
        setCalibrationDate(profile.last_calibration_date || '');
        setInstrumentNotes(profile.instrument_notes || '');
      }
    }
  };

  const handleSaveAsProfile = async () => {
    if (!effectiveUserId || !make || !model) return;
    setSavingProfile(true);
    try {
      const label = `${make} ${model}${serial ? ` (${serial})` : ''}`;
      const { data, error } = await supabase
        .from('pressure_reader_profiles')
        .insert({
          user_id: effectiveUserId,
          reader_type: readerType,
          make,
          model,
          serial_number: serial || null,
          label,
          unit,
          last_calibration_date: calibrationDate || null,
          instrument_notes: instrumentNotes || null,
          is_default: profiles.length === 0,
        })
        .select()
        .single();
      if (error) throw error;
      onProfileSaved(data as PressureReaderProfile);
      onSelectProfile(data.id);
      toast({ title: 'Pressure reader saved', description: 'You can select it for future sessions.' });
    } catch (err: any) {
      toast({ title: 'Could not save profile', description: err?.message, variant: 'destructive' });
    } finally {
      setSavingProfile(false);
    }
  };

  const isManualEntry = selectedProfileId === 'manual';
  const canSaveProfile = isManualEntry && make && model;

  return (
    <div className="space-y-3">
      <Label className="text-[13px] font-semibold">Pressure Reader</Label>

      {/* Profile selector */}
      <Select value={selectedProfileId} onValueChange={handleSelectProfile}>
        <SelectTrigger className="h-10 text-[13px]">
          <SelectValue placeholder="Select saved reader or enter manually" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="manual">Enter manually</SelectItem>
          {profiles.map(p => (
            <SelectItem key={p.id} value={p.id}>
              {p.label || `${p.make} ${p.model}`}
              {p.is_default && ' ★'}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {/* Reader type */}
      <div className="space-y-1">
        <Label className="text-[11px] text-muted-foreground">Reader type</Label>
        <Select value={readerType} onValueChange={setReaderType}>
          <SelectTrigger className="h-10 text-[13px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {READER_TYPES.map(t => (
              <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Make & Model */}
      <div className="grid grid-cols-2 gap-2">
        <div className="space-y-1">
          <Label className="text-[11px] text-muted-foreground">Make / Brand *</Label>
          <Input value={make} onChange={e => setMake(e.target.value)} placeholder="e.g. Digitron" className="h-10 text-[13px]" />
        </div>
        <div className="space-y-1">
          <Label className="text-[11px] text-muted-foreground">Model *</Label>
          <Input value={model} onChange={e => setModel(e.target.value)} placeholder="e.g. PM-20" className="h-10 text-[13px]" />
        </div>
      </div>

      {/* Serial & Unit */}
      <div className="grid grid-cols-2 gap-2">
        <div className="space-y-1">
          <Label className="text-[11px] text-muted-foreground">Serial number</Label>
          <Input value={serial} onChange={e => setSerial(e.target.value)} placeholder="S/N" className="h-10 text-[13px]" />
        </div>
        <div className="space-y-1">
          <Label className="text-[11px] text-muted-foreground">Unit</Label>
          <Select value={unit} onValueChange={setUnit}>
            <SelectTrigger className="h-10 text-[13px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {UNIT_OPTIONS.map(u => (
                <SelectItem key={u.value} value={u.value}>{u.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Calibration date */}
      <div className="space-y-1">
        <Label className="text-[11px] text-muted-foreground">Last calibration date</Label>
        <Input type="date" value={calibrationDate} onChange={e => setCalibrationDate(e.target.value)} className="h-10 text-[13px]" />
      </div>

      {/* Notes */}
      <div className="space-y-1">
        <Label className="text-[11px] text-muted-foreground">Instrument notes</Label>
        <Textarea value={instrumentNotes} onChange={e => setInstrumentNotes(e.target.value)} placeholder="Optional notes about this instrument" className="text-[13px] min-h-[60px]" />
      </div>

      {/* Save as profile */}
      {canSaveProfile && (
        <Button
          variant="outline"
          size="sm"
          onClick={handleSaveAsProfile}
          disabled={savingProfile}
          className="gap-1.5 h-8 text-[12px]"
        >
          {savingProfile ? <Loader2 className="h-3 w-3 animate-spin" /> : <Save className="h-3 w-3" />}
          Save as reusable profile
        </Button>
      )}
    </div>
  );
};

export default PressureReaderPicker;
export type { PressureReaderProfile };
