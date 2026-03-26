import { useState, useEffect, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { AdminLayout } from '@/components/admin/AdminLayout';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { Separator } from '@/components/ui/separator';
import {
  Lightbulb, RefreshCw, Loader2, Search, Save, Inbox, ArrowLeft,
  Clock, User, Tag, AlertTriangle, CheckCircle2, XCircle, Eye,
} from 'lucide-react';
import { format } from 'date-fns';
import { toast } from 'sonner';
import { useIsMobile } from '@/hooks/use-mobile';

interface FeatureRequest {
  id: string;
  user_id: string | null;
  feature_title: string;
  feature_description: string;
  use_case: string | null;
  status: string;
  priority: string;
  category: string | null;
  admin_notes: string | null;
  votes_count: number;
  created_at: string;
  updated_at: string;
}

interface SenderProfile {
  user_id: string;
  full_name: string | null;
  company_name: string | null;
}

const STATUS_OPTIONS = [
  { value: 'pending', label: 'New', color: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300' },
  { value: 'in_review', label: 'In Review', color: 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300' },
  { value: 'planned', label: 'Planned', color: 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300' },
  { value: 'declined', label: 'Declined', color: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300' },
  { value: 'completed', label: 'Completed', color: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300' },
];

const PRIORITY_OPTIONS = [
  { value: 'low', label: 'Low' },
  { value: 'normal', label: 'Normal' },
  { value: 'high', label: 'High' },
];

const FILTER_TABS = [
  { value: 'open', label: 'Open' },
  { value: 'pending', label: 'New' },
  { value: 'in_review', label: 'In Review' },
  { value: 'planned', label: 'Planned' },
  { value: 'declined', label: 'Declined' },
  { value: 'completed', label: 'Completed' },
  { value: 'all', label: 'All' },
];

const OPEN_STATUSES = ['pending', 'in_review'];

function getStatusBadge(status: string) {
  const opt = STATUS_OPTIONS.find((s) => s.value === status);
  return <Badge variant="outline" className={`text-xs ${opt?.color || ''}`}>{opt?.label || status}</Badge>;
}

function getPriorityBadge(priority: string) {
  const colors: Record<string, string> = {
    high: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300',
    normal: 'bg-muted text-muted-foreground',
    low: 'bg-muted text-muted-foreground',
  };
  return <Badge variant="outline" className={`text-xs ${colors[priority] || ''}`}>{priority}</Badge>;
}

export default function FeatureRequests() {
  const [requests, setRequests] = useState<FeatureRequest[]>([]);
  const [senders, setSenders] = useState<Record<string, SenderProfile>>({});
  const [loading, setLoading] = useState(true);
  const [filterStatus, setFilterStatus] = useState('open');
  const [search, setSearch] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [adminNotes, setAdminNotes] = useState('');
  const [editStatus, setEditStatus] = useState('');
  const [editPriority, setEditPriority] = useState('');
  const [editCategory, setEditCategory] = useState('');
  const [saving, setSaving] = useState(false);
  const isMobile = useIsMobile();

  useEffect(() => { fetchRequests(); }, []);

  const fetchRequests = async () => {
    try {
      const { data, error } = await (supabase as any)
        .from('feature_requests')
        .select('*')
        .order('created_at', { ascending: false });
      if (error) throw error;
      const items = (data || []) as FeatureRequest[];
      setRequests(items);

      const userIds = [...new Set(items.map((r) => r.user_id).filter(Boolean))];
      if (userIds.length > 0) {
        const { data: profiles } = await supabase
          .from('profiles')
          .select('user_id, full_name, company_name')
          .in('user_id', userIds as string[]);
        const map: Record<string, SenderProfile> = {};
        (profiles || []).forEach((p: any) => { map[p.user_id] = p; });
        setSenders(map);
      }
    } catch {
      toast.error('Failed to load feature requests');
    } finally {
      setLoading(false);
    }
  };

  const filtered = useMemo(() => {
    let list = requests;
    if (filterStatus === 'open') {
      list = list.filter((r) => OPEN_STATUSES.includes(r.status));
    } else if (filterStatus !== 'all') {
      list = list.filter((r) => r.status === filterStatus);
    }
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter((r) => {
        const sender = r.user_id ? senders[r.user_id] : null;
        return (
          r.feature_title.toLowerCase().includes(q) ||
          r.feature_description.toLowerCase().includes(q) ||
          sender?.full_name?.toLowerCase().includes(q) ||
          sender?.company_name?.toLowerCase().includes(q)
        );
      });
    }
    return list;
  }, [requests, filterStatus, search, senders]);

  const selected = selectedId ? requests.find((r) => r.id === selectedId) : null;

  const handleSelect = (id: string) => {
    const req = requests.find((r) => r.id === id);
    if (req) {
      setSelectedId(id);
      setAdminNotes(req.admin_notes || '');
      setEditStatus(req.status);
      setEditPriority(req.priority);
      setEditCategory(req.category || '');
    }
  };

  const handleSave = async () => {
    if (!selectedId) return;
    setSaving(true);
    try {
      const { error } = await (supabase as any)
        .from('feature_requests')
        .update({
          status: editStatus,
          priority: editPriority,
          category: editCategory || null,
          admin_notes: adminNotes || null,
          updated_at: new Date().toISOString(),
        })
        .eq('id', selectedId);
      if (error) throw error;
      toast.success('Feature request updated');
      fetchRequests();
    } catch {
      toast.error('Failed to save');
    } finally {
      setSaving(false);
    }
  };

  // Detail view
  if (selected) {
    const sender = selected.user_id ? senders[selected.user_id] : null;
    return (
      <AdminLayout>
        <div className="max-w-3xl mx-auto space-y-4">
          <Button variant="ghost" size="sm" onClick={() => setSelectedId(null)} className="gap-1.5 -ml-2">
            <ArrowLeft className="h-4 w-4" /> Back to queue
          </Button>

          <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
            <div className="min-w-0">
              <h1 className="text-lg font-semibold leading-tight">{selected.feature_title}</h1>
              <div className="flex flex-wrap items-center gap-2 mt-1.5 text-xs text-muted-foreground">
                <span className="flex items-center gap-1"><User className="h-3 w-3" />{sender?.full_name || 'Unknown'}</span>
                {sender?.company_name && <span>• {sender.company_name}</span>}
                <span className="flex items-center gap-1"><Clock className="h-3 w-3" />{format(new Date(selected.created_at), 'dd MMM yyyy HH:mm')}</span>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {getStatusBadge(selected.status)}
              {getPriorityBadge(selected.priority)}
            </div>
          </div>

          <Card>
            <CardContent className="p-4 space-y-4">
              <div>
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1">Description</p>
                <p className="text-sm whitespace-pre-wrap">{selected.feature_description}</p>
              </div>
              {selected.use_case && (
                <div>
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1">Use Case</p>
                  <p className="text-sm whitespace-pre-wrap">{selected.use_case}</p>
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4 space-y-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Admin Controls</p>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="text-xs font-medium mb-1 block">Status</label>
                  <Select value={editStatus} onValueChange={setEditStatus}>
                    <SelectTrigger className="h-9 text-sm"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {STATUS_OPTIONS.map((s) => (
                        <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <label className="text-xs font-medium mb-1 block">Priority</label>
                  <Select value={editPriority} onValueChange={setEditPriority}>
                    <SelectTrigger className="h-9 text-sm"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {PRIORITY_OPTIONS.map((p) => (
                        <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <label className="text-xs font-medium mb-1 block">Category</label>
                  <Input
                    value={editCategory}
                    onChange={(e) => setEditCategory(e.target.value)}
                    placeholder="e.g. UX, Compliance"
                    className="h-9 text-sm"
                  />
                </div>
              </div>
              <div>
                <label className="text-xs font-medium mb-1 block">Admin Notes (internal only)</label>
                <Textarea
                  value={adminNotes}
                  onChange={(e) => setAdminNotes(e.target.value)}
                  placeholder="Internal notes about this request..."
                  rows={3}
                  className="text-sm"
                />
              </div>
              <div className="flex items-center justify-between pt-1">
                <p className="text-xs text-muted-foreground">
                  Last updated: {format(new Date(selected.updated_at), 'dd MMM yyyy HH:mm')}
                </p>
                <Button size="sm" onClick={handleSave} disabled={saving} className="gap-1.5">
                  {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
                  Save
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </AdminLayout>
    );
  }

  // List view
  return (
    <AdminLayout>
      <div className="space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <h1 className="text-xl md:text-2xl font-bold flex items-center gap-2">
              <Lightbulb className="h-5 w-5 text-primary" />
              Feature Requests
            </h1>
            <p className="text-sm text-muted-foreground mt-0.5">Review and manage user feature requests</p>
          </div>
          <Button variant="outline" size="sm" onClick={() => { setLoading(true); fetchRequests(); }} className="gap-1.5 self-start">
            <RefreshCw className="h-3.5 w-3.5" /> Refresh
          </Button>
        </div>

        {/* Filters */}
        <div className="flex flex-col sm:flex-row gap-2">
          <div className="w-full sm:w-auto overflow-x-auto -mx-1 px-1" style={{ WebkitOverflowScrolling: 'touch' }}>
            <div className="flex gap-1 pb-1 pr-4 min-w-max">
              {FILTER_TABS.map((tab) => {
                const count = tab.value === 'open'
                  ? requests.filter((r) => OPEN_STATUSES.includes(r.status)).length
                  : tab.value === 'all'
                    ? requests.length
                    : requests.filter((r) => r.status === tab.value).length;
                const isActive = filterStatus === tab.value;
                return (
                  <Button
                    key={tab.value}
                    variant={isActive ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setFilterStatus(tab.value)}
                    className="text-xs whitespace-nowrap h-8"
                  >
                    {tab.label}
                    <Badge
                      variant="secondary"
                      className={`ml-1 text-[10px] px-1.5 py-0 ${isActive ? 'bg-primary-foreground/20 text-primary-foreground' : 'bg-muted text-muted-foreground'}`}
                    >
                      {count}
                    </Badge>
                  </Button>
                );
              })}
            </div>
          </div>
          <div className="relative flex-1 sm:max-w-xs">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by title, user, org..."
              className="pl-8 h-8 text-sm"
            />
          </div>
        </div>

        {/* List */}
        {loading ? (
          <div className="space-y-2">{[1, 2, 3].map((i) => <Skeleton key={i} className="h-20 w-full" />)}</div>
        ) : filtered.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center">
              <Inbox className="h-10 w-10 mx-auto text-muted-foreground/40 mb-3" />
              <p className="text-sm text-muted-foreground">No feature requests match your filters</p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-2">
            {filtered.map((req) => {
              const sender = req.user_id ? senders[req.user_id] : null;
              return (
                <Card
                  key={req.id}
                  className="cursor-pointer hover:border-primary/30 transition-colors"
                  onClick={() => handleSelect(req.id)}
                >
                  <CardContent className="p-3 sm:p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium truncate">{req.feature_title}</p>
                        <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 mt-1 text-xs text-muted-foreground">
                          <span>{sender?.full_name || 'Unknown user'}</span>
                          {sender?.company_name && <span>• {sender.company_name}</span>}
                          <span>• {format(new Date(req.created_at), 'dd MMM yyyy')}</span>
                        </div>
                      </div>
                      <div className="flex items-center gap-1.5 shrink-0">
                        {req.priority === 'high' && getPriorityBadge('high')}
                        {getStatusBadge(req.status)}
                      </div>
                    </div>
                    <p className="text-xs text-muted-foreground mt-1.5 line-clamp-2">{req.feature_description}</p>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>
    </AdminLayout>
  );
}
