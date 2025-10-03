import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { AdminLayout } from '@/components/admin/AdminLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { toast } from 'sonner';
import { Loader2, MessageCircle, Clock, CheckCircle2, AlertCircle } from 'lucide-react';
import { format } from 'date-fns';

interface SupportMessage {
  id: string;
  subject: string;
  message: string;
  status: string;
  priority: string;
  admin_response: string | null;
  responded_at: string | null;
  created_at: string;
  updated_at: string;
  user_id: string;
}

const priorityColors = {
  low: 'bg-blue-100 text-blue-800',
  normal: 'bg-gray-100 text-gray-800',
  high: 'bg-orange-100 text-orange-800',
  urgent: 'bg-red-100 text-red-800',
};

const statusColors = {
  pending: 'bg-yellow-100 text-yellow-800',
  in_progress: 'bg-blue-100 text-blue-800',
  resolved: 'bg-green-100 text-green-800',
};

const statusIcons = {
  pending: Clock,
  in_progress: AlertCircle,
  resolved: CheckCircle2,
};

export default function SupportMessages() {
  const [messages, setMessages] = useState<SupportMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [selectedMessage, setSelectedMessage] = useState<SupportMessage | null>(null);
  const [response, setResponse] = useState('');
  const [updating, setUpdating] = useState(false);

  useEffect(() => {
    fetchMessages();
  }, [filterStatus]);

  const fetchMessages = async () => {
    try {
      let query = supabase
        .from('support_messages')
        .select('*')
        .order('created_at', { ascending: false });

      if (filterStatus !== 'all') {
        query = query.eq('status', filterStatus);
      }

      const { data, error } = await query;

      if (error) throw error;
      setMessages(data || []);
    } catch (error: any) {
      console.error('Error fetching messages:', error);
      toast.error('Failed to load support messages');
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateMessage = async (
    messageId: string,
    updates: { status?: string; admin_response?: string }
  ) => {
    setUpdating(true);

    try {
      const updateData: any = { ...updates, updated_at: new Date().toISOString() };

      if (updates.admin_response) {
        updateData.responded_at = new Date().toISOString();
        updateData.responded_by = (await supabase.auth.getUser()).data.user?.id;
      }

      const { error } = await supabase
        .from('support_messages')
        .update(updateData)
        .eq('id', messageId);

      if (error) throw error;

      toast.success('Message updated successfully');
      fetchMessages();
      setSelectedMessage(null);
      setResponse('');
    } catch (error: any) {
      console.error('Error updating message:', error);
      toast.error('Failed to update message');
    } finally {
      setUpdating(false);
    }
  };

  const MessageCard = ({ msg }: { msg: SupportMessage }) => {
    const StatusIcon = statusIcons[msg.status as keyof typeof statusIcons];

    return (
      <Card
        className="cursor-pointer hover:border-primary transition-colors"
        onClick={() => setSelectedMessage(msg)}
      >
        <CardHeader>
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <CardTitle className="text-lg">{msg.subject}</CardTitle>
              <CardDescription className="mt-1">
                {format(new Date(msg.created_at), 'MMM d, yyyy h:mm a')}
              </CardDescription>
            </div>
            <div className="flex flex-col gap-2 items-end">
              <Badge className={priorityColors[msg.priority as keyof typeof priorityColors]}>
                {msg.priority}
              </Badge>
              <Badge className={statusColors[msg.status as keyof typeof statusColors]}>
                <StatusIcon className="h-3 w-3 mr-1" />
                {msg.status.replace('_', ' ')}
              </Badge>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground line-clamp-2">{msg.message}</p>
        </CardContent>
      </Card>
    );
  };

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
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">Support Messages</h1>
            <p className="text-muted-foreground mt-1">
              Manage and respond to user support requests
            </p>
          </div>
          <MessageCircle className="h-8 w-8 text-muted-foreground" />
        </div>

        <div className="flex gap-2">
          <Select value={filterStatus} onValueChange={setFilterStatus}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Filter by status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Messages</SelectItem>
              <SelectItem value="pending">Pending</SelectItem>
              <SelectItem value="in_progress">In Progress</SelectItem>
              <SelectItem value="resolved">Resolved</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {selectedMessage ? (
          <Card>
            <CardHeader>
              <div className="flex items-start justify-between">
                <div>
                  <CardTitle>{selectedMessage.subject}</CardTitle>
                  <CardDescription>
                    {format(new Date(selectedMessage.created_at), 'MMMM d, yyyy h:mm a')}
                  </CardDescription>
                </div>
                <Button variant="ghost" onClick={() => setSelectedMessage(null)}>
                  ← Back
                </Button>
              </div>
              <div className="flex gap-2 mt-2">
                <Badge
                  className={priorityColors[selectedMessage.priority as keyof typeof priorityColors]}
                >
                  {selectedMessage.priority}
                </Badge>
                <Badge className={statusColors[selectedMessage.status as keyof typeof statusColors]}>
                  {selectedMessage.status.replace('_', ' ')}
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label>User Message</Label>
                <div className="bg-muted p-4 rounded-md mt-2">
                  <p className="whitespace-pre-wrap">{selectedMessage.message}</p>
                </div>
              </div>

              {selectedMessage.admin_response && (
                <div>
                  <Label>Your Response</Label>
                  <div className="bg-primary/5 p-4 rounded-md mt-2 border border-primary/20">
                    <p className="whitespace-pre-wrap">{selectedMessage.admin_response}</p>
                    <p className="text-xs text-muted-foreground mt-2">
                      Responded on{' '}
                      {selectedMessage.responded_at &&
                        format(new Date(selectedMessage.responded_at), 'MMM d, yyyy h:mm a')}
                    </p>
                  </div>
                </div>
              )}

              <div className="space-y-4">
                <div>
                  <Label htmlFor="status">Update Status</Label>
                  <Select
                    value={selectedMessage.status}
                    onValueChange={(value) =>
                      handleUpdateMessage(selectedMessage.id, { status: value })
                    }
                    disabled={updating}
                  >
                    <SelectTrigger id="status" className="mt-2">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="pending">Pending</SelectItem>
                      <SelectItem value="in_progress">In Progress</SelectItem>
                      <SelectItem value="resolved">Resolved</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label htmlFor="response">Admin Response</Label>
                  <Textarea
                    id="response"
                    value={response || selectedMessage.admin_response || ''}
                    onChange={(e) => setResponse(e.target.value)}
                    placeholder="Type your response here..."
                    rows={6}
                    className="mt-2"
                  />
                </div>

                <Button
                  onClick={() =>
                    handleUpdateMessage(selectedMessage.id, {
                      admin_response: response || selectedMessage.admin_response || '',
                      status: 'in_progress',
                    })
                  }
                  disabled={updating || !response}
                  className="w-full"
                >
                  {updating ? 'Updating...' : 'Send Response'}
                </Button>
              </div>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4">
            {messages.length === 0 ? (
              <Card>
                <CardContent className="flex flex-col items-center justify-center py-12">
                  <MessageCircle className="h-12 w-12 text-muted-foreground mb-4" />
                  <p className="text-muted-foreground">No support messages found</p>
                </CardContent>
              </Card>
            ) : (
              messages.map((msg) => <MessageCard key={msg.id} msg={msg} />)
            )}
          </div>
        )}
      </div>
    </AdminLayout>
  );
}
