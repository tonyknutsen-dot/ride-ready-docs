import { Lock, Zap } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogTrigger } from '@/components/ui/dialog';
import { PlanSelection } from './PlanSelection';
import { useTester } from '@/contexts/TesterContext';
import { useStaff } from '@/contexts/StaffContext';

interface UpgradePromptProps {
  feature: string;
  requiredPlan: 'basic' | 'advanced';
  compact?: boolean;
}

export const UpgradePrompt: React.FC<UpgradePromptProps> = ({
  feature,
  requiredPlan,
  compact = false
}) => {
  const { isTester } = useTester();
  const { isStaff } = useStaff();
  
  // TESTER BYPASS: Don't show upgrade prompts for testers
  if (isTester) {
    return null;
  }
  
  const planName = requiredPlan === 'basic' ? 'Documents & Compliance' : 'Operations & Maintenance';
  const price = requiredPlan === 'basic' ? '£6.99' : '£18.99';
  
  // STAFF: Show disabled upgrade prompt instead of functional one
  if (isStaff) {
    if (compact) {
      return (
        <Card className="border-muted bg-muted/30">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Lock className="h-5 w-5 text-muted-foreground" />
                <div>
                  <p className="font-medium text-muted-foreground">{feature}</p>
                  <p className="text-sm text-muted-foreground">
                    Requires {planName} plan
                  </p>
                </div>
              </div>
              <Button size="sm" disabled className="opacity-50">
                Ask admin to upgrade
              </Button>
            </div>
          </CardContent>
        </Card>
      );
    }
    
    return (
      <Card className="border-muted bg-muted/20">
        <CardHeader className="text-center">
          <div className="mx-auto w-16 h-16 rounded-full bg-muted flex items-center justify-center mb-4">
            <Lock className="h-8 w-8 text-muted-foreground" />
          </div>
          <CardTitle className="flex items-center justify-center gap-2 text-muted-foreground">
            <span>{feature}</span>
            <Badge variant="secondary" className="ml-2">
              {planName} Feature
            </Badge>
          </CardTitle>
        </CardHeader>
        <CardContent className="text-center space-y-4">
          <p className="text-muted-foreground">
            This feature requires the {planName} plan. Contact your company administrator to upgrade.
          </p>
          <Button disabled className="opacity-50">
            Ask admin to upgrade
          </Button>
        </CardContent>
      </Card>
    );
  }
  
  // OWNER: Show functional upgrade prompt
  if (compact) {
    return <Card className="border-primary/20 bg-primary/5">
        <CardContent className="p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Lock className="h-5 w-5 text-primary" />
              <div>
                <p className="font-medium">{feature}</p>
                <p className="text-sm text-muted-foreground">
                  Requires {planName} plan
                </p>
              </div>
            </div>
            <Dialog>
              <DialogTrigger asChild>
                <Button size="sm">
                  Upgrade to {planName}
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-4xl">
                <PlanSelection />
              </DialogContent>
            </Dialog>
          </div>
        </CardContent>
      </Card>;
  }
  return <Card className="border-primary/20 bg-gradient-to-br from-primary/5 to-primary/10">
      <CardHeader className="text-center">
        <div className="mx-auto w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mb-4">
          <Lock className="h-8 w-8 text-primary" />
        </div>
        <CardTitle className="flex items-center justify-center gap-2">
          <span>{feature}</span>
          <Badge variant="secondary" className="ml-2">
            {planName} Feature
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="text-center space-y-6">
        <div>
          <p className="text-muted-foreground mb-4">
            This feature requires the {planName} plan to access.
          </p>
          <div className="flex items-center justify-center gap-2 text-2xl font-bold">
            <span>{price}</span>
            <span className="text-sm font-normal text-muted-foreground">/month</span>
          </div>
        </div>

        <div className="space-y-3">
          <Dialog>
            <DialogTrigger asChild>
              <Button size="lg" className="w-full">
                <Zap className="mr-2 h-4 w-4" />
                Upgrade to {planName}
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-4xl">
              <PlanSelection />
            </DialogContent>
          </Dialog>
          
          <p className="text-xs text-muted-foreground">Cancel anytime • Instant access • 364 days support</p>
        </div>
      </CardContent>
    </Card>;
};