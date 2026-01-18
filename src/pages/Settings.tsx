import { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import ProfileEdit from '@/components/ProfileEdit';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { Settings as SettingsIcon, User, FileText, Globe, Users, ArrowRight, Mail, ArrowLeft, Info } from 'lucide-react';
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
import AppHeader from '@/components/AppHeader';
import { COUNTRIES, OPERATOR_TYPES, getTerminologyForCountry } from '@/constants/profile';
import { CustomTerminologyEditor, CustomTerminology } from '@/components/CustomTerminologyEditor';
import { Button } from '@/components/ui/button';
import { useNavigate } from 'react-router-dom';
import { APP_NAME, APP_VERSION, formatVersionDate, getLastUpdateDate } from '@/config/appVersion';
import AboutAppDialog from '@/components/AboutAppDialog';
import TesterTools from '@/components/TesterTools';

const Settings = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  const [profile, setProfile] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [country, setCountry] = useState('GB');
  const [updatingCountry, setUpdatingCountry] = useState(false);
  const [operatorType, setOperatorType] = useState('company');
  const [updatingOperatorType, setUpdatingOperatorType] = useState(false);
  const [pendingCountry, setPendingCountry] = useState<string | null>(null);
  const [showCountryDialog, setShowCountryDialog] = useState(false);
  const [customTerminology, setCustomTerminology] = useState<CustomTerminology | null>(null);
  const [savingTerminology, setSavingTerminology] = useState(false);

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
      setCountry(data.country || 'GB');
      setOperatorType(data.operator_type || 'company');
      setCustomTerminology(data.custom_terminology as CustomTerminology | null);
    }
    setLoading(false);
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

  const handleCustomTerminologySave = async (terminology: CustomTerminology | null) => {
    if (!user) return;
    
    setSavingTerminology(true);
    const { error } = await supabase
      .from('profiles')
      .update({ custom_terminology: terminology ? JSON.parse(JSON.stringify(terminology)) : null })
      .eq('user_id', user.id);

    if (error) {
      toast({
        title: "Error",
        description: "Failed to save custom terminology",
        variant: "destructive",
      });
    } else {
      setCustomTerminology(terminology);
      toast({
        title: terminology ? "Custom terminology saved" : "Reset to defaults",
        description: terminology ? "Your custom terms are now active" : "Using default terminology for your region",
      });
    }
    setSavingTerminology(false);
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
                  <div className="bg-secondary/50 rounded-lg p-3 space-y-2 text-sm border border-accent/30">
                    <p className="font-medium text-foreground mb-2">Terminology changes:</p>
                    
                    {currentTerms.safetyCertificate !== newTerms.safetyCertificate && (
                      <div className="flex items-center gap-2 text-muted-foreground">
                        <span className="line-through text-xs">{currentTerms.safetyCertificate}</span>
                        <ArrowRight className="h-3 w-3 shrink-0 text-primary" />
                        <span className="text-foreground font-medium text-xs">{newTerms.safetyCertificate}</span>
                      </div>
                    )}
                    
                    {currentTerms.localAuthority !== newTerms.localAuthority && (
                      <div className="flex items-center gap-2 text-muted-foreground">
                        <span className="line-through text-xs">{currentTerms.localAuthority}</span>
                        <ArrowRight className="h-3 w-3 shrink-0 text-primary" />
                        <span className="text-foreground font-medium text-xs">{newTerms.localAuthority}</span>
                      </div>
                    )}
                    
                    {currentTerms.inspector !== newTerms.inspector && (
                      <div className="flex items-center gap-2 text-muted-foreground">
                        <span className="line-through text-xs">{currentTerms.inspector}</span>
                        <ArrowRight className="h-3 w-3 shrink-0 text-primary" />
                        <span className="text-foreground font-medium text-xs">{newTerms.inspector}</span>
                      </div>
                    )}
                    
                    {currentTerms.safetyCertificate === newTerms.safetyCertificate &&
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
        {/* Back Button */}
        <Button
          variant="ghost"
          size="sm"
          onClick={() => navigate('/overview')}
          className="w-fit gap-1.5 -ml-2 text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" />
          Back
        </Button>
        
        {/* Header */}
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-gradient-to-br from-primary/20 to-accent/20 flex items-center justify-center shrink-0 shadow-sm">
            <SettingsIcon className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h1 className="text-xl md:text-2xl font-bold">Settings</h1>
            <p className="text-sm text-muted-foreground">Manage your profile and account</p>
          </div>
        </div>

        {/* Profile Card */}
        <Card className="border-2 border-primary/20 bg-gradient-to-br from-primary/5 to-transparent shadow-elegant">
          <CardHeader className="pb-3">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
                <User className="h-4 w-4 text-primary" />
              </div>
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
        <Card className="border-2 border-accent/30 bg-gradient-to-br from-accent/5 to-transparent shadow-elegant">
          <CardHeader className="pb-3">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-full bg-accent/20 flex items-center justify-center">
                <FileText className="h-4 w-4 text-accent-foreground" />
              </div>
              <CardTitle className="text-base">Document Management</CardTitle>
            </div>
            <CardDescription className="text-sm">
              How your documents are organised
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="p-4 rounded-lg bg-secondary/50 border border-accent/20 space-y-2">
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium">📋 Automatic Version History</span>
              </div>
              <p className="text-xs text-muted-foreground">
                When you upload a document with the same name as an existing one, we automatically keep all versions. 
                Each version is labelled with its upload date so you can easily find what you need.
              </p>
              <p className="text-xs text-primary mt-2">
                💡 All previous versions are kept for your records and compliance audits.
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Region Settings Card */}
        <Card className="border-2 border-info/30 bg-gradient-to-br from-info/5 to-transparent shadow-elegant">
          <CardHeader className="pb-3">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-full bg-info/20 flex items-center justify-center">
                <Globe className="h-4 w-4 text-info" />
              </div>
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
                <SelectTrigger id="operator-type-select" className="h-11 border-2 hover:border-primary/50 transition-colors">
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
                <SelectTrigger id="country-select" className="h-11 border-2 hover:border-primary/50 transition-colors">
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
              <div className="p-3 rounded-lg bg-secondary border-2 border-info/20">
                <p className="text-xs text-muted-foreground">
                  <span className="font-medium text-foreground">{selectedCountry.flag} {selectedCountry.name}:</span>{' '}
                  {selectedCountry.note}
                </p>
                {selectedCountry.code === 'GB' && (
                  <p className="text-xs text-primary mt-2 font-medium">
                    💡 UK terminology: ADIPS certificates for rides, PIPA certificates for inflatables
                  </p>
                )}
              </div>
            )}

            {/* Custom Terminology Editor */}
            <div className="pt-2 border-t border-border/50">
              <CustomTerminologyEditor
                countryCode={country}
                customTerminology={customTerminology}
                onSave={handleCustomTerminologySave}
                saving={savingTerminology}
              />
            </div>
          </CardContent>
        </Card>

        {/* Account Card */}
        <Card className="border-2 border-success/30 bg-gradient-to-br from-success/5 to-transparent shadow-elegant">
          <CardHeader className="pb-3">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-full bg-success/20 flex items-center justify-center">
                <Mail className="h-4 w-4 text-success" />
              </div>
              <CardTitle className="text-base">Account</CardTitle>
            </div>
            <CardDescription className="text-sm">
              Your account details and preferences
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <div className="p-4 rounded-lg bg-secondary/50 border border-success/20">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium">Email Address</p>
                    <p className="text-sm text-muted-foreground">{user?.email || 'Not logged in'}</p>
                  </div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* App Info Card */}
        <Card className="border-2 border-muted/50 bg-gradient-to-br from-muted/10 to-transparent shadow-elegant">
          <CardHeader className="pb-3">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-full bg-muted/30 flex items-center justify-center">
                <Info className="h-4 w-4 text-muted-foreground" />
              </div>
              <CardTitle className="text-base">About This App</CardTitle>
            </div>
            <CardDescription className="text-sm">
              Version information for testing and bug reporting
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <div className="p-4 rounded-lg bg-secondary/50 border border-muted/30">
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">App Name</span>
                    <span className="text-sm font-medium">{APP_NAME}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">Version</span>
                    <span className="text-sm font-mono font-bold text-primary">{APP_VERSION}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">Last Update</span>
                    <span className="text-sm">{formatVersionDate(getLastUpdateDate())}</span>
                  </div>
                </div>
              </div>
              <AboutAppDialog 
                trigger={
                  <Button variant="outline" size="sm" className="w-full gap-2">
                    <Info className="h-4 w-4" />
                    View Full Change Log
                  </Button>
                }
              />
            </div>
          </CardContent>
        </Card>

        {/* Tester Tools - only shows for testers */}
        <TesterTools />
      </div>
    </>
  );
};

export default Settings;
