import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { AppLayout } from '@/components/AppLayout';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Loader2, MessageCircle, ArrowLeft, Send, User, Shield, Clock, Plus } from 'lucide-react';
import { toast } from 'sonner';
import { formatDistanceToNow, format } from 'date-fns';
import { ContactSupportDialog } from '@/components/ContactSupportDialog';

interface SupportMessage {
  id: string;
  subject: string;
  message: string;
  status: string;
  priority: string;
  created_at: string;
  last_activity_at: string | null;
  updated_at: string;
}

interface SupportReply {
  id: string;
  message_id: string;
  author_id: string;
  body: string;
  is_internal_note: boolean;
  created_at: string;
}

const STATUS_LABELS: Record<string, { label: string; className: string }> = {
  pending: { label: 'Awaiting Response', className: 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300' },
  in_progress: { label: 'In Progress', className: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300' },
  waiting_on_user: { label: 'Your Reply Needed', className: 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300' },
  resolved: { label: 'Resolved', className: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300' },
  archived: { label: 'Closed', className: 'bg-muted text-muted-foreground' },
};

export default function SupportRequests() {
  const { user } = useAuth();
  const [messages, setMessages] = useState<SupportMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [replies, setReplies] = useState<SupportReply[]>([]);
  const [loadingReplies, setLoadingReplies] = useState(false);
  const [replyText, setReplyText] = useState('');
  const [sending, setSending] = useState(false);
  const [contactOpen, setContactOpen] = useState(false);

  useEffect(() => { if (user) fetchMessages(); }, [user]);

  const fetchMessages = async () => {
    try {
      const { data, error } = await supabase
        .from('support_messages')
        .select('*')
        .eq('user_id', user!.id)
        .order('created_at', { ascending: false });
      if (error) throw error;
      setMessages((data || []) as SupportMessage[]);
    } catch {
      toast.error('Failed to load support requests');
    } finally {
      setLoading(false);
    }
  };

  const fetchThread = async (messageId: string) => {
    setLoadingReplies(true);
    try {
      // RLS ensures only non-internal replies are returned for regular users
      const { data } = await (supabase.from('support_message_replies') as any)
        .select('*')
        .eq('message_id', messageId)
        .order('created_at', { ascending: true });
      setReplies(data || []);
    } finally {
      setLoadingReplies(false);
    }
  };

  const handleSelect = (id: string) => {
    setSelectedId(id);
    fetchThread(id);
  };

  const handleReply = async () => {
    if (!replyText.trim() || !selectedId || !user) return;
    setSending(true);
    try {
      const { error } = await (supabase.from('support_message_replies') as any).insert({
        message_id: selectedId,
        author_id: user.id,
        body: replyText.trim(),
        is_internal_note: false,
      });
      if (error) throw error;
      toast.success('Reply sent');
      setReplyText('');
      fetchThread(selectedId);
      fetchMessages(); // refresh activity timestamp
    } catch {
      toast.error('Failed to send reply');
    } finally {
      setSending(false);
    }
  };

  const selectedMessage = messages.find((m) => m.id === selectedId);

  if (loading) {
    return (
      <AppLayout>
        <div className="flex items-center justify-center min-h-[400px]">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </AppLayout>
    );
  }

  // Thread detail view
  if (selectedMessage) {
    const status = STATUS_LABELS[selectedMessage.status] || STATUS_LABELS.pending;
    return (
      <AppLayout>
        <div className="space-y-4 max-w-2xl mx-auto">
          <Button variant="ghost" size="sm" onClick={() => { setSelectedId(null); setReplies([]); }} className="-ml-2">
            <ArrowLeft className="h-4 w-4 mr-1" /> My Requests
          </Button>

          <div className="space-y-1">
            <h2 className="text-lg font-bold leading-tight">{selectedMessage.subject}</h2>
            <div className="flex items-center gap-2 text-xs text-muted-foreground flex-wrap">
              <Badge className={status.className}>{status.label}</Badge>
              <span>Opened {format(new Date(selectedMessage.created_at), 'MMM d, yyyy')}</span>
            </div>
          </div>

          {/* Thread */}
          <div className="space-y-3">
            {/* Original message */}
            <Card className="border-l-4 border-l-primary/40">
              <CardContent className="p-4">
                <div className="flex items-center gap-2 text-xs text-muted-foreground mb-2">
                  <User className="h-3.5 w-3.5" />
                  <span className="font-medium text-foreground">You</span>
                  <span>·</span>
                  <span>{formatDistanceToNow(new Date(selectedMessage.created_at), { addSuffix: true })}</span>
                </div>
                <p className="text-sm whitespace-pre-wrap">{selectedMessage.message}</p>
              </CardContent>
            </Card>

            {loadingReplies && (
              <div className="flex justify-center py-4">
                <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
              </div>
            )}

            {replies.map((reply) => {
              const isUser = reply.author_id === user?.id;
              return (
                <Card key={reply.id} className={`border-l-4 ${isUser ? 'border-l-primary/40' : 'border-l-green-500/60'}`}>
                  <CardContent className="p-4">
                    <div className="flex items-center gap-2 text-xs text-muted-foreground mb-2">
                      {isUser ? <User className="h-3.5 w-3.5" /> : <Shield className="h-3.5 w-3.5 text-green-600" />}
                      <span className="font-medium text-foreground">{isUser ? 'You' : 'Support Team'}</span>
                      <span>·</span>
                      <span>{formatDistanceToNow(new Date(reply.created_at), { addSuffix: true })}</span>
                    </div>
                    <p className="text-sm whitespace-pre-wrap">{reply.body}</p>
                  </CardContent>
                </Card>
              );
            })}
          </div>

          {/* Reply box — only for non-resolved/archived threads */}
          {!['resolved', 'archived'].includes(selectedMessage.status) && (
            <Card>
              <CardContent className="p-4 space-y-3">
                <Textarea
                  value={replyText}
                  onChange={(e) => setReplyText(e.target.value)}
                  placeholder="Type your reply…"
                  rows={3}
                />
                <div className="flex justify-end">
                  <Button onClick={handleReply} disabled={sending || !replyText.trim()} size="sm">
                    {sending ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" /> : <Send className="h-3.5 w-3.5 mr-1" />}
                    Send Reply
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

          {['resolved', 'archived'].includes(selectedMessage.status) && (
            <p className="text-xs text-muted-foreground text-center py-2">
              This request has been resolved. Need more help? Open a new request.
            </p>
          )}
        </div>
      </AppLayout>
    );
  }

  // List view
  const isEmpty = messages.length === 0;

  return (
    <AppLayout>
      <div className="space-y-5 max-w-2xl mx-auto px-1">
        {/* Header — hidden on mobile when empty, shown when there are messages */}
        <div className={`space-y-2 md:space-y-0 md:flex md:items-center md:justify-between md:gap-4 ${isEmpty ? 'hidden md:flex' : ''}`}>
          <div className="space-y-0.5">
            <h1 className="text-base md:text-xl font-semibold">My Support Requests</h1>
            <p className="text-[13px] text-muted-foreground">View your support conversations</p>
          </div>
          <Button size="sm" onClick={() => setContactOpen(true)} className="w-full md:w-auto mt-1.5 md:mt-0">
            <Plus className="h-4 w-4 mr-1" /> New Request
          </Button>
        </div>

        {isEmpty ? (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-8 md:py-12">
              <MessageCircle className="h-10 w-10 text-muted-foreground/30 mb-2.5" />
              <p className="text-base font-semibold mb-0.5">My Support Requests</p>
              <p className="text-[13px] text-muted-foreground mb-4">View your support conversations</p>
              <Button size="sm" onClick={() => setContactOpen(true)}>
                <Plus className="h-4 w-4 mr-1" /> New Request
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-2">
            {messages.map((msg) => {
              const status = STATUS_LABELS[msg.status] || STATUS_LABELS.pending;
              const activityDate = msg.last_activity_at || msg.updated_at;
              return (
                <Card
                  key={msg.id}
                  className="cursor-pointer hover:border-primary/50 transition-colors group"
                  onClick={() => handleSelect(msg.id)}
                >
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1 min-w-0 space-y-1">
                        <h3 className="font-semibold text-sm truncate group-hover:text-primary transition-colors">
                          {msg.subject}
                        </h3>
                        <p className="text-xs text-muted-foreground line-clamp-1">{msg.message}</p>
                      </div>
                      <div className="flex flex-col items-end gap-1 shrink-0">
                        <Badge className={`${status.className} text-[10px] px-1.5 py-0`}>{status.label}</Badge>
                        <span className="flex items-center gap-1 text-[10px] text-muted-foreground">
                          <Clock className="h-2.5 w-2.5" />
                          {formatDistanceToNow(new Date(activityDate), { addSuffix: true })}
                        </span>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}

        <ContactSupportDialog open={contactOpen} onOpenChange={(v) => { setContactOpen(v); if (!v) fetchMessages(); }} />
      </div>
    </AppLayout>
  );
}
