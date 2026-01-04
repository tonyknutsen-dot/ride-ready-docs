import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { getTerminologyForCountry } from '@/constants/profile';
import { RotateCcw, Pencil } from 'lucide-react';

export interface CustomTerminology {
  safetyCertificate?: string;
  inflatableCertificate?: string;
  localAuthority?: string;
  inspector?: string;
}

interface CustomTerminologyEditorProps {
  countryCode: string;
  customTerminology: CustomTerminology | null;
  onSave: (terminology: CustomTerminology | null) => Promise<void>;
  saving?: boolean;
}

export const CustomTerminologyEditor = ({
  countryCode,
  customTerminology,
  onSave,
  saving = false,
}: CustomTerminologyEditorProps) => {
  const defaultTerms = getTerminologyForCountry(countryCode);
  const [useCustom, setUseCustom] = useState(!!customTerminology);
  const [terms, setTerms] = useState<CustomTerminology>({
    safetyCertificate: customTerminology?.safetyCertificate || '',
    inflatableCertificate: customTerminology?.inflatableCertificate || '',
    localAuthority: customTerminology?.localAuthority || '',
    inspector: customTerminology?.inspector || '',
  });
  const [hasChanges, setHasChanges] = useState(false);

  const handleToggle = async (enabled: boolean) => {
    setUseCustom(enabled);
    if (!enabled) {
      // Reset to defaults
      await onSave(null);
      setTerms({
        safetyCertificate: '',
        inflatableCertificate: '',
        localAuthority: '',
        inspector: '',
      });
      setHasChanges(false);
    }
  };

  const handleChange = (field: keyof CustomTerminology, value: string) => {
    setTerms(prev => ({ ...prev, [field]: value }));
    setHasChanges(true);
  };

  const handleSave = async () => {
    // Only save non-empty values that differ from defaults
    const customValues: CustomTerminology = {};
    if (terms.safetyCertificate && terms.safetyCertificate !== defaultTerms.safetyCertificate) {
      customValues.safetyCertificate = terms.safetyCertificate;
    }
    if (terms.inflatableCertificate && terms.inflatableCertificate !== defaultTerms.inflatableCertificate) {
      customValues.inflatableCertificate = terms.inflatableCertificate;
    }
    if (terms.localAuthority && terms.localAuthority !== defaultTerms.localAuthority) {
      customValues.localAuthority = terms.localAuthority;
    }
    if (terms.inspector && terms.inspector !== defaultTerms.inspector) {
      customValues.inspector = terms.inspector;
    }

    await onSave(Object.keys(customValues).length > 0 ? customValues : null);
    setHasChanges(false);
  };

  const handleReset = (field: keyof CustomTerminology) => {
    setTerms(prev => ({ ...prev, [field]: '' }));
    setHasChanges(true);
  };

  const getDisplayValue = (field: keyof CustomTerminology) => {
    return terms[field] || defaultTerms[field];
  };

  const isCustom = (field: keyof CustomTerminology) => {
    return terms[field] && terms[field] !== defaultTerms[field];
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Pencil className="h-4 w-4 text-muted-foreground" />
          <Label htmlFor="custom-terminology" className="text-sm font-medium">
            Custom Terminology
          </Label>
        </div>
        <Switch
          id="custom-terminology"
          checked={useCustom}
          onCheckedChange={handleToggle}
          disabled={saving}
        />
      </div>
      
      <p className="text-xs text-muted-foreground">
        Override default terminology with your own preferred terms
      </p>

      {useCustom && (
        <div className="space-y-3 pt-2">
          {/* Safety Certificate */}
          <div className="space-y-1.5">
            <Label htmlFor="term-safety" className="text-xs text-muted-foreground">
              Safety Certificate
            </Label>
            <div className="flex gap-2">
              <Input
                id="term-safety"
                placeholder={defaultTerms.safetyCertificate}
                value={terms.safetyCertificate}
                onChange={(e) => handleChange('safetyCertificate', e.target.value)}
                className="h-9 text-sm"
              />
              {isCustom('safetyCertificate') && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => handleReset('safetyCertificate')}
                  className="h-9 px-2 shrink-0"
                  title="Reset to default"
                >
                  <RotateCcw className="h-4 w-4" />
                </Button>
              )}
            </div>
          </div>

          {/* Inflatable Certificate */}
          <div className="space-y-1.5">
            <Label htmlFor="term-inflatable" className="text-xs text-muted-foreground">
              Inflatable Certificate
            </Label>
            <div className="flex gap-2">
              <Input
                id="term-inflatable"
                placeholder={defaultTerms.inflatableCertificate}
                value={terms.inflatableCertificate}
                onChange={(e) => handleChange('inflatableCertificate', e.target.value)}
                className="h-9 text-sm"
              />
              {isCustom('inflatableCertificate') && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => handleReset('inflatableCertificate')}
                  className="h-9 px-2 shrink-0"
                  title="Reset to default"
                >
                  <RotateCcw className="h-4 w-4" />
                </Button>
              )}
            </div>
          </div>

          {/* Local Authority */}
          <div className="space-y-1.5">
            <Label htmlFor="term-authority" className="text-xs text-muted-foreground">
              Local Authority Term
            </Label>
            <div className="flex gap-2">
              <Input
                id="term-authority"
                placeholder={defaultTerms.localAuthority}
                value={terms.localAuthority}
                onChange={(e) => handleChange('localAuthority', e.target.value)}
                className="h-9 text-sm"
              />
              {isCustom('localAuthority') && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => handleReset('localAuthority')}
                  className="h-9 px-2 shrink-0"
                  title="Reset to default"
                >
                  <RotateCcw className="h-4 w-4" />
                </Button>
              )}
            </div>
          </div>

          {/* Inspector */}
          <div className="space-y-1.5">
            <Label htmlFor="term-inspector" className="text-xs text-muted-foreground">
              Inspector Title
            </Label>
            <div className="flex gap-2">
              <Input
                id="term-inspector"
                placeholder={defaultTerms.inspector}
                value={terms.inspector}
                onChange={(e) => handleChange('inspector', e.target.value)}
                className="h-9 text-sm"
              />
              {isCustom('inspector') && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => handleReset('inspector')}
                  className="h-9 px-2 shrink-0"
                  title="Reset to default"
                >
                  <RotateCcw className="h-4 w-4" />
                </Button>
              )}
            </div>
          </div>

          {hasChanges && (
            <Button
              onClick={handleSave}
              disabled={saving}
              className="w-full mt-2"
              size="sm"
            >
              {saving ? 'Saving...' : 'Save Custom Terms'}
            </Button>
          )}
        </div>
      )}
    </div>
  );
};
