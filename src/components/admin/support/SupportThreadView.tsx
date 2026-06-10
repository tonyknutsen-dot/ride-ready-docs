import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { format, formatDistanceToNow } from 'date-fns';
import { ArrowLeft, Send, StickyNote, User, Shield, Loader2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import {
  SupportMessage,
  SupportReply,
  SenderProfile,
  STATUS_CONFIG,
  PRIORITY_CONFIG,
  SupportStatus,
  SupportPriority,
} from './types';

interface Props {
  message: SupportMessage;
  replies: SupportReply[];
  sender: SenderProfile | null;
  onBack: () => void;
  onRefresh: () => void;
}

export function SupportThreadView({ message, replies, sender, onBack, onRefresh }: Props) {
  const [replyText, setReplyText] = useState('');
  const [isInternal, setIsInternal] = useState(false);
  const [sending, setSending] = useState(false);
  const [updatingField, setUpdatingField] = useState<string | null>(null);

  const senderName =
    sender?.company_name ||
    sender?.controller_name ||
    sender?.showmen_name ||
    sender?.email ||
    'Unknown user';
  const orgName = sender?.company_name && (sender?.controller_name || sender?.showmen_name)
    ? sender.company_name
    : null;
  const status = STATUS_CONFIG[message.status] || STATUS_CONFIG.pending;
  const priority = PRIORITY_CONFIG[message.priority || 'normal'] || PRIORITY_CONFIG.normal;

  const handleSendReply = async (sendEmail: boolean) => {
    if (!replyText.trim()) return;
    setSending(true);
    try {
      const user = (await supabase.auth.getUser()).data.user;
      if (!user) throw new Error('Not authenticated');

      // Insert reply
      const { error } = await (supabase.from('support_message_replies') as any).insert({
        message_id: message.id,
        author_id: user.id,
        body: replyText.trim(),
        is_internal_note: isInternal,
      });
      if (error) throw error;

      // Update status if it's a visible reply (not internal note)
      if (!isInternal) {
        await (supabase.from('support_messages') as any)
          .update({
            status: 'waiting_on_user',
            admin_response: replyText.trim(),
            responded_at: new Date().toISOString(),
            responded_by: user.id,
          })
          .eq('id', message.id);

        // Insert in-app notification so the user can see the reply even if no email is sent
        try {
          await (supabase.from('notifications') as any).insert({
            user_id: message.user_id,
            title: 'Support reply received',
            message: `Re: ${message.subject}`,
            type: 'info',
            related_table: 'support_messages',
            related_id: message.id,
          });
        } catch (notifErr) {
          console.warn('support notification insert failed:', notifErr);
        }
      }

      // Send email notification if requested (and not internal)
      if (sendEmail && !isInternal) {
        let emailSent = false;
        let emailErrorMsg = '';
        try {
          const { data: emailData } = await supabase.functions.invoke('get-user-email', {
            body: { userId: message.user_id },
          });
          if (emailData?.email) {
            const { error: sendErr } = await supabase.functions.invoke('send-support-response', {
              body: {
                messageId: message.id,
                adminResponse: replyText.trim(),
                userEmail: emailData.email,
                subject: message.subject,
              },
            });
            if (sendErr) {
              emailErrorMsg = sendErr.message || 'send failed';
            } else {
              emailSent = true;
            }
          } else {
            emailErrorMsg = 'no email address on file';
          }
        } catch (e: any) {
          emailErrorMsg = e?.message || 'invoke threw';
        }

        if (emailSent) {
          toast.success('Reply saved and emailed to user.');
        } else {
          console.error('[support-reply] email failed:', emailErrorMsg);
          toast.error(`Reply saved, but email failed to send (${emailErrorMsg}). The user may not see this unless they open the app.`);
        }
      } else if (isInternal) {
        toast.success('Internal note added.');
      } else {
        toast.warning('Reply saved in app only. No email was sent.');
      }

      setReplyText('');
      setIsInternal(false);
      onRefresh();
    } catch (err: any) {
      console.error('Error sending reply:', err);
      toast.error('Failed to send reply');
    } finally {
      setSending(false);
    }
  };

  const handleUpdateField = async (field: string, value: string) => {
    setUpdatingField(field);
    try {
      const { error } = await (supabase.from('support_messages') as any)
        .update({ [field]: value, updated_at: new Date().toISOString() })
        .eq('id', message.id);
      if (error) throw error;
      toast.success(`${field === 'status' ? 'Status' : 'Priority'} updated`);
      onRefresh();
    } catch {
      toast.error('Failed to update');
    } finally {
      setUpdatingField(null);
    }
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div className="space-y-1 flex-1 min-w-0">
          <Button variant="ghost" size="sm" onClick={onBack} className="-ml-2 mb-1">
            <ArrowLeft className="h-4 w-4 mr-1" /> Back to inbox
          </Button>
          <h2 className="text-lg font-bold leading-tight">{message.subject}</h2>
          <div className="flex items-center gap-2 text-sm text-muted-foreground flex-wrap">
            <User className="h-3.5 w-3.5" />
            <span>{senderName}</span>
            {orgName && (
              <>
                <span className="text-muted-foreground/40">·</span>
                <span>{orgName}</span>
              </>
            )}
            <span className="text-muted-foreground/40">·</span>
            <span>Opened {format(new Date(message.created_at), 'MMM d, yyyy h:mm a')}</span>
          </div>
        </div>
      </div>

      {/* Controls row */}
      <div className="grid grid-cols-2 sm:flex sm:flex-wrap gap-2 sm:gap-3 items-center">
        <div className="flex items-center gap-2">
          <Label className="text-xs text-muted-foreground shrink-0">Status</Label>
          <Select
            value={message.status}
            onValueChange={(v) => handleUpdateField('status', v)}
            disabled={updatingField === 'status'}
          >
            <SelectTrigger className={`h-8 text-xs w-full sm:w-[160px] ${status.className}`}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {Object.entries(STATUS_CONFIG).map(([k, v]) => (
                <SelectItem key={k} value={k}>{v.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="flex items-center gap-2">
          <Label className="text-xs text-muted-foreground shrink-0">Priority</Label>
          <Select
            value={message.priority || 'normal'}
            onValueChange={(v) => handleUpdateField('priority', v)}
            disabled={updatingField === 'priority'}
          >
            <SelectTrigger className={`h-8 text-xs w-full sm:w-[120px] ${priority.className}`}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {Object.entries(PRIORITY_CONFIG).map(([k, v]) => (
                <SelectItem key={k} value={k}>{v.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Conversation thread */}
      <div className="space-y-3">
        {/* Original message */}
        <Card className="border-l-4 border-l-muted-foreground/30">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 text-xs text-muted-foreground mb-2">
              <User className="h-3.5 w-3.5" />
              <span className="font-medium text-foreground">{senderName}</span>
              <span>·</span>
              <span>{formatDistanceToNow(new Date(message.created_at), { addSuffix: true })}</span>
            </div>
            <p className="text-sm whitespace-pre-wrap">{message.message}</p>
          </CardContent>
        </Card>

        {/* Replies */}
        {replies.map((reply) => {
          const isAdmin = reply.author_id !== message.user_id;
          return (
            <Card
              key={reply.id}
              className={`border-l-4 ${
                reply.is_internal_note
                  ? 'border-l-amber-400 bg-amber-50/50 dark:bg-amber-950/10'
                  : isAdmin
                  ? 'border-l-primary/60'
                  : 'border-l-muted-foreground/30'
              }`}
            >
              <CardContent className="p-4">
                <div className="flex items-center gap-2 text-xs text-muted-foreground mb-2">
                  {reply.is_internal_note ? (
                    <StickyNote className="h-3.5 w-3.5 text-amber-600" />
                  ) : isAdmin ? (
                    <Shield className="h-3.5 w-3.5 text-primary" />
                  ) : (
                    <User className="h-3.5 w-3.5" />
                  )}
                  <span className="font-medium text-foreground">
                    {reply.is_internal_note ? 'Internal note' : isAdmin ? 'Admin' : senderName}
                  </span>
                  {reply.is_internal_note && (
                    <Badge variant="outline" className="text-[9px] px-1 py-0 text-amber-700 border-amber-300">
                      Internal only
                    </Badge>
                  )}
                  <span>·</span>
                  <span>{formatDistanceToNow(new Date(reply.created_at), { addSuffix: true })}</span>
                </div>
                <p className="text-sm whitespace-pre-wrap">{reply.body}</p>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Reply composer */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-2">
            {isInternal ? (
              <>
                <StickyNote className="h-4 w-4 text-amber-600" />
                Add Internal Note
              </>
            ) : (
              <>
                <Send className="h-4 w-4" />
                Reply to User
              </>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <Textarea
            value={replyText}
            onChange={(e) => setReplyText(e.target.value)}
            placeholder={isInternal ? 'Add an internal note (not visible to user)…' : 'Type your reply…'}
            rows={4}
            className={isInternal ? 'border-amber-300 bg-amber-50/30 dark:bg-amber-950/10' : ''}
          />

          <div className="flex items-center justify-between flex-wrap gap-3">
            <div className="flex items-center gap-2">
              <Switch
                id="internal-note"
                checked={isInternal}
                onCheckedChange={setIsInternal}
              />
              <Label htmlFor="internal-note" className="text-xs text-muted-foreground cursor-pointer">
                Internal note only
              </Label>
            </div>

            <div className="flex gap-2">
              {isInternal ? (
                <Button
                  onClick={() => handleSendReply(false)}
                  disabled={sending || !replyText.trim()}
                  size="sm"
                  variant="outline"
                >
                  {sending ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" /> : <StickyNote className="h-3.5 w-3.5 mr-1" />}
                  Save Note
                </Button>
              ) : (
                <>
                  <Button
                    onClick={() => handleSendReply(false)}
                    disabled={sending || !replyText.trim()}
                    size="sm"
                    variant="outline"
                  >
                    {sending && <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" />}
                    Save in App Only
                  </Button>
                  <Button
                    onClick={() => handleSendReply(true)}
                    disabled={sending || !replyText.trim()}
                    size="sm"
                  >
                    {sending ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" /> : <Send className="h-3.5 w-3.5 mr-1" />}
                    Send & Email User (default)
                  </Button>
                </>
              )}
            </div>
          </div>

          {!isInternal && (
            <p className="text-[11px] text-muted-foreground leading-snug">
              If email is not sent, the user will only see this reply when they open the support thread in the app. An in-app notification will still be added.
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
