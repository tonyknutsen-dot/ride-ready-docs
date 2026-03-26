import { useCallback, useEffect, useMemo, useState, memo } from 'react';
import { AdminLayout } from '@/components/admin/AdminLayout';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useAuditLog } from '@/hooks/useAuditLog';
import {
  FileText, Plus, Search, MoreVertical, Pencil, Archive, ArchiveRestore,
  Trash2, AlertTriangle, CheckCircle, FolderOpen,
} from 'lucide-react';

/* ─── Constants ─── */

const DOC_CATEGORIES = [
  'Inspection / Test',
  'Insurance & Certificates',
  'Manual / Procedure',
  'Maintenance',
  'Other',
];

/* ─── Types ─── */

interface DocType {
  id: string;
  type_key: string;
  name: string;
  category: string;
  description: string | null;
  is_active: boolean;
  source: string;
  created_at: string;
}

type StatusFilter = 'active' | 'archived';

/* ─── Create/Edit Dialog ─── */

const DocTypeDialog = memo(function DocTypeDialog({
  docType, open, allTypes, onClose, onSaved,
}: {
  docType: DocType | null;
  open: boolean;
  allTypes: DocType[];
  onClose: () => void;
  onSaved: (dt: DocType, isNew: boolean) => void;
}) {
  const [name, setName] = useState('');
  const [typeKey, setTypeKey] = useState('');
  const [category, setCategory] = useState('Other');
  const [description, setDescription] = useState('');
  const [saving, setSaving] = useState(false);
  const { toast } = useToast();
  const isEdit = !!docType;

  useEffect(() => {
    if (open) {
      if (docType) {
        setName(docType.name);
        setTypeKey(docType.type_key);
        setCategory(docType.category);
        setDescription(docType.description || '');
      } else {
        setName('');
        setTypeKey('');
        setCategory('Other');
        setDescription('');
      }
    }
  }, [open, docType]);

  // Auto-generate key from name for new items
  useEffect(() => {
    if (!isEdit && name) {
      setTypeKey(name.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, ''));
    }
  }, [name, isEdit]);

  // Duplicate check
  const duplicateWarning = useMemo(() => {
    if (!name.trim()) return null;
    const lower = name.toLowerCase().trim();
    const match = allTypes.find(t =>
      t.id !== docType?.id && t.name.toLowerCase().trim() === lower
    );
    return match ? `"${match.name}" already exists in ${match.category}` : null;
  }, [name, allTypes, docType]);

  const handleSave = async () => {
    if (!name.trim() || !typeKey.trim()) return;
    setSaving(true);
    try {
      if (isEdit && docType) {
        const { data, error } = await supabase
          .from('document_types')
          .update({
            name: name.trim(),
            category,
            description: description.trim() || null,
          })
          .eq('id', docType.id)
          .select()
          .single();
        if (error) throw error;
        onSaved(data as DocType, false);
        toast({ title: 'Updated', description: `"${name.trim()}" updated.` });
      } else {
        const { data, error } = await supabase
          .from('document_types')
          .insert({
            type_key: typeKey.trim(),
            name: name.trim(),
            category,
            description: description.trim() || null,
            source: 'admin',
          })
          .select()
          .single();
        if (error) {
          if (error.message?.includes('duplicate key')) {
            toast({ title: 'Error', description: 'A type with this key already exists.', variant: 'destructive' });
            return;
          }
          throw error;
        }
        onSaved(data as DocType, true);
        toast({ title: 'Created', description: `"${name.trim()}" added to the library.` });
      }
      onClose();
    } catch (err: any) {
      const msg = err?.message?.includes('row-level security')
        ? 'Permission denied. Only admins can manage document types.'
        : (err.message || 'Failed to save');
      toast({ title: 'Error', description: msg, variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{isEdit ? 'Edit Document Type' : 'New Document Type'}</DialogTitle>
          <DialogDescription>
            {isEdit ? 'Update the details of this document type.' : 'Add a new shared document type to the library.'}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Name *</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Structural Assessment Report" />
          </div>
          {!isEdit && (
            <div className="space-y-2">
              <Label>Type Key *</Label>
              <Input value={typeKey} onChange={(e) => setTypeKey(e.target.value)}
                placeholder="e.g. structural_assessment" className="font-mono text-sm" />
              <p className="text-[11px] text-muted-foreground">Used internally. Auto-generated from name.</p>
            </div>
          )}
          <div className="space-y-2">
            <Label>Category</Label>
            <Select value={category} onValueChange={setCategory}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {DOC_CATEGORIES.map(c => (
                  <SelectItem key={c} value={c}>{c}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Description (optional)</Label>
            <Textarea value={description} onChange={(e) => setDescription(e.target.value)}
              rows={2} placeholder="Brief description…" />
          </div>
          {duplicateWarning && (
            <div className="flex items-center gap-2 text-xs text-amber-700 dark:text-amber-400 bg-amber-500/10 border border-amber-500/30 rounded-lg p-2.5">
              <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
              {duplicateWarning}
            </div>
          )}
        </div>
        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={handleSave} disabled={saving || !name.trim() || !typeKey.trim()}>
            {saving ? 'Saving…' : isEdit ? 'Save Changes' : 'Create Type'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
});

/* ─── Main Page ─── */

export default function DocumentTypeLibrary() {
  const [types, setTypes] = useState<DocType[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('active');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');

  // Dialog state
  const [editTarget, setEditTarget] = useState<DocType | null>(null);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [archiveTarget, setArchiveTarget] = useState<DocType | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<DocType | null>(null);
  const [deleteUsageCount, setDeleteUsageCount] = useState<number | null>(null);
  const [deleting, setDeleting] = useState(false);

  // Dropdown cleanup for mobile
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);

  const { toast } = useToast();
  const { logEvent } = useAuditLog();

  const fetchData = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase
      .from('document_types')
      .select('*')
      .order('name');
    if (data) setTypes(data as DocType[]);
    setLoading(false);
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  /* ─── KPIs ─── */
  const kpis = useMemo(() => ({
    active: types.filter(t => t.is_active).length,
    archived: types.filter(t => !t.is_active).length,
    total: types.length,
  }), [types]);

  /* ─── Categories ─── */
  const categories = useMemo(() => {
    const cats = new Set(types.map(t => t.category));
    return Array.from(cats).sort();
  }, [types]);

  /* ─── Filtering ─── */
  const filtered = useMemo(() => {
    let list = types.filter(t => statusFilter === 'active' ? t.is_active : !t.is_active);
    if (categoryFilter !== 'all') {
      list = list.filter(t => t.category === categoryFilter);
    }
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(t =>
        t.name.toLowerCase().includes(q)
        || t.type_key.toLowerCase().includes(q)
        || t.category.toLowerCase().includes(q)
      );
    }
    return list.sort((a, b) => a.name.localeCompare(b.name));
  }, [types, statusFilter, categoryFilter, search]);

  /* ─── Archive/Unarchive ─── */
  const handleArchiveToggle = async (dt: DocType) => {
    const newActive = !dt.is_active;
    try {
      const { error } = await supabase
        .from('document_types')
        .update({ is_active: newActive })
        .eq('id', dt.id);
      if (error) throw error;
      setTypes(prev => prev.map(t => t.id === dt.id ? { ...t, is_active: newActive } : t));
      toast({ title: newActive ? 'Restored' : 'Archived', description: `"${dt.name}" ${newActive ? 'restored to active' : 'archived'}.` });
    } catch (err: any) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    }
    setArchiveTarget(null);
  };

  /* ─── Delete with usage check ─── */
  const handleDeleteCheck = async (dt: DocType) => {
    setDeleteTarget(dt);
    setDeleteUsageCount(null);
    // Check if type_key is used in documents table
    const { count } = await supabase
      .from('documents')
      .select('id', { count: 'exact', head: true })
      .eq('document_type', dt.type_key);
    setDeleteUsageCount(count || 0);
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      const { error } = await supabase
        .from('document_types')
        .delete()
        .eq('id', deleteTarget.id);
      if (error) throw error;
      setTypes(prev => prev.filter(t => t.id !== deleteTarget.id));
      toast({ title: 'Deleted', description: `"${deleteTarget.name}" removed from library.` });
      setDeleteTarget(null);
    } catch (err: any) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    } finally {
      setDeleting(false);
    }
  };

  /* ─── Save callback ─── */
  const onSaved = useCallback((dt: DocType, isNew: boolean) => {
    if (isNew) {
      setTypes(prev => [...prev, dt]);
    } else {
      setTypes(prev => prev.map(t => t.id === dt.id ? dt : t));
    }
  }, []);

  /* ─── Menu action handler with clean handoff ─── */
  const handleMenuAction = useCallback((action: () => void) => {
    return (e: Event) => {
      e.preventDefault();
      setTimeout(() => {
        document.body.style.removeProperty('pointer-events');
        action();
      }, 10);
    };
  }, []);

  const statusTabs: { key: StatusFilter; label: string }[] = [
    { key: 'active', label: 'Active' },
    { key: 'archived', label: 'Archived' },
  ];

  return (
    <AdminLayout>
      <div className="space-y-5">
        {/* Header */}
        <div className="flex items-start justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <FolderOpen className="h-6 w-6" />
              Document Type Library
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              Manage the shared document types used across the app.
            </p>
          </div>
          <Button size="sm" className="gap-1.5 shrink-0" onClick={() => setShowCreateDialog(true)}>
            <Plus className="h-4 w-4" />
            <span className="hidden sm:inline">New Type</span>
          </Button>
        </div>

        {/* KPIs */}
        <div className="grid grid-cols-3 gap-3">
          {[
            { label: 'Active', value: kpis.active, color: 'text-green-600' },
            { label: 'Archived', value: kpis.archived, color: 'text-muted-foreground' },
            { label: 'Total', value: kpis.total, color: 'text-foreground' },
          ].map(kpi => (
            <Card key={kpi.label}>
              <CardContent className="p-3 text-center">
                <p className={`text-2xl font-bold ${kpi.color}`}>{kpi.value}</p>
                <p className="text-[11px] text-muted-foreground">{kpi.label}</p>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Status tabs */}
        <div className="flex gap-1">
          {statusTabs.map(t => (
            <button key={t.key} onClick={() => setStatusFilter(t.key)}
              className={`text-xs font-medium py-1.5 px-3 rounded-full transition-colors ${
                statusFilter === t.key
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-muted/50 text-muted-foreground hover:text-foreground'
              }`}>
              {t.label} ({t.key === 'active' ? kpis.active : kpis.archived})
            </button>
          ))}
        </div>

        {/* Filters */}
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Input placeholder="Search types…" value={search}
              onChange={(e) => setSearch(e.target.value)} className="pl-8 h-9" />
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          </div>
          <Select value={categoryFilter} onValueChange={setCategoryFilter}>
            <SelectTrigger className="w-[140px] h-9 text-xs">
              <SelectValue placeholder="Category" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Categories</SelectItem>
              {categories.map(c => (
                <SelectItem key={c} value={c}>{c}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* List */}
        {loading ? (
          <div className="text-center py-12 text-muted-foreground text-sm">Loading…</div>
        ) : filtered.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center space-y-2">
              <FolderOpen className="h-10 w-10 mx-auto text-muted-foreground/40" />
              <p className="text-sm text-muted-foreground">
                {types.length === 0
                  ? 'No document types yet.'
                  : 'No document types match your filters.'}
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-2">
            {filtered.map(dt => (
              <Card key={dt.id}>
                <CardContent className="p-3 flex items-center gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="font-medium text-sm leading-tight">{dt.name}</h3>
                      {!dt.is_active && (
                        <Badge variant="secondary" className="text-[10px]">Archived</Badge>
                      )}
                    </div>
                    <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                      <span className="text-[11px] text-muted-foreground">{dt.category}</span>
                      <span className="text-[11px] text-muted-foreground/40">·</span>
                      <span className="text-[11px] text-muted-foreground font-mono">{dt.type_key}</span>
                      {dt.source !== 'system' && dt.source !== 'admin' && (
                        <>
                          <span className="text-[11px] text-muted-foreground/40">·</span>
                          <Badge variant="outline" className="text-[9px] px-1 py-0">From Request</Badge>
                        </>
                      )}
                    </div>
                    {dt.description && (
                      <p className="text-[11px] text-muted-foreground/70 mt-0.5 line-clamp-1">{dt.description}</p>
                    )}
                  </div>

                  <DropdownMenu
                    open={openMenuId === dt.id}
                    onOpenChange={(open) => setOpenMenuId(open ? dt.id : null)}
                  >
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0">
                        <MoreVertical className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-44">
                      <DropdownMenuItem onSelect={handleMenuAction(() => setEditTarget(dt))}>
                        <Pencil className="h-3.5 w-3.5 mr-2" />
                        Edit
                      </DropdownMenuItem>
                      <DropdownMenuItem onSelect={handleMenuAction(() => handleArchiveToggle(dt))}>
                        {dt.is_active ? (
                          <><Archive className="h-3.5 w-3.5 mr-2" />Archive</>
                        ) : (
                          <><ArchiveRestore className="h-3.5 w-3.5 mr-2" />Restore</>
                        )}
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        onSelect={handleMenuAction(() => handleDeleteCheck(dt))}
                        className="text-destructive focus:text-destructive"
                      >
                        <Trash2 className="h-3.5 w-3.5 mr-2" />
                        Delete
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>

      {/* Create/Edit dialog */}
      <DocTypeDialog
        docType={editTarget}
        open={showCreateDialog || !!editTarget}
        allTypes={types}
        onClose={() => { setShowCreateDialog(false); setEditTarget(null); }}
        onSaved={onSaved}
      />

      {/* Delete confirmation */}
      <AlertDialog open={!!deleteTarget} onOpenChange={(v) => !v && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Document Type</AlertDialogTitle>
            <AlertDialogDescription>
              {deleteUsageCount === null
                ? 'Checking usage…'
                : deleteUsageCount > 0
                  ? `"${deleteTarget?.name}" is used by ${deleteUsageCount} document${deleteUsageCount !== 1 ? 's' : ''}. You should archive it instead of deleting.`
                  : `"${deleteTarget?.name}" is not used by any documents. It will be permanently removed.`
              }
            </AlertDialogDescription>
          </AlertDialogHeader>
          {deleteUsageCount !== null && deleteUsageCount > 0 && (
            <div className="flex items-center gap-2 text-xs text-amber-700 dark:text-amber-400 bg-amber-500/10 border border-amber-500/30 rounded-lg p-2.5">
              <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
              Deleting this type will leave {deleteUsageCount} document{deleteUsageCount !== 1 ? 's' : ''} with an orphaned type reference. Archive instead.
            </div>
          )}
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            {deleteUsageCount !== null && deleteUsageCount > 0 ? (
              <Button onClick={() => { handleArchiveToggle(deleteTarget!); setDeleteTarget(null); }}
                variant="secondary" className="gap-1.5">
                <Archive className="h-4 w-4" />
                Archive Instead
              </Button>
            ) : (
              <AlertDialogAction onClick={handleDelete} disabled={deleting || deleteUsageCount === null}
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                {deleting ? 'Deleting…' : 'Delete Permanently'}
              </AlertDialogAction>
            )}
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AdminLayout>
  );
}
