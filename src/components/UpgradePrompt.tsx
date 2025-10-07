import { Lock, Zap } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogTrigger } from '@/components/ui/dialog';
import { PlanSelection } from './PlanSelection';
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
  const planName = requiredPlan === 'basic' ? 'Documents & Compliance' : 'Operations & Maintenance';
  const price = requiredPlan === 'basic' ? '£12.99' : '£27.99';
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