import { useState, useEffect, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { ArrowLeft, ArrowRight, Plus, Trash2, Save, Library, Pencil, Check, X, Sparkles, CheckSquare, ListChecks, AlertTriangle, Search, ChevronDown, ChevronUp, GripVertical } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { Tables } from '@/integrations/supabase/types';
import CheckLibraryDialog from './CheckLibraryDialog';

type Ride = Tables<'rides'> & {
  ride_categories: {
    name: string;
    description: string | null;
    category_group: string;
  };
};

type Template = Tables<'daily_check_templates'> & {
  daily_check_template_items: Tables<'daily_check_template_items'>[];
};

interface TemplateBuilderProps {
  ride: Ride;
  template?: Template | null;
  frequency?: string;
  onSuccess: () => void;
  onCancel: () => void;
}

interface BuilderItem {
  id?: string;
  check_item_text: string;
  is_required: boolean;
  category: string;
  sort_order: number;
  isNew?: boolean;
}

interface SuggestionItem {
  id: string;
  label: string;
  hint: string | null;
  risk_level: string | null;
  ride_category_id: string | null;
}

const STEPS = [
  { label: 'Suggestions', icon: Sparkles },
  { label: 'Custom', icon: Plus },
  { label: 'Review', icon: ListChecks },
];

/** Map ride category_group to the check library equipment_group */
const getEquipmentGroup = (categoryGroup: string): string | null => {
  const map: Record<string, string> = {
    'rides': 'rides',
    'inflatables': 'inflatables',
    'stalls': 'stalls',
    'attractions': 'attractions',
    'food stalls': 'food_stalls',
    'games': 'games',
    'equipment': 'equipment',
  };
  return map[categoryGroup.toLowerCase()] ?? null;
};

const TemplateBuilder = ({ ride, template, frequency = 'daily', onSuccess, onCancel }: TemplateBuilderProps) => {
  const { user } = useAuth();
  const { toast } = useToast();
  const freqLabel = frequency === 'preopening' ? 'Pre-Opening' : frequency.charAt(0).toUpperCase() + frequency.slice(1);
  const equipmentGroup = getEquipmentGroup(ride.ride_categories?.category_group ?? '');
  const defaultTemplateName = `${freqLabel} Safety Check`;
  const isEditing = !!template;

  // Wizard state
  const [step, setStep] = useState(isEditing ? 2 : 0);
  const [templateName, setTemplateName] = useState(template?.template_name || defaultTemplateName);
  const [selectedItems, setSelectedItems] = useState<BuilderItem[]>([]);
  const [customItemText, setCustomItemText] = useState('');
  const [loading, setLoading] = useState(false);
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [editText, setEditText] = useState('');

  // Start Notice state
  const [startNoticeText, setStartNoticeText] = useState(template?.start_notice_text ?? '');
  const [startNoticeRequired, setStartNoticeRequired] = useState(template?.start_notice_required ?? false);
  const [startNoticeOpen, setStartNoticeOpen] = useState(!!(template?.start_notice_text?.trim()));

  // Suggestions state
  const [suggestions, setSuggestions] = useState<SuggestionItem[]>([]);
  const [suggestionsLoading, setSuggestionsLoading] = useState(false);
  const [selectedSuggestions, setSelectedSuggestions] = useState<Record<string, boolean>>({});
  const [suggestionSearch, setSuggestionSearch] = useState('');

  // Load existing template items
  useEffect(() => {
    if (template) {
      setSelectedItems(
        template.daily_check_template_items
          .sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0))
          .map((item, index) => ({
            id: item.id,
            check_item_text: item.check_item_text,
            is_required: item.is_required ?? true,
            category: item.category ?? 'general',
            sort_order: index,
          }))
      );
    }
  }, [template]);

  // Load suggestions when on step 0
  useEffect(() => {
    if (step !== 0) return;
    loadSuggestions();
  }, [step, frequency, ride.category_id]);

  const loadSuggestions = async () => {
    setSuggestionsLoading(true);
    try {
      const cat = ride.category_id || null;
      const resolvedGroup = equipmentGroup || 'rides';
      let query = supabase
        .from('check_library_items')
        .select('id,label,hint,risk_level,ride_category_id')
        .eq('frequency', frequency as "daily" | "weekly" | "monthly" | "yearly" | "preopening")
        .eq('is_active', true)
        .eq('equipment_group', resolvedGroup)
        .order('sort_index', { ascending: true });

      if (cat) {
        query = query.or(`ride_category_id.is.null,ride_category_id.eq.${cat}`);
      } else {
        query = query.is('ride_category_id', null);
      }

      const { data, error } = await query;
      if (error) throw error;

      const specific = (data || []).filter(r => r.ride_category_id === cat);
      const generic = (data || []).filter(r => !r.ride_category_id);
      setSuggestions([...specific, ...generic]);

      const autoSelect: Record<string, boolean> = {};
      specific.forEach(item => { autoSelect[item.id] = true; });
      setSelectedSuggestions(autoSelect);
    } catch (error: any) {
      console.error('Error loading suggestions:', error);
    } finally {
      setSuggestionsLoading(false);
    }
  };

  const filteredSuggestions = useMemo(() => {
    if (!suggestionSearch.trim()) return suggestions;
    const s = suggestionSearch.trim().toLowerCase();
    return suggestions.filter(r =>
      r.label.toLowerCase().includes(s) || (r.hint || '').toLowerCase().includes(s)
    );
  }, [suggestions, suggestionSearch]);

  const selectedSuggestionCount = Object.values(selectedSuggestions).filter(Boolean).length;

  const handleAcceptSuggestions = () => {
    const labels = suggestions.filter(s => selectedSuggestions[s.id]).map(s => s.label);
    if (labels.length > 0) {
      const newItems: BuilderItem[] = labels.map((label, i) => ({
        check_item_text: label,
        is_required: true,
        category: 'library',
        sort_order: selectedItems.length + i,
        isNew: true,
      }));
      setSelectedItems(prev => [...prev, ...newItems]);
      toast({
        title: `${labels.length} item${labels.length > 1 ? 's' : ''} added`,
        description: 'Suggested items added to your checklist',
      });
    }
    setStep(1);
  };

  const handleSkipSuggestions = () => {
    setStep(1);
  };

  // Custom item handlers
  const handleAddCustomItem = () => {
    if (!customItemText.trim()) return;
    const newItem: BuilderItem = {
      check_item_text: customItemText.trim(),
      is_required: true,
      category: 'custom',
      sort_order: selectedItems.length,
      isNew: true,
    };
    setSelectedItems(prev => [...prev, newItem]);

    if (user?.id) {
      supabase
        .from('user_submitted_check_items')
        .insert({
          user_id: user.id,
          label: customItemText.trim(),
          frequency,
          ride_category_id: ride.category_id,
          is_generic: false,
        })
        .then(({ error }) => { if (error) console.log('Submit failed:', error); });
    }

    setCustomItemText('');
    toast({ title: 'Item added', description: 'Custom check item added' });
  };

  const handleRemoveItem = (index: number) => {
    setSelectedItems(prev => prev.filter((_, i) => i !== index));
  };

  const handleMoveItem = (index: number, direction: 'up' | 'down') => {
    const items = [...selectedItems];
    const newIndex = direction === 'up' ? index - 1 : index + 1;
    if (newIndex < 0 || newIndex >= items.length) return;
    [items[index], items[newIndex]] = [items[newIndex], items[index]];
    items.forEach((item, i) => item.sort_order = i);
    setSelectedItems(items);
  };

  const handleStartEdit = (index: number) => {
    setEditingIndex(index);
    setEditText(selectedItems[index].check_item_text);
  };

  const handleSaveEdit = () => {
    if (editingIndex === null || !editText.trim()) return;
    const originalText = selectedItems[editingIndex].check_item_text;
    const newText = editText.trim();

    if (newText !== originalText && user?.id) {
      supabase
        .from('user_submitted_check_items')
        .insert({ user_id: user.id, label: newText, frequency, ride_category_id: ride.category_id, is_generic: false })
        .then(({ error }) => { if (error) console.log('Submit failed:', error); });
    }

    setSelectedItems(prev => prev.map((item, i) =>
      i === editingIndex ? { ...item, check_item_text: newText } : item
    ));
    setEditingIndex(null);
    setEditText('');
  };

  const handleCancelEdit = () => {
    setEditingIndex(null);
    setEditText('');
  };

  // Background spell-check
  const spellcheckItems = async (items: Array<{ id: string; check_item_text: string }>) => {
    for (const item of items) {
      try {
        await supabase.functions.invoke('spellcheck-items', {
          body: { item_id: item.id, text: item.check_item_text, table: 'daily_check_template_items' }
        });
      } catch (e) {
        console.log('Spellcheck failed for item:', item.id);
      }
    }
  };

  const handleSaveTemplate = async () => {
    if (!templateName.trim()) {
      toast({ title: 'Missing name', description: 'Please enter a checklist name', variant: 'destructive' });
      return;
    }
    if (selectedItems.length === 0) {
      toast({ title: 'No items', description: 'Add at least one check item', variant: 'destructive' });
      return;
    }

    setLoading(true);
    try {
      let templateId = template?.id;

      if (template) {
        const { error: updateError } = await supabase
          .from('daily_check_templates')
          .update({
            template_name: templateName.trim(),
            start_notice_text: startNoticeText.trim() || null,
            start_notice_required: startNoticeText.trim() ? startNoticeRequired : false,
          } as any)
          .eq('id', template.id);
        if (updateError) throw updateError;

        const { error: deleteError } = await supabase
          .from('daily_check_template_items')
          .delete()
          .eq('template_id', template.id);
        if (deleteError) throw deleteError;
      } else {
        const { data: newTemplate, error: createError } = await supabase
          .from('daily_check_templates')
          .insert({
            user_id: user?.id,
            ride_id: ride.id,
            template_name: templateName.trim(),
            check_frequency: frequency,
            template_type: frequency,
            is_active: true,
            start_notice_text: startNoticeText.trim() || null,
            start_notice_required: startNoticeText.trim() ? startNoticeRequired : false,
          } as any)
          .select()
          .single();
        if (createError) throw createError;
        templateId = newTemplate.id;
      }

      const itemsToInsert = selectedItems.map((item, index) => ({
        template_id: templateId,
        check_item_text: item.check_item_text,
        is_required: item.is_required,
        category: item.category,
        sort_order: index,
      }));

      const { data: insertedItems, error: itemsError } = await supabase
        .from('daily_check_template_items')
        .insert(itemsToInsert)
        .select();
      if (itemsError) throw itemsError;

      toast({
        title: 'Checklist saved',
        description: `Your ${frequency === 'preopening' ? 'pre-opening' : frequency} checklist is ready to use`,
      });

      if (insertedItems && insertedItems.length > 0) {
        const customItems = insertedItems.filter((_, index) => selectedItems[index]?.isNew === true);
        if (customItems.length > 0) spellcheckItems(customItems);
      }

      onSuccess();
    } catch (error: any) {
      console.error('Error saving template:', error);
      toast({ title: 'Error saving', description: error.message, variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  const getRiskBadgeClass = (level: string | null) => {
    switch (level) {
      case 'high': return 'bg-red-600 text-white hover:bg-red-700';
      case 'med': return 'bg-yellow-600 text-white hover:bg-yellow-700';
      case 'low': return 'bg-green-600 text-white hover:bg-green-700';
      default: return '';
    }
  };

  const progressValue = ((step + 1) / STEPS.length) * 100;

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="sm" onClick={step > 0 && !isEditing ? () => setStep(step - 1) : onCancel}>
          <ArrowLeft className="h-4 w-4 mr-1" />
          {step > 0 && !isEditing ? 'Back' : 'Cancel'}
        </Button>
        <div className="flex-1 min-w-0">
          <h3 className="font-semibold truncate">
            {isEditing ? 'Edit' : 'Build'} {freqLabel} Checklist
          </h3>
          <p className="text-xs text-muted-foreground truncate">{ride.ride_name}</p>
        </div>
      </div>

      {/* Compact mobile stepper — dots + active label */}
      <div className="flex items-center gap-2">
        {STEPS.map((s, i) => {
          const isActive = i === step;
          const isDone = i < step;
          return (
            <div key={i} className="flex items-center gap-2">
              {i > 0 && <div className={`h-px w-3 ${isDone ? 'bg-primary/30' : 'bg-muted'}`} />}
              <button
                onClick={() => { if (isDone && !isEditing) setStep(i); }}
                disabled={i > step || isEditing}
                className={`h-6 w-6 rounded-full flex items-center justify-center text-[10px] font-bold shrink-0 transition-colors ${
                  isActive ? 'bg-primary text-primary-foreground' : isDone ? 'bg-primary/20 text-primary' : 'bg-muted text-muted-foreground'
                } ${isDone && !isEditing ? 'cursor-pointer' : ''}`}
              >
                {isDone ? <Check className="h-3 w-3" /> : i + 1}
              </button>
            </div>
          );
        })}
        <span className="text-xs font-medium text-foreground ml-1">
          {STEPS[step].label}
        </span>
        <span className="text-xs text-muted-foreground">
          — Step {step + 1} of {STEPS.length}
        </span>
      </div>

      {/* Step 0: Smart Suggestions — flat layout */}
      {step === 0 && (
        <div className="space-y-3">
          <p className="text-sm text-muted-foreground">
            Tick the items relevant to your {ride.ride_categories?.name || 'equipment'}.
          </p>

          {suggestions.length > 8 && (
            <div className="relative">
              <Input
                placeholder="Search suggestions…"
                value={suggestionSearch}
                onChange={(e) => setSuggestionSearch(e.target.value)}
                className="pl-8 h-9"
              />
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            </div>
          )}

          {suggestionsLoading ? (
            <div className="py-8 text-center text-sm text-muted-foreground">Loading suggestions…</div>
          ) : filteredSuggestions.length === 0 ? (
            <div className="py-8 text-center text-sm text-muted-foreground">
              No suggestions available for this frequency. You can add your own in the next step.
            </div>
          ) : (
            <>
              <div className="flex items-center gap-2 pb-2 border-b">
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-xs h-7"
                  onClick={() => {
                    const all: Record<string, boolean> = {};
                    filteredSuggestions.forEach(s => { all[s.id] = true; });
                    setSelectedSuggestions(prev => ({ ...prev, ...all }));
                  }}
                >
                  Select all
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-xs h-7"
                  onClick={() => setSelectedSuggestions({})}
                >
                  Clear
                </Button>
                <span className="text-xs text-muted-foreground ml-auto">
                  {selectedSuggestionCount} selected
                </span>
              </div>

              <div className="space-y-1">
                {filteredSuggestions.map((item) => (
                  <label
                    key={item.id}
                    className={`flex items-start gap-3 rounded-lg p-2.5 cursor-pointer transition-colors border ${
                      selectedSuggestions[item.id]
                        ? 'border-primary/40 bg-primary/5'
                        : 'border-transparent hover:bg-muted/40'
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={!!selectedSuggestions[item.id]}
                      onChange={(e) => setSelectedSuggestions(prev => ({ ...prev, [item.id]: e.target.checked }))}
                      className="mt-0.5 h-4 w-4 rounded cursor-pointer accent-primary"
                    />
                    <div className="min-w-0 flex-1">
                      <div className="text-sm font-medium flex items-start gap-1.5">
                        {item.risk_level === 'high' && <AlertTriangle className="h-3.5 w-3.5 text-destructive shrink-0 mt-0.5" />}
                        {item.label}
                      </div>
                      {item.hint && (
                        <p className="text-xs text-muted-foreground mt-0.5">{item.hint}</p>
                      )}
                      {item.risk_level && (
                        <Badge className={`text-[10px] mt-1 ${getRiskBadgeClass(item.risk_level)}`}>
                          {item.risk_level.toUpperCase()}
                        </Badge>
                      )}
                    </div>
                  </label>
                ))}
              </div>
            </>
          )}

          <Button onClick={handleAcceptSuggestions} className="w-full gap-2 mt-2">
            {selectedSuggestionCount > 0 ? (
              <>Add {selectedSuggestionCount} & Continue <ArrowRight className="h-4 w-4" /></>
            ) : (
              <>Skip & Continue <ArrowRight className="h-4 w-4" /></>
            )}
          </Button>
        </div>
      )}

      {/* Step 1: Add Custom Items — flat layout */}
      {step === 1 && (
        <div className="space-y-4">
          {selectedItems.length > 0 && (
            <div className="flex items-center gap-2 p-2.5 rounded-lg bg-success/10 border border-success/20">
              <CheckSquare className="h-4 w-4 text-success shrink-0" />
              <span className="text-sm font-medium">{selectedItems.length} item{selectedItems.length !== 1 ? 's' : ''} added so far</span>
            </div>
          )}

          {/* Library button */}
          {equipmentGroup && (
            <CheckLibraryDialog
              trigger={
                <Button className="w-full font-medium" variant="outline">
                  <Library className="w-4 h-4 mr-2" />
                  Browse Check Library
                </Button>
              }
              frequency={frequency as "daily" | "weekly" | "monthly" | "yearly" | "preopening"}
              rideCategoryId={ride.category_id}
              equipmentGroup={equipmentGroup}
              categoryGroupLabel={ride.ride_categories?.category_group}
              onAdd={async (labels: string[]) => {
                const newItems: BuilderItem[] = labels.map((label, i) => ({
                  check_item_text: label,
                  is_required: true,
                  category: 'library',
                  sort_order: selectedItems.length + i,
                  isNew: true,
                }));
                setSelectedItems(prev => [...prev, ...newItems]);
                toast({ title: `${labels.length} item${labels.length > 1 ? 's' : ''} added` });
              }}
            />
          )}

          {/* Custom item input */}
          <div className="space-y-1.5">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Add your own</p>
            <div className="flex gap-2">
              <Input
                value={customItemText}
                onChange={(e) => setCustomItemText(e.target.value)}
                placeholder="e.g., Check hydraulic fluid levels"
                className="bg-background"
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    handleAddCustomItem();
                  }
                }}
              />
              <Button onClick={handleAddCustomItem} disabled={!customItemText.trim()} size="icon" variant="outline" className="shrink-0">
                <Plus className="h-4 w-4" />
              </Button>
            </div>
          </div>

          {/* Item list preview */}
          {selectedItems.length > 0 && (
            <div>
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2">Your items ({selectedItems.length})</p>
              <div className="space-y-1">
                {selectedItems.map((item, index) => (
                  <div key={index} className="flex items-center gap-2 text-sm py-1.5 border-b border-border/50 last:border-0">
                    <CheckSquare className="h-3.5 w-3.5 text-success shrink-0" />
                    <span className="truncate flex-1">{item.check_item_text}</span>
                    <button onClick={() => handleRemoveItem(index)} className="text-muted-foreground hover:text-destructive p-2 -mr-1" aria-label="Remove">
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          <Button onClick={() => setStep(2)} className="w-full gap-2" disabled={selectedItems.length === 0}>
            Review & Save <ArrowRight className="h-4 w-4" />
          </Button>
        </div>
      )}

      {/* Step 2: Review & Save */}
      {step === 2 && (
        <div className="space-y-3">
          {/* Checklist name */}
          <div className="space-y-1.5">
            <Label htmlFor="name" className="text-sm font-medium">Checklist Name</Label>
            <Input
              id="name"
              value={templateName}
              onChange={(e) => setTemplateName(e.target.value)}
              placeholder="e.g., Morning Safety Checks"
              className="h-9"
            />
          </div>

          {/* Final item list */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-semibold">Check Items ({selectedItems.length})</span>
              {!isEditing && (
                <Button variant="ghost" size="sm" className="text-xs h-7" onClick={() => setStep(1)}>
                  <Plus className="h-3 w-3 mr-1" /> Add more
                </Button>
              )}
            </div>

            {selectedItems.length === 0 ? (
              <p className="text-sm text-muted-foreground py-4 text-center">No items yet — go back to add some.</p>
            ) : (
              <div className="space-y-1">
                {selectedItems.map((item, index) => (
                  <div key={index} className="group flex items-center gap-1.5 py-1.5 px-2 rounded-lg border bg-card hover:bg-muted/30 transition-colors">
                    {/* Reorder controls */}
                    <div className="flex flex-col shrink-0 -my-1">
                      <button
                        onClick={() => handleMoveItem(index, 'up')}
                        disabled={index === 0 || editingIndex !== null}
                        className="text-muted-foreground hover:text-foreground active:text-foreground disabled:opacity-20 min-h-[28px] min-w-[40px] flex items-center justify-center rounded-md hover:bg-muted/60 active:bg-muted transition-colors"
                        aria-label="Move up"
                      >
                        <ChevronUp className="h-5 w-5" />
                      </button>
                      <button
                        onClick={() => handleMoveItem(index, 'down')}
                        disabled={index === selectedItems.length - 1 || editingIndex !== null}
                        className="text-muted-foreground hover:text-foreground active:text-foreground disabled:opacity-20 min-h-[28px] min-w-[40px] flex items-center justify-center rounded-md hover:bg-muted/60 active:bg-muted transition-colors"
                        aria-label="Move down"
                      >
                        <ChevronDown className="h-5 w-5" />
                      </button>
                    </div>

                    {/* Item content */}
                    <div className="flex-1 min-w-0">
                      {editingIndex === index ? (
                        <div className="flex gap-1.5 items-center">
                          <Input
                            value={editText}
                            onChange={(e) => setEditText(e.target.value)}
                            className="flex-1 h-8 text-sm"
                            autoFocus
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') handleSaveEdit();
                              if (e.key === 'Escape') handleCancelEdit();
                            }}
                          />
                          <button onClick={handleSaveEdit} className="text-primary p-2" aria-label="Save">
                            <Check className="h-4 w-4" />
                          </button>
                          <button onClick={handleCancelEdit} className="text-muted-foreground p-2" aria-label="Cancel">
                            <X className="h-4 w-4" />
                          </button>
                        </div>
                      ) : (
                        <p className="text-sm leading-snug">{item.check_item_text}</p>
                      )}
                    </div>

                    {/* Actions */}
                    {editingIndex !== index && (
                      <div className="flex items-center shrink-0">
                        <button onClick={() => handleStartEdit(index)} className="text-muted-foreground hover:text-foreground p-2" aria-label="Edit">
                          <Pencil className="h-4 w-4" />
                        </button>
                        <button onClick={() => handleRemoveItem(index)} className="text-muted-foreground hover:text-destructive p-2" aria-label="Remove">
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Add items — compact inline */}
          <div className="flex gap-2 items-center">
            <Input
              value={customItemText}
              onChange={(e) => setCustomItemText(e.target.value)}
              placeholder="Add custom item…"
              className="bg-background h-8 text-sm flex-1"
              onKeyDown={(e) => {
                if (e.key === 'Enter') { e.preventDefault(); handleAddCustomItem(); }
              }}
            />
            <Button onClick={handleAddCustomItem} disabled={!customItemText.trim()} size="sm" variant="outline" className="shrink-0 h-8 px-2.5">
              <Plus className="h-3.5 w-3.5" />
            </Button>
            {equipmentGroup && (
              <CheckLibraryDialog
                trigger={
                  <Button variant="outline" size="sm" className="shrink-0 h-8 px-2.5 gap-1">
                    <Library className="h-3.5 w-3.5" />
                    <span className="hidden sm:inline text-xs">Library</span>
                  </Button>
                }
                frequency={frequency as "daily" | "weekly" | "monthly" | "yearly" | "preopening"}
                rideCategoryId={ride.category_id}
                equipmentGroup={equipmentGroup}
                categoryGroupLabel={ride.ride_categories?.category_group}
                onAdd={async (labels: string[]) => {
                  const newItems: BuilderItem[] = labels.map((label, i) => ({
                    check_item_text: label,
                    is_required: true,
                    category: 'library',
                    sort_order: selectedItems.length + i,
                    isNew: true,
                  }));
                  setSelectedItems(prev => [...prev, ...newItems]);
                  toast({ title: `${labels.length} item${labels.length > 1 ? 's' : ''} added` });
                }}
              />
            )}
          </div>

          {/* Start Notice — collapsed by default */}
          <Collapsible open={startNoticeOpen} onOpenChange={setStartNoticeOpen}>
            <CollapsibleTrigger asChild>
              <button className="flex items-center gap-2 w-full text-sm text-muted-foreground hover:text-foreground transition-colors py-2">
                <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
                <span className="font-medium">Start Notice</span>
                {startNoticeText.trim() && <Badge variant="outline" className="text-[10px] ml-1">Set</Badge>}
                <ChevronDown className={`h-3.5 w-3.5 ml-auto transition-transform ${startNoticeOpen ? 'rotate-180' : ''}`} />
              </button>
            </CollapsibleTrigger>
            <CollapsibleContent className="space-y-3 pt-1 pb-2">
              <p className="text-xs text-muted-foreground">Optional notice shown to staff before this check starts.</p>
              <Textarea
                value={startNoticeText}
                onChange={(e) => {
                  setStartNoticeText(e.target.value);
                  if (!e.target.value.trim()) setStartNoticeRequired(false);
                  else if (!startNoticeRequired) setStartNoticeRequired(true);
                }}
                placeholder="e.g., Ensure PPE is worn. Check ground stability."
                rows={2}
                className="text-sm"
              />
              {startNoticeText.trim() && (
                <div className="flex items-center justify-between gap-2">
                  <Label htmlFor="startNoticeToggle" className="text-xs cursor-pointer">
                    Require acknowledgement
                  </Label>
                  <Switch
                    id="startNoticeToggle"
                    checked={startNoticeRequired}
                    onCheckedChange={setStartNoticeRequired}
                  />
                </div>
              )}
            </CollapsibleContent>
          </Collapsible>

          {/* Save — single action */}
          <Button
            onClick={handleSaveTemplate}
            disabled={loading || selectedItems.length === 0}
            className="w-full gap-2"
          >
            <Save className="h-4 w-4" />
            {loading ? 'Saving…' : isEditing ? 'Save Changes' : 'Save & Start Using'}
          </Button>
        </div>
      )}
    </div>
  );
};

export default TemplateBuilder;
