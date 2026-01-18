import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Loader2, FlaskConical, Mail, Send, Clock } from 'lucide-react';

interface TesterInviteDialogProps {
  trigger?: React.ReactNode;
  onInviteSent?: () => void;
}

export function TesterInviteDialog({ trigger, onInviteSent }: TesterInviteDialogProps) {
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState('');
  const [expiryDays, setExpiryDays] = useState('30');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!email) {
      toast.error('Please enter an email address');
      return;
    }

    setLoading(true);

    try {
      const { data, error } = await supabase.functions.invoke('send-tester-invite', {
        body: { 
          email,
          expiryDays: parseInt(expiryDays) || 0
        },
      });

      if (error) throw error;

      if (data.success) {
        const expiryMsg = parseInt(expiryDays) > 0 
          ? ` (access will last ${expiryDays} days)`
          : ' (permanent access)';
        toast.success(`Tester invite sent to ${email}${expiryMsg}`);
        setEmail('');
        setExpiryDays('30');
        setOpen(false);
        onInviteSent?.();
      } else {
        throw new Error(data.error || 'Failed to send invite');
      }
    } catch (error: any) {
      console.error('Error sending tester invite:', error);
      toast.error(error.message || 'Failed to send invite');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger || (
          <Button className="gap-2">
            <FlaskConical className="h-4 w-4" />
            Invite Tester
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FlaskConical className="h-5 w-5 text-warning-foreground" />
            Invite a Tester
          </DialogTitle>
          <DialogDescription>
            Send an email invite to add someone as a tester. They'll receive a link to sign up or sign in and automatically get the tester role.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit}>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="tester-email">Email Address</Label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  id="tester-email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="tester@example.com"
                  className="pl-10"
                  disabled={loading}
                  required
                />
              </div>
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="tester-expiry" className="flex items-center gap-2">
                <Clock className="h-4 w-4" />
                Access Duration
              </Label>
              <div className="flex gap-2 items-center">
                <Input
                  id="tester-expiry"
                  type="number"
                  min="0"
                  value={expiryDays}
                  onChange={(e) => setExpiryDays(e.target.value)}
                  className="w-24"
                  disabled={loading}
                />
                <span className="text-sm text-muted-foreground">days</span>
              </div>
              <p className="text-xs text-muted-foreground">
                Set to 0 for permanent access (no expiry).
              </p>
            </div>
            
            <div className="p-3 rounded-lg bg-warning/10 border border-warning/30 text-sm">
              <p className="font-medium mb-1">What happens next:</p>
              <ul className="list-disc list-inside text-muted-foreground space-y-1 text-xs">
                <li>They'll receive an invite email with a special link</li>
                <li>The invite link is valid for 7 days</li>
                <li>They can create an account or sign in with that email</li>
                <li>They'll automatically get the tester role{parseInt(expiryDays) > 0 ? ` for ${expiryDays} days` : ' permanently'}</li>
              </ul>
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)} disabled={loading}>
              Cancel
            </Button>
            <Button type="submit" disabled={loading} className="gap-2">
              {loading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Send className="h-4 w-4" />
              )}
              Send Invite
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
