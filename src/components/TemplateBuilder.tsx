import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { ArrowLeft, Plus, Trash2, GripVertical, Save, Library, Info } from 'lucide-react';
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

type LibraryItem = Tables<'check_item_library'>;

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

const TemplateBuilder = ({ ride, template, frequency = 'daily', onSuccess, onCancel }: TemplateBuilderProps) => {
  const { user } = useAuth();
  const { toast } = useToast();
  const defaultTemplateName = `${frequency.charAt(0).toUpperCase() + frequency.slice(1)} Safety Check`;

  // Background spell-check function - runs without blocking UI
  const spellcheckItems = async (items: Array<{ id: string; check_item_text: string }>) => {
    for (const item of items) {
      try {
        // Call the spellcheck edge function in the background
        const { error } = await supabase.functions.invoke('spellcheck-items', {
          body: { 
            item_id: item.id, 
            text: item.check_item_text,
            table: 'daily_check_template_items'
          }
        });
        
        if (error) {
          console.log('Spellcheck skipped for item:', item.id, error);
        }
      } catch (e) {
        // Silently fail - this is a background enhancement
        console.log('Spellcheck failed for item:', item.id);
      }
    }
  };
  const [templateName, setTemplateName] = useState(template?.template_name || defaultTemplateName);
  const [selectedItems, setSelectedItems] = useState<BuilderItem[]>([]);
  const [customItemText, setCustomItemText] = useState('');
  const [loading, setLoading] = useState(false);

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

  const handleAddCustomItem = () => {
    if (!customItemText.trim()) {
      toast({
        title: "Missing information",
        description: "Please enter a check item",
        variant: "destructive",
      });
      return;
    }

    const newItem: BuilderItem = {
      check_item_text: customItemText.trim(),
      is_required: true,
      category: 'custom',
      sort_order: selectedItems.length,
      isNew: true,
    };

    setSelectedItems(prev => [...prev, newItem]);
    setCustomItemText('');
    toast({
      title: "Item added",
      description: "Check item added to your template"
    });
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

  const handleSaveTemplate = async () => {
    if (!templateName.trim()) {
      toast({
        title: "Missing information",
        description: "Please enter a template name",
        variant: "destructive",
      });
      return;
    }

    if (selectedItems.length === 0) {
      toast({
        title: "No check items",
        description: "Please add at least one check item to the template",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);

    try {
      let templateId = template?.id;

      if (template) {
        // Update existing template
        const { error: updateError } = await supabase
          .from('daily_check_templates')
          .update({ template_name: templateName.trim() })
          .eq('id', template.id);

        if (updateError) throw updateError;

        // Delete existing items
        const { error: deleteError } = await supabase
          .from('daily_check_template_items')
          .delete()
          .eq('template_id', template.id);

        if (deleteError) throw deleteError;
      } else {
        // Create new template - set as active by default
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

      // Insert template items
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
        title: template ? "Template updated" : "Template created",
        description: `Your ${frequency} check template is ready to use`,
      });

      // Trigger background spell-check for custom items (non-blocking)
      if (insertedItems && insertedItems.length > 0) {
        // Only spell-check items that were custom-added (not from library)
        const customItems = insertedItems.filter((item, index) => 
          selectedItems[index]?.isNew === true
        );
        
        if (customItems.length > 0) {
          // Run in background - don't await
          spellcheckItems(customItems);
        }
      }

      onSuccess();
    } catch (error: any) {
      console.error('Error saving template:', error);
      toast({
        title: "Error saving template",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="sm" onClick={onCancel}>
          <ArrowLeft className="h-4 w-4 mr-1" />
          Back
        </Button>
        <div>
          <h3 className="font-semibold">
            {template ? 'Edit' : 'Build'} {frequency.charAt(0).toUpperCase() + frequency.slice(1)} Check Template
          </h3>
          <p className="text-sm text-muted-foreground">{ride.ride_name}</p>
        </div>
      </div>

      {/* Instructions */}
      <Alert>
        <Info className="h-4 w-4" />
        <AlertDescription>
          Add check items that you want to verify each {frequency === 'daily' ? 'day' : frequency === 'monthly' ? 'month' : 'year'}. 
          You can pick from our library or add your own custom checks specific to your equipment.
        </AlertDescription>
      </Alert>

      {/* Template Name */}
      <Card>
        <CardContent className="pt-4">
          <div className="space-y-2">
            <Label htmlFor="name">Template Name</Label>
            <Input
              id="name"
              value={templateName}
              onChange={(e) => setTemplateName(e.target.value)}
              placeholder="e.g., Morning Safety Checks"
            />
          </div>
        </CardContent>
      </Card>

      {/* Add Items Section */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Add Check Items</CardTitle>
          <CardDescription>
            Add items from our library or type your own custom checks
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Quick Add from Library */}
          <CheckLibraryDialog
            trigger={
              <Button variant="outline" className="w-full">
                <Library className="w-4 h-4 mr-2" />
                Browse Library Items
              </Button>
            }
            frequency={frequency as "daily" | "monthly" | "yearly"}
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
              toast({
                title: `${labels.length} item${labels.length > 1 ? 's' : ''} added`,
                description: "Items added to your template"
              });
            }}
          />

          {/* Add Your Own */}
          <div className="space-y-2">
            <Label htmlFor="custom-item" className="text-sm font-medium">
              Add Your Own Check Item
            </Label>
            <div className="flex gap-2">
              <Input
                id="custom-item"
                value={customItemText}
                onChange={(e) => setCustomItemText(e.target.value)}
                placeholder="e.g., Check hydraulic fluid levels"
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    handleAddCustomItem();
                  }
                }}
              />
              <Button onClick={handleAddCustomItem} disabled={!customItemText.trim()}>
                <Plus className="h-4 w-4" />
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              Press Enter or click + to add. Include any checks specific to your equipment that aren't in the library.
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Selected Items */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">
            Your Check Items ({selectedItems.length})
          </CardTitle>
          {selectedItems.length === 0 && (
            <CardDescription>
              No items added yet. Use the options above to add check items.
            </CardDescription>
          )}
        </CardHeader>
        {selectedItems.length > 0 && (
          <CardContent>
            <div className="space-y-2">
              {selectedItems.map((item, index) => (
                <div key={index} className="flex items-center gap-2 p-2 border rounded-lg bg-muted/30">
                  <div className="flex flex-col">
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => handleMoveItem(index, 'up')}
                      disabled={index === 0}
                      className="h-5 w-5 p-0"
                    >
                      ↑
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => handleMoveItem(index, 'down')}
                      disabled={index === selectedItems.length - 1}
                      className="h-5 w-5 p-0"
                    >
                      ↓
                    </Button>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm truncate">{item.check_item_text}</p>
                    <Badge variant="outline" className="text-xs mt-1">
                      {item.category === 'custom' ? 'Custom' : item.category === 'library' ? 'Library' : item.category}
                    </Badge>
                  </div>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => handleRemoveItem(index)}
                    className="text-destructive hover:text-destructive"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              ))}
            </div>
          </CardContent>
        )}
      </Card>

      {/* Save Button */}
      <div className="flex gap-2">
        <Button 
          onClick={handleSaveTemplate} 
          disabled={loading || selectedItems.length === 0} 
          className="flex-1"
        >
          <Save className="h-4 w-4 mr-2" />
          {loading ? 'Saving...' : template ? 'Save Changes' : 'Save & Start Using'}
        </Button>
        <Button variant="outline" onClick={onCancel}>
          Cancel
        </Button>
      </div>
    </div>
  );
};

export default TemplateBuilder;
