import { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import ProfileEdit from '@/components/ProfileEdit';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { Info } from 'lucide-react';
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
      <div className="container mx-auto py-6 space-y-6 max-w-4xl pb-24 md:pb-6">
        <div>
          <h1 className="text-3xl font-bold">Settings</h1>
          <p className="text-muted-foreground mt-2">
            Manage your profile and account settings
          </p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Profile Information</CardTitle>
            <CardDescription>
              Update your company and contact details. This information will be included when sending documents to councils.
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

        <Card>
          <CardHeader>
            <CardTitle>Document Management</CardTitle>
            <CardDescription>
              Configure how documents are handled when uploading
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between space-x-4">
              <div className="flex-1 space-y-1">
                <div className="flex items-center gap-2">
                  <Label htmlFor="version-control" className="text-sm font-medium">
                    Enable Version Control
                  </Label>
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Info className="h-4 w-4 text-muted-foreground cursor-help" />
                      </TooltipTrigger>
                      <TooltipContent className="max-w-sm">
                        <p className="font-semibold mb-2">What is Document Version Control?</p>
                        <p className="mb-2"><strong>When ON (Recommended):</strong> Uploading a document with the same name creates a new version (v1.0, v2.0, etc.). All previous versions are kept in history and remain accessible.</p>
                        <p><strong>When OFF:</strong> Uploading a document with the same name completely replaces and deletes the old one. No version history is maintained.</p>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                </div>
                <p className="text-xs text-muted-foreground">
                  When enabled, uploading a document with the same name creates a new version instead of replacing the original. All versions are kept for your records.
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

        <Card>
          <CardHeader>
            <CardTitle>Account</CardTitle>
            <CardDescription>
              Your account email
            </CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              <span className="font-medium">Email:</span> {user?.email}
            </p>
          </CardContent>
        </Card>
      </div>
    </>
  );
};

export default Settings;
