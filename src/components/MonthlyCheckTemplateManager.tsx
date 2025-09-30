import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Calendar, Plus, Edit, Copy, Trash2, CheckCircle, AlertCircle } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
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

interface MonthlyCheckTemplateManagerProps {
  ride: Ride;
}

const MonthlyCheckTemplateManager = ({ ride }: MonthlyCheckTemplateManagerProps) => {
  const [templates, setTemplates] = useState<Template[]>([]);
  const [loading, setLoading] = useState(true);
  const [showBuilder, setShowBuilder] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<Template | null>(null);
  const { toast } = useToast();
  const { user } = useAuth();

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
        .eq('check_frequency', 'monthly')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setTemplates(data || []);
    } catch (error) {
      console.error('Error loading monthly templates:', error);
      toast({
        title: "Error",
        description: "Failed to load monthly check templates",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSetActive = async (templateId: string) => {
    try {
      // Set all templates to inactive first
      await supabase
        .from('daily_check_templates')
        .update({ is_active: false })
        .eq('user_id', user?.id)
        .eq('ride_id', ride.id)
        .eq('check_frequency', 'monthly');

      // Set the selected template to active
      const { error } = await supabase
        .from('daily_check_templates')
        .update({ is_active: true })
        .eq('id', templateId);

      if (error) throw error;

      await loadTemplates();
      toast({
        title: "Success",
        description: "Active monthly template updated"
      });
    } catch (error) {
      console.error('Error setting active template:', error);
      toast({
        title: "Error",
        description: "Failed to update active template",
        variant: "destructive"
      });
    }
  };

  const handleDuplicateTemplate = async (template: Template) => {
    try {
      // Create duplicate template
      const { data: newTemplate, error: templateError } = await supabase
        .from('daily_check_templates')
        .insert({
          user_id: user?.id,
          ride_id: ride.id,
          template_name: `${template.template_name} (Copy)`,
          description: template.description,
          check_frequency: 'monthly',
          template_type: 'monthly',
          is_active: false
        })
        .select()
        .single();

      if (templateError) throw templateError;

      // Get template items to duplicate
      const { data: items, error: itemsError } = await supabase
        .from('daily_check_template_items')
        .select('*')
        .eq('template_id', template.id);

      if (itemsError) throw itemsError;

      // Duplicate template items
      if (items && items.length > 0) {
        const duplicatedItems = items.map(item => ({
          template_id: newTemplate.id,
          check_item_text: item.check_item_text,
          is_required: item.is_required,
          sort_order: item.sort_order,
          category: item.category
        }));

        const { error: insertError } = await supabase
          .from('daily_check_template_items')
          .insert(duplicatedItems);

        if (insertError) throw insertError;
      }

      await loadTemplates();
      toast({
        title: "Success",
        description: "Monthly template duplicated successfully"
      });
    } catch (error) {
      console.error('Error duplicating template:', error);
      toast({
        title: "Error",
        description: "Failed to duplicate template",
        variant: "destructive"
      });
    }
  };

  const handleDeleteTemplate = async (templateId: string) => {
    if (!confirm('Are you sure you want to delete this monthly template?')) return;

    try {
      const { error } = await supabase
        .from('daily_check_templates')
        .delete()
        .eq('id', templateId);

      if (error) throw error;

      await loadTemplates();
      toast({
        title: "Success",
        description: "Monthly template deleted successfully"
      });
    } catch (error) {
      console.error('Error deleting template:', error);
      toast({
        title: "Error",
        description: "Failed to delete template",
        variant: "destructive"
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
        frequency="monthly"
        onSuccess={handleTemplateSuccess}
        onCancel={() => {
          setShowBuilder(false);
          setEditingTemplate(null);
        }}
      />
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h3 className="text-lg font-semibold">Monthly Check Templates</h3>
          <p className="text-sm text-muted-foreground">
            Create and manage monthly inspection templates for {ride.ride_name}
          </p>
        </div>
        <Button onClick={() => setShowBuilder(true)}>
          <Plus className="h-4 w-4 mr-2" />
          Create Template
        </Button>
      </div>

      {loading ? (
        <div className="flex justify-center py-8">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        </div>
      ) : templates.length === 0 ? (
        <Card>
          <CardContent className="pt-6">
            <div className="text-center py-8">
              <Calendar className="mx-auto h-16 w-16 text-muted-foreground" />
              <h3 className="text-lg font-semibold mt-4">No Monthly Templates Created</h3>
              <p className="text-muted-foreground mb-4">
                Create your first monthly inspection template to get started
              </p>
              <Button onClick={() => setShowBuilder(true)}>
                <Plus className="h-4 w-4 mr-2" />
                Create Monthly Template
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4">
          {templates.map((template) => (
            <Card key={template.id} className={template.is_active ? 'ring-2 ring-primary' : ''}>
              <CardHeader>
                <div className="flex justify-between items-start">
                  <div className="space-y-2">
                    <div className="flex items-center space-x-2">
                      <CardTitle className="text-lg">{template.template_name}</CardTitle>
                      {template.is_active && (
                        <Badge variant="default" className="flex items-center space-x-1">
                          <CheckCircle className="h-3 w-3" />
                          <span>Active</span>
                        </Badge>
                      )}
                      {!template.is_active && (
                        <Badge variant="secondary" className="flex items-center space-x-1">
                          <AlertCircle className="h-3 w-3" />
                          <span>Inactive</span>
                        </Badge>
                      )}
                    </div>
                    {template.description && (
                      <CardDescription>{template.description}</CardDescription>
                    )}
                    <div className="text-xs text-muted-foreground">
                      Created: {new Date(template.created_at).toLocaleDateString()}
                    </div>
                  </div>
                  <div className="flex space-x-2">
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => {
                              setEditingTemplate(template);
                              setShowBuilder(true);
                            }}
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>
                          <p>Edit template</p>
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleDuplicateTemplate(template)}
                          >
                            <Copy className="h-4 w-4" />
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>
                          <p>Duplicate template</p>
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                    {!template.is_active && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleSetActive(template.id)}
                      >
                        Set Active
                      </Button>
                    )}
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleDeleteTemplate(template.id)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>
                          <p>Delete template</p>
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  </div>
                </div>
              </CardHeader>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
};

export default MonthlyCheckTemplateManager;