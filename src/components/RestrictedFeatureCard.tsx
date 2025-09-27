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
          <DialogContent className="max-w-4xl">
            <DialogTitle>Upgrade to Advanced Plan</DialogTitle>
            <DialogDescription>
              Unlock {title.toLowerCase()} and all premium features
            </DialogDescription>
            
            <div className="grid md:grid-cols-2 gap-6 mt-4">
              {/* Feature Highlight */}
              <div className="space-y-4">
                <div className="bg-primary/5 border border-primary/20 rounded-lg p-4">
                  <h3 className="text-lg font-semibold mb-3">You're trying to access:</h3>
                  <div className="flex items-start gap-3 p-3 bg-white/70 rounded border-l-4 border-primary">
                    {icon}
                    <div>
                      <h4 className="font-medium text-primary">{title}</h4>
                      <p className="text-sm text-muted-foreground mt-1">{description}</p>
                    </div>
                  </div>
                </div>
                
                <div className="space-y-3">
                  <h3 className="font-semibold">What you'll get with Advanced Plan:</h3>
                  <div className="grid grid-cols-1 gap-2 text-sm">
                    <div className="flex items-center gap-2">
                      <div className="w-2 h-2 bg-primary rounded-full"></div>
                      <span>Unlimited document storage</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="w-2 h-2 bg-primary rounded-full"></div>
                      <span>Calendar & inspection scheduling</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="w-2 h-2 bg-primary rounded-full"></div>
                      <span>Maintenance tracking & reporting</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="w-2 h-2 bg-primary rounded-full"></div>
                      <span>Technical bulletins access</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="w-2 h-2 bg-primary rounded-full"></div>
                      <span>Priority 24/7 support</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Plan Selection */}
              <div className="space-y-4">
                <div className="bg-gradient-to-br from-primary/10 to-primary/5 rounded-lg p-6 text-center border">
                  <div className="text-4xl font-bold text-primary mb-2">
                    £27.99<span className="text-lg text-muted-foreground">/month</span>
                  </div>
                  <h3 className="text-xl font-semibold mb-2">Advanced Plan</h3>
                  <p className="text-muted-foreground text-sm mb-4">
                    Complete solution for professional fairground operations
                  </p>
                  
                  <div className="text-xs text-muted-foreground mb-4 space-y-1">
                    <p>✓ No setup fees • ✓ Cancel anytime</p>
                    <p>✓ Full access during trial period</p>
                  </div>
                </div>

                <PlanSelection />
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </CardContent>
    </Card>
  );
};