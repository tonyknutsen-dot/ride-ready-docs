import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Plus, Settings, Trash2, Edit, Copy, CheckSquare, Wrench, Archive, ArchiveRestore, MoreVertical } from 'lucide-react';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
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
  frequency?: string;
}

const DailyCheckTemplateManager = ({ ride, frequency = 'daily' }: DailyCheckTemplateManagerProps) => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [templates, setTemplates] = useState<Template[]>([]);
  const [loading, setLoading] = useState(true);
  const [showBuilder, setShowBuilder] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<Template | null>(null);
  const [linkedChecksInfo, setLinkedChecksInfo] = useState<{ [key: string]: { count: number; earliest: string | null; latest: string | null } }>({});
  const [checkingLinked, setCheckingLinked] = useState<string | null>(null);
  const [showArchived, setShowArchived] = useState(false);

  useEffect(() => {
    if (user) {
      loadTemplates();
    }
  }, [user, ride.id, showArchived]);

  const loadTemplates = async () => {
    try {
      let query = supabase
        .from('daily_check_templates')
        .select(`
          *,
          daily_check_template_items (*)
        `)
        .eq('user_id', user?.id)
        .eq('ride_id', ride.id)
        .eq('check_frequency', frequency)
        .order('created_at', { ascending: false });

      if (!showArchived) {
        query = query.eq('is_archived', false);
      }

      const { data, error } = await query;

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

  const checkLinkedRecords = async (templateId: string) => {
    setCheckingLinked(templateId);
    try {
      const { data, error } = await supabase
        .from('checks')
        .select('check_date')
        .eq('template_id', templateId)
        .order('check_date', { ascending: true });

      if (!error && data) {
        setLinkedChecksInfo(prev => ({
          ...prev,
          [templateId]: {
            count: data.length,
            earliest: data.length > 0 ? data[0].check_date : null,
            latest: data.length > 0 ? data[data.length - 1].check_date : null,
          }
        }));
      }
    } catch (error) {
      console.error('Error checking linked records:', error);
    } finally {
      setCheckingLinked(null);
    }
  };

  const handleArchiveTemplate = async (templateId: string) => {
    try {
      const { error } = await supabase
        .from('daily_check_templates')
        .update({ is_archived: true, is_active: false })
        .eq('id', templateId);

      if (error) throw error;

      toast({
        title: "Template archived",
        description: "Template has been archived and can be restored later",
      });

      loadTemplates();
    } catch (error: any) {
      console.error('Error archiving template:', error);
      toast({
        title: "Error archiving template",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const handleRestoreTemplate = async (templateId: string) => {
    try {
      const { error } = await supabase
        .from('daily_check_templates')
        .update({ is_archived: false })
        .eq('id', templateId);

      if (error) throw error;

      toast({
        title: "Template restored",
        description: "Template has been restored and is now available for use",
      });

      loadTemplates();
    } catch (error: any) {
      console.error('Error restoring template:', error);
      toast({
        title: "Error restoring template",
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
        description: "Template has been permanently deleted",
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
      <Alert>
        <AlertDescription>
          Create and manage daily inspection templates. Set one as active to use it for daily checks. You can edit, duplicate, or delete templates as needed.
        </AlertDescription>
      </Alert>
      <div className="flex flex-col sm:flex-row sm:items-center gap-3">
        <div className="space-y-2 min-w-0 flex-1">
          <h3 className="text-xl font-semibold">Daily Check Templates</h3>
          <p className="text-muted-foreground">
            Manage custom daily check templates for {ride.ride_name}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button 
            variant={showArchived ? "secondary" : "outline"} 
            size="sm"
            onClick={() => setShowArchived(!showArchived)}
          >
            <Archive className="h-4 w-4 mr-2" />
            {showArchived ? "Hide Archived" : "Show Archived"}
          </Button>
          <Button onClick={() => setShowBuilder(true)} className="flex items-center space-x-2 shrink-0">
            <Plus className="h-4 w-4" />
            <span>Create Template</span>
          </Button>
        </div>
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
            <Card key={template.id} className={`${template.is_active ? "border-primary" : ""} ${(template as any).is_archived ? "opacity-60" : ""}`}>
              <CardHeader>
                <div className="flex flex-col sm:flex-row sm:items-center gap-3">
                  <div className="flex items-center gap-2 flex-wrap min-w-0 flex-1">
                    <CardTitle className="flex items-center space-x-2">
                      <Wrench className="h-5 w-5" />
                      <span className="break-words">{template.template_name}</span>
                    </CardTitle>
                    {template.is_active && (
                      <Badge variant="default">Active</Badge>
                    )}
                    {(template as any).is_archived && (
                      <Badge variant="outline">Archived</Badge>
                    )}
                  </div>
                  <div className="flex flex-wrap items-center gap-2 shrink-0">
                    {!(template as any).is_archived && (
                      <>
                        <TooltipProvider>
                          <Tooltip>
                            <TooltipTrigger asChild>
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
                                size="sm"
                                variant="outline"
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
                      </>
                    )}
                    {(template as any).is_archived ? (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleRestoreTemplate(template.id)}
                      >
                        <ArchiveRestore className="h-4 w-4 mr-2" />
                        Restore
                      </Button>
                    ) : null}
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button size="sm" variant="outline">
                          <MoreVertical className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        {!(template as any).is_archived && (
                          <AlertDialog onOpenChange={(open) => open && checkLinkedRecords(template.id)}>
                            <AlertDialogTrigger asChild>
                              <DropdownMenuItem onSelect={(e) => e.preventDefault()}>
                                <Archive className="h-4 w-4 mr-2" />
                                Archive
                              </DropdownMenuItem>
                            </AlertDialogTrigger>
                            <AlertDialogContent className="w-[95vw] max-w-[95vw] sm:max-w-lg">
                              <AlertDialogHeader>
                                <AlertDialogTitle>Archive Template</AlertDialogTitle>
                                <AlertDialogDescription asChild>
                                  <div>
                                    <span>Archive "{template.template_name}"? It will be hidden from active use but preserved for historical records.</span>
                                    {checkingLinked === template.id ? (
                                      <span className="block mt-2 text-muted-foreground">Checking for linked records...</span>
                                    ) : linkedChecksInfo[template.id]?.count > 0 ? (
                                      <div className="mt-3 p-3 bg-muted border rounded-md">
                                        <span className="block font-medium">This template has linked check records:</span>
                                        <ul className="mt-2 text-sm space-y-1 text-muted-foreground">
                                          <li>• Total records: <strong className="text-foreground">{linkedChecksInfo[template.id].count}</strong></li>
                                          <li>• Date range: <strong className="text-foreground">
                                            {new Date(linkedChecksInfo[template.id].earliest!).toLocaleDateString()} — {new Date(linkedChecksInfo[template.id].latest!).toLocaleDateString()}
                                          </strong></li>
                                        </ul>
                                        <span className="block mt-2 text-xs text-muted-foreground">
                                          Archiving preserves all historical data.
                                        </span>
                                      </div>
                                    ) : null}
                                  </div>
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>Cancel</AlertDialogCancel>
                                <AlertDialogAction onClick={() => handleArchiveTemplate(template.id)}>
                                  Archive
                                </AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        )}
                        {!(template as any).is_archived && <DropdownMenuSeparator />}
                        <AlertDialog onOpenChange={(open) => open && checkLinkedRecords(template.id)}>
                          <AlertDialogTrigger asChild>
                            <DropdownMenuItem onSelect={(e) => e.preventDefault()} className="text-destructive focus:text-destructive">
                              <Trash2 className="h-4 w-4 mr-2" />
                              Delete Permanently
                            </DropdownMenuItem>
                          </AlertDialogTrigger>
                          <AlertDialogContent className="w-[95vw] max-w-[95vw] sm:max-w-lg">
                            <AlertDialogHeader>
                              <AlertDialogTitle>Delete Template</AlertDialogTitle>
                              <AlertDialogDescription asChild>
                                <div>
                                  <span>Are you sure you want to permanently delete "{template.template_name}"?</span>
                                  {checkingLinked === template.id ? (
                                    <span className="block mt-2 text-muted-foreground">Checking for linked records...</span>
                                  ) : linkedChecksInfo[template.id]?.count > 0 ? (
                                    <div className="mt-3 p-3 bg-destructive/10 border border-destructive/20 rounded-md">
                                      <span className="block text-destructive font-medium">
                                        ⚠️ Warning: This template has linked check records
                                      </span>
                                      <ul className="mt-2 text-sm space-y-1 text-muted-foreground">
                                        <li>• Total records: <strong className="text-foreground">{linkedChecksInfo[template.id].count}</strong></li>
                                        <li>• Date range: <strong className="text-foreground">
                                          {new Date(linkedChecksInfo[template.id].earliest!).toLocaleDateString()} — {new Date(linkedChecksInfo[template.id].latest!).toLocaleDateString()}
                                        </strong></li>
                                      </ul>
                                      <span className="block mt-2 text-xs text-destructive">
                                        Consider archiving instead to preserve historical data.
                                      </span>
                                    </div>
                                  ) : (
                                    <span className="block mt-2 text-muted-foreground">This action cannot be undone.</span>
                                  )}
                                </div>
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Cancel</AlertDialogCancel>
                              <AlertDialogAction
                                onClick={() => handleDeleteTemplate(template.id)}
                                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                              >
                                Delete Permanently
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      </DropdownMenuContent>
                    </DropdownMenu>
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