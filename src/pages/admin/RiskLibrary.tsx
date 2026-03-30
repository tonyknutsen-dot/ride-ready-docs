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
import { Separator } from '@/components/ui/separator';
import { useToast } from '@/hooks/use-toast';
import { useAuditLog } from '@/hooks/useAuditLog';
import {
  Search, Loader2, Shield, Edit3, Archive, ArchiveRestore, Trash2, Copy,
  MoreVertical, Globe, Target, AlertTriangle, BookOpen, Plus
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

const RISK_CATEGORIES = [
  'Mechanical', 'Electrical', 'Structural', 'Environmental', 'Operational',
  'Fire', 'Chemical', 'Ergonomic', 'Biological', 'Other',
];

const EQUIPMENT_GROUPS = ['rides', 'inflatables', 'stalls'] as const;
const EQUIPMENT_GROUP_LABELS: Record<string, string> = {
  rides: 'Rides',
  inflatables: 'Inflatables',
  stalls: 'Stalls',
};

interface RiskLibraryItem {
  id: string;
  label: string;
  item_type: string;
  equipment_group: string;
  ride_category_id: string | null;
  hint: string | null;
  is_active: boolean;
  sort_index: number;
  created_at: string;
  category: string;
  ride_category?: { name: string; category_group: string } | null;
}

interface RideCategory {
  id: string;
  name: string;
  category_group: string;
}

/* ── Edit/Create Dialog ── */

interface RiskItemDialogProps {
  open: boolean;
  isCreating: boolean;
  item: RiskLibraryItem | null;
  rideCategories: RideCategory[];
  onSave: (data: {
    label: string; hint: string; category: string;
    itemType: string; group: string; rideCategoryId: string | null; note: string;
  }) => Promise<void>;
  onClose: () => void;
}

const RiskItemDialog = memo(function RiskItemDialog({
  open, isCreating, item, rideCategories, onSave, onClose,
}: RiskItemDialogProps) {
  const [label, setLabel] = useState('');
  const [hint, setHint] = useState('');
  const [category, setCategory] = useState('');
  const [itemType, setItemType] = useState('hazard');
  const [group, setGroup] = useState('rides');
  const [rideCategoryId, setRideCategoryId] = useState<string | null>(null);
  const [note, setNote] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    if (isCreating) {
      setLabel(''); setHint(''); setCategory(''); setItemType('hazard');
      setGroup('rides'); setRideCategoryId(null); setNote('');
    } else if (item) {
      setLabel(item.label); setHint(item.hint || ''); setCategory(item.category || '');
      setItemType(item.item_type); setGroup(item.equipment_group.toLowerCase());
      setRideCategoryId(item.ride_category_id); setNote('');
    }
  }, [open, isCreating, item?.id]);

  const filteredGroupCategories = rideCategories.filter(
    rc => rc.category_group.toLowerCase() === group.toLowerCase()
  );

  const handleSubmit = async () => {
    if (!label.trim()) return;
    setSaving(true);
    await onSave({ label, hint, category, itemType, group, rideCategoryId, note });
    setSaving(false);
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{isCreating ? 'New Risk Library Item' : 'Edit Risk Library Item'}</DialogTitle>
          <DialogDescription>
            {isCreating ? 'Add a new hazard or control to the shared risk library' : 'Update wording, classification, or scope'}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <Label>Item text</Label>
            <Input value={label} onChange={e => setLabel(e.target.value)} placeholder="e.g. Entrapment risk at moving parts" />
          </div>
          <div>
            <Label>Hint / guidance</Label>
            <Textarea value={hint} onChange={e => setHint(e.target.value)} rows={2} placeholder="Optional guidance" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Category</Label>
              <Select value={category} onValueChange={setCategory}>
                <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                <SelectContent>
                  {RISK_CATEGORIES.map(c => (
                    <SelectItem key={c} value={c}>{c}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Type</Label>
              <Select value={itemType} onValueChange={setItemType}>
                <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="hazard">Hazard</SelectItem>
                  <SelectItem value="control">Control</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div>
            <Label>Equipment group</Label>
            <Select value={group} onValueChange={(v) => { setGroup(v); setRideCategoryId(null); }}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {EQUIPMENT_GROUPS.map(g => (
                  <SelectItem key={g} value={g}>{EQUIPMENT_GROUP_LABELS[g]}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          {filteredGroupCategories.length > 0 && (
            <div>
              <Label>Specific equipment type (optional)</Label>
              <Select value={rideCategoryId || 'none'} onValueChange={v => setRideCategoryId(v === 'none' ? null : v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">None (group-wide)</SelectItem>
                  {filteredGroupCategories.map(rc => (
                    <SelectItem key={rc.id} value={rc.id}>{rc.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
          <div>
            <Label>Admin note (optional)</Label>
            <Input value={note} onChange={e => setNote(e.target.value)} placeholder={isCreating ? "Reason for adding" : "Reason for change"} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={handleSubmit} disabled={saving || !label.trim()}>
            {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            {isCreating ? 'Add to Library' : 'Save Changes'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
});

/* ── Main Page ── */

export default function RiskLibrary() {
  const { toast } = useToast();
  const { logEvent } = useAuditLog();

  const [items, setItems] = useState<RiskLibraryItem[]>([]);
  const [rideCategories, setRideCategories] = useState<RideCategory[]>([]);
  const [loading, setLoading] = useState(true);

  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'active' | 'archived' | 'all'>('active');
  const [typeFilter, setTypeFilter] = useState('all');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [groupFilter, setGroupFilter] = useState('all');
  const [sortBy, setSortBy] = useState<'newest' | 'oldest' | 'alpha'>('alpha');

  const [editItem, setEditItem] = useState<RiskLibraryItem | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [archiveTarget, setArchiveTarget] = useState<RiskLibraryItem | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<RiskLibraryItem | null>(null);
  const [saving, setSaving] = useState(false);
  const [mobileMenuId, setMobileMenuId] = useState<string | null>(null);

  const clearPointerLock = () => {
    if (typeof document !== 'undefined' && document.body.style.pointerEvents === 'none') {
      document.body.style.removeProperty('pointer-events');
    }
  };

  useEffect(() => {
    fetchItems();
    fetchRideCategories();
  }, []);

  const fetchItems = async () => {
    setLoading(true);
    const { data, error } = await (supabase as any)
      .from('risk_library_items')
      .select('*, ride_category:ride_categories(name, category_group)')
      .order('created_at', { ascending: false });

    if (!error && data) {
      setItems(data as RiskLibraryItem[]);
    }
    setLoading(false);
  };

  const fetchRideCategories = async () => {
    const { data } = await supabase
      .from('ride_categories')
      .select('id, name, category_group')
      .order('name');
    if (data) setRideCategories(data);
  };

  const filteredItems = useMemo(() => {
    let result = items.filter(item => {
      if (statusFilter === 'active' && !item.is_active) return false;
      if (statusFilter === 'archived' && item.is_active) return false;
      if (typeFilter !== 'all' && item.item_type !== typeFilter) return false;
      if (categoryFilter !== 'all' && item.category !== categoryFilter) return false;
      if (groupFilter !== 'all' && item.equipment_group.toLowerCase() !== groupFilter.toLowerCase()) return false;
      if (search) {
        const q = search.toLowerCase();
        if (!item.label.toLowerCase().includes(q) && !(item.hint || '').toLowerCase().includes(q)) return false;
      }
      return true;
    });

    result.sort((a, b) => {
      if (sortBy === 'newest') return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
      if (sortBy === 'oldest') return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
      return a.label.localeCompare(b.label);
    });

    return result;
  }, [items, search, statusFilter, typeFilter, categoryFilter, groupFilter, sortBy]);

  const totalActive = items.filter(i => i.is_active).length;
  const totalArchived = items.filter(i => !i.is_active).length;
  const hazardCount = items.filter(i => i.is_active && i.item_type === 'hazard').length;
  const controlCount = items.filter(i => i.is_active && i.item_type === 'control').length;

  const openCreate = () => { setIsCreating(true); setEditItem(null); };
  const openEdit = (item: RiskLibraryItem) => { setIsCreating(false); setEditItem(item); };
  const closeDialog = useCallback(() => { setEditItem(null); setIsCreating(false); }, []);

  const handleSaveEdit = useCallback(async (data: {
    label: string; hint: string; category: string;
    itemType: string; group: string; rideCategoryId: string | null; note: string;
  }) => {
    if (isCreating) {
      const { data: row, error } = await (supabase as any)
        .from('risk_library_items')
        .insert({
          label: data.label.trim(),
          hint: data.hint.trim() || null,
          category: data.category || 'Other',
          item_type: data.itemType,
          equipment_group: data.group.toLowerCase(),
          ride_category_id: data.rideCategoryId,
          is_active: true,
          sort_index: 0,
        })
        .select('*, ride_category:ride_categories(name, category_group)')
        .single();

      if (error) {
        toast({ title: 'Error', description: 'Failed to create item', variant: 'destructive' });
      } else if (row) {
        logEvent('create', 'risk_library', row.id, { label: data.label, note: data.note || undefined });
        toast({ title: 'Created', description: 'New risk library item added' });
        setItems(prev => [row as RiskLibraryItem, ...prev]);
        setIsCreating(false);
      }
    } else if (editItem) {
      const { error } = await (supabase as any)
        .from('risk_library_items')
        .update({
          label: data.label.trim(),
          hint: data.hint.trim() || null,
          category: data.category || 'Other',
          item_type: data.itemType,
          equipment_group: data.group.toLowerCase(),
          ride_category_id: data.rideCategoryId,
        })
        .eq('id', editItem.id);

      if (error) {
        toast({ title: 'Error', description: 'Failed to update item', variant: 'destructive' });
      } else {
        logEvent('update', 'risk_library', editItem.id, { label: data.label, note: data.note || undefined });
        toast({ title: 'Updated', description: 'Risk library item updated' });
        setItems(prev => prev.map(i => i.id === editItem.id ? {
          ...i, label: data.label.trim(), hint: data.hint.trim() || null,
          category: data.category || 'Other', item_type: data.itemType,
          equipment_group: data.group, ride_category_id: data.rideCategoryId,
        } : i));
        setEditItem(null);
      }
    }
  }, [isCreating, editItem, toast, logEvent]);

  const handleArchiveToggle = async () => {
    if (!archiveTarget) return;
    setSaving(true);
    const newActive = !archiveTarget.is_active;
    const { error } = await (supabase as any)
      .from('risk_library_items')
      .update({ is_active: newActive })
      .eq('id', archiveTarget.id);

    if (error) {
      toast({ title: 'Error', description: 'Failed to update status', variant: 'destructive' });
    } else {
      const action = newActive ? 'Unarchived' : 'Archived';
      logEvent('update', 'risk_library', archiveTarget.id, { action: action.toLowerCase() });
      toast({ title: action, description: `Item ${action.toLowerCase()} successfully` });
      setItems(prev => prev.map(i => i.id === archiveTarget.id ? { ...i, is_active: newActive } : i));
    }
    setArchiveTarget(null);
    setSaving(false);
  };

  const handleDeleteConfirm = async () => {
    if (!deleteTarget) return;
    setSaving(true);
    const { error } = await (supabase as any)
      .from('risk_library_items')
      .delete()
      .eq('id', deleteTarget.id);

    if (error) {
      toast({ title: 'Error', description: 'Failed to delete item', variant: 'destructive' });
    } else {
      logEvent('delete', 'risk_library', deleteTarget.id, { label: deleteTarget.label }, {
        before: {
          label: deleteTarget.label,
          item_type: deleteTarget.item_type,
          equipment_group: deleteTarget.equipment_group,
          category: deleteTarget.category,
          hint: deleteTarget.hint,
        },
        contextHint: 'admin permanent deletion',
      });
      toast({ title: 'Deleted', description: 'Risk library item permanently removed' });
      setItems(prev => prev.filter(i => i.id !== deleteTarget.id));
    }
    setDeleteTarget(null);
    setSaving(false);
  };

  const handleDuplicate = async (item: RiskLibraryItem) => {
    const { data, error } = await (supabase as any)
      .from('risk_library_items')
      .insert({
        label: `${item.label} (copy)`,
        item_type: item.item_type,
        equipment_group: item.equipment_group.toLowerCase(),
        ride_category_id: item.ride_category_id,
        hint: item.hint,
        category: item.category,
        is_active: true,
        sort_index: item.sort_index,
      })
      .select()
      .single();

    if (error) {
      toast({ title: 'Error', description: 'Failed to duplicate item', variant: 'destructive' });
    } else if (data) {
      logEvent('create', 'risk_library', data.id, { duplicated_from: item.id });
      toast({ title: 'Duplicated', description: 'Item cloned successfully' });
      setItems(prev => [data as RiskLibraryItem, ...prev]);
    }
  };

  const scopeLabel = (item: RiskLibraryItem) => {
    if (item.ride_category_id && item.ride_category) return item.ride_category.name;
    return EQUIPMENT_GROUP_LABELS[item.equipment_group.toLowerCase()] || item.equipment_group;
  };

  return (
    <AdminLayout>
      <div className="space-y-6 max-w-5xl">
        {/* Header */}
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <Shield className="h-6 w-6 text-primary" />
              <h1 className="text-2xl font-bold">Risk Library</h1>
            </div>
            <p className="text-sm text-muted-foreground">
              Manage the shared risk library. Edit wording, archive old items, or remove unused entries.
            </p>
          </div>
          <Button onClick={openCreate} className="shrink-0 gap-1.5">
            <Plus className="h-4 w-4" />
            <span className="hidden sm:inline">New Library Item</span>
            <span className="sm:hidden">New</span>
          </Button>
        </div>

        {/* KPIs */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <Card><CardContent className="p-4 text-center">
            <p className="text-2xl font-bold">{totalActive}</p>
            <p className="text-xs text-muted-foreground">Active Items</p>
          </CardContent></Card>
          <Card><CardContent className="p-4 text-center">
            <p className="text-2xl font-bold">{hazardCount}</p>
            <p className="text-xs text-muted-foreground">Hazards</p>
          </CardContent></Card>
          <Card><CardContent className="p-4 text-center">
            <p className="text-2xl font-bold">{controlCount}</p>
            <p className="text-xs text-muted-foreground">Controls</p>
          </CardContent></Card>
          <Card><CardContent className="p-4 text-center">
            <p className="text-2xl font-bold">{totalArchived}</p>
            <p className="text-xs text-muted-foreground">Archived</p>
          </CardContent></Card>
        </div>

        {/* Filters */}
        <div className="space-y-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search risk library items..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
            <Select value={statusFilter} onValueChange={(v: any) => setStatusFilter(v)}>
              <SelectTrigger><SelectValue placeholder="Status" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="active">Active</SelectItem>
                <SelectItem value="archived">Archived</SelectItem>
                <SelectItem value="all">All</SelectItem>
              </SelectContent>
            </Select>
            <Select value={typeFilter} onValueChange={setTypeFilter}>
              <SelectTrigger><SelectValue placeholder="Type" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Types</SelectItem>
                <SelectItem value="hazard">Hazards</SelectItem>
                <SelectItem value="control">Controls</SelectItem>
              </SelectContent>
            </Select>
            <Select value={categoryFilter} onValueChange={setCategoryFilter}>
              <SelectTrigger><SelectValue placeholder="Category" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Categories</SelectItem>
                {RISK_CATEGORIES.map(c => (
                  <SelectItem key={c} value={c}>{c}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={groupFilter} onValueChange={setGroupFilter}>
              <SelectTrigger><SelectValue placeholder="Equipment Group" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Groups</SelectItem>
                {EQUIPMENT_GROUPS.map(g => (
                  <SelectItem key={g} value={g}>{EQUIPMENT_GROUP_LABELS[g]}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={sortBy} onValueChange={(v: any) => setSortBy(v)}>
              <SelectTrigger><SelectValue placeholder="Sort" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="alpha">A–Z</SelectItem>
                <SelectItem value="newest">Newest First</SelectItem>
                <SelectItem value="oldest">Oldest First</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <Separator />

        <p className="text-sm text-muted-foreground">
          {filteredItems.length} item{filteredItems.length !== 1 ? 's' : ''} found
        </p>

        {/* Items list */}
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : filteredItems.length === 0 ? (
          <div className="text-center py-16 text-muted-foreground">
            <BookOpen className="h-10 w-10 mx-auto mb-3 opacity-40" />
            <p className="text-sm">No risk library items match your filters</p>
          </div>
        ) : (
          <div className="space-y-2">
            {filteredItems.map(item => (
              <Card key={item.id} className={!item.is_active ? 'opacity-60' : ''}>
                <CardContent className="p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0 space-y-1.5">
                      <p className="font-medium text-sm leading-snug break-words">{item.label}</p>
                      <div className="flex flex-wrap gap-1.5">
                        <Badge variant="secondary" className="text-[10px] gap-1">
                          {item.item_type === 'hazard' ? (
                            <AlertTriangle className="h-2.5 w-2.5" />
                          ) : (
                            <Shield className="h-2.5 w-2.5" />
                          )}
                          {item.item_type}
                        </Badge>
                        {item.category && (
                          <Badge variant="outline" className="text-[10px]">{item.category}</Badge>
                        )}
                        <Badge variant="outline" className="text-[10px] gap-1">
                          {item.ride_category_id ? (
                            <Target className="h-2.5 w-2.5" />
                          ) : (
                            <Globe className="h-2.5 w-2.5" />
                          )}
                          {scopeLabel(item)}
                        </Badge>
                        {!item.is_active && (
                          <Badge variant="destructive" className="text-[10px]">Archived</Badge>
                        )}
                      </div>
                      {item.hint && (
                        <p className="text-xs text-muted-foreground line-clamp-1">{item.hint}</p>
                      )}
                      <p className="text-[10px] text-muted-foreground/60">
                        Added {format(new Date(item.created_at), 'dd MMM yyyy')}
                      </p>
                    </div>

                    <DropdownMenu
                      open={mobileMenuId === item.id}
                      onOpenChange={(open) => {
                        setMobileMenuId(open ? item.id : null);
                        if (!open) clearPointerLock();
                      }}
                      modal={false}
                    >
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0">
                          <MoreVertical className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onSelect={(e) => {
                          e.preventDefault();
                          setMobileMenuId(null);
                          clearPointerLock();
                          openEdit(item);
                        }}>
                          <Edit3 className="h-4 w-4 mr-2" /> Edit
                        </DropdownMenuItem>
                        <DropdownMenuItem onSelect={(e) => {
                          e.preventDefault();
                          setMobileMenuId(null);
                          clearPointerLock();
                          handleDuplicate(item);
                        }}>
                          <Copy className="h-4 w-4 mr-2" /> Duplicate
                        </DropdownMenuItem>
                        <DropdownMenuItem onSelect={(e) => {
                          e.preventDefault();
                          setMobileMenuId(null);
                          clearPointerLock();
                          setArchiveTarget(item);
                        }}>
                          {item.is_active ? (
                            <><Archive className="h-4 w-4 mr-2" /> Archive</>
                          ) : (
                            <><ArchiveRestore className="h-4 w-4 mr-2" /> Unarchive</>
                          )}
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          className="text-destructive focus:text-destructive"
                          onSelect={(e) => {
                            e.preventDefault();
                            setMobileMenuId(null);
                            clearPointerLock();
                            setDeleteTarget(item);
                          }}
                        >
                          <Trash2 className="h-4 w-4 mr-2" /> Delete
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>

      <RiskItemDialog
        open={!!editItem || isCreating}
        isCreating={isCreating}
        item={editItem}
        rideCategories={rideCategories}
        onSave={handleSaveEdit}
        onClose={closeDialog}
      />

      <AlertDialog open={!!archiveTarget} onOpenChange={(open) => { if (!open) setArchiveTarget(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {archiveTarget?.is_active ? 'Archive item?' : 'Unarchive item?'}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {archiveTarget?.is_active
                ? 'This item will be hidden from future risk assessment suggestions. Existing assessments that reference it will not be affected.'
                : 'This item will become available again in risk assessment suggestions.'}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleArchiveToggle} disabled={saving}>
              {archiveTarget?.is_active ? 'Archive' : 'Unarchive'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={!!deleteTarget} onOpenChange={(open) => { if (!open) setDeleteTarget(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Permanently delete item?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently remove the item from the shared risk library. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteConfirm}
              disabled={saving}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete Permanently
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AdminLayout>
  );
}
