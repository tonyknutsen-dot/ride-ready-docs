import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { FileText, Search, Calendar } from 'lucide-react';
import { format } from 'date-fns';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Tables } from '@/integrations/supabase/types';

type TechnicalBulletin = Tables<'technical_bulletins'> & {
  ride_categories: {
    name: string;
    description: string | null;
  };
};

type RideCategory = Tables<'ride_categories'>;

const TechnicalBulletinList = () => {
  const { toast } = useToast();
  const [bulletins, setBulletins] = useState<TechnicalBulletin[]>([]);
  const [categories, setCategories] = useState<RideCategory[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [selectedPriority, setSelectedPriority] = useState('all');

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

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'critical': return 'bg-red-500 text-white';
      case 'high': return 'bg-orange-500 text-white';
      case 'medium': return 'bg-yellow-500 text-white';
      case 'low': return 'bg-green-500 text-white';
      default: return 'bg-gray-500 text-white';
    }
  };

  const filteredBulletins = bulletins.filter(bulletin => {
    const matchesSearch = bulletin.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         (bulletin.content?.toLowerCase().includes(searchTerm.toLowerCase())) ||
                         (bulletin.bulletin_number?.toLowerCase().includes(searchTerm.toLowerCase()));
    
    const matchesCategory = selectedCategory === 'all' || bulletin.category_id === selectedCategory;
    const matchesPriority = selectedPriority === 'all' || bulletin.priority === selectedPriority;
    
    return matchesSearch && matchesCategory && matchesPriority;
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-3xl font-bold">Technical Bulletins</h2>
        <p className="text-muted-foreground">
          Important safety and technical information for ride operators
        </p>
      </div>

      {/* Filters */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="relative">
          <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search bulletins..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
          />
        </div>
        <Select value={selectedCategory} onValueChange={setSelectedCategory}>
          <SelectTrigger>
            <SelectValue placeholder="All Categories" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Categories</SelectItem>
            {categories.map((category) => (
              <SelectItem key={category.id} value={category.id}>
                {category.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={selectedPriority} onValueChange={setSelectedPriority}>
          <SelectTrigger>
            <SelectValue placeholder="All Priorities" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Priorities</SelectItem>
            <SelectItem value="critical">Critical</SelectItem>
            <SelectItem value="high">High</SelectItem>
            <SelectItem value="medium">Medium</SelectItem>
            <SelectItem value="low">Low</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Bulletins List */}
      <div className="grid gap-4">
        {filteredBulletins.length === 0 ? (
          <Card>
            <CardContent className="p-6 text-center">
              <FileText className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <p className="text-muted-foreground">
                {bulletins.length === 0 
                  ? 'No technical bulletins available yet'
                  : 'No bulletins match your current filters'
                }
              </p>
            </CardContent>
          </Card>
        ) : (
          filteredBulletins.map((bulletin) => (
            <Card key={bulletin.id} className="transition-smooth hover:shadow-elegant">
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between">
                  <div className="space-y-2">
                    <CardTitle className="text-lg">{bulletin.title}</CardTitle>
                    <div className="flex items-center space-x-2 flex-wrap">
                      {bulletin.bulletin_number && (
                        <Badge variant="outline">#{bulletin.bulletin_number}</Badge>
                      )}
                      <Badge className={getPriorityColor(bulletin.priority || 'medium')}>
                        {bulletin.priority}
                      </Badge>
                      <Badge variant="secondary">
                        {bulletin.ride_categories.name}
                      </Badge>
                    </div>
                  </div>
                  {bulletin.issue_date && (
                    <div className="flex items-center text-sm text-muted-foreground">
                      <Calendar className="h-4 w-4 mr-1" />
                      {format(new Date(bulletin.issue_date), 'MMM dd, yyyy')}
                    </div>
                  )}
                </div>
              </CardHeader>
              <CardContent>
                <div className="prose prose-sm max-w-none">
                  <p className="text-muted-foreground whitespace-pre-wrap leading-relaxed">
                    {bulletin.content}
                  </p>
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>

      {filteredBulletins.length > 0 && (
        <div className="text-center text-sm text-muted-foreground">
          Showing {filteredBulletins.length} of {bulletins.length} bulletins
        </div>
      )}
    </div>
  );
};

export default TechnicalBulletinList;