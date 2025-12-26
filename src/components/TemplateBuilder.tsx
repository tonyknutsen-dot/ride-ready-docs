import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ArrowLeft, Plus, Trash2, GripVertical, Save, Library, Edit3, CheckSquare } from 'lucide-react';
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
type TemplateItem = Tables<'daily_check_template_items'>;

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
  const [templateName, setTemplateName] = useState(template?.template_name || '');
  const [libraryItems, setLibraryItems] = useState<LibraryItem[]>([]);
  const [selectedItems, setSelectedItems] = useState<BuilderItem[]>([]);
  const [customItemText, setCustomItemText] = useState('');
  const [customItemRequired, setCustomItemRequired] = useState(true);
  const [loading, setLoading] = useState(false);
  const [libraryLoading, setLibraryLoading] = useState(true);

  useEffect(() => {
    loadLibraryItems();
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

  const loadLibraryItems = async () => {
    try {
      const { data, error } = await supabase
        .from('check_item_library')
        .select('*')
        .order('category', { ascending: true })
        .order('sort_order', { ascending: true });

      if (error) {
        throw error;
      }

      setLibraryItems(data);
    } catch (error: any) {
      console.error('Error loading library items:', error);
      toast({
        title: "Error loading check items",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLibraryLoading(false);
    }
  };

  const getCategoryItems = (category: string) => {
    return libraryItems.filter(item => 
      item.category === category || 
      (category === 'ride_specific' && item.category === getRideCategoryKey())
    );
  };

  const getRideCategoryKey = () => {
    return ride.ride_categories.name.toLowerCase().replace(/\s+/g, '_');
  };

  const handleAddLibraryItem = (libraryItem: LibraryItem) => {
    // Check if item already added
    if (selectedItems.some(item => item.check_item_text === libraryItem.check_item_text)) {
      toast({
        title: "Item already added",
        description: "This check item is already in your template",
        variant: "destructive",
      });
      return;
    }

    const newItem: BuilderItem = {
      check_item_text: libraryItem.check_item_text,
      is_required: libraryItem.is_required,
      category: libraryItem.category,
      sort_order: selectedItems.length,
      isNew: true,
    };

    setSelectedItems(prev => [...prev, newItem]);
  };

  const handleAddCustomItem = () => {
    if (!customItemText.trim()) {
      toast({
        title: "Missing information",
        description: "Please enter check item text",
        variant: "destructive",
      });
      return;
    }

    const newItem: BuilderItem = {
      check_item_text: customItemText.trim(),
      is_required: customItemRequired,
      category: 'custom',
      sort_order: selectedItems.length,
      isNew: true,
    };

    setSelectedItems(prev => [...prev, newItem]);
    setCustomItemText('');
    setCustomItemRequired(true);
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

  const handleToggleRequired = (index: number) => {
    setSelectedItems(prev => prev.map((item, i) => 
      i === index ? { ...item, is_required: !item.is_required } : item
    ));
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
        // Create new template
        const { data: newTemplate, error: createError } = await supabase
          .from('daily_check_templates')
          .insert({
            user_id: user?.id,
            ride_id: ride.id,
            template_name: templateName.trim(),
            check_frequency: frequency,
            template_type: frequency,
            is_active: false,
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

      const { error: itemsError } = await supabase
        .from('daily_check_template_items')
        .insert(itemsToInsert);

      if (itemsError) throw itemsError;

      toast({
        title: template ? "Template updated" : "Template created",
        description: `Template "${templateName}" has been ${template ? 'updated' : 'created'} successfully`,
      });

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
    <div className="space-y-6">
      <div className="flex items-center space-x-4">
        <Button variant="ghost" onClick={onCancel} className="flex items-center space-x-2">
          <ArrowLeft className="h-4 w-4" />
          <span>Back to Templates</span>
        </Button>
        <div className="flex-1">
          <h3 className="text-xl font-semibold">
            {template ? 'Edit' : 'Create'} Daily Check Template
          </h3>
          <p className="text-muted-foreground">
            Build a custom template for {ride.ride_name} ({ride.ride_categories.name})
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Template Builder */}
        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Template Details</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
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

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <Edit3 className="h-5 w-5" />
                <span>Selected Check Items ({selectedItems.length})</span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              {selectedItems.length === 0 ? (
                <p className="text-muted-foreground text-center py-4">
                  No check items added yet. Select from library or add custom items.
                </p>
              ) : (
                <div className="space-y-2">
                  {selectedItems.map((item, index) => (
                    <div key={index} className="flex items-center space-x-2 p-2 border rounded">
                      <div className="flex flex-col space-y-1">
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => handleMoveItem(index, 'up')}
                          disabled={index === 0}
                          className="h-4 w-4 p-0"
                        >
                          ↑
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => handleMoveItem(index, 'down')}
                          disabled={index === selectedItems.length - 1}
                          className="h-4 w-4 p-0"
                        >
                          ↓
                        </Button>
                      </div>
                      <GripVertical className="h-4 w-4 text-muted-foreground" />
                      <div className="flex-1">
                        <p className="text-sm font-medium">{item.check_item_text}</p>
                        <div className="flex items-center space-x-2 mt-1">
                          <Badge variant={item.category === 'custom' ? 'secondary' : 'outline'} className="text-xs">
                            {item.category === 'custom' ? 'Custom' : item.category}
                          </Badge>
                          <Checkbox
                            checked={item.is_required}
                            onCheckedChange={() => handleToggleRequired(index)}
                          />
                          <Label className="text-xs">Required</Label>
                        </div>
                      </div>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => handleRemoveItem(index)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          <div className="flex space-x-2">
            <Button onClick={handleSaveTemplate} disabled={loading} className="flex-1">
              <Save className="h-4 w-4 mr-2" />
              {loading ? 'Saving...' : template ? 'Update Template' : 'Create Template'}
            </Button>
            <Button variant="outline" onClick={onCancel}>
              Cancel
            </Button>
          </div>
        </div>

        {/* Item Library */}
        <div className="space-y-4">
          {/* Bulk Add from Enhanced Library */}
          <Card className="border-primary/20 bg-primary/5">
            <CardHeader>
              <CardTitle className="text-sm flex items-center gap-2">
                <CheckSquare className="h-4 w-4" />
                Quick Add: Bulk Select from Library
              </CardTitle>
              <CardDescription className="text-xs">
                Select multiple pre-built check items at once, including high-risk and ride-specific items
              </CardDescription>
            </CardHeader>
            <CardContent>
              <CheckLibraryDialog
                trigger={
                  <Button className="w-full">
                    <Library className="w-4 h-4 mr-2" />
                    Browse & Add Multiple Items
                  </Button>
                }
                frequency={frequency as "daily" | "monthly" | "yearly"}
                rideCategoryId={ride.category_id}
                onAdd={async (labels: string[]) => {
                  // Add all selected items to the template
                  const newItems: BuilderItem[] = labels.map((label, i) => ({
                    check_item_text: label,
                    is_required: true,
                    category: 'library',
                    sort_order: selectedItems.length + i,
                    isNew: true,
                  }));
                  setSelectedItems(prev => [...prev, ...newItems]);
                }}
              />
            </CardContent>
          </Card>

          <Tabs defaultValue="general" className="space-y-4">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="general">General</TabsTrigger>
              <TabsTrigger value="ride_specific">Ride Specific</TabsTrigger>
              <TabsTrigger value="custom">Custom</TabsTrigger>
            </TabsList>

            <TabsContent value="general">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center space-x-2">
                    <Library className="h-5 w-5" />
                    <span>General Safety Checks</span>
                  </CardTitle>
                  <CardDescription>
                    Standard safety checks that apply to all ride types
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {libraryLoading ? (
                    <p className="text-muted-foreground">Loading check items...</p>
                  ) : (
                    <div className="space-y-2">
                      {getCategoryItems('general').map((item) => (
                        <div key={item.id} className="flex items-center justify-between p-2 border rounded">
                          <div className="flex-1">
                            <p className="text-sm font-medium">{item.check_item_text}</p>
                            <p className="text-xs text-muted-foreground">{item.description}</p>
                            <div className="flex items-center space-x-1 mt-1">
                              <Badge variant="outline" className="text-xs">
                                {item.is_required ? 'Required' : 'Optional'}
                              </Badge>
                            </div>
                          </div>
                          <Button
                            size="sm"
                            onClick={() => handleAddLibraryItem(item)}
                            disabled={selectedItems.some(selected => selected.check_item_text === item.check_item_text)}
                          >
                            <Plus className="h-4 w-4" />
                          </Button>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="ride_specific">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center space-x-2">
                    <Library className="h-5 w-5" />
                    <span>{ride.ride_categories.name} Specific Checks</span>
                  </CardTitle>
                  <CardDescription>
                    Safety checks specific to {ride.ride_categories.name} rides
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {libraryLoading ? (
                    <p className="text-muted-foreground">Loading check items...</p>
                  ) : (
                    <div className="space-y-2">
                      {getCategoryItems('ride_specific').map((item) => (
                        <div key={item.id} className="flex items-center justify-between p-2 border rounded">
                          <div className="flex-1">
                            <p className="text-sm font-medium">{item.check_item_text}</p>
                            <p className="text-xs text-muted-foreground">{item.description}</p>
                            <div className="flex items-center space-x-1 mt-1">
                              <Badge variant="outline" className="text-xs">
                                {item.is_required ? 'Required' : 'Optional'}
                              </Badge>
                            </div>
                          </div>
                          <Button
                            size="sm"
                            onClick={() => handleAddLibraryItem(item)}
                            disabled={selectedItems.some(selected => selected.check_item_text === item.check_item_text)}
                          >
                            <Plus className="h-4 w-4" />
                          </Button>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="custom">
              <Card>
                <CardHeader>
                  <CardTitle>Add Custom Check Item</CardTitle>
                  <CardDescription>
                    Create your own custom check items specific to your needs
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <Label htmlFor="custom-text">Check Item Text</Label>
                    <Textarea
                      id="custom-text"
                      value={customItemText}
                      onChange={(e) => setCustomItemText(e.target.value)}
                      placeholder="e.g., Check oil levels in hydraulic system"
                      rows={2}
                    />
                  </div>
                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="custom-required"
                      checked={customItemRequired}
                      onCheckedChange={(checked) => setCustomItemRequired(checked === true)}
                    />
                    <Label htmlFor="custom-required">Required check item</Label>
                  </div>
                  <Button onClick={handleAddCustomItem} disabled={!customItemText.trim()}>
                    <Plus className="h-4 w-4 mr-2" />
                    Add Custom Item
                  </Button>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </div>
  );
};

export default TemplateBuilder;