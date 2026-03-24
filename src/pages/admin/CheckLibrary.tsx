import { useState, useEffect, useMemo } from 'react';
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
  Search, Loader2, Library, Edit3, Archive, ArchiveRestore, Trash2, Copy,
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
import { Database } from '@/integrations/supabase/types';

type CheckFrequency = Database['public']['Enums']['check_frequency'];

const CHECK_CATEGORIES = [
  "Anchorage", "Blower", "Compliance", "Electrical", "Fuel", "Gas",
  "General", "Hydraulic/Pneumatic", "Hygiene", "Operations", "Safety",
  "Signage", "Site", "Storage", "Structure", "Weather"
];

const EQUIPMENT_GROUPS = [
  "rides", "inflatables", "stalls", "attractions", "food_stalls", "games", "equipment"
];

const EQUIPMENT_GROUP_LABELS: Record<string, string> = {
  rides: 'Rides', inflatables: 'Inflatables', stalls: 'Stalls',
  attractions: 'Attractions', food_stalls: 'Food Stalls', games: 'Games', equipment: 'Equipment',
};

const FREQUENCY_LABELS: Record<string, string> = {
  daily: 'Daily', preopening: 'Pre-Opening', weekly: 'Weekly', monthly: 'Monthly', yearly: 'Yearly',
};

interface LibraryItem {
  id: string;
  label: string;
  frequency: string;
  equipment_group: string;
  ride_category_id: string | null;
  hint: string | null;
  risk_level: string | null;
  is_active: boolean;
  sort_index: number;
  created_at: string;
  category: string | null;
  ride_category?: { name: string; category_group: string } | null;
}

interface RideCategory {
  id: string;
  name: string;
  category_group: string;
}

export default function CheckLibrary() {
  const { toast } = useToast();
  const { logEvent } = useAuditLog();

  // Data
  const [items, setItems] = useState<LibraryItem[]>([]);
  const [rideCategories, setRideCategories] = useState<RideCategory[]>([]);
  const [loading, setLoading] = useState(true);

  // Filters
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'active' | 'archived' | 'all'>('active');
  const [frequencyFilter, setFrequencyFilter] = useState('all');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [groupFilter, setGroupFilter] = useState('all');
  const [sortBy, setSortBy] = useState<'newest' | 'oldest' | 'alpha'>('alpha');

  // Dialogs
  const [editItem, setEditItem] = useState<LibraryItem | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [archiveTarget, setArchiveTarget] = useState<LibraryItem | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<LibraryItem | null>(null);
  const [deleteBlocked, setDeleteBlocked] = useState(false);
  const [saving, setSaving] = useState(false);

  // Edit form state
  const [editLabel, setEditLabel] = useState('');
  const [editHint, setEditHint] = useState('');
  const [editCategory, setEditCategory] = useState('');
  const [editFrequency, setEditFrequency] = useState('');
  const [editGroup, setEditGroup] = useState('');
  const [editRideCategoryId, setEditRideCategoryId] = useState<string | null>(null);
  const [editNote, setEditNote] = useState('');

  // Mobile action menu
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
    const { data, error } = await supabase
      .from('check_library_items')
      .select('*, ride_category:ride_categories(name, category_group)')
      .order('created_at', { ascending: false });

    if (!error && data) {
      setItems(data as unknown as LibraryItem[]);
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
      if (frequencyFilter !== 'all' && item.frequency !== frequencyFilter) return false;
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
  }, [items, search, statusFilter, frequencyFilter, categoryFilter, groupFilter, sortBy]);

  // KPIs
  const totalActive = items.filter(i => i.is_active).length;
  const totalArchived = items.filter(i => !i.is_active).length;
  const groupCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    items.filter(i => i.is_active).forEach(i => {
      const g = i.equipment_group.toLowerCase();
      counts[g] = (counts[g] || 0) + 1;
    });
    return counts;
  }, [items]);

  // === Actions ===

  const openCreate = () => {
    setIsCreating(true);
    setEditItem(null);
    setEditLabel('');
    setEditHint('');
    setEditCategory('');
    setEditFrequency('daily');
    setEditGroup('rides');
    setEditRideCategoryId(null);
    setEditNote('');
  };

  const openEdit = (item: LibraryItem) => {
    setIsCreating(false);
    setEditItem(item);
    setEditLabel(item.label);
    setEditHint(item.hint || '');
    setEditCategory(item.category || '');
    setEditFrequency(item.frequency);
    setEditGroup(item.equipment_group.toLowerCase());
    setEditRideCategoryId(item.ride_category_id);
    setEditNote('');
  };

  const handleSaveEdit = async () => {
    if (!editLabel.trim()) return;
    setSaving(true);

    if (isCreating) {
      // Create new library item
      const { data, error } = await supabase
        .from('check_library_items')
        .insert({
          label: editLabel.trim(),
          hint: editHint.trim() || null,
          category: editCategory || null,
          frequency: editFrequency as CheckFrequency,
          equipment_group: editGroup,
          ride_category_id: editRideCategoryId,
          is_active: true,
          sort_index: 0,
        })
        .select('*, ride_category:ride_categories(name, category_group)')
        .single();

      if (error) {
        toast({ title: 'Error', description: 'Failed to create item', variant: 'destructive' });
      } else if (data) {
        logEvent('create', 'check', data.id, { label: editLabel, note: editNote || undefined });
        toast({ title: 'Created', description: 'New library item added' });
        setItems(prev => [data as unknown as LibraryItem, ...prev]);
        setIsCreating(false);
      }
    } else if (editItem) {
      // Update existing
      const { error } = await supabase
        .from('check_library_items')
        .update({
          label: editLabel.trim(),
          hint: editHint.trim() || null,
          category: editCategory || null,
          frequency: editFrequency as CheckFrequency,
          equipment_group: editGroup,
          ride_category_id: editRideCategoryId,
        })
        .eq('id', editItem.id);

      if (error) {
        toast({ title: 'Error', description: 'Failed to update item', variant: 'destructive' });
      } else {
        logEvent('update', 'check', editItem.id, { label: editLabel, note: editNote || undefined });
        toast({ title: 'Updated', description: 'Library item updated' });
        setItems(prev => prev.map(i => i.id === editItem.id ? {
          ...i, label: editLabel.trim(), hint: editHint.trim() || null,
          category: editCategory || null, frequency: editFrequency,
          equipment_group: editGroup, ride_category_id: editRideCategoryId,
        } : i));
        setEditItem(null);
      }
    }
    setSaving(false);
  };

  const handleArchiveToggle = async () => {
    if (!archiveTarget) return;
    setSaving(true);
    const newActive = !archiveTarget.is_active;
    const { error } = await supabase
      .from('check_library_items')
      .update({ is_active: newActive })
      .eq('id', archiveTarget.id);

    if (error) {
      toast({ title: 'Error', description: 'Failed to update status', variant: 'destructive' });
    } else {
      const action = newActive ? 'Unarchived' : 'Archived';
      logEvent('update', 'check', archiveTarget.id, { action: action.toLowerCase() });
      toast({ title: action, description: `Item ${action.toLowerCase()} successfully` });
      setItems(prev => prev.map(i => i.id === archiveTarget.id ? { ...i, is_active: newActive } : i));
    }
    setArchiveTarget(null);
    setSaving(false);
  };

  const handleDeleteCheck = async (item: LibraryItem) => {
    // Check dependencies: check_results referencing template items that use this library item
    // For now, check if any daily_check_template_items reference this label
    const { count } = await supabase
      .from('daily_check_template_items')
      .select('id', { count: 'exact', head: true })
      .ilike('check_item_text', item.label);

    if ((count || 0) > 0) {
      setDeleteBlocked(true);
      setDeleteTarget(item);
    } else {
      setDeleteBlocked(false);
      setDeleteTarget(item);
    }
  };

  const handleDeleteConfirm = async () => {
    if (!deleteTarget || deleteBlocked) return;
    setSaving(true);
    const { error } = await supabase
      .from('check_library_items')
      .delete()
      .eq('id', deleteTarget.id);

    if (error) {
      toast({ title: 'Error', description: 'Failed to delete item', variant: 'destructive' });
    } else {
      logEvent('delete', 'check', deleteTarget.id, { label: deleteTarget.label });
      toast({ title: 'Deleted', description: 'Library item permanently removed' });
      setItems(prev => prev.filter(i => i.id !== deleteTarget.id));
    }
    setDeleteTarget(null);
    setSaving(false);
  };

  const handleDuplicate = async (item: LibraryItem) => {
    const { data, error } = await supabase
      .from('check_library_items')
      .insert({
        label: `${item.label} (copy)`,
        frequency: item.frequency as CheckFrequency,
        equipment_group: item.equipment_group,
        ride_category_id: item.ride_category_id,
        hint: item.hint,
        category: item.category,
        risk_level: item.risk_level,
        is_active: true,
        sort_index: item.sort_index,
      })
      .select()
      .single();

    if (error) {
      toast({ title: 'Error', description: 'Failed to duplicate item', variant: 'destructive' });
    } else if (data) {
      logEvent('create', 'check', data.id, { duplicated_from: item.id });
      toast({ title: 'Duplicated', description: 'Item cloned successfully' });
      setItems(prev => [data as unknown as LibraryItem, ...prev]);
    }
  };

  const scopeLabel = (item: LibraryItem) => {
    if (item.ride_category_id && item.ride_category) return item.ride_category.name;
    const g = item.equipment_group.toLowerCase();
    if (g === 'rides' && !item.ride_category_id) return 'General';
    return EQUIPMENT_GROUP_LABELS[g] || item.equipment_group;
  };

  const scopeType = (item: LibraryItem): 'general' | 'group' | 'type' => {
    if (item.ride_category_id) return 'type';
    const g = item.equipment_group.toLowerCase();
    return g === 'rides' && !item.ride_category_id ? 'general' : 'group';
  };

  const filteredGroupCategories = rideCategories.filter(
    rc => rc.category_group.toLowerCase() === editGroup.toLowerCase()
  );

  return (
    <AdminLayout>
      <div className="space-y-6 max-w-5xl">
        {/* Header */}
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <Library className="h-6 w-6 text-primary" />
              <h1 className="text-2xl font-bold">Check Library</h1>
            </div>
            <p className="text-sm text-muted-foreground">
              Manage the shared check item library. Edit wording, archive old items, or remove unused entries.
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
            <p className="text-2xl font-bold">{totalArchived}</p>
            <p className="text-xs text-muted-foreground">Archived</p>
          </CardContent></Card>
          <Card><CardContent className="p-4 text-center">
            <p className="text-2xl font-bold">{Object.keys(groupCounts).length}</p>
            <p className="text-xs text-muted-foreground">Equipment Groups</p>
          </CardContent></Card>
          <Card><CardContent className="p-4 text-center">
            <p className="text-2xl font-bold">{items.length}</p>
            <p className="text-xs text-muted-foreground">Total Items</p>
          </CardContent></Card>
        </div>

        {/* Filters */}
        <div className="space-y-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search library items..."
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
            <Select value={frequencyFilter} onValueChange={setFrequencyFilter}>
              <SelectTrigger><SelectValue placeholder="Frequency" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Frequencies</SelectItem>
                {Object.entries(FREQUENCY_LABELS).map(([k, v]) => (
                  <SelectItem key={k} value={k}>{v}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={categoryFilter} onValueChange={setCategoryFilter}>
              <SelectTrigger><SelectValue placeholder="Category" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Categories</SelectItem>
                {CHECK_CATEGORIES.map(c => (
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

        {/* Results count */}
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
            <p className="text-sm">No library items match your filters</p>
          </div>
        ) : (
          <div className="space-y-2">
            {filteredItems.map(item => (
              <Card key={item.id} className={!item.is_active ? 'opacity-60' : ''}>
                <CardContent className="p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0 space-y-1.5">
                      {/* Title row */}
                      <p className="font-medium text-sm leading-snug break-words">{item.label}</p>

                      {/* Metadata badges */}
                      <div className="flex flex-wrap gap-1.5">
                        <Badge variant="outline" className="text-[10px]">
                          {FREQUENCY_LABELS[item.frequency] || item.frequency}
                        </Badge>
                        {item.category && (
                          <Badge variant="secondary" className="text-[10px]">{item.category}</Badge>
                        )}
                        <Badge
                          variant={scopeType(item) === 'general' ? 'default' : 'outline'}
                          className="text-[10px] gap-1"
                        >
                          {scopeType(item) === 'general' ? (
                            <Globe className="h-2.5 w-2.5" />
                          ) : (
                            <Target className="h-2.5 w-2.5" />
                          )}
                          {scopeLabel(item)}
                        </Badge>
                        {!item.is_active && (
                          <Badge variant="destructive" className="text-[10px]">Archived</Badge>
                        )}
                      </div>

                      {/* Hint */}
                      {item.hint && (
                        <p className="text-xs text-muted-foreground line-clamp-1">{item.hint}</p>
                      )}

                      {/* Date */}
                      <p className="text-[10px] text-muted-foreground/60">
                        Added {format(new Date(item.created_at), 'dd MMM yyyy')}
                      </p>
                    </div>

                    {/* Actions */}
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
                            handleDeleteCheck(item);
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

      {/* ── Create / Edit Dialog ── */}
      <Dialog open={!!editItem || isCreating} onOpenChange={(open) => { if (!open) { setEditItem(null); setIsCreating(false); } }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{isCreating ? 'New Library Item' : 'Edit Library Item'}</DialogTitle>
            <DialogDescription>
              {isCreating ? 'Add a new item to the shared check library' : 'Update wording, classification, or scope'}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Item text</Label>
              <Input value={editLabel} onChange={e => setEditLabel(e.target.value)} placeholder="e.g. Check emergency stop button" />
            </div>
            <div>
              <Label>Hint / guidance</Label>
              <Textarea value={editHint} onChange={e => setEditHint(e.target.value)} rows={2} placeholder="Optional guidance for the inspector" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Category</Label>
                <Select value={editCategory} onValueChange={setEditCategory}>
                  <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                  <SelectContent>
                    {CHECK_CATEGORIES.map(c => (
                      <SelectItem key={c} value={c}>{c}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Frequency</Label>
                <Select value={editFrequency} onValueChange={setEditFrequency}>
                  <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                  <SelectContent>
                    {Object.entries(FREQUENCY_LABELS).map(([k, v]) => (
                      <SelectItem key={k} value={k}>{v}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div>
              <Label>Equipment group</Label>
              <Select value={editGroup} onValueChange={(v) => {
                setEditGroup(v);
                setEditRideCategoryId(null);
              }}>
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
                <Label>Specific ride/equipment type (optional)</Label>
                <Select
                  value={editRideCategoryId || 'none'}
                  onValueChange={v => setEditRideCategoryId(v === 'none' ? null : v)}
                >
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
              <Input
                value={editNote}
                onChange={e => setEditNote(e.target.value)}
                placeholder={isCreating ? "Reason for adding" : "Reason for change"}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setEditItem(null); setIsCreating(false); }}>Cancel</Button>
            <Button onClick={handleSaveEdit} disabled={saving || !editLabel.trim()}>
              {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              {isCreating ? 'Add to Library' : 'Save Changes'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Archive Confirmation ── */}
      <AlertDialog open={!!archiveTarget} onOpenChange={(open) => { if (!open) setArchiveTarget(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {archiveTarget?.is_active ? 'Archive item?' : 'Unarchive item?'}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {archiveTarget?.is_active
                ? 'This item will be hidden from future check template suggestions. Existing templates and records that reference it will not be affected.'
                : 'This item will become available again in check template suggestions.'}
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

      {/* ── Delete Confirmation ── */}
      <AlertDialog open={!!deleteTarget} onOpenChange={(open) => { if (!open) { setDeleteTarget(null); setDeleteBlocked(false); } }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {deleteBlocked ? 'Cannot delete this item' : 'Permanently delete item?'}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {deleteBlocked ? (
                <span className="flex items-start gap-2">
                  <AlertTriangle className="h-4 w-4 text-destructive shrink-0 mt-0.5" />
                  <span>
                    This item is referenced by existing check templates. Use <strong>Archive</strong> instead to hide it from future use while preserving history.
                  </span>
                </span>
              ) : (
                'This will permanently remove the item from the shared library. This action cannot be undone.'
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            {deleteBlocked ? (
              <AlertDialogAction onClick={() => {
                setDeleteTarget(null);
                setDeleteBlocked(false);
                if (deleteTarget) setArchiveTarget(deleteTarget);
              }}>
                Archive Instead
              </AlertDialogAction>
            ) : (
              <AlertDialogAction
                onClick={handleDeleteConfirm}
                disabled={saving}
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              >
                Delete Permanently
              </AlertDialogAction>
            )}
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AdminLayout>
  );
}
