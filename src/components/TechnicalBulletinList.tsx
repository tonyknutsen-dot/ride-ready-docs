import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { supabase } from '@/integrations/supabase/client';
import { FileText, Search, Filter, Target, Calendar } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { BulletinMatcher } from '@/utils/bulletinMatcher';
import { format } from 'date-fns';
import { useToast } from '@/hooks/use-toast';
import type { Database } from '@/integrations/supabase/types';

type TechnicalBulletin = Database['public']['Tables']['technical_bulletins']['Row'] & {
  ride_categories: {
    name: string;
    description: string | null;
  };
};

type RideCategory = Database['public']['Tables']['ride_categories']['Row'];

type Ride = Database['public']['Tables']['rides']['Row'] & {
  ride_categories: {
    name: string;
    description: string | null;
  };
};

export const TechnicalBulletinList = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [bulletins, setBulletins] = useState<TechnicalBulletin[]>([]);
  const [categories, setCategories] = useState<RideCategory[]>([]);
  const [rides, setRides] = useState<Ride[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [selectedPriority, setSelectedPriority] = useState<string>('all');
  const [showOnlyRelevant, setShowOnlyRelevant] = useState(true);

  useEffect(() => {
    loadBulletins();
    loadCategories();
    if (user) {
      loadUserRides();
    }
  }, [user]);

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

  const loadUserRides = async () => {
    if (!user) return;
    
    try {
      const { data, error } = await supabase
        .from('rides')
        .select(`
          *,
          ride_categories (
            name,
            description
          )
        `)
        .eq('user_id', user.id)
        .order('ride_name');

      if (error) throw error;
      setRides(data || []);
    } catch (error) {
      console.error('Error loading user rides:', error);
    }
  };

  // Filter bulletins based on search, category, and ride relevance
  const filteredBulletins = bulletins.filter(bulletin => {
    const matchesSearch = searchTerm === '' || 
      bulletin.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      bulletin.content?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      bulletin.bulletin_number?.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesCategory = selectedCategory === 'all' || bulletin.category_id === selectedCategory;
    const matchesPriority = selectedPriority === 'all' || bulletin.priority === selectedPriority;
    
    return matchesSearch && matchesCategory && matchesPriority;
  });

  // Apply ride-specific filtering if enabled
  const finalFilteredBulletins = showOnlyRelevant && rides.length > 0
    ? BulletinMatcher.filterBulletinsForRides(filteredBulletins, rides)
    : filteredBulletins;

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'critical': return 'bg-red-500 text-white';
      case 'high': return 'bg-orange-500 text-white';
      case 'medium': return 'bg-yellow-500 text-white';
      case 'low': return 'bg-green-500 text-white';
      default: return 'bg-gray-500 text-white';
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
      <div>
        <h2 className="text-3xl font-bold">Technical Bulletins</h2>
        <p className="text-muted-foreground">
          Important safety and technical information for ride operators
        </p>
      </div>

      <div className="space-y-4 mb-6">
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
            <Input
              placeholder="Search bulletins..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>
          <Select value={selectedCategory} onValueChange={setSelectedCategory}>
            <SelectTrigger className="w-full sm:w-48">
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
            <SelectTrigger className="w-full sm:w-32">
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
        
        {rides.length > 0 && (
          <div className="flex items-center space-x-2 p-3 bg-muted/50 rounded-lg">
            <Target className="h-4 w-4 text-primary" />
            <Label htmlFor="relevant-filter" className="text-sm font-medium">
              Show only bulletins relevant to my rides
            </Label>
            <Switch
              id="relevant-filter"
              checked={showOnlyRelevant}
              onCheckedChange={setShowOnlyRelevant}
            />
          </div>
        )}
      </div>

      <div className="space-y-4">
        {finalFilteredBulletins.length === 0 ? (
          <Card>
            <CardContent className="p-6 text-center">
              <FileText className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-lg font-semibold mb-2">No bulletins found</h3>
              <p className="text-muted-foreground">
                {bulletins.length === 0 
                  ? "No technical bulletins available yet."
                  : showOnlyRelevant && rides.length > 0
                  ? "No bulletins match your rides. Try turning off 'relevant only' filter."
                  : "No bulletins match your current filters."
                }
              </p>
            </CardContent>
          </Card>
        ) : (
          <>
            {showOnlyRelevant && rides.length > 0 && (
              <div className="text-sm text-muted-foreground mb-4 p-3 bg-primary/5 rounded-lg border">
                <Target className="h-4 w-4 inline mr-2" />
                Showing {finalFilteredBulletins.length} bulletin(s) relevant to your {rides.length} ride(s): {rides.map(r => r.ride_name).join(', ')}
              </div>
            )}
            {finalFilteredBulletins.map((bulletin) => (
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
                          {(bulletin as any).ride_categories?.name || 'Unknown'}
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
            ))}
          </>
        )}
      </div>

      {finalFilteredBulletins.length > 0 && (
        <div className="text-center text-sm text-muted-foreground">
          Showing {finalFilteredBulletins.length} of {bulletins.length} bulletins
          {showOnlyRelevant && rides.length > 0 && (
            <span className="block mt-1">
              Filtered by your rides for maximum relevance
            </span>
          )}
        </div>
      )}
    </div>
  );
};

export default TechnicalBulletinList;