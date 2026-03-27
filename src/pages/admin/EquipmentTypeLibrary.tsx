import { useState, useEffect, useMemo, useCallback, memo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { useAuditLog } from '@/hooks/useAuditLog';
import {
  Search, Loader2, Edit3, Archive, ArchiveRestore, Trash2,
  MoreVertical, AlertTriangle, Plus, Layers, Package, BarChart3,
} from 'lucide-react';
import { format } from 'date-fns';
import { AdminLayout } from '@/components/admin/AdminLayout';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { EQUIPMENT_GROUPS, EQUIPMENT_GROUP_LABELS, type EquipmentGroup } from '@/constants/checkLibrary';

interface EquipmentType {
  id: string;
  name: string;
  description: string | null;
  category_group: string;
  is_billable: boolean;
  is_archived: boolean;
  source: string;
  admin_notes: string | null;
  created_at: string;
  updated_at: string;
  approved_from_request_id: string | null;
  usage_count?: number;
}

/* ── Edit/Create Dialog ── */

interface TypeDialogProps {
  open: boolean;
  isCreating: boolean;
  item: EquipmentType | null;
  allTypes: EquipmentType[];
  onSave: (data: { name: string; categoryGroup: string; description: string; adminNotes: string; isBillable: boolean }) => Promise<void>;
  onClose: () => void;
}

const TypeDialog = memo(function TypeDialog({ open, isCreating, item, allTypes, onSave, onClose }: TypeDialogProps) {
  const [name, setName] = useState('');
  const [categoryGroup, setCategoryGroup] = useState('Rides');
  const [description, setDescription] = useState('');
  const [adminNotes, setAdminNotes] = useState('');
  const [isBillable, setIsBillable] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    if (item && !isCreating) {
      setName(item.name);
      setCategoryGroup(item.category_group);
      setDescription(item.description || '');
      setAdminNotes(item.admin_notes || '');
      setIsBillable(item.is_billable);
    } else {
      setName(''); setCategoryGroup('Rides'); setDescription(''); setAdminNotes(''); setIsBillable(true);
    }
  }, [open, item, isCreating]);

  const duplicateWarning = useMemo(() => {
    if (!name.trim()) return null;
    const lower = name.trim().toLowerCase();
    const dup = allTypes.find(t =>
      t.id !== item?.id &&
      t.category_group === categoryGroup &&
      t.name.toLowerCase() === lower
    );
    if (dup) return `"${dup.name}" already exists in ${categoryGroup}`;
    const similar = allTypes.find(t =>
      t.id !== item?.id &&
      t.category_group === categoryGroup &&
      t.name.toLowerCase().includes(lower) || lower.includes(t.name.toLowerCase())
    );
    if (similar && similar.name.toLowerCase() !== lower) return `Similar: "${similar.name}" in ${categoryGroup}`;
    return null;
  }, [name, categoryGroup, allTypes, item?.id]);

  const handleSave = async () => {
    if (!name.trim()) return;
    setSaving(true);
    try {
      await onSave({ name: name.trim(), categoryGroup, description: description.trim(), adminNotes: adminNotes.trim(), isBillable });
    } finally {
      setSaving(false);
    }
  };

  // Map PascalCase category_group to equipment group labels
  const GROUP_LABELS: Record<string, string> = {
    'Rides': 'Rides', 'Inflatables': 'Inflatables', 'Stalls': 'Stalls',
    'Attractions': 'Attractions', 'Food Stalls': 'Food Stalls', 'Games': 'Games', 'Equipment': 'Equipment',
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{isCreating ? 'New Equipment Type' : 'Edit Equipment Type'}</DialogTitle>
          <DialogDescription>
            {isCreating ? 'Add a new shared equipment type to the system.' : 'Update this equipment type.'}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="space-y-2">
            <Label>Type Name *</Label>
            <Input value={name} onChange={e => setName(e.target.value)} placeholder="e.g., Dodgems, Bouncy Castle" />
            {duplicateWarning && (
              <div className="flex items-start gap-2 text-xs text-warning bg-warning/10 p-2 rounded">
                <AlertTriangle className="h-3.5 w-3.5 mt-0.5 shrink-0" />
                <span>{duplicateWarning}</span>
              </div>
            )}
          </div>
          <div className="space-y-2">
            <Label>Equipment Group *</Label>
            <Select value={categoryGroup} onValueChange={setCategoryGroup}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {Object.entries(GROUP_LABELS).map(([val, label]) => (
                  <SelectItem key={val} value={val}>{label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Description</Label>
            <Textarea value={description} onChange={e => setDescription(e.target.value)} placeholder="Brief description…" rows={2} />
          </div>
          <div className="space-y-2">
            <Label>Admin Notes</Label>
            <Textarea value={adminNotes} onChange={e => setAdminNotes(e.target.value)} placeholder="Internal notes…" rows={2} />
          </div>
          <div className="flex items-center gap-2">
            <input type="checkbox" id="billable" checked={isBillable} onChange={e => setIsBillable(e.target.checked)} className="rounded" />
            <Label htmlFor="billable" className="text-sm font-normal">Counts toward plan limits</Label>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={handleSave} disabled={saving || !name.trim()}>
            {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            {isCreating ? 'Create' : 'Save Changes'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
});

/* ── Main Page ── */

export default function EquipmentTypeLibrary() {
  const { toast } = useToast();
  const { logEvent } = useAuditLog();

  const [types, setTypes] = useState<EquipmentType[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'active' | 'archived' | 'all'>('active');
  const [groupFilter, setGroupFilter] = useState('all');
  const [sortBy, setSortBy] = useState<'az' | 'za' | 'newest' | 'oldest'>('az');

  // Dialog state
  const [dialogOpen, setDialogOpen] = useState(false);
  const [dialogItem, setDialogItem] = useState<EquipmentType | null>(null);
  const [isCreating, setIsCreating] = useState(false);

  // Delete state
  const [deleteTarget, setDeleteTarget] = useState<EquipmentType | null>(null);
  const [deleteBlocked, setDeleteBlocked] = useState<string | null>(null);
  const [checkingDelete, setCheckingDelete] = useState(false);

  // Usage counts
  const [usageCounts, setUsageCounts] = useState<Record<string, number>>({});

  const fetchTypes = useCallback(async () => {
    setLoading(true);
    const { data, error } = await (supabase as any)
      .from('ride_categories')
      .select('id, name, description, category_group, is_billable, is_archived, source, admin_notes, created_at, updated_at, approved_from_request_id')
      .order('name');
    if (error) {
      console.error('Error fetching equipment types:', error);
    } else {
      setTypes(data || []);
    }
    setLoading(false);
  }, []);

  const fetchUsageCounts = useCallback(async () => {
    const { data, error } = await supabase
      .from('rides')
      .select('category_id');
    if (!error && data) {
      const counts: Record<string, number> = {};
      data.forEach((r: any) => {
        if (r.category_id) counts[r.category_id] = (counts[r.category_id] || 0) + 1;
      });
      setUsageCounts(counts);
    }
  }, []);

  useEffect(() => {
    fetchTypes();
    fetchUsageCounts();
  }, [fetchTypes, fetchUsageCounts]);

  // Filter and sort
  const filtered = useMemo(() => {
    let result = types.filter(t => {
      if (statusFilter === 'active' && t.is_archived) return false;
      if (statusFilter === 'archived' && !t.is_archived) return false;
      if (groupFilter !== 'all' && t.category_group !== groupFilter) return false;
      if (search) {
        const s = search.toLowerCase();
        return t.name.toLowerCase().includes(s) || (t.description || '').toLowerCase().includes(s);
      }
      return true;
    });

    result.sort((a, b) => {
      switch (sortBy) {
        case 'az': return a.name.localeCompare(b.name);
        case 'za': return b.name.localeCompare(a.name);
        case 'newest': return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
        case 'oldest': return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
        default: return 0;
      }
    });

    return result;
  }, [types, statusFilter, groupFilter, search, sortBy]);

  // KPIs
  const kpis = useMemo(() => {
    const active = types.filter(t => !t.is_archived).length;
    const archived = types.filter(t => t.is_archived).length;
    const groups = new Set(types.map(t => t.category_group)).size;
    return { active, archived, total: types.length, groups };
  }, [types]);

  // Save handler
  const handleSave = useCallback(async (data: { name: string; categoryGroup: string; description: string; adminNotes: string; isBillable: boolean }) => {
    if (isCreating) {
      const { error } = await (supabase as any).from('ride_categories').insert({
        name: data.name,
        category_group: data.categoryGroup,
        description: data.description || null,
        admin_notes: data.adminNotes || null,
        is_billable: data.isBillable,
        source: 'admin',
      });
      if (error) {
        console.error('[EquipmentTypeLibrary] Insert error:', error);
        toast({ title: 'Could not create type', description: 'This type could not be created due to an admin permission rule. The technical error has been logged.', variant: 'destructive' });
        throw error;
      }
      logEvent('create', 'ride_category', undefined, { name: data.name, group: data.categoryGroup }, {
        after: { name: data.name, category_group: data.categoryGroup, description: data.description, is_billable: data.isBillable },
        contextHint: 'admin equipment type library',
      });
      toast({ title: 'Created', description: `"${data.name}" added to equipment types.` });
    } else if (dialogItem) {
      const { error } = await (supabase as any).from('ride_categories').update({
        name: data.name,
        category_group: data.categoryGroup,
        description: data.description || null,
        admin_notes: data.adminNotes || null,
        is_billable: data.isBillable,
        updated_at: new Date().toISOString(),
      }).eq('id', dialogItem.id);
      if (error) {
        console.error('[EquipmentTypeLibrary] Update error:', error);
        toast({ title: 'Could not update type', description: 'This type could not be updated due to an admin permission rule. The technical error has been logged.', variant: 'destructive' });
        throw error;
      }
      logEvent('update', 'ride_category', dialogItem.id, { name: data.name }, {
        before: { name: dialogItem.name, category_group: dialogItem.category_group, description: dialogItem.description, is_billable: dialogItem.is_billable, admin_notes: dialogItem.admin_notes },
        after: { name: data.name, category_group: data.categoryGroup, description: data.description, is_billable: data.isBillable, admin_notes: data.adminNotes },
        contextHint: 'admin equipment type library',
      });
      toast({ title: 'Updated', description: `"${data.name}" has been updated.` });
    }
    setDialogOpen(false);
    setDialogItem(null);
    fetchTypes();
  }, [isCreating, dialogItem, toast, logEvent, fetchTypes]);

  // Archive/unarchive
  const handleToggleArchive = useCallback(async (item: EquipmentType) => {
    const newArchived = !item.is_archived;
    const { error } = await (supabase as any).from('ride_categories').update({
      is_archived: newArchived,
      updated_at: new Date().toISOString(),
    }).eq('id', item.id);
    if (error) {
      console.error('[EquipmentTypeLibrary] Archive toggle error:', error);
      toast({ title: 'Could not update type', description: 'This type could not be updated due to an admin permission rule. The technical error has been logged.', variant: 'destructive' });
      return;
    }
    logEvent(newArchived ? 'archive' : 'unarchive', 'ride_category', item.id, { name: item.name });
    toast({ title: newArchived ? 'Archived' : 'Unarchived', description: `"${item.name}" ${newArchived ? 'archived' : 'restored'}.` });
    fetchTypes();
  }, [toast, logEvent, fetchTypes]);

  // Delete check
  const handleDeleteCheck = useCallback(async (item: EquipmentType) => {
    setDeleteTarget(item);
    setCheckingDelete(true);
    setDeleteBlocked(null);

    // Check all referencing tables
    const [ridesRes, checkLibRes] = await Promise.all([
      supabase.from('rides').select('id', { count: 'exact', head: true }).eq('category_id', item.id),
      supabase.from('check_library_items').select('id', { count: 'exact', head: true }).eq('ride_category_id', item.id),
    ]);

    const totalRefs = (ridesRes.count || 0) + (checkLibRes.count || 0);
    if (totalRefs > 0) {
      setDeleteBlocked(`This equipment type is referenced by ${totalRefs} record(s) and cannot be deleted. Archive it instead.`);
    }
    setCheckingDelete(false);
  }, []);

  const handleDeleteConfirm = useCallback(async () => {
    if (!deleteTarget || deleteBlocked) return;
    const { error } = await (supabase as any).from('ride_categories').delete().eq('id', deleteTarget.id);
    if (error) {
      console.error('[EquipmentTypeLibrary] Delete error:', error);
      toast({ title: 'Could not delete type', description: 'This type could not be deleted due to an admin permission rule. The technical error has been logged.', variant: 'destructive' });
      return;
    }
    logEvent('delete', 'ride_category', deleteTarget.id, { name: deleteTarget.name });
    toast({ title: 'Deleted', description: `"${deleteTarget.name}" permanently removed.` });
    setDeleteTarget(null);
    fetchTypes();
  }, [deleteTarget, deleteBlocked, toast, logEvent, fetchTypes]);

  const GROUP_OPTIONS = [
    'Rides', 'Inflatables', 'Stalls', 'Attractions', 'Food Stalls', 'Games', 'Equipment',
  ];

  return (
    <AdminLayout>
      <div className="space-y-4 sm:space-y-6">
        {/* Header */}
        <div className="flex items-start justify-between gap-3">
          <div>
            <h1 className="text-xl sm:text-2xl font-bold flex items-center gap-2">
              <Layers className="h-6 w-6 text-primary" />
              Equipment Type Library
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              Manage the shared equipment types used across the app.
            </p>
          </div>
          <Button size="sm" onClick={() => { setIsCreating(true); setDialogItem(null); setDialogOpen(true); }}>
            <Plus className="h-4 w-4 mr-1" /> New Type
          </Button>
        </div>

        {/* KPIs */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { label: 'Active', value: kpis.active, icon: Package, color: 'text-green-600' },
            { label: 'Archived', value: kpis.archived, icon: Archive, color: 'text-muted-foreground' },
            { label: 'Total', value: kpis.total, icon: BarChart3, color: 'text-primary' },
            { label: 'Groups', value: kpis.groups, icon: Layers, color: 'text-blue-600' },
          ].map(kpi => (
            <Card key={kpi.label}>
              <CardContent className="p-3 flex items-center gap-3">
                <kpi.icon className={`h-5 w-5 ${kpi.color}`} />
                <div>
                  <p className="text-lg font-bold">{kpi.value}</p>
                  <p className="text-xs text-muted-foreground">{kpi.label}</p>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Filters */}
        <div className="space-y-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search equipment types…"
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>
          <div className="flex flex-wrap gap-2">
            <Select value={statusFilter} onValueChange={(v: any) => setStatusFilter(v)}>
              <SelectTrigger className="w-[120px] h-8 text-xs"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="active">Active</SelectItem>
                <SelectItem value="archived">Archived</SelectItem>
                <SelectItem value="all">All</SelectItem>
              </SelectContent>
            </Select>
            <Select value={groupFilter} onValueChange={setGroupFilter}>
              <SelectTrigger className="w-[140px] h-8 text-xs"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Groups</SelectItem>
                {GROUP_OPTIONS.map(g => (
                  <SelectItem key={g} value={g}>{g}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={sortBy} onValueChange={(v: any) => setSortBy(v)}>
              <SelectTrigger className="w-[110px] h-8 text-xs"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="az">A–Z</SelectItem>
                <SelectItem value="za">Z–A</SelectItem>
                <SelectItem value="newest">Newest</SelectItem>
                <SelectItem value="oldest">Oldest</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Results count */}
        <p className="text-xs text-muted-foreground">{filtered.length} type{filtered.length !== 1 ? 's' : ''}</p>

        {/* List */}
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : filtered.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center text-muted-foreground">
              <Layers className="h-10 w-10 mx-auto mb-3 opacity-40" />
              <p className="font-medium">No equipment types found</p>
              <p className="text-sm mt-1">
                {search ? 'Try a different search term.' : statusFilter === 'archived' ? 'No archived types.' : 'Create your first equipment type.'}
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-2">
            {filtered.map(item => {
              const usage = usageCounts[item.id] || 0;
              return (
                <Card key={item.id} className={item.is_archived ? 'opacity-60' : ''}>
                  <CardContent className="p-3 sm:p-4">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-semibold text-sm">{item.name}</span>
                          <Badge variant="outline" className="text-[10px]">{item.category_group}</Badge>
                          {item.is_archived && <Badge variant="secondary" className="text-[10px]">Archived</Badge>}
                          {!item.is_billable && <Badge variant="secondary" className="text-[10px]">Non-billable</Badge>}
                        </div>
                        {item.description && (
                          <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{item.description}</p>
                        )}
                        <div className="flex flex-wrap gap-x-4 gap-y-1 mt-2 text-[11px] text-muted-foreground">
                          <span>Created {format(new Date(item.created_at), 'dd MMM yyyy')}</span>
                          <span>Source: {item.source === 'approved_request' ? 'Request' : 'Admin'}</span>
                          {usage > 0 && <span>{usage} equipment item{usage !== 1 ? 's' : ''}</span>}
                        </div>
                      </div>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0">
                            <MoreVertical className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onSelect={() => {
                            setTimeout(() => {
                              document.body.style.removeProperty('pointer-events');
                              setIsCreating(false);
                              setDialogItem(item);
                              setDialogOpen(true);
                            }, 0);
                          }}>
                            <Edit3 className="h-4 w-4 mr-2" /> Edit
                          </DropdownMenuItem>
                          <DropdownMenuItem onSelect={() => {
                            setTimeout(() => {
                              document.body.style.removeProperty('pointer-events');
                              handleToggleArchive(item);
                            }, 0);
                          }}>
                            {item.is_archived ? <ArchiveRestore className="h-4 w-4 mr-2" /> : <Archive className="h-4 w-4 mr-2" />}
                            {item.is_archived ? 'Unarchive' : 'Archive'}
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onSelect={() => {
                              setTimeout(() => {
                                document.body.style.removeProperty('pointer-events');
                                handleDeleteCheck(item);
                              }, 0);
                            }}
                            className="text-destructive focus:text-destructive"
                          >
                            <Trash2 className="h-4 w-4 mr-2" /> Delete
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>

      {/* Create/Edit Dialog */}
      <TypeDialog
        open={dialogOpen}
        isCreating={isCreating}
        item={dialogItem}
        allTypes={types}
        onSave={handleSave}
        onClose={() => { setDialogOpen(false); setDialogItem(null); document.body.style.removeProperty('pointer-events'); }}
      />

      {/* Delete Confirmation */}
      <AlertDialog open={!!deleteTarget} onOpenChange={(o) => { if (!o) { setDeleteTarget(null); setDeleteBlocked(null); document.body.style.removeProperty('pointer-events'); } }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {deleteBlocked ? 'Cannot Delete' : `Delete "${deleteTarget?.name}"?`}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {checkingDelete ? (
                <span className="flex items-center gap-2"><Loader2 className="h-4 w-4 animate-spin" /> Checking usage…</span>
              ) : deleteBlocked ? (
                <span className="flex items-start gap-2 text-warning">
                  <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
                  {deleteBlocked}
                </span>
              ) : (
                'This will permanently remove this equipment type. This action cannot be undone.'
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            {!deleteBlocked && !checkingDelete && (
              <AlertDialogAction onClick={handleDeleteConfirm} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                Delete Permanently
              </AlertDialogAction>
            )}
            {deleteBlocked && (
              <Button variant="outline" onClick={() => { handleToggleArchive(deleteTarget!); setDeleteTarget(null); setDeleteBlocked(null); }}>
                Archive Instead
              </Button>
            )}
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AdminLayout>
  );
}
