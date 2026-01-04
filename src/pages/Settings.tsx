import { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import ProfileEdit from '@/components/ProfileEdit';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { Info, Settings as SettingsIcon, User, FileText, Mail, Globe, Users } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { ArrowRight } from 'lucide-react';

// Terminology maps for preview - simplified version matching useTerminology
const getTerminologyForCountry = (countryCode: string) => {
  const UK_TERMS = {
    safetyCertificate: "Declaration of Compliance (DOC)",
    inflatableCertificate: "PIPA Certificate",
    localAuthority: "council",
    inspector: "ADIPS inspector",
  };

  const GLOBAL_TERMS = {
    safetyCertificate: "Safety Compliance Certificate",
    inflatableCertificate: "Inflatable Safety Certificate",
    localAuthority: "local authority",
    inspector: "safety inspector",
  };

  const GERMANY_TERMS = {
    safetyCertificate: "TÜV Safety Certificate",
    inflatableCertificate: "Inflatable Safety Certificate",
    localAuthority: "authority",
    inspector: "TÜV inspector",
  };

  const US_TERMS = {
    safetyCertificate: "Annual Safety Inspection Certificate",
    inflatableCertificate: "Inflatable Safety Certificate",
    localAuthority: "state/local authority",
    inspector: "certified inspector",
  };

  const AUSTRALIA_TERMS = {
    ...GLOBAL_TERMS,
    localAuthority: "council",
  };

  const CANADA_TERMS = {
    ...GLOBAL_TERMS,
    localAuthority: "provincial authority",
  };

  switch (countryCode) {
    case "GB": return UK_TERMS;
    case "DE": return GERMANY_TERMS;
    case "US": return US_TERMS;
    case "AU":
    case "NZ": return AUSTRALIA_TERMS;
    case "CA": return CANADA_TERMS;
    default: return GLOBAL_TERMS;
  }
};

const OPERATOR_TYPES = [
  { value: 'showman', label: 'Showman', description: 'Traditional travelling showman or fairground family' },
  { value: 'private_operator', label: 'Private Operator', description: 'Independent ride or attraction operator' },
  { value: 'company', label: 'Company', description: 'Business or corporate operator' },
];
import AppHeader from '@/components/AppHeader';

const COUNTRIES = [
  // UK & Ireland
  { code: 'GB', name: 'United Kingdom', flag: '🇬🇧', note: 'Uses ADIPS (rides) & PIPA (inflatables) certificates' },
  { code: 'IE', name: 'Ireland', flag: '🇮🇪', note: 'Uses Declaration of Compliance certificates' },
  // Americas
  { code: 'US', name: 'United States', flag: '🇺🇸', note: 'Uses ASTM F24 compliant safety certifications' },
  { code: 'CA', name: 'Canada', flag: '🇨🇦', note: 'Uses provincial safety certifications' },
  { code: 'MX', name: 'Mexico', flag: '🇲🇽', note: 'Uses safety compliance certificates' },
  // Europe
  { code: 'DE', name: 'Germany', flag: '🇩🇪', note: 'Uses TÜV safety certifications' },
  { code: 'FR', name: 'France', flag: '🇫🇷', note: 'Uses safety compliance certificates' },
  { code: 'NL', name: 'Netherlands', flag: '🇳🇱', note: 'Uses safety compliance certificates' },
  { code: 'ES', name: 'Spain', flag: '🇪🇸', note: 'Uses safety compliance certificates' },
  { code: 'IT', name: 'Italy', flag: '🇮🇹', note: 'Uses safety compliance certificates' },
  { code: 'BE', name: 'Belgium', flag: '🇧🇪', note: 'Uses safety compliance certificates' },
  { code: 'AT', name: 'Austria', flag: '🇦🇹', note: 'Uses safety compliance certificates' },
  { code: 'CH', name: 'Switzerland', flag: '🇨🇭', note: 'Uses safety compliance certificates' },
  { code: 'PL', name: 'Poland', flag: '🇵🇱', note: 'Uses safety compliance certificates' },
  { code: 'SE', name: 'Sweden', flag: '🇸🇪', note: 'Uses safety compliance certificates' },
  // Asia-Pacific
  { code: 'AU', name: 'Australia', flag: '🇦🇺', note: 'Uses Declaration of Compliance certificates' },
  { code: 'NZ', name: 'New Zealand', flag: '🇳🇿', note: 'Uses Declaration of Compliance certificates' },
  { code: 'AE', name: 'United Arab Emirates', flag: '🇦🇪', note: 'Uses safety compliance certificates' },
  { code: 'SG', name: 'Singapore', flag: '🇸🇬', note: 'Uses safety compliance certificates' },
  { code: 'JP', name: 'Japan', flag: '🇯🇵', note: 'Uses safety compliance certificates' },
  // Other
  { code: 'OTHER', name: 'Other Country', flag: '🌍', note: 'Uses Declaration of Compliance certificates' },
];

const Settings = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [profile, setProfile] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [versioningEnabled, setVersioningEnabled] = useState(true);
  const [updatingVersioning, setUpdatingVersioning] = useState(false);
  const [country, setCountry] = useState('GB');
  const [updatingCountry, setUpdatingCountry] = useState(false);
  const [operatorType, setOperatorType] = useState('company');
  const [updatingOperatorType, setUpdatingOperatorType] = useState(false);
  const [pendingCountry, setPendingCountry] = useState<string | null>(null);
  const [showCountryDialog, setShowCountryDialog] = useState(false);

  const fetchProfile = async () => {
    if (!user) return;
    
    setLoading(true);
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('user_id', user.id)
      .maybeSingle();

    if (!error && data) {
      setProfile(data);
      setVersioningEnabled(data.enable_document_versioning ?? true);
      setCountry(data.country || 'GB');
      setOperatorType(data.operator_type || 'company');
    }
    setLoading(false);
  };

  const handleVersioningToggle = async (enabled: boolean) => {
    if (!user) return;
    
    setUpdatingVersioning(true);
    const { error } = await supabase
      .from('profiles')
      .update({ enable_document_versioning: enabled })
      .eq('user_id', user.id);

    if (error) {
      toast({
        title: "Error",
        description: "Failed to update version control setting",
        variant: "destructive",
      });
    } else {
      setVersioningEnabled(enabled);
      toast({
        title: "Settings updated",
        description: `Document version control ${enabled ? 'enabled' : 'disabled'}`,
      });
    }
    setUpdatingVersioning(false);
  };

  const handleCountrySelectChange = (newCountry: string) => {
    if (newCountry !== country) {
      setPendingCountry(newCountry);
      setShowCountryDialog(true);
    }
  };

  const handleCountryConfirm = async () => {
    if (!user || !pendingCountry) return;
    
    setShowCountryDialog(false);
    setUpdatingCountry(true);
    
    const { error } = await supabase
      .from('profiles')
      .update({ country: pendingCountry })
      .eq('user_id', user.id);

    if (error) {
      toast({
        title: "Error",
        description: "Failed to update country setting",
        variant: "destructive",
      });
    } else {
      setCountry(pendingCountry);
      const countryInfo = COUNTRIES.find(c => c.code === pendingCountry);
      toast({
        title: "Country updated",
        description: countryInfo ? `Terminology will now match ${countryInfo.name} standards` : 'Country updated',
      });
    }
    
    setPendingCountry(null);
    setUpdatingCountry(false);
  };

  const handleCountryCancel = () => {
    setShowCountryDialog(false);
    setPendingCountry(null);
  };

  const handleOperatorTypeChange = async (newType: string) => {
    if (!user) return;
    
    setUpdatingOperatorType(true);
    const { error } = await supabase
      .from('profiles')
      .update({ operator_type: newType })
      .eq('user_id', user.id);

    if (error) {
      toast({
        title: "Error",
        description: "Failed to update operator type",
        variant: "destructive",
      });
    } else {
      setOperatorType(newType);
      const typeInfo = OPERATOR_TYPES.find(t => t.value === newType);
      toast({
        title: "Operator type updated",
        description: typeInfo ? `Terminology will now use ${typeInfo.label.toLowerCase()} terms` : 'Operator type updated',
      });
    }
    setUpdatingOperatorType(false);
  };

  useEffect(() => {
    fetchProfile();
  }, [user]);

  const handleComplete = () => {
    fetchProfile();
  };

  const selectedCountry = COUNTRIES.find(c => c.code === country);
  const selectedOperatorType = OPERATOR_TYPES.find(t => t.value === operatorType);
  const pendingCountryInfo = COUNTRIES.find(c => c.code === pendingCountry);
  
  // Get terminology for comparison
  const currentTerms = getTerminologyForCountry(country);
  const newTerms = pendingCountry ? getTerminologyForCountry(pendingCountry) : null;

  return (
    <>
      <AlertDialog open={showCountryDialog} onOpenChange={setShowCountryDialog}>
        <AlertDialogContent className="max-w-md">
          <AlertDialogHeader>
            <AlertDialogTitle>Change Country?</AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-4">
                <p>
                  Changing your country from <strong>{selectedCountry?.name}</strong> to{' '}
                  <strong>{pendingCountryInfo?.name}</strong> will update terminology throughout the app.
                </p>
                
                {newTerms && (
                  <div className="bg-muted/50 rounded-lg p-3 space-y-2 text-sm">
                    <p className="font-medium text-foreground mb-2">Terminology changes:</p>
                    
                    {currentTerms.safetyCertificate !== newTerms.safetyCertificate && (
                      <div className="flex items-center gap-2 text-muted-foreground">
                        <span className="line-through text-xs">{currentTerms.safetyCertificate}</span>
                        <ArrowRight className="h-3 w-3 shrink-0" />
                        <span className="text-foreground font-medium text-xs">{newTerms.safetyCertificate}</span>
                      </div>
                    )}
                    
                    {currentTerms.inflatableCertificate !== newTerms.inflatableCertificate && (
                      <div className="flex items-center gap-2 text-muted-foreground">
                        <span className="line-through text-xs">{currentTerms.inflatableCertificate}</span>
                        <ArrowRight className="h-3 w-3 shrink-0" />
                        <span className="text-foreground font-medium text-xs">{newTerms.inflatableCertificate}</span>
                      </div>
                    )}
                    
                    {currentTerms.localAuthority !== newTerms.localAuthority && (
                      <div className="flex items-center gap-2 text-muted-foreground">
                        <span className="line-through text-xs">{currentTerms.localAuthority}</span>
                        <ArrowRight className="h-3 w-3 shrink-0" />
                        <span className="text-foreground font-medium text-xs">{newTerms.localAuthority}</span>
                      </div>
                    )}
                    
                    {currentTerms.inspector !== newTerms.inspector && (
                      <div className="flex items-center gap-2 text-muted-foreground">
                        <span className="line-through text-xs">{currentTerms.inspector}</span>
                        <ArrowRight className="h-3 w-3 shrink-0" />
                        <span className="text-foreground font-medium text-xs">{newTerms.inspector}</span>
                      </div>
                    )}
                    
                    {currentTerms.safetyCertificate === newTerms.safetyCertificate &&
                     currentTerms.inflatableCertificate === newTerms.inflatableCertificate &&
                     currentTerms.localAuthority === newTerms.localAuthority &&
                     currentTerms.inspector === newTerms.inspector && (
                      <p className="text-xs text-muted-foreground italic">
                        No major terminology differences between these countries.
                      </p>
                    )}
                  </div>
                )}
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={handleCountryCancel}>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleCountryConfirm}>Change Country</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      <AppHeader />
      <div className="container mx-auto px-4 py-5 pb-28 md:pb-8 space-y-5 max-w-2xl">
        {/* Header */}
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
            <SettingsIcon className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h1 className="text-xl md:text-2xl font-bold">Settings</h1>
            <p className="text-sm text-muted-foreground">Manage your profile and account</p>
          </div>
        </div>

        {/* Profile Card */}
        <Card className="shadow-card">
          <CardHeader className="pb-3">
            <div className="flex items-center gap-2">
              <User className="h-4 w-4 text-primary" />
              <CardTitle className="text-base">Profile Information</CardTitle>
            </div>
            <CardDescription className="text-sm">
              Update your company and contact details
            </CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="space-y-4">
                <Skeleton className="h-10 w-full" />
                <Skeleton className="h-10 w-full" />
                <Skeleton className="h-10 w-full" />
              </div>
            ) : (
              <ProfileEdit profile={profile} onComplete={handleComplete} />
            )}
          </CardContent>
        </Card>

        {/* Document Management Card */}
        <Card className="shadow-card">
          <CardHeader className="pb-3">
            <div className="flex items-center gap-2">
              <FileText className="h-4 w-4 text-primary" />
              <CardTitle className="text-base">Document Management</CardTitle>
            </div>
            <CardDescription className="text-sm">
              Configure how documents are handled
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-start justify-between gap-4">
              <div className="flex-1 space-y-1">
                <div className="flex items-center gap-2">
                  <Label htmlFor="version-control" className="text-sm font-medium">
                    Enable Version Control
                  </Label>
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Info className="h-4 w-4 text-muted-foreground" />
                      </TooltipTrigger>
                      <TooltipContent className="max-w-xs">
                        <p className="font-semibold mb-2">What is Version Control?</p>
                        <p className="mb-2"><strong>ON:</strong> Creates new versions (v1.0, v2.0) when uploading same-named documents.</p>
                        <p><strong>OFF:</strong> Replaces and deletes old documents with the same name.</p>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                </div>
                <p className="text-xs text-muted-foreground">
                  Keep all versions of uploaded documents for your records
                </p>
              </div>
              <Switch
                id="version-control"
                checked={versioningEnabled}
                onCheckedChange={handleVersioningToggle}
                disabled={loading || updatingVersioning}
              />
            </div>
          </CardContent>
        </Card>

        {/* Region Settings Card */}
        <Card className="shadow-card">
          <CardHeader className="pb-3">
            <div className="flex items-center gap-2">
              <Globe className="h-4 w-4 text-primary" />
              <CardTitle className="text-base">Region & Terminology</CardTitle>
            </div>
            <CardDescription className="text-sm">
              Set your country for region-appropriate certificate names
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Operator Type */}
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <Users className="h-4 w-4 text-muted-foreground" />
                <Label htmlFor="operator-type-select" className="text-sm font-medium">
                  Operator Type
                </Label>
              </div>
              <Select 
                value={operatorType} 
                onValueChange={handleOperatorTypeChange}
                disabled={loading || updatingOperatorType}
              >
                <SelectTrigger id="operator-type-select" className="h-11">
                  <SelectValue placeholder="Select your operator type..." />
                </SelectTrigger>
                <SelectContent>
                  {OPERATOR_TYPES.map((type) => (
                    <SelectItem key={type.value} value={type.value}>
                      {type.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {selectedOperatorType && (
                <p className="text-xs text-muted-foreground">
                  {selectedOperatorType.description}
                </p>
              )}
            </div>

            {/* Country */}
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <Globe className="h-4 w-4 text-muted-foreground" />
                <Label htmlFor="country-select" className="text-sm font-medium">
                  Country / Region
                </Label>
              </div>
              <Select 
                value={country} 
                onValueChange={handleCountrySelectChange}
                disabled={loading || updatingCountry}
              >
                <SelectTrigger id="country-select" className="h-11">
                  <SelectValue placeholder="Select your country..." />
                </SelectTrigger>
                <SelectContent>
                  {COUNTRIES.map((c) => (
                    <SelectItem key={c.code} value={c.code}>
                      <div className="flex items-center gap-2">
                        <span>{c.flag}</span>
                        <span>{c.name}</span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            
            {selectedCountry && (
              <div className="p-3 rounded-lg bg-muted/50 border border-border/50">
                <p className="text-xs text-muted-foreground">
                  <span className="font-medium text-foreground">{selectedCountry.flag} {selectedCountry.name}:</span>{' '}
                  {selectedCountry.note}
                </p>
                {selectedCountry.code === 'GB' && (
                  <p className="text-xs text-primary mt-2">
                    💡 UK terminology: ADIPS certificates for rides, PIPA certificates for inflatables
                  </p>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Account Card */}
        <Card className="shadow-card">
          <CardHeader className="pb-3">
            <div className="flex items-center gap-2">
              <Mail className="h-4 w-4 text-primary" />
              <CardTitle className="text-base">Account</CardTitle>
            </div>
            <CardDescription className="text-sm">
              Your account email
            </CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-sm">
              <span className="text-muted-foreground">Email: </span>
              <span className="font-medium">{user?.email}</span>
            </p>
          </CardContent>
        </Card>
      </div>
    </>
  );
};

export default Settings;
