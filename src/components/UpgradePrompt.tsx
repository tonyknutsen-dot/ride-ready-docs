import { Lock, Zap } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useTester } from '@/contexts/TesterContext';
import { useStaff } from '@/contexts/StaffContext';
import { useNavigate } from 'react-router-dom';

interface UpgradePromptProps {
  feature?: string;
  requiredPlan?: string; // Kept for backward compat
  compact?: boolean;
}

export const UpgradePrompt: React.FC<UpgradePromptProps> = ({
  feature = 'this feature',
  compact = false
}) => {
  const { isTester } = useTester();
  const { isStaff } = useStaff();
  const navigate = useNavigate();
  
  if (isTester) return null;
  
  if (isStaff) {
    return (
      <Card className="border-muted bg-muted/20">
        <CardContent className={compact ? "p-4" : "p-6 text-center space-y-4"}>
          <div className="flex items-center gap-3">
            <Lock className="h-5 w-5 text-muted-foreground" />
            <div>
              <p className="font-medium text-muted-foreground">{feature}</p>
              <p className="text-sm text-muted-foreground">
                Contact your administrator to subscribe
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }
  
  if (compact) {
    return (
      <Card className="border-primary/20 bg-primary/5">
        <CardContent className="p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Lock className="h-5 w-5 text-primary" />
              <div>
                <p className="font-medium">{feature}</p>
                <p className="text-sm text-muted-foreground">
                  Subscribe to access all features
                </p>
              </div>
            </div>
            <Button size="sm" onClick={() => navigate('/billing')}>
              Subscribe
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-primary/20 bg-gradient-to-br from-primary/5 to-primary/10">
      <CardHeader className="text-center">
        <div className="mx-auto w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mb-4">
          <Lock className="h-8 w-8 text-primary" />
        </div>
        <CardTitle>{feature}</CardTitle>
      </CardHeader>
      <CardContent className="text-center space-y-6">
        <div>
          <p className="text-muted-foreground mb-4">
            Subscribe to Ride Ready Docs to access all compliance and operations features.
          </p>
          <div className="flex items-center justify-center gap-2 text-2xl font-bold">
            <span>From £9.99</span>
            <span className="text-sm font-normal text-muted-foreground">/month</span>
          </div>
        </div>

        <div className="space-y-3">
          <Button size="lg" className="w-full" onClick={() => navigate('/billing')}>
            <Zap className="mr-2 h-4 w-4" />
            View Plans
          </Button>
          <p className="text-xs text-muted-foreground">Priced by number of rides • All features included</p>
        </div>
      </CardContent>
    </Card>
  );
};
