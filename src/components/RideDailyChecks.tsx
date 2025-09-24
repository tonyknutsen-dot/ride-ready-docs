import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { CheckSquare, AlertTriangle, Clock, User, Calendar, Save } from 'lucide-react';
import { Tables } from '@/integrations/supabase/types';
import { useToast } from '@/hooks/use-toast';

type Ride = Tables<'rides'> & {
  ride_categories: {
    name: string;
    description: string | null;
  };
};

interface RideDailyChecksProps {
  ride: Ride;
}

// Mock check items based on ride category
const getCheckItems = (categoryName: string) => {
  const baseChecks = [
    { id: 'visual', label: 'Visual inspection of ride structure', required: true },
    { id: 'safety_barriers', label: 'Safety barriers and gates secure', required: true },
    { id: 'emergency_stops', label: 'Emergency stop buttons functional', required: true },
    { id: 'safety_signs', label: 'Safety signage visible and intact', required: true },
  ];

  const categorySpecificChecks: Record<string, any[]> = {
    'Chair O Plane': [
      { id: 'chain_condition', label: 'Check chair chains and connections', required: true },
      { id: 'seat_security', label: 'Chair seats securely attached', required: true },
      { id: 'rotation_mechanism', label: 'Rotation mechanism operates smoothly', required: true },
    ],
    'Dodgems': [
      { id: 'floor_condition', label: 'Floor surface clean and intact', required: true },
      { id: 'car_bumpers', label: 'Car bumpers in good condition', required: true },
      { id: 'electrical_pickup', label: 'Electrical pickup poles secure', required: true },
    ],
    'Twist': [
      { id: 'gondola_secure', label: 'Gondolas securely attached', required: true },
      { id: 'restraint_systems', label: 'Passenger restraint systems functional', required: true },
      { id: 'hydraulic_systems', label: 'Hydraulic systems operating normally', required: true },
    ],
  };

  return [
    ...baseChecks,
    ...(categorySpecificChecks[categoryName] || [])
  ];
};

// Mock recent checks data
const mockRecentChecks = [
  {
    id: '1',
    date: '2024-09-23',
    inspector: 'John Smith',
    status: 'passed',
    issues: 0,
    notes: 'All checks completed successfully'
  },
  {
    id: '2',
    date: '2024-09-22',
    inspector: 'John Smith',
    status: 'failed',
    issues: 2,
    notes: 'Minor issue with safety barrier - resolved'
  }
];

const RideDailyChecks = ({ ride }: RideDailyChecksProps) => {
  const { toast } = useToast();
  const [checkItems] = useState(getCheckItems(ride.ride_categories.name));
  const [checkedItems, setCheckedItems] = useState<Record<string, boolean>>({});
  const [notes, setNotes] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleCheckChange = (itemId: string, checked: boolean) => {
    setCheckedItems(prev => ({
      ...prev,
      [itemId]: checked
    }));
  };

  const handleSubmitChecks = async () => {
    const requiredItems = checkItems.filter(item => item.required);
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

    // This would save to Supabase in real implementation
    setTimeout(() => {
      toast({
        title: "Daily checks completed",
        description: "Your daily safety checks have been recorded successfully",
      });
      
      // Reset form
      setCheckedItems({});
      setNotes('');
      setIsSubmitting(false);
    }, 1500);
  };

  const completedCount = Object.values(checkedItems).filter(Boolean).length;
  const totalCount = checkItems.length;
  const completionPercentage = totalCount > 0 ? (completedCount / totalCount) * 100 : 0;

  return (
    <div className="space-y-6">
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
        <CardContent>
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <div className="text-center">
                <div className="text-2xl font-bold text-primary">{completedCount}/{totalCount}</div>
                <p className="text-xs text-muted-foreground">Checks completed</p>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-accent">{Math.round(completionPercentage)}%</div>
                <p className="text-xs text-muted-foreground">Progress</p>
              </div>
            </div>
            <Badge variant={completionPercentage === 100 ? "default" : "secondary"}>
              {completionPercentage === 100 ? "Ready to Submit" : "In Progress"}
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
          {checkItems.map((item) => (
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
                  {item.label}
                  {item.required && <span className="text-red-500 ml-1">*</span>}
                </label>
              </div>
              <div className="flex items-center">
                {checkedItems[item.id] ? (
                  <CheckSquare className="h-4 w-4 text-green-600" />
                ) : item.required ? (
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
          disabled={isSubmitting || completionPercentage !== 100}
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
            {mockRecentChecks.map((check) => (
              <div key={check.id} className="flex items-center justify-between p-3 rounded border">
                <div className="flex items-center space-x-3">
                  <div className="flex items-center space-x-2">
                    <Calendar className="h-4 w-4 text-muted-foreground" />
                    <span className="font-medium">{new Date(check.date).toLocaleDateString()}</span>
                  </div>
                  <div className="flex items-center space-x-2">
                    <User className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm text-muted-foreground">{check.inspector}</span>
                  </div>
                </div>
                <div className="flex items-center space-x-3">
                  <Badge variant={check.status === 'passed' ? 'default' : 'destructive'}>
                    {check.status === 'passed' ? 'Passed' : 'Issues Found'}
                  </Badge>
                  {check.issues > 0 && (
                    <span className="text-sm text-muted-foreground">
                      {check.issues} issue{check.issues !== 1 ? 's' : ''}
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default RideDailyChecks;