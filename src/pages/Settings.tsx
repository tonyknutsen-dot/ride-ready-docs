import { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import ProfileEdit from '@/components/ProfileEdit';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { Info, Settings as SettingsIcon, User, FileText, Mail } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import AppHeader from '@/components/AppHeader';

const Settings = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [profile, setProfile] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [versioningEnabled, setVersioningEnabled] = useState(true);
  const [updatingVersioning, setUpdatingVersioning] = useState(false);

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

  useEffect(() => {
    fetchProfile();
  }, [user]);

  const handleComplete = () => {
    fetchProfile();
  };

  return (
    <>
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
