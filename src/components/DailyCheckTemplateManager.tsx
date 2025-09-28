import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { Plus, Settings, Trash2, Edit, Copy, CheckSquare, Wrench } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { Tables } from '@/integrations/supabase/types';
import TemplateBuilder from './TemplateBuilder';

type Ride = Tables<'rides'> & {
  ride_categories: {
    name: string;
    description: string | null;
  };
};

type Template = Tables<'daily_check_templates'> & {
  daily_check_template_items: Tables<'daily_check_template_items'>[];
};

interface DailyCheckTemplateManagerProps {
  ride: Ride;
}

const DailyCheckTemplateManager = ({ ride }: DailyCheckTemplateManagerProps) => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [templates, setTemplates] = useState<Template[]>([]);
  const [loading, setLoading] = useState(true);
  const [showBuilder, setShowBuilder] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<Template | null>(null);

  useEffect(() => {
    if (user) {
      loadTemplates();
    }
  }, [user, ride.id]);

  const loadTemplates = async () => {
    try {
      const { data, error } = await supabase
        .from('daily_check_templates')
        .select(`
          *,
          daily_check_template_items (*)
        `)
        .eq('user_id', user?.id)
        .eq('ride_id', ride.id)
        .eq('check_frequency', 'daily')
        .order('created_at', { ascending: false });

      if (error) {
        throw error;
      }

      setTemplates(data as Template[]);
    } catch (error: any) {
      console.error('Error loading templates:', error);
      toast({
        title: "Error loading templates",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSetActive = async (templateId: string) => {
    try {
      // Set all templates inactive first
      await supabase
        .from('daily_check_templates')
        .update({ is_active: false })
        .eq('user_id', user?.id)
        .eq('ride_id', ride.id);

      // Set selected template active
      const { error } = await supabase
        .from('daily_check_templates')
        .update({ is_active: true })
        .eq('id', templateId);

      if (error) {
        throw error;
      }

      toast({
        title: "Template activated",
        description: "This template is now active for daily checks",
      });

      loadTemplates();
    } catch (error: any) {
      console.error('Error setting active template:', error);
      toast({
        title: "Error activating template",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const handleDuplicateTemplate = async (template: Template) => {
    try {
      // Create new template
      const { data: newTemplate, error: templateError } = await supabase
        .from('daily_check_templates')
        .insert({
          user_id: user?.id,
          ride_id: ride.id,
          template_name: `${template.template_name} (Copy)`,
          is_active: false,
        })
        .select()
        .single();

      if (templateError) {
        throw templateError;
      }

      // Copy template items
      const itemsToInsert = template.daily_check_template_items.map(item => ({
        template_id: newTemplate.id,
        check_item_text: item.check_item_text,
        is_required: item.is_required,
        category: item.category,
        sort_order: item.sort_order,
      }));

      const { error: itemsError } = await supabase
        .from('daily_check_template_items')
        .insert(itemsToInsert);

      if (itemsError) {
        throw itemsError;
      }

      toast({
        title: "Template duplicated",
        description: "Template has been successfully duplicated",
      });

      loadTemplates();
    } catch (error: any) {
      console.error('Error duplicating template:', error);
      toast({
        title: "Error duplicating template",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const handleDeleteTemplate = async (templateId: string) => {
    try {
      const { error } = await supabase
        .from('daily_check_templates')
        .delete()
        .eq('id', templateId);

      if (error) {
        throw error;
      }

      toast({
        title: "Template deleted",
        description: "Template has been successfully deleted",
      });

      loadTemplates();
    } catch (error: any) {
      console.error('Error deleting template:', error);
      toast({
        title: "Error deleting template",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const handleTemplateSuccess = () => {
    setShowBuilder(false);
    setEditingTemplate(null);
    loadTemplates();
  };

  if (showBuilder) {
    return (
        <TemplateBuilder
          ride={ride}
          template={editingTemplate}
          frequency="daily"
          onSuccess={handleTemplateSuccess}
          onCancel={() => {
            setShowBuilder(false);
            setEditingTemplate(null);
          }}
        />
    );
  }

  if (loading) {
    return (
      <Card>
        <CardContent className="pt-6">
          <div className="text-center py-4">
            <Settings className="mx-auto h-8 w-8 text-muted-foreground animate-spin" />
            <p className="text-muted-foreground mt-2">Loading templates...</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="space-y-2">
          <h3 className="text-xl font-semibold">Daily Check Templates</h3>
          <p className="text-muted-foreground">
            Manage custom daily check templates for {ride.ride_name}
          </p>
        </div>
        <Button onClick={() => setShowBuilder(true)} className="flex items-center space-x-2">
          <Plus className="h-4 w-4" />
          <span>Create Template</span>
        </Button>
      </div>

      {templates.length === 0 ? (
        <Card>
          <CardContent className="pt-6">
            <div className="text-center py-8">
              <CheckSquare className="mx-auto h-16 w-16 text-muted-foreground" />
              <h3 className="text-lg font-semibold mt-4">No templates created</h3>
              <p className="text-muted-foreground mb-4">
                Create your first daily check template by selecting from our pre-built components
                or adding your own custom check items.
              </p>
              <Button onClick={() => setShowBuilder(true)} className="flex items-center space-x-2">
                <Plus className="h-4 w-4" />
                <span>Create First Template</span>
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {templates.map((template) => (
            <Card key={template.id} className={template.is_active ? "border-primary" : ""}>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    <CardTitle className="flex items-center space-x-2">
                      <Wrench className="h-5 w-5" />
                      <span>{template.template_name}</span>
                    </CardTitle>
                    {template.is_active && (
                      <Badge variant="default">Active</Badge>
                    )}
                  </div>
                  <div className="flex items-center space-x-2">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        setEditingTemplate(template);
                        setShowBuilder(true);
                      }}
                    >
                      <Edit className="h-4 w-4" />
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleDuplicateTemplate(template)}
                    >
                      <Copy className="h-4 w-4" />
                    </Button>
                    {!template.is_active ? (
                      <Button
                        size="sm"
                        onClick={() => handleSetActive(template.id)}
                      >
                        Set Active
                      </Button>
                    ) : (
                      <Badge variant="secondary">In Use</Badge>
                    )}
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button size="sm" variant="outline">
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Delete Template</AlertDialogTitle>
                          <AlertDialogDescription>
                            Are you sure you want to delete "{template.template_name}"? 
                            This action cannot be undone and will affect any existing daily check records.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancel</AlertDialogCancel>
                          <AlertDialogAction
                            onClick={() => handleDeleteTemplate(template.id)}
                            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                          >
                            Delete
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </div>
                </div>
                <CardDescription>
                  {template.daily_check_template_items.length} check items • 
                  Created {new Date(template.created_at).toLocaleDateString()}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  <h4 className="font-medium text-sm">Check Items Preview:</h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                    {template.daily_check_template_items
                      .sort((a, b) => a.sort_order - b.sort_order)
                      .slice(0, 4)
                      .map((item) => (
                        <div key={item.id} className="text-xs p-2 bg-muted rounded flex items-center space-x-2">
                          <CheckSquare className="h-3 w-3 text-muted-foreground" />
                          <span className="truncate">{item.check_item_text}</span>
                          {item.is_required && <span className="text-red-500">*</span>}
                        </div>
                      ))}
                  </div>
                  {template.daily_check_template_items.length > 4 && (
                    <p className="text-xs text-muted-foreground">
                      +{template.daily_check_template_items.length - 4} more items
                    </p>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
};

export default DailyCheckTemplateManager;