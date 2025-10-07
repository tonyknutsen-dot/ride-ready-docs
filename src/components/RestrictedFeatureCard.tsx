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
  const planName = requiredPlan === 'basic' ? 'Documents & Compliance' : 'Operations & Maintenance';
  
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
              Upgrade to {planName}
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
            <DialogTitle>Upgrade to {planName} - £{requiredPlan === 'basic' ? '12.99' : '27.99'}/month</DialogTitle>
            <DialogDescription>
              Unlock {title.toLowerCase()} and all premium features
            </DialogDescription>
            
            <div className="grid md:grid-cols-2 gap-4 mt-3">
              {/* Feature Highlight - Left */}
              <div className="space-y-3">
                <div className="bg-primary/5 border border-primary/20 rounded p-3">
                  <h3 className="font-medium mb-2 text-sm">You're trying to access:</h3>
                  <div className="flex items-center gap-2 p-2 bg-white/70 rounded border-l-2 border-primary">
                    {icon}
                    <div>
                      <div className="font-medium text-sm text-primary">{title}</div>
                      <div className="text-xs text-muted-foreground">{description}</div>
                    </div>
                  </div>
                </div>
                
                <div>
                  <h3 className="font-medium text-sm mb-2">{planName} includes:</h3>
                  <div className="grid grid-cols-1 gap-1 text-xs">
                    <div className="flex items-center gap-2">
                      <div className="w-1.5 h-1.5 bg-primary rounded-full"></div>
                      <span>Unlimited document storage</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="w-1.5 h-1.5 bg-primary rounded-full"></div>
                      <span>Calendar & inspection scheduling</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="w-1.5 h-1.5 bg-primary rounded-full"></div>
                      <span>Maintenance tracking & reporting</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="w-1.5 h-1.5 bg-primary rounded-full"></div>
                      <span>Technical bulletins access</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="w-1.5 h-1.5 bg-primary rounded-full"></div>
                      <span>Priority support</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Plan Selection - Right */}
              <div>
                <div className="bg-gradient-to-br from-primary/10 to-primary/5 rounded p-4 text-center border mb-3">
                  <div className="text-2xl font-bold text-primary mb-1">
                    £27.99<span className="text-sm text-muted-foreground">/month</span>
                  </div>
                  <div className="text-xs text-muted-foreground mb-2">
                    ✓ No setup fees • ✓ Cancel anytime
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