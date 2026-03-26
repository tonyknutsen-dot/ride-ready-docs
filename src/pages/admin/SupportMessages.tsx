import { useState, useEffect, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { AdminLayout } from '@/components/admin/AdminLayout';
import { Card, CardContent } from '@/components/ui/card';
import { Loader2, MessageCircle } from 'lucide-react';
import { toast } from 'sonner';
import { SupportQueueFilters } from '@/components/admin/support/SupportQueueFilters';
import { SupportMessageRow } from '@/components/admin/support/SupportMessageRow';
import { SupportThreadView } from '@/components/admin/support/SupportThreadView';
import type { SupportMessage, SupportReply, SenderProfile, SortOption } from '@/components/admin/support/types';

const PRIORITY_ORDER: Record<string, number> = { urgent: 0, high: 1, normal: 2, low: 3 };
const OPEN_STATUSES = ['pending', 'in_progress', 'waiting_on_user'];

export default function SupportMessages() {
  const [messages, setMessages] = useState<SupportMessage[]>([]);
  const [replies, setReplies] = useState<Record<string, SupportReply[]>>({});
  const [replyCounts, setReplyCounts] = useState<Record<string, number>>({});
  const [senders, setSenders] = useState<Record<string, SenderProfile>>({});
  const [loading, setLoading] = useState(true);
  const [filterStatus, setFilterStatus] = useState('open');
  const [sortBy, setSortBy] = useState<SortOption>('newest');
  const [search, setSearch] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(null);

  useEffect(() => { fetchMessages(); }, []);

  const fetchMessages = async () => {
    try {
      const { data, error } = await supabase
        .from('support_messages')
        .select('*')
        .order('created_at', { ascending: false });
      if (error) throw error;

      const msgs = (data || []) as SupportMessage[];
      setMessages(msgs);

      // Fetch sender profiles
      const userIds = [...new Set(msgs.map((m) => m.user_id))];
      if (userIds.length > 0) {
        const { data: profiles } = await supabase
          .from('profiles')
          .select('user_id, full_name, company_name')
          .in('user_id', userIds);
        const map: Record<string, SenderProfile> = {};
        (profiles || []).forEach((p: any) => { map[p.user_id] = p; });
        setSenders(map);
      }

      // Fetch reply counts per message
      const msgIds = msgs.map((m) => m.id);
      if (msgIds.length > 0) {
        const { data: allReplies } = await (supabase.from('support_message_replies') as any)
          .select('id, message_id')
          .in('message_id', msgIds);
        const countMap: Record<string, number> = {};
        (allReplies || []).forEach((r: any) => {
          countMap[r.message_id] = (countMap[r.message_id] || 0) + 1;
        });
        setReplyCounts(countMap);
      }
    } catch (err: any) {
      console.error('Error fetching messages:', err);
      toast.error('Failed to load support messages');
    } finally {
      setLoading(false);
    }
  };

  const fetchThread = async (messageId: string) => {
    const { data } = await (supabase.from('support_message_replies') as any)
      .select('*')
      .eq('message_id', messageId)
      .order('created_at', { ascending: true });
    setReplies((prev) => ({ ...prev, [messageId]: data || [] }));
  };

  const handleSelect = (id: string) => {
    setSelectedId(id);
    fetchThread(id);
  };

  // Counts for queue filters
  const counts = useMemo(() => {
    const c: Record<string, number> = { open: 0, pending: 0, in_progress: 0, waiting_on_user: 0, resolved: 0, archived: 0, all: messages.length };
    messages.forEach((m) => {
      const s = m.status || 'pending';
      if (c[s] !== undefined) c[s]++;
      if (OPEN_STATUSES.includes(s)) c.open++;
    });
    return c;
  }, [messages]);

  // Filter + search + sort
  const filteredMessages = useMemo(() => {
    let result = messages;

    // Status filter
    if (filterStatus === 'open') {
      result = result.filter((m) => OPEN_STATUSES.includes(m.status || 'pending'));
    } else if (filterStatus !== 'all') {
      result = result.filter((m) => m.status === filterStatus);
    }

    // Search
    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter((m) => {
        const sender = senders[m.user_id];
        return (
          m.subject.toLowerCase().includes(q) ||
          m.message.toLowerCase().includes(q) ||
          (sender?.full_name || '').toLowerCase().includes(q) ||
          (sender?.company_name || '').toLowerCase().includes(q)
        );
      });
    }

    // Sort
    result = [...result].sort((a, b) => {
      switch (sortBy) {
        case 'oldest':
          return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
        case 'priority':
          return (PRIORITY_ORDER[a.priority || 'normal'] ?? 2) - (PRIORITY_ORDER[b.priority || 'normal'] ?? 2);
        case 'waiting_longest':
          return new Date(a.last_activity_at || a.created_at).getTime() - new Date(b.last_activity_at || b.created_at).getTime();
        case 'unresolved':
          const aOpen = OPEN_STATUSES.includes(a.status) ? 0 : 1;
          const bOpen = OPEN_STATUSES.includes(b.status) ? 0 : 1;
          return aOpen - bOpen || new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
        default: // newest
          return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
      }
    });

    return result;
  }, [messages, filterStatus, search, sortBy, senders]);

  const selectedMessage = messages.find((m) => m.id === selectedId) || null;

  if (loading) {
    return (
      <AdminLayout>
        <div className="flex items-center justify-center min-h-[400px]">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout>
      <div className="space-y-5">
        {/* Header */}
        <div>
          <h1 className="text-xl md:text-2xl font-bold flex items-center gap-2">
            <MessageCircle className="h-5 w-5 text-primary" />
            Support Messages
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Manage and respond to customer support requests
          </p>
        </div>

        {selectedMessage ? (
          <SupportThreadView
            message={selectedMessage}
            replies={replies[selectedMessage.id] || []}
            sender={senders[selectedMessage.user_id] || null}
            onBack={() => setSelectedId(null)}
            onRefresh={() => { fetchMessages(); if (selectedId) fetchThread(selectedId); }}
          />
        ) : (
          <>
            <SupportQueueFilters
              filterStatus={filterStatus}
              onFilterChange={setFilterStatus}
              sortBy={sortBy}
              onSortChange={setSortBy}
              search={search}
              onSearchChange={setSearch}
              counts={counts}
            />

            <div className="space-y-2">
              {filteredMessages.length === 0 ? (
                <Card>
                  <CardContent className="flex flex-col items-center justify-center py-12">
                    <MessageCircle className="h-12 w-12 text-muted-foreground/30 mb-4" />
                    <p className="text-muted-foreground text-sm">No messages in this queue</p>
                  </CardContent>
                </Card>
              ) : (
                filteredMessages.map((msg) => (
                  <SupportMessageRow
                    key={msg.id}
                    msg={msg}
                    sender={senders[msg.user_id] || null}
                    replyCount={replyCounts[msg.id] || 0}
                    onClick={() => handleSelect(msg.id)}
                  />
                ))
              )}
            </div>
          </>
        )}
      </div>
    </AdminLayout>
  );
}
