import { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useStaff } from '@/contexts/StaffContext';
import { supabase } from '@/integrations/supabase/client';
import ProfileEdit from '@/components/ProfileEdit';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  Settings as SettingsIcon, User, Globe, ArrowRight, Mail, ArrowLeft, Info, Bug,
  Calendar, Building2, Shield, Users, CreditCard, ChevronRight, FileText, Pencil, X,
} from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { DateTimeSettings, COUNTRY_TIMEZONES, COUNTRY_DATE_FORMATS } from '@/components/DateTimeSettings';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { COUNTRIES, getTerminologyForCountry } from '@/constants/profile';
import { CustomTerminologyEditor, CustomTerminology } from '@/components/CustomTerminologyEditor';
import { Button } from '@/components/ui/button';
import { useNavigate } from 'react-router-dom';
import { APP_NAME, APP_VERSION, formatVersionDate, getLastUpdateDate } from '@/config/appVersion';
import AboutAppDialog from '@/components/AboutAppDialog';
import TesterTools from '@/components/TesterTools';
import BugReportDialog from '@/components/BugReportDialog';
import ActivityLog from '@/components/ActivityLog';
import SupportAccessManager from '@/components/SupportAccessManager';
import { SecuritySettingsSection } from '@/components/SecuritySettingsSection';

/* ── Reusable section label ── */
const SectionLabel = ({ children }: { children: React.ReactNode }) => (
  <div className="flex items-center gap-2 pt-4 pb-1">
    <span className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">{children}</span>
    <div className="flex-1 h-px bg-border" />
  </div>
);

/* ── Clickable nav card (links to another page) ── */
const NavCard = ({ icon: Icon, title, subtitle, onClick }: {
  icon: React.ElementType; title: string; subtitle: string; onClick: () => void;
}) => (
  <Card className="cursor-pointer hover:border-primary/40 transition-colors" onClick={onClick}>
    <CardContent className="flex items-center justify-between py-4 px-5">
      <div className="flex items-center gap-3">
        <div className="w-8 h-8 rounded-lg bg-muted flex items-center justify-center">
          <Icon className="h-4 w-4 text-muted-foreground" />
        </div>
        <div>
          <p className="text-sm font-semibold">{title}</p>
          <p className="text-xs text-muted-foreground">{subtitle}</p>
        </div>
      </div>
      <ChevronRight className="h-4 w-4 text-muted-foreground" />
    </CardContent>
  </Card>
);

const Settings = () => {
  const { user } = useAuth();
  const { isStaff, staffMembership } = useStaff();
  const { toast } = useToast();
  const navigate = useNavigate();
  const [profile, setProfile] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  // Country / terminology
  const [country, setCountry] = useState('GB');
  const [updatingCountry, setUpdatingCountry] = useState(false);
  const [pendingCountry, setPendingCountry] = useState<string | null>(null);
  const [showCountryDialog, setShowCountryDialog] = useState(false);
  const [customTerminology, setCustomTerminology] = useState<CustomTerminology | null>(null);
  const [savingTerminology, setSavingTerminology] = useState(false);

  // Date & Time
  const [dateFormat, setDateFormat] = useState('DD/MM/YYYY');
  const [timezone, setTimezone] = useState('Europe/London');
  const [savingDateTime, setSavingDateTime] = useState(false);

  // Expand state for summary→edit cards
  const [editingProfile, setEditingProfile] = useState(false);

  /* ── Data fetching ── */
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
      setCustomTerminology(data.custom_terminology as CustomTerminology | null);
      setDateFormat(data.date_format || COUNTRY_DATE_FORMATS[data.country || 'GB'] || 'DD/MM/YYYY');
      setTimezone(data.timezone || COUNTRY_TIMEZONES[data.country || 'GB'] || 'Europe/London');
    }
    setLoading(false);
  };

  useEffect(() => { fetchProfile(); }, [user]);


  const handleComplete = () => {
    setEditingProfile(false);
    fetchProfile();
  };

  /* ── Country change ── */
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
    const { error } = await supabase.from('profiles').update({ country: pendingCountry }).eq('user_id', user.id);
    if (error) {
      toast({ title: "Error", description: "Failed to update country setting", variant: "destructive" });
    } else {
      setCountry(pendingCountry);
      const countryInfo = COUNTRIES.find(c => c.code === pendingCountry);
      toast({ title: "Country updated", description: countryInfo ? `Terminology will now match ${countryInfo.name} standards` : 'Country updated' });
    }
    setPendingCountry(null);
    setUpdatingCountry(false);
  };

  const handleCountryCancel = () => { setShowCountryDialog(false); setPendingCountry(null); };

  /* ── Terminology ── */
  const handleCustomTerminologySave = async (terminology: CustomTerminology | null) => {
    if (!user) return;
    setSavingTerminology(true);
    const { error } = await supabase.from('profiles').update({ custom_terminology: terminology ? JSON.parse(JSON.stringify(terminology)) : null }).eq('user_id', user.id);
    if (error) {
      toast({ title: "Error", description: "Failed to save custom terminology", variant: "destructive" });
    } else {
      setCustomTerminology(terminology);
      toast({ title: terminology ? "Custom terminology saved" : "Reset to defaults", description: terminology ? "Your custom terms are now active" : "Using default terminology for your region" });
    }
    setSavingTerminology(false);
  };

  /* ── Date / Time ── */
  const handleDateFormatChange = async (newFormat: string) => {
    if (!user) return;
    setSavingDateTime(true);
    const { error } = await supabase.from('profiles').update({ date_format: newFormat }).eq('user_id', user.id);
    if (!error) { setDateFormat(newFormat); toast({ title: "Date format updated", description: `Dates will now display as ${newFormat}` }); }
    else toast({ title: "Error", description: "Failed to update date format", variant: "destructive" });
    setSavingDateTime(false);
  };

  const handleTimezoneChange = async (newTimezone: string) => {
    if (!user) return;
    setSavingDateTime(true);
    const { error } = await supabase.from('profiles').update({ timezone: newTimezone }).eq('user_id', user.id);
    if (!error) { setTimezone(newTimezone); toast({ title: "Timezone updated", description: "Your timezone preference has been saved" }); }
    else toast({ title: "Error", description: "Failed to update timezone", variant: "destructive" });
    setSavingDateTime(false);
  };

  const selectedCountry = COUNTRIES.find(c => c.code === country);
  const pendingCountryInfo = COUNTRIES.find(c => c.code === pendingCountry);
  const currentTerms = getTerminologyForCountry(country);
  const newTerms = pendingCountry ? getTerminologyForCountry(pendingCountry) : null;

  return (
    <>
      {/* Country change confirmation dialog */}
      <AlertDialog open={showCountryDialog} onOpenChange={setShowCountryDialog}>
        <AlertDialogContent className="max-w-md">
          <AlertDialogHeader>
            <AlertDialogTitle>Change Country?</AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-4">
                <p>Changing your country from <strong>{selectedCountry?.name}</strong> to <strong>{pendingCountryInfo?.name}</strong> will update terminology throughout the app.</p>
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
                      <p className="text-xs text-muted-foreground italic">No major terminology differences between these countries.</p>
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

      <div className="container mx-auto px-4 py-5 pb-28 md:pb-8 space-y-3 max-w-2xl">
        {/* Back */}
        <Button variant="ghost" size="sm" onClick={() => navigate('/overview')} className="w-fit gap-1.5 -ml-2 text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-4 w-4" />Back
        </Button>

        {/* Header */}
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-muted flex items-center justify-center shrink-0">
            <SettingsIcon className="h-5 w-5 text-muted-foreground" />
          </div>
          <div>
            <h1 className="text-xl md:text-2xl font-bold">Settings</h1>
            <p className="text-sm text-muted-foreground">Manage your organisation, account, and app preferences</p>
          </div>
        </div>

        {/* ════════════════════════════════════════════
            ORGANISATION
           ════════════════════════════════════════════ */}
        <SectionLabel>Organisation</SectionLabel>

        {isStaff ? (
          <Card>
            <CardContent className="py-4 px-5">
              <Alert className="bg-muted/50 border-muted">
                <Info className="h-4 w-4" />
                <AlertDescription className="text-sm">
                  You're logged in as a staff member for <strong>{staffMembership?.organisationName}</strong>.
                  Profile settings are managed by the account owner.
                </AlertDescription>
              </Alert>
            </CardContent>
          </Card>
        ) : (
          <>
            {/* Organisation Profile — summary → edit */}
            <Card>
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
                      <Building2 className="h-4 w-4 text-primary" />
                    </div>
                    <div>
                      <CardTitle className="text-base">Organisation Profile</CardTitle>
                      <CardDescription className="text-xs mt-0.5">Used on reports, PDFs, and exported records</CardDescription>
                    </div>
                  </div>
                  {!editingProfile && !loading && (
                    <Button variant="ghost" size="sm" className="gap-1.5 text-xs" onClick={() => setEditingProfile(true)}>
                      <Pencil className="h-3.5 w-3.5" />Edit
                    </Button>
                  )}
                  {editingProfile && (
                    <Button variant="ghost" size="sm" className="gap-1.5 text-xs text-muted-foreground" onClick={() => setEditingProfile(false)}>
                      <X className="h-3.5 w-3.5" />Cancel
                    </Button>
                  )}
                </div>
              </CardHeader>
              <CardContent>
                {loading ? (
                  <div className="space-y-3">
                    <Skeleton className="h-4 w-3/4" />
                    <Skeleton className="h-4 w-1/2" />
                  </div>
                ) : editingProfile ? (
                  <ProfileEdit profile={profile} onComplete={handleComplete} />
                ) : (
                  /* Summary view */
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Company</span>
                      <span className="font-medium text-right">{profile?.company_name || '—'}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Primary Contact</span>
                      <span className="font-medium text-right">{profile?.controller_name || '—'}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Address</span>
                      <span className="font-medium text-right max-w-[60%] truncate">{profile?.address || '—'}</span>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Reports & Identity — text-based identity for PDFs/exports */}
            <Card>
              <CardHeader className="pb-2">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-lg bg-muted flex items-center justify-center">
                    <FileText className="h-4 w-4 text-muted-foreground" />
                  </div>
                  <div>
                    <CardTitle className="text-base">Reports & Identity</CardTitle>
                    <CardDescription className="text-xs mt-0.5">Text-based identity shown on reports, PDFs, and exports</CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                {loading ? (
                  <Skeleton className="h-16 w-full" />
                ) : (
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Organisation Name</span>
                      <span className="font-medium text-right">{profile?.company_name || '—'}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Contact Name</span>
                      <span className="font-medium text-right">{profile?.controller_name || '—'}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Address</span>
                      <span className="font-medium text-right max-w-[60%] truncate">{profile?.address || '—'}</span>
                    </div>
                    <p className="text-xs text-muted-foreground pt-1">
                      These details appear on generated reports and exported documents. Edit via Organisation Profile above.
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>
          </>
        )}

        {/* Region & Terminology */}
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-muted flex items-center justify-center">
                <Globe className="h-4 w-4 text-muted-foreground" />
              </div>
              <div>
                <CardTitle className="text-base">Region & Terminology</CardTitle>
                <CardDescription className="text-xs mt-0.5">Country-specific certificate names and language</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <Globe className="h-4 w-4 text-muted-foreground" />
                <Label htmlFor="country-select" className="text-sm font-medium">Country / Region</Label>
              </div>
              <Select value={country} onValueChange={handleCountrySelectChange} disabled={loading || updatingCountry}>
                <SelectTrigger id="country-select" className="h-11">
                  <SelectValue placeholder="Select your country..." />
                </SelectTrigger>
                <SelectContent>
                  {COUNTRIES.map((c) => (
                    <SelectItem key={c.code} value={c.code}>
                      <div className="flex items-center gap-2"><span>{c.flag}</span><span>{c.name}</span></div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {selectedCountry && (
              <div className="p-3 rounded-lg bg-muted/50 border border-border">
                <p className="text-xs text-muted-foreground">
                  <span className="font-medium text-foreground">{selectedCountry.flag} {selectedCountry.name}:</span> {selectedCountry.note}
                </p>
              </div>
            )}
            <div className="pt-2 border-t border-border/50">
              <CustomTerminologyEditor countryCode={country} customTerminology={customTerminology} onSave={handleCustomTerminologySave} saving={savingTerminology} />
            </div>
          </CardContent>
        </Card>

        {/* ════════════════════════════════════════════
            TEAM & ACCESS
           ════════════════════════════════════════════ */}
        {!isStaff && (
          <>
            <SectionLabel>Team & Access</SectionLabel>
            <NavCard icon={Users} title="Staff & Permissions" subtitle="Manage user access, roles, and responsibilities" onClick={() => navigate('/staff')} />
            <SupportAccessManager />
          </>
        )}

        {/* ════════════════════════════════════════════
            ACCOUNT
           ════════════════════════════════════════════ */}
        <SectionLabel>Account</SectionLabel>

        {/* Account email — clearly labelled as login credential */}
        <Card>
          <CardContent className="py-4 px-5">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-muted flex items-center justify-center">
                <Mail className="h-4 w-4 text-muted-foreground" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold">Account Email</p>
                <p className="text-xs text-muted-foreground">Login credential — not shown on reports</p>
              </div>
              <span className="text-sm text-muted-foreground truncate max-w-[45%] text-right">{user?.email || '—'}</span>
            </div>
          </CardContent>
        </Card>

        {!isStaff && (
          <NavCard icon={CreditCard} title="Subscription & Billing" subtitle="Manage your plan, payments, and billing history" onClick={() => navigate('/billing')} />
        )}

        {/* Security */}
        <SecuritySettingsSection />

        {/* ════════════════════════════════════════════
            APP
           ════════════════════════════════════════════ */}
        <SectionLabel>App</SectionLabel>

        {/* Date & Time */}
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-muted flex items-center justify-center">
                <Calendar className="h-4 w-4 text-muted-foreground" />
              </div>
              <div>
                <CardTitle className="text-base">Date & Time</CardTitle>
                <CardDescription className="text-xs mt-0.5">Preferred date format and timezone</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="space-y-4"><Skeleton className="h-10 w-full" /><Skeleton className="h-10 w-full" /></div>
            ) : (
              <DateTimeSettings dateFormat={dateFormat} timezone={timezone} country={country} onDateFormatChange={handleDateFormatChange} onTimezoneChange={handleTimezoneChange} disabled={savingDateTime} />
            )}
          </CardContent>
        </Card>

        {/* About & Bug Report — visually secondary */}
        <Card className="border-border/60">
          <CardContent className="py-4 px-5 space-y-3">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-muted flex items-center justify-center">
                <Info className="h-4 w-4 text-muted-foreground" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold">About This App</p>
                <p className="text-xs text-muted-foreground">{APP_NAME} v{APP_VERSION} • Updated {formatVersionDate(getLastUpdateDate())}</p>
              </div>
            </div>
            <div className="flex gap-2">
              <AboutAppDialog
                trigger={
                  <Button variant="outline" size="sm" className="flex-1 gap-1.5 text-xs h-8">
                    <Info className="h-3.5 w-3.5" />Change Log
                  </Button>
                }
              />
              <BugReportDialog
                trigger={
                  <Button variant="outline" size="sm" className="flex-1 gap-1.5 text-xs h-8 border-destructive/40 text-destructive hover:bg-destructive/10">
                    <Bug className="h-3.5 w-3.5" />Report Bug
                  </Button>
                }
              />
            </div>
          </CardContent>
        </Card>

        {/* Activity Log — compact */}
        <ActivityLog limit={5} showViewAll={false} />

        {/* Tester Tools — only for testers */}
        <TesterTools />
      </div>
    </>
  );
};

export default Settings;
