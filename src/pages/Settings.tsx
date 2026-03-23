import { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useStaff } from '@/contexts/StaffContext';
import { supabase } from '@/integrations/supabase/client';
import ProfileEdit from '@/components/ProfileEdit';
import { Skeleton } from '@/components/ui/skeleton';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  Settings as SettingsIcon, User, Globe, ArrowRight, Mail, ArrowLeft, Info, Bug,
  Calendar, Building2, Shield, Users, CreditCard, ChevronRight, FileText, LogOut,
  HeadphonesIcon, X,
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
import SupportAccessManager from '@/components/SupportAccessManager';
import { SecuritySettingsSection } from '@/components/SecuritySettingsSection';

/* ── Section heading ── */
const SectionHeading = ({ children }: { children: React.ReactNode }) => (
  <p className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground px-1 pt-5 pb-1">
    {children}
  </p>
);

/* ── Settings row — the core building block ── */
const SettingsRow = ({
  icon: Icon,
  title,
  value,
  onClick,
  last = false,
  chevron = true,
}: {
  icon: React.ElementType;
  title: string;
  value?: string;
  onClick?: () => void;
  last?: boolean;
  chevron?: boolean;
}) => (
  <button
    type="button"
    onClick={onClick}
    className={`w-full flex items-center gap-3 px-4 py-3.5 text-left transition-colors hover:bg-muted/50 active:bg-muted ${!last ? 'border-b border-border/50' : ''}`}
  >
    <Icon className="h-[18px] w-[18px] text-muted-foreground shrink-0" />
    <span className="flex-1 text-sm font-medium">{title}</span>
    {value && <span className="text-xs text-muted-foreground truncate max-w-[40%] text-right">{value}</span>}
    {chevron && <ChevronRight className="h-4 w-4 text-muted-foreground/60 shrink-0" />}
  </button>
);

/* ── Grouped card wrapper ── */
const SettingsGroup = ({ children }: { children: React.ReactNode }) => (
  <div className="rounded-xl border border-border bg-card overflow-hidden">
    {children}
  </div>
);

const Settings = () => {
  const { user } = useAuth();
  const { isStaff, staffMembership } = useStaff();
  const { toast } = useToast();
  const navigate = useNavigate();
  const [profile, setProfile] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  // Expanded panels
  const [activePanel, setActivePanel] = useState<string | null>(null);

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

  const togglePanel = (panel: string) => {
    setActivePanel(prev => prev === panel ? null : panel);
  };

  const handleProfileComplete = () => {
    setActivePanel(null);
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

      <div className="container mx-auto px-4 py-5 pb-28 md:pb-8 space-y-1 max-w-2xl">
        {/* Back */}
        <Button variant="ghost" size="sm" onClick={() => navigate('/overview')} className="w-fit gap-1.5 -ml-2 text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-4 w-4" />Back
        </Button>

        {/* Header */}
        <div className="flex items-center gap-3 pb-2">
          <div className="w-10 h-10 rounded-xl bg-muted flex items-center justify-center shrink-0">
            <SettingsIcon className="h-5 w-5 text-muted-foreground" />
          </div>
          <div>
            <h1 className="text-xl font-bold">Settings</h1>
            <p className="text-xs text-muted-foreground">Organisation, account & app preferences</p>
          </div>
        </div>

        {/* ═══ ORGANISATION ═══ */}
        <SectionHeading>Organisation</SectionHeading>

        {isStaff ? (
          <div className="rounded-xl border border-border bg-card p-4">
            <Alert className="bg-muted/50 border-muted">
              <Info className="h-4 w-4" />
              <AlertDescription className="text-sm">
                You're logged in as a staff member for <strong>{staffMembership?.organisationName}</strong>.
                Profile settings are managed by the account owner.
              </AlertDescription>
            </Alert>
          </div>
        ) : (
          <>
            <SettingsGroup>
              <SettingsRow
                icon={Building2}
                title="Organisation Profile"
                value={loading ? '…' : (profile?.company_name || 'Not set')}
                onClick={() => togglePanel('profile')}
              />
              <SettingsRow
                icon={FileText}
                title="Reports & Identity"
                value="Text identity for PDFs"
                onClick={() => togglePanel('reports')}
              />
              <SettingsRow
                icon={Globe}
                title="Region & Terminology"
                value={selectedCountry ? `${selectedCountry.flag} ${selectedCountry.name}` : '—'}
                onClick={() => togglePanel('region')}
                last
              />
            </SettingsGroup>

            {/* Expanded panels — render below the group */}
            {activePanel === 'profile' && (
              <div className="rounded-xl border border-primary/30 bg-card p-4 space-y-3 animate-in fade-in-0 slide-in-from-top-1 duration-200">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-semibold">Organisation Profile</p>
                  <Button variant="ghost" size="sm" className="h-7 text-xs gap-1 text-muted-foreground" onClick={() => setActivePanel(null)}>
                    <X className="h-3.5 w-3.5" />Close
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground -mt-1">Used on reports, PDFs, and exported records</p>
                {loading ? (
                  <div className="space-y-3"><Skeleton className="h-4 w-3/4" /><Skeleton className="h-4 w-1/2" /></div>
                ) : (
                  <ProfileEdit profile={profile} onComplete={handleProfileComplete} />
                )}
              </div>
            )}

            {activePanel === 'reports' && (
              <div className="rounded-xl border border-border bg-card p-4 space-y-3 animate-in fade-in-0 slide-in-from-top-1 duration-200">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-semibold">Reports & Identity</p>
                  <Button variant="ghost" size="sm" className="h-7 text-xs gap-1 text-muted-foreground" onClick={() => setActivePanel(null)}>
                    <X className="h-3.5 w-3.5" />Close
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground -mt-1">This text-based identity appears on generated reports and exported documents</p>
                {loading ? (
                  <Skeleton className="h-16 w-full" />
                ) : (
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between py-1">
                      <span className="text-muted-foreground">Organisation</span>
                      <span className="font-medium text-right">{profile?.company_name || '—'}</span>
                    </div>
                    <div className="flex justify-between py-1 border-t border-border/40">
                      <span className="text-muted-foreground">Primary Contact</span>
                      <span className="font-medium text-right">{profile?.controller_name || '—'}</span>
                    </div>
                    <div className="flex justify-between py-1 border-t border-border/40">
                      <span className="text-muted-foreground">Address</span>
                      <span className="font-medium text-right max-w-[60%] truncate">{profile?.address || '—'}</span>
                    </div>
                    <p className="text-[11px] text-muted-foreground/70 pt-2">
                      Edit these details via Organisation Profile.
                    </p>
                  </div>
                )}
              </div>
            )}

            {activePanel === 'region' && (
              <div className="rounded-xl border border-border bg-card p-4 space-y-4 animate-in fade-in-0 slide-in-from-top-1 duration-200">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-semibold">Region & Terminology</p>
                  <Button variant="ghost" size="sm" className="h-7 text-xs gap-1 text-muted-foreground" onClick={() => setActivePanel(null)}>
                    <X className="h-3.5 w-3.5" />Close
                  </Button>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="country-select" className="text-xs font-medium text-muted-foreground">Country / Region</Label>
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
                  <p className="text-xs text-muted-foreground">
                    <span className="font-medium text-foreground">{selectedCountry.flag} {selectedCountry.name}:</span> {selectedCountry.note}
                  </p>
                )}
                <div className="pt-2 border-t border-border/50">
                  <CustomTerminologyEditor countryCode={country} customTerminology={customTerminology} onSave={handleCustomTerminologySave} saving={savingTerminology} />
                </div>
              </div>
            )}
          </>
        )}

        {/* ═══ TEAM ═══ */}
        {!isStaff && (
          <>
            <SectionHeading>Team</SectionHeading>
            <SettingsGroup>
              <SettingsRow
                icon={Users}
                title="Staff & Permissions"
                value="Manage access"
                onClick={() => navigate('/staff')}
              />
              <SettingsRow
                icon={HeadphonesIcon}
                title="Support Access"
                onClick={() => togglePanel('support')}
                last
              />
            </SettingsGroup>

            {activePanel === 'support' && (
              <div className="rounded-xl border border-border bg-card p-4 animate-in fade-in-0 slide-in-from-top-1 duration-200">
                <div className="flex items-center justify-between mb-3">
                  <p className="text-sm font-semibold">Support Access</p>
                  <Button variant="ghost" size="sm" className="h-7 text-xs gap-1 text-muted-foreground" onClick={() => setActivePanel(null)}>
                    <X className="h-3.5 w-3.5" />Close
                  </Button>
                </div>
                <SupportAccessManager />
              </div>
            )}
          </>
        )}

        {/* ═══ ACCOUNT ═══ */}
        <SectionHeading>Account</SectionHeading>
        <SettingsGroup>
          <SettingsRow
            icon={Mail}
            title="Account Email"
            value={user?.email || '—'}
            chevron={false}
          />
          {!isStaff && (
            <SettingsRow
              icon={CreditCard}
              title="Subscription & Billing"
              onClick={() => navigate('/billing')}
            />
          )}
          <SettingsRow
            icon={Shield}
            title="Security"
            value="PIN, 2FA & sessions"
            onClick={() => togglePanel('security')}
            last={isStaff}
          />
          {!isStaff && (
            <SettingsRow
              icon={LogOut}
              title="Account Actions"
              value="Sign out"
              onClick={() => togglePanel('security')}
              last
            />
          )}
        </SettingsGroup>

        {activePanel === 'security' && (
          <div className="space-y-3 animate-in fade-in-0 slide-in-from-top-1 duration-200">
            <div className="flex items-center justify-between px-1">
              <p className="text-sm font-semibold">Security & Account Actions</p>
              <Button variant="ghost" size="sm" className="h-7 text-xs gap-1 text-muted-foreground" onClick={() => setActivePanel(null)}>
                <X className="h-3.5 w-3.5" />Close
              </Button>
            </div>
            <SecuritySettingsSection />
          </div>
        )}

        {/* ═══ APP ═══ */}
        <SectionHeading>App</SectionHeading>
        <SettingsGroup>
          <SettingsRow
            icon={Calendar}
            title="Date & Time"
            value={dateFormat}
            onClick={() => togglePanel('datetime')}
          />
          <SettingsRow
            icon={Info}
            title="About This App"
            value={`v${APP_VERSION}`}
            onClick={() => togglePanel('about')}
            last
          />
        </SettingsGroup>

        {activePanel === 'datetime' && (
          <div className="rounded-xl border border-border bg-card p-4 animate-in fade-in-0 slide-in-from-top-1 duration-200">
            <div className="flex items-center justify-between mb-3">
              <p className="text-sm font-semibold">Date & Time</p>
              <Button variant="ghost" size="sm" className="h-7 text-xs gap-1 text-muted-foreground" onClick={() => setActivePanel(null)}>
                <X className="h-3.5 w-3.5" />Close
              </Button>
            </div>
            {loading ? (
              <div className="space-y-4"><Skeleton className="h-10 w-full" /><Skeleton className="h-10 w-full" /></div>
            ) : (
              <DateTimeSettings dateFormat={dateFormat} timezone={timezone} country={country} onDateFormatChange={handleDateFormatChange} onTimezoneChange={handleTimezoneChange} disabled={savingDateTime} />
            )}
          </div>
        )}

        {activePanel === 'about' && (
          <div className="rounded-xl border border-border bg-card p-4 space-y-3 animate-in fade-in-0 slide-in-from-top-1 duration-200">
            <div className="flex items-center justify-between">
              <p className="text-sm font-semibold">About This App</p>
              <Button variant="ghost" size="sm" className="h-7 text-xs gap-1 text-muted-foreground" onClick={() => setActivePanel(null)}>
                <X className="h-3.5 w-3.5" />Close
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">{APP_NAME} v{APP_VERSION} • Updated {formatVersionDate(getLastUpdateDate())}</p>
            <div className="flex gap-2">
              <AboutAppDialog
                trigger={
                  <Button variant="outline" size="sm" className="flex-1 gap-1.5 text-xs h-9">
                    <Info className="h-3.5 w-3.5" />Change Log
                  </Button>
                }
              />
              <BugReportDialog
                trigger={
                  <Button variant="outline" size="sm" className="flex-1 gap-1.5 text-xs h-9 border-destructive/40 text-destructive hover:bg-destructive/10">
                    <Bug className="h-3.5 w-3.5" />Report Bug
                  </Button>
                }
              />
            </div>
          </div>
        )}

        {/* Tester Tools — only for testers */}
        <TesterTools />
      </div>
    </>
  );
};

export default Settings;
