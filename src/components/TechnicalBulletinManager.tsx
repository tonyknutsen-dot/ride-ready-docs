import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { Plus, Edit2, Trash2, FileText, Calendar as CalendarIcon, Edit } from 'lucide-react';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { BulletinScraper } from './BulletinScraper';
import { format } from 'date-fns';
import { useAuth } from '@/contexts/AuthContext';
import { Tables } from '@/integrations/supabase/types';

type RideCategory = Tables<'ride_categories'>;
type TechnicalBulletin = Tables<'technical_bulletins'> & {
  ride_categories: {
    name: string;
    description: string | null;
  };
};

const TechnicalBulletinManager = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [bulletins, setBulletins] = useState<TechnicalBulletin[]>([]);
  const [categories, setCategories] = useState<RideCategory[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingBulletin, setEditingBulletin] = useState<TechnicalBulletin | null>(null);
  
  // Form state
  const [formData, setFormData] = useState({
    title: '',
    content: '',
    bulletin_number: '',
    priority: 'medium' as 'low' | 'medium' | 'high' | 'critical',
    category_id: '',
    issue_date: new Date()
  });

  useEffect(() => {
    loadBulletins();
    loadCategories();
  }, []);

  const loadBulletins = async () => {
    try {
      const { data, error } = await supabase
        .from('technical_bulletins')
        .select(`
          *,
          ride_categories (
            name,
            description
          )
        `)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setBulletins(data || []);
    } catch (error) {
      console.error('Error loading bulletins:', error);
      toast({
        title: "Error",
        description: "Failed to load technical bulletins.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const loadCategories = async () => {
    try {
      const { data, error } = await supabase
        .from('ride_categories')
        .select('*')
        .order('name');

      if (error) throw error;
      setCategories(data || []);
    } catch (error) {
      console.error('Error loading categories:', error);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    try {
      if (editingBulletin) {
        // Update existing bulletin
        const { error } = await supabase
          .from('technical_bulletins')
          .update({
            title: formData.title,
            content: formData.content,
            bulletin_number: formData.bulletin_number,
            priority: formData.priority,
            category_id: formData.category_id,
            issue_date: formData.issue_date.toISOString().split('T')[0]
          })
          .eq('id', editingBulletin.id);

        if (error) throw error;
        
        toast({
          title: "Success",
          description: "Technical bulletin updated successfully.",
        });
      } else {
        // Create new bulletin
        const { error } = await supabase
          .from('technical_bulletins')
          .insert([{
            title: formData.title,
            content: formData.content,
            bulletin_number: formData.bulletin_number,
            priority: formData.priority,
            category_id: formData.category_id,
            issue_date: formData.issue_date.toISOString().split('T')[0]
          }]);

        if (error) throw error;
        
        toast({
          title: "Success",
          description: "Technical bulletin created successfully.",
        });
      }

      // Reset form and reload
      resetForm();
      loadBulletins();
    } catch (error) {
      console.error('Error saving bulletin:', error);
      toast({
        title: "Error",
        description: "Failed to save technical bulletin.",
        variant: "destructive",
      });
    }
  };

  const handleDelete = async (bulletinId: string) => {
    try {
      const { error } = await supabase
        .from('technical_bulletins')
        .delete()
        .eq('id', bulletinId);

      if (error) throw error;
      
      toast({
        title: "Success",
        description: "Technical bulletin deleted successfully.",
      });
      
      loadBulletins();
    } catch (error) {
      console.error('Error deleting bulletin:', error);
      toast({
        title: "Error",
        description: "Failed to delete technical bulletin.",
        variant: "destructive",
      });
    }
  };

  const resetForm = () => {
    setFormData({
      title: '',
      content: '',
      bulletin_number: '',
      priority: 'medium',
      category_id: '',
      issue_date: new Date()
    });
    setShowAddForm(false);
    setEditingBulletin(null);
  };

  const handleEdit = (bulletin: TechnicalBulletin) => {
    setFormData({
      title: bulletin.title,
      content: bulletin.content || '',
      bulletin_number: bulletin.bulletin_number || '',
      priority: (bulletin.priority as 'low' | 'medium' | 'high' | 'critical') || 'medium',
      category_id: bulletin.category_id,
      issue_date: bulletin.issue_date ? new Date(bulletin.issue_date) : new Date()
    });
    setEditingBulletin(bulletin);
    setShowAddForm(true);
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'critical': return 'bg-red-500';
      case 'high': return 'bg-orange-500';
      case 'medium': return 'bg-yellow-500';
      case 'low': return 'bg-green-500';
      default: return 'bg-gray-500';
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold tracking-tight flex items-center space-x-2">
            <FileText className="h-6 w-6" />
            <span>Technical Bulletins</span>
          </h2>
          <p className="text-muted-foreground">Manage technical bulletins and safety alerts</p>
        </div>
        <Button onClick={() => setShowAddForm(true)} className="flex items-center space-x-2">
          <Plus className="h-4 w-4" />
          <span>Add Bulletin</span>
        </Button>
      </div>

      <BulletinScraper />

      {(showAddForm || editingBulletin) && (
        <Card>
          <CardHeader>
            <CardTitle>
              {editingBulletin ? 'Edit Technical Bulletin' : 'Create New Technical Bulletin'}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="title">Title *</Label>
                  <Input
                    id="title"
                    value={formData.title}
                    onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                    required
                  />
                </div>
                <div>
                  <Label htmlFor="bulletin_number">Bulletin Number</Label>
                  <Input
                    id="bulletin_number"
                    value={formData.bulletin_number}
                    onChange={(e) => setFormData({ ...formData, bulletin_number: e.target.value })}
                  />
                </div>
                <div>
                  <Label htmlFor="priority">Priority</Label>
                  <Select value={formData.priority} onValueChange={(value) => setFormData({ ...formData, priority: value as any })}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="low">Low</SelectItem>
                      <SelectItem value="medium">Medium</SelectItem>
                      <SelectItem value="high">High</SelectItem>
                      <SelectItem value="critical">Critical</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label htmlFor="category">Category *</Label>
                  <Select value={formData.category_id} onValueChange={(value) => setFormData({ ...formData, category_id: value })}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select category" />
                    </SelectTrigger>
                    <SelectContent>
                      {categories.map((category) => (
                        <SelectItem key={category.id} value={category.id}>
                          {category.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Issue Date</Label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        className="w-full justify-start text-left font-normal"
                      >
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {format(formData.issue_date, "PPP")}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar
                        mode="single"
                        selected={formData.issue_date}
                        onSelect={(date) => date && setFormData({ ...formData, issue_date: date })}
                        initialFocus
                      />
                    </PopoverContent>
                  </Popover>
                </div>
              </div>
              
              <div>
                <Label htmlFor="content">Content *</Label>
                <Textarea
                  id="content"
                  value={formData.content}
                  onChange={(e) => setFormData({ ...formData, content: e.target.value })}
                  rows={6}
                  required
                />
              </div>

              <div className="flex items-center space-x-2">
                <Button type="submit">
                  {editingBulletin ? 'Update Bulletin' : 'Create Bulletin'}
                </Button>
                <Button type="button" variant="ghost" onClick={resetForm}>
                  Cancel
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      <div className="grid gap-4">
        {bulletins.length === 0 ? (
          <Card>
            <CardContent className="p-6 text-center">
              <FileText className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <p className="text-muted-foreground">No technical bulletins yet</p>
            </CardContent>
          </Card>
        ) : (
          bulletins.map((bulletin) => (
            <Card key={bulletin.id}>
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between">
                  <div className="space-y-1">
                    <CardTitle className="text-lg">{bulletin.title}</CardTitle>
                    <div className="flex items-center space-x-2">
                      {bulletin.bulletin_number && (
                        <Badge variant="outline">#{bulletin.bulletin_number}</Badge>
                      )}
                      <Badge 
                        className={`text-white ${getPriorityColor(bulletin.priority || 'medium')}`}
                      >
                        {bulletin.priority}
                      </Badge>
                      <Badge variant="secondary">
                        {bulletin.ride_categories.name}
                      </Badge>
                    </div>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleEdit(bulletin)}
                    >
                      <Edit className="h-4 w-4" />
                    </Button>
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button variant="ghost" size="sm">
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Delete Technical Bulletin</AlertDialogTitle>
                          <AlertDialogDescription>
                            Are you sure you want to delete this technical bulletin? This action cannot be undone.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancel</AlertDialogCancel>
                          <AlertDialogAction
                            onClick={() => handleDelete(bulletin.id)}
                            className="bg-red-500 hover:bg-red-600"
                          >
                            Delete
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground whitespace-pre-wrap">{bulletin.content}</p>
                {bulletin.issue_date && (
                  <p className="text-sm text-muted-foreground mt-2">
                    Issue Date: {format(new Date(bulletin.issue_date), 'PPP')}
                  </p>
                )}
              </CardContent>
            </Card>
          ))
        )}
      </div>
    </div>
  );
};

export default TechnicalBulletinManager;