import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Mail, Loader2, CheckCircle2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useEffectiveUserId } from '@/hooks/useEffectiveUserId';
import { useToast } from '@/hooks/use-toast';

interface QuickSendDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Document IDs from the documents table to send */
  documentIds: string[];
  /** Display name of the document being sent */
  documentName?: string;
}

const QuickSendDialog = ({ open, onOpenChange, documentIds, documentName }: QuickSendDialogProps) => {
  const { user } = useAuth();
  const { effectiveUserId } = useEffectiveUserId();
  const { toast } = useToast();

  const [recipientEmail, setRecipientEmail] = useState('');
  const [recipientName, setRecipientName] = useState('');
  const [message, setMessage] = useState('');
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [profile, setProfile] = useState<any>(null);
  const [profileLoaded, setProfileLoaded] = useState(false);

  // Load profile on open
  const loadProfile = async () => {
    if (profileLoaded) return;
    const { data } = await supabase
      .from('profiles')
      .select('company_name, controller_name')
      .eq('user_id', effectiveUserId)
      .single();
    setProfile(data);
    setProfileLoaded(true);
  };

  if (open && !profileLoaded) {
    loadProfile();
  }

  const handleSend = async () => {
    if (!recipientEmail || documentIds.length === 0) return;
    setSending(true);
    try {
      const { error } = await supabase.functions.invoke('create-document-share', {
        body: {
          recipientEmail,
          recipientName: recipientName || undefined,
          message: message || undefined,
          documentIds,
          expiryDays: 7,
        },
      });
      if (error) throw error;
      setSent(true);
      toast({ title: 'Sent', description: `Document sent to ${recipientEmail}` });
    } catch (err: any) {
      console.error('QuickSend failed:', err);
      toast({ title: 'Failed to send', description: err.message || 'Please try again', variant: 'destructive' });
    } finally {
      setSending(false);
    }
  };

  const handleClose = (nextOpen: boolean) => {
    if (!nextOpen) {
      setRecipientEmail('');
      setRecipientName('');
      setMessage('');
      setSent(false);
      setSending(false);
    }
    onOpenChange(nextOpen);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-base">
            {sent ? 'Sent successfully' : 'Send Document'}
          </DialogTitle>
          {documentName && (
            <DialogDescription className="text-xs truncate">
              {documentName}
            </DialogDescription>
          )}
        </DialogHeader>

        {sent ? (
          <div className="flex flex-col items-center py-6 gap-3">
            <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center">
              <CheckCircle2 className="h-6 w-6 text-primary" />
            </div>
            <p className="text-sm font-medium text-foreground">Document sent</p>
            <p className="text-xs text-muted-foreground text-center max-w-[260px]">
              A secure download link has been emailed to {recipientEmail}. It expires in 7 days.
            </p>
            <Button variant="outline" className="mt-2 w-full" onClick={() => handleClose(false)}>
              Done
            </Button>
          </div>
        ) : (
          <div className="space-y-4 pt-1">
            {/* Sender info */}
            {profile && (profile.company_name || profile.controller_name) && (
              <div className="bg-muted/50 border border-border rounded-xl p-3">
                <p className="text-[11px] font-semibold text-muted-foreground mb-1">FROM</p>
                {profile.company_name && <p className="text-xs text-foreground">{profile.company_name}</p>}
                {profile.controller_name && <p className="text-xs text-foreground/70">{profile.controller_name}</p>}
                {user?.email && <p className="text-xs text-foreground/60">{user.email}</p>}
              </div>
            )}

            <div className="space-y-3">
              <div>
                <Label htmlFor="qs-email" className="text-xs font-medium mb-1.5 block">
                  Recipient Email *
                </Label>
                <Input
                  id="qs-email"
                  type="email"
                  value={recipientEmail}
                  onChange={(e) => setRecipientEmail(e.target.value)}
                  placeholder="inspector@example.com"
                  autoFocus
                />
              </div>
              <div>
                <Label htmlFor="qs-name" className="text-xs font-medium mb-1.5 block">
                  Name / Organisation
                </Label>
                <Input
                  id="qs-name"
                  value={recipientName}
                  onChange={(e) => setRecipientName(e.target.value)}
                  placeholder="Optional"
                />
              </div>
              <div>
                <Label htmlFor="qs-msg" className="text-xs font-medium mb-1.5 block">
                  Message <span className="text-muted-foreground font-normal">(optional)</span>
                </Label>
                <Textarea
                  id="qs-msg"
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  placeholder="Add a note for the recipient…"
                  rows={2}
                  className="resize-none"
                />
              </div>
            </div>

            <p className="text-[11px] text-muted-foreground text-center">
              A secure download link valid for 7 days will be emailed to the recipient.
            </p>

            <div className="flex gap-3">
              <Button variant="outline" className="flex-1" onClick={() => handleClose(false)}>
                Cancel
              </Button>
              <Button
                className="flex-1 gap-1.5"
                onClick={handleSend}
                disabled={sending || !recipientEmail}
              >
                {sending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Mail className="h-4 w-4" />
                )}
                {sending ? 'Sending…' : 'Send'}
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default QuickSendDialog;
