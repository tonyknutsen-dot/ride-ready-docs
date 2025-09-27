import { Lock } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogTrigger, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { PlanSelection } from './PlanSelection';

interface RestrictedFeatureCardProps {
  title: string;
  description: string;
  icon: React.ReactNode;
  requiredPlan: 'basic' | 'advanced';
}

export const RestrictedFeatureCard: React.FC<RestrictedFeatureCardProps> = ({
  title,
  description,
  icon,
  requiredPlan
}) => {
  const planName = requiredPlan === 'basic' ? 'Basic' : 'Advanced';
  
  return (
    <Card className="relative overflow-hidden border-muted-foreground/20 bg-muted/30">
      <div className="absolute inset-0 bg-muted/50" />
      <CardHeader className="relative">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="opacity-50">{icon}</div>
            <div>
              <CardTitle className="text-muted-foreground">{title}</CardTitle>
              <Badge variant="outline" className="mt-1">
                {planName} Feature
              </Badge>
            </div>
          </div>
          <Lock className="h-5 w-5 text-muted-foreground" />
        </div>
      </CardHeader>
      <CardContent className="relative">
        <p className="text-sm text-muted-foreground mb-4">{description}</p>
        <Dialog>
          <DialogTrigger asChild>
            <Button variant="outline" size="sm" className="w-full">
              Upgrade to Advanced Plan
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
            <DialogTitle>Upgrade to Advanced Plan</DialogTitle>
            <DialogDescription>
              Unlock {title.toLowerCase()} and all premium features with the Advanced Plan
            </DialogDescription>
            
            <div className="space-y-4">
              <div className="bg-primary/5 border border-primary/20 rounded-lg p-4">
                <div className="text-center space-y-3">
                  <div className="text-3xl font-bold text-primary">
                    £39<span className="text-base text-muted-foreground">/month</span>
                  </div>
                  <h3 className="text-lg font-semibold">Advanced Plan</h3>
                  
                  <div className="flex items-center gap-2 text-sm bg-white/50 rounded p-2">
                    {icon}
                    <span className="text-left">
                      <strong>{title}</strong><br/>
                      <span className="text-muted-foreground text-xs">{description}</span>
                    </span>
                  </div>
                  
                  <div className="text-xs text-left text-muted-foreground space-y-1">
                    <p className="font-medium">Plus all Advanced features:</p>
                    <p>• Unlimited document storage</p>
                    <p>• Calendar & inspection scheduling</p>
                    <p>• Maintenance tracking & reporting</p>
                    <p>• Technical bulletins access</p>
                    <p>• Priority 24/7 support</p>
                  </div>
                </div>
              </div>
              
              <PlanSelection />
            </div>
          </DialogContent>
        </Dialog>
      </CardContent>
    </Card>
  );
};