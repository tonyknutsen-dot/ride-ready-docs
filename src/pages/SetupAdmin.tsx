import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { toast } from 'sonner';

export default function SetupAdmin() {
  const [setupKey, setSetupKey] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const navigate = useNavigate();

  const handleSetupAdmin = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!setupKey.trim()) {
      toast.error('Please enter the setup key');
      return;
    }

    setIsLoading(true);

    try {
      const { data, error } = await supabase.functions.invoke('setup-admin', {
        body: { setupKey },
      });

      if (error) throw error;

      toast.success('Admin access granted successfully!');
      setTimeout(() => {
        navigate('/admin');
      }, 1500);
    } catch (error: any) {
      console.error('Error setting up admin:', error);
      toast.error(error.message || 'Failed to grant admin access');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>Admin Setup</CardTitle>
          <CardDescription>
            Enter the setup key to grant yourself admin access
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSetupAdmin} className="space-y-4">
            <div>
              <Input
                type="password"
                placeholder="Enter setup key"
                value={setupKey}
                onChange={(e) => setSetupKey(e.target.value)}
                disabled={isLoading}
              />
            </div>
            <Button type="submit" className="w-full" disabled={isLoading}>
              {isLoading ? 'Setting up...' : 'Grant Admin Access'}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
