import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { CheckSquare, AlertTriangle, Clock, User, Calendar, Save, Settings } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { Tables } from '@/integrations/supabase/types';

type Ride = Tables<'rides'> & {
  ride_categories: {
    name: string;
    description: string | null;
  };
};

type Template = Tables<'daily_check_templates'> & {
  daily_check_template_items: Tables<'daily_check_template_items'>[];
};

type Check = Tables<'checks'>;

interface RideDailyChecksProps {
  ride: Ride;
}

const RideDailyChecks = ({ ride }: RideDailyChecksProps) => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [template, setTemplate] = useState<Template | null>(null);
  const [recentChecks, setRecentChecks] = useState<Check[]>([]);
  const [checkedItems, setCheckedItems] = useState<Record<string, boolean>>({});
  const [notes, setNotes] = useState('');
  const [inspectorName, setInspectorName] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user) {
      loadActiveTemplate();
      loadRecentChecks();
    }
  }, [user, ride.id]);

  const loadActiveTemplate = async () => {
    try {
      const { data, error } = await supabase
        .from('daily_check_templates')
        .select(`
          *,
          daily_check_template_items (*)
        `)
        .eq('user_id', user?.id)
        .eq('ride_id', ride.id)
        .eq('is_active', true)
        .eq('check_frequency', 'daily')
        .maybeSingle();

      if (error) {
        throw error;
      }

      setTemplate(data as Template | null);
    } catch (error: any) {
      console.error('Error loading template:', error);
      toast({
        title: "Error loading template",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const loadRecentChecks = async () => {
    try {
      const { data, error } = await supabase
        .from('checks')
        .select('*')
        .eq('user_id', user?.id)
        .eq('ride_id', ride.id)
        .eq('check_frequency', 'daily')
        .order('check_date', { ascending: false })
        .limit(5);

      if (error) {
        throw error;
      }

      setRecentChecks(data || []);
    } catch (error: any) {
      console.error('Error loading recent checks:', error);
    }
  };

  const handleCheckChange = (itemId: string, checked: boolean) => {
    setCheckedItems(prev => ({
      ...prev,
      [itemId]: checked
    }));
  };

  const handleSubmitChecks = async () => {
    if (!template) {
      toast({
        title: "No template available",
        description: "Please create a daily check template for this ride first",
        variant: "destructive",
      });
      return;
    }

    if (!inspectorName.trim()) {
      toast({
        title: "Missing information",
        description: "Please enter the inspector's name",
        variant: "destructive",
      });
      return;
    }

    const requiredItems = template.daily_check_template_items.filter(item => item.is_required);
    const completedRequiredItems = requiredItems.filter(item => checkedItems[item.id]);

    if (completedRequiredItems.length !== requiredItems.length) {
      toast({
        title: "Incomplete checks",
        description: "Please complete all required safety checks before submitting",
        variant: "destructive",
      });
      return;
    }

    setIsSubmitting(true);

    try {
      // Calculate status
      const allItems = template.daily_check_template_items;
      const completedItems = allItems.filter(item => checkedItems[item.id]);
      let status: 'passed' | 'failed' | 'partial' = 'passed';
      
      if (completedItems.length === 0) {
        status = 'failed';
      } else if (completedItems.length < allItems.length) {
        status = 'partial';
      }

      // Create daily check record
      const { data: dailyCheck, error: checkError } = await supabase
        .from('checks')
        .insert({
          user_id: user?.id,
          ride_id: ride.id,
          template_id: template.id,
          inspector_name: inspectorName.trim(),
          check_frequency: 'daily',
          status,
          notes: notes.trim() || null,
        })
        .select()
        .single();

      if (checkError) {
        throw checkError;
      }

      // Create individual check results
      const resultsToInsert = template.daily_check_template_items.map(item => ({
        check_id: dailyCheck.id,
        template_item_id: item.id,
        is_checked: checkedItems[item.id] || false,
        notes: null, // Could be extended to support per-item notes
      }));

      const { error: resultsError } = await supabase
        .from('check_results')
        .insert(resultsToInsert);

      if (resultsError) {
        throw resultsError;
      }

      toast({
        title: "Daily checks completed",
        description: "Your daily safety checks have been recorded successfully",
      });
      
      // Reset form and reload recent checks
      setCheckedItems({});
      setNotes('');
      setInspectorName('');
      loadRecentChecks();
    } catch (error: any) {
      console.error('Error submitting daily checks:', error);
      toast({
        title: "Error submitting checks",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const completedCount = template ? Object.values(checkedItems).filter(Boolean).length : 0;
  const totalCount = template?.daily_check_template_items.length || 0;
  const completionPercentage = totalCount > 0 ? (completedCount / totalCount) * 100 : 0;

  if (loading) {
    return (
      <Card>
        <CardContent className="pt-6">
          <div className="text-center py-4">
            <Settings className="mx-auto h-8 w-8 text-muted-foreground animate-spin" />
            <p className="text-muted-foreground mt-2">Loading daily checks...</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!template) {
    return (
      <Card>
        <CardContent className="pt-6">
          <div className="text-center py-8">
            <CheckSquare className="mx-auto h-16 w-16 text-muted-foreground" />
            <h3 className="text-lg font-semibold mt-4">No daily check template</h3>
            <p className="text-muted-foreground">
              Create a daily check template for this ride to start performing safety checks.
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <Alert>
        <AlertDescription>
          Complete all required inspection items by checking them off. Add notes for any issues found. Enter inspector details and submit when finished.
        </AlertDescription>
      </Alert>
      {/* Header */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <CheckSquare className="h-5 w-5" />
            <span>Daily Safety Checks - {ride.ride_name}</span>
          </CardTitle>
          <CardDescription>
            Complete the daily safety inspection for this {ride.ride_categories.name}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="inspector">Inspector Name</Label>
              <Input
                id="inspector"
                value={inspectorName}
                onChange={(e) => setInspectorName(e.target.value)}
                placeholder="Enter inspector name"
              />
            </div>
            <div className="flex items-end">
              <div className="text-center">
                <div className="text-2xl font-bold text-primary">{completedCount}/{totalCount}</div>
                <p className="text-xs text-muted-foreground">Checks completed</p>
              </div>
            </div>
          </div>
          <div className="flex items-center justify-between">
            <div className="text-center">
              <div className="text-2xl font-bold text-accent">{Math.round(completionPercentage)}%</div>
              <p className="text-xs text-muted-foreground">Progress</p>
            </div>
            <Badge variant={completionPercentage === 100 && inspectorName.trim() ? "default" : "secondary"}>
              {completionPercentage === 100 && inspectorName.trim() ? "Ready to Submit" : "In Progress"}
            </Badge>
          </div>
        </CardContent>
      </Card>

      {/* Check Items */}
      <Card>
        <CardHeader>
          <CardTitle>Safety Check Items</CardTitle>
          <CardDescription>
            Complete all required checks before operating the ride
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {template.daily_check_template_items
            .sort((a, b) => a.sort_order - b.sort_order)
            .map((item) => (
            <div key={item.id} className="flex items-start space-x-3 p-3 rounded border">
              <Checkbox
                id={item.id}
                checked={checkedItems[item.id] || false}
                onCheckedChange={(checked) => handleCheckChange(item.id, checked as boolean)}
                className="mt-0.5"
              />
              <div className="flex-1">
                <label
                  htmlFor={item.id}
                  className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer"
                >
                  {item.check_item_text}
                  {item.is_required && <span className="text-red-500 ml-1">*</span>}
                </label>
                <Badge variant="outline" className="text-xs mt-1">
                  {item.category}
                </Badge>
              </div>
              <div className="flex items-center">
                {checkedItems[item.id] ? (
                  <CheckSquare className="h-4 w-4 text-green-600" />
                ) : item.is_required ? (
                  <AlertTriangle className="h-4 w-4 text-yellow-600" />
                ) : (
                  <Clock className="h-4 w-4 text-muted-foreground" />
                )}
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      {/* Notes Section */}
      <Card>
        <CardHeader>
          <CardTitle>Inspector Notes</CardTitle>
          <CardDescription>
            Add any observations, issues, or additional comments
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Textarea
            placeholder="Enter any notes about the inspection, issues found, or maintenance needed..."
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={4}
          />
        </CardContent>
      </Card>

      {/* Submit Button */}
      <div className="flex justify-center">
        <Button
          onClick={handleSubmitChecks}
          disabled={isSubmitting || completionPercentage !== 100 || !inspectorName.trim()}
          size="lg"
          className="flex items-center space-x-2"
        >
          <Save className="h-4 w-4" />
          <span>{isSubmitting ? 'Submitting...' : 'Submit Daily Checks'}</span>
        </Button>
      </div>

      {/* Recent Checks History */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Calendar className="h-5 w-5" />
            <span>Recent Checks</span>
          </CardTitle>
          <CardDescription>
            History of daily safety checks for this ride
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {recentChecks.length === 0 ? (
              <p className="text-muted-foreground text-center py-4">
                No daily checks completed yet for this ride.
              </p>
            ) : (
              recentChecks.map((check) => (
                <div key={check.id} className="flex items-center justify-between p-3 rounded border">
                  <div className="flex items-center space-x-3">
                    <div className="flex items-center space-x-2">
                      <Calendar className="h-4 w-4 text-muted-foreground" />
                      <span className="font-medium">{new Date(check.check_date).toLocaleDateString()}</span>
                    </div>
                    <div className="flex items-center space-x-2">
                      <User className="h-4 w-4 text-muted-foreground" />
                      <span className="text-sm text-muted-foreground">{check.inspector_name}</span>
                    </div>
                  </div>
                  <div className="flex items-center space-x-3">
                    <Badge variant={
                      check.status === 'passed' ? 'default' : 
                      check.status === 'failed' ? 'destructive' : 
                      'secondary'
                    }>
                      {check.status === 'passed' ? 'Passed' : 
                       check.status === 'failed' ? 'Failed' : 'Partial'}
                    </Badge>
                  </div>
                </div>
              ))
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default RideDailyChecks;