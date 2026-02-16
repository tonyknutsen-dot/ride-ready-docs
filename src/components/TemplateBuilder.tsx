import { useState, useEffect, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { ArrowLeft, ArrowRight, Plus, Trash2, Save, Library, Pencil, Check, X, Sparkles, CheckSquare, ListChecks, AlertTriangle, Search } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { Tables } from '@/integrations/supabase/types';
import CheckLibraryDialog from './CheckLibraryDialog';

type Ride = Tables<'rides'> & {
  ride_categories: {
    name: string;
    description: string | null;
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

const TemplateBuilder = ({ ride, template, frequency = 'daily', onSuccess, onCancel }: TemplateBuilderProps) => {
  const { user } = useAuth();
  const { toast } = useToast();
  const freqLabel = frequency === 'preopening' ? 'Pre-Opening' : frequency.charAt(0).toUpperCase() + frequency.slice(1);
  const defaultTemplateName = `${freqLabel} Safety Check`;
  const isEditing = !!template;

  // Wizard state
  const [step, setStep] = useState(isEditing ? 2 : 0); // Skip to review if editing
  const [templateName, setTemplateName] = useState(template?.template_name || defaultTemplateName);
  const [selectedItems, setSelectedItems] = useState<BuilderItem[]>([]);
  const [customItemText, setCustomItemText] = useState('');
  const [loading, setLoading] = useState(false);
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [editText, setEditText] = useState('');

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
      let query = supabase
        .from('check_library_items')
        .select('id,label,hint,risk_level,ride_category_id')
        .eq('frequency', frequency as "daily" | "weekly" | "monthly" | "yearly" | "preopening")
        .eq('is_active', true)
        .order('sort_index', { ascending: true });

      if (cat) {
        query = query.or(`ride_category_id.is.null,ride_category_id.eq.${cat}`);
      } else {
        query = query.is('ride_category_id', null);
      }

      const { data, error } = await query;
      if (error) throw error;

      // Sort: category-specific first, then generic
      const specific = (data || []).filter(r => r.ride_category_id === cat);
      const generic = (data || []).filter(r => !r.ride_category_id);
      setSuggestions([...specific, ...generic]);

      // Auto-select ride-specific items
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
          .update({ template_name: templateName.trim() })
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
          })
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
          <p className="text-sm text-muted-foreground truncate">{ride.ride_name}</p>
        </div>
      </div>

      {/* Progress stepper */}
      <div className="space-y-2">
        <Progress value={progressValue} className="h-1.5" />
        <div className="flex justify-between">
          {STEPS.map((s, i) => {
            const Icon = s.icon;
            const isActive = i === step;
            const isDone = i < step;
            return (
              <button
                key={i}
                onClick={() => {
                  if (isDone && !isEditing) setStep(i);
                }}
                disabled={i > step || isEditing}
                className={`flex items-center gap-1.5 text-xs font-medium transition-colors ${
                  isActive ? 'text-primary' : isDone ? 'text-success' : 'text-muted-foreground'
                } ${isDone && !isEditing ? 'cursor-pointer hover:text-primary' : ''}`}
              >
                <div className={`h-6 w-6 rounded-full flex items-center justify-center text-xs font-bold ${
                  isActive ? 'bg-primary text-primary-foreground' : isDone ? 'bg-success text-success-foreground' : 'bg-muted text-muted-foreground'
                }`}>
                  {isDone ? <Check className="h-3.5 w-3.5" /> : i + 1}
                </div>
                <span className="hidden sm:inline">{s.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Step 0: Smart Suggestions */}
      {step === 0 && (
        <div className="space-y-4">
          <Card className="border-primary/20">
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-primary" />
                Suggested Check Items
              </CardTitle>
              <CardDescription>
                We've selected items relevant to your {ride.ride_categories?.name || 'equipment'}. Tick the ones you want.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
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
                <div className="space-y-1.5 max-h-[50vh] overflow-y-auto">
                  {/* Select all / none */}
                  <div className="flex items-center gap-2 pb-2 border-b mb-2">
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

                  {filteredSuggestions.map((item) => (
                    <label
                      key={item.id}
                      className={`flex items-start gap-3 rounded-lg p-3 cursor-pointer transition-colors border ${
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
                          {item.risk_level === 'high' && <AlertTriangle className="h-3.5 w-3.5 text-red-600 shrink-0 mt-0.5" />}
                          {item.label}
                        </div>
                        {item.hint && (
                          <p className="text-xs text-muted-foreground mt-0.5">{item.hint}</p>
                        )}
                        <div className="flex gap-1.5 mt-1.5">
                          {item.risk_level && (
                            <Badge className={`text-[10px] ${getRiskBadgeClass(item.risk_level)}`}>
                              {item.risk_level.toUpperCase()}
                            </Badge>
                          )}
                          {item.ride_category_id && (
                            <Badge variant="default" className="text-[10px]">For your equipment</Badge>
                          )}
                        </div>
                      </div>
                    </label>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          <div className="flex gap-2">
            <Button onClick={handleAcceptSuggestions} className="flex-1 gap-2">
              {selectedSuggestionCount > 0 ? (
                <>Add {selectedSuggestionCount} & Continue <ArrowRight className="h-4 w-4" /></>
              ) : (
                <>Skip & Continue <ArrowRight className="h-4 w-4" /></>
              )}
            </Button>
          </div>
        </div>
      )}

      {/* Step 1: Add Custom Items */}
      {step === 1 && (
        <div className="space-y-4">
          {selectedItems.length > 0 && (
            <div className="flex items-center gap-2 p-3 rounded-lg bg-success/10 border border-success/20">
              <CheckSquare className="h-4 w-4 text-success shrink-0" />
              <span className="text-sm font-medium">{selectedItems.length} item{selectedItems.length !== 1 ? 's' : ''} added so far</span>
            </div>
          )}

          <Card className="border-primary/20 bg-primary/5">
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Add More Items</CardTitle>
              <CardDescription>
                Browse our library or type your own custom checks
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <CheckLibraryDialog
                trigger={
                  <Button className="w-full font-medium" variant="outline">
                    <Library className="w-4 h-4 mr-2" />
                    Browse Full Library
                  </Button>
                }
                frequency={frequency as "daily" | "weekly" | "monthly" | "yearly" | "preopening"}
                rideCategoryId={ride.category_id}
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

              <div className="relative">
                <div className="absolute inset-0 flex items-center">
                  <span className="w-full border-t" />
                </div>
                <div className="relative flex justify-center text-xs uppercase">
                  <span className="bg-primary/5 px-2 text-muted-foreground">or add your own</span>
                </div>
              </div>

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
              <p className="text-xs text-muted-foreground">Press Enter to add.</p>
            </CardContent>
          </Card>

          {/* Quick preview of items */}
          {selectedItems.length > 0 && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">Your Items ({selectedItems.length})</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-1">
                  {selectedItems.map((item, index) => (
                    <div key={index} className="flex items-center gap-2 text-sm py-1.5 border-b last:border-0">
                      <CheckSquare className="h-3.5 w-3.5 text-success shrink-0" />
                      <span className="truncate flex-1">{item.check_item_text}</span>
                      <Button size="sm" variant="ghost" className="h-6 w-6 p-0 text-destructive" onClick={() => handleRemoveItem(index)}>
                        <X className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          <Button onClick={() => setStep(2)} className="w-full gap-2" disabled={selectedItems.length === 0}>
            Review & Save <ArrowRight className="h-4 w-4" />
          </Button>
        </div>
      )}

      {/* Step 2: Review & Save */}
      {step === 2 && (
        <div className="space-y-4">
          {/* Checklist name */}
          <Card>
            <CardContent className="pt-4">
              <div className="space-y-2">
                <Label htmlFor="name" className="text-sm font-medium">Checklist Name</Label>
                <Input
                  id="name"
                  value={templateName}
                  onChange={(e) => setTemplateName(e.target.value)}
                  placeholder="e.g., Morning Safety Checks"
                />
              </div>
            </CardContent>
          </Card>

          {/* Final item list */}
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base">
                  Check Items ({selectedItems.length})
                </CardTitle>
                {!isEditing && (
                  <Button variant="ghost" size="sm" className="text-xs" onClick={() => setStep(1)}>
                    <Plus className="h-3.5 w-3.5 mr-1" /> Add more
                  </Button>
                )}
              </div>
              {selectedItems.length === 0 && (
                <CardDescription>No items yet — go back to add some.</CardDescription>
              )}
            </CardHeader>
            {selectedItems.length > 0 && (
              <CardContent>
                <div className="space-y-2">
                  {selectedItems.map((item, index) => (
                    <div key={index} className="flex items-center gap-2 p-2.5 border rounded-lg bg-muted/30">
                      <div className="flex flex-col gap-0.5">
                        <Button
                          size="sm" variant="ghost"
                          onClick={() => handleMoveItem(index, 'up')}
                          disabled={index === 0 || editingIndex !== null}
                          className="h-5 w-5 p-0 text-xs"
                        >↑</Button>
                        <Button
                          size="sm" variant="ghost"
                          onClick={() => handleMoveItem(index, 'down')}
                          disabled={index === selectedItems.length - 1 || editingIndex !== null}
                          className="h-5 w-5 p-0 text-xs"
                        >↓</Button>
                      </div>
                      <div className="flex-1 min-w-0">
                        {editingIndex === index ? (
                          <div className="flex gap-2 items-center">
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
                            <Button size="sm" variant="ghost" onClick={handleSaveEdit} className="h-7 w-7 p-0 text-success">
                              <Check className="h-4 w-4" />
                            </Button>
                            <Button size="sm" variant="ghost" onClick={handleCancelEdit} className="h-7 w-7 p-0">
                              <X className="h-4 w-4" />
                            </Button>
                          </div>
                        ) : (
                          <>
                            <p className="text-sm truncate">{item.check_item_text}</p>
                            <Badge variant="outline" className="text-[10px] mt-1">
                              {item.category === 'custom' ? 'Custom' : item.category === 'library' ? 'Library' : item.category}
                            </Badge>
                          </>
                        )}
                      </div>
                      {editingIndex !== index && (
                        <>
                          <Button size="sm" variant="ghost" onClick={() => handleStartEdit(index)} className="text-muted-foreground hover:text-foreground h-8 w-8 p-0">
                            <Pencil className="h-3.5 w-3.5" />
                          </Button>
                          <Button size="sm" variant="ghost" onClick={() => handleRemoveItem(index)} className="text-destructive hover:text-destructive h-8 w-8 p-0">
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </>
                      )}
                    </div>
                  ))}
                </div>
              </CardContent>
            )}
          </Card>

          {/* Add items on review step too */}
          <Card className="border-dashed">
            <CardContent className="pt-4 space-y-3">
              <div className="flex gap-2">
                <Input
                  value={customItemText}
                  onChange={(e) => setCustomItemText(e.target.value)}
                  placeholder="Add another check item…"
                  className="bg-background"
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') { e.preventDefault(); handleAddCustomItem(); }
                  }}
                />
                <Button onClick={handleAddCustomItem} disabled={!customItemText.trim()} size="icon" variant="outline" className="shrink-0">
                  <Plus className="h-4 w-4" />
                </Button>
              </div>
              <CheckLibraryDialog
                trigger={
                  <Button variant="ghost" size="sm" className="w-full text-xs">
                    <Library className="w-3.5 h-3.5 mr-1.5" />
                    Browse Library
                  </Button>
                }
                frequency={frequency as "daily" | "weekly" | "monthly" | "yearly" | "preopening"}
                rideCategoryId={ride.category_id}
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
            </CardContent>
          </Card>

          {/* Save */}
          <div className="flex gap-2">
            <Button
              onClick={handleSaveTemplate}
              disabled={loading || selectedItems.length === 0}
              className="flex-1 gap-2"
            >
              <Save className="h-4 w-4" />
              {loading ? 'Saving…' : isEditing ? 'Save Changes' : 'Save & Start Using'}
            </Button>
            <Button variant="outline" onClick={onCancel}>Cancel</Button>
          </div>
        </div>
      )}
    </div>
  );
};

export default TemplateBuilder;
