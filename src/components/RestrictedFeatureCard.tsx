import { Lock } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogTrigger } from '@/components/ui/dialog';
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
          <DialogContent className="max-w-2xl">
            <div className="space-y-6">
              <div className="text-center space-y-2">
                <h2 className="text-2xl font-bold">Upgrade to Advanced Plan</h2>
                <p className="text-muted-foreground">
                  Unlock {title.toLowerCase()} and all premium features
                </p>
              </div>
              
              <div className="bg-primary/5 border border-primary/20 rounded-lg p-6">
                <div className="text-center space-y-4">
                  <div className="text-4xl font-bold text-primary">£39<span className="text-lg text-muted-foreground">/month</span></div>
                  <h3 className="text-xl font-semibold">Advanced Plan</h3>
                  <p className="text-muted-foreground">
                    Complete solution for professional fairground operations
                  </p>
                  
                  <div className="text-left space-y-2 max-w-md mx-auto">
                    <p className="text-sm font-medium">Includes this feature:</p>
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      {icon}
                      <span>{title} - {description}</span>
                    </div>
                    
                    <p className="text-sm font-medium mt-4">Plus all Advanced features:</p>
                    <ul className="text-sm text-muted-foreground space-y-1">
                      <li>• Unlimited document storage</li>
                      <li>• Calendar & inspection scheduling</li>
                      <li>• Maintenance tracking</li>
                      <li>• Advanced reporting & analytics</li>
                      <li>• Technical bulletins access</li>
                      <li>• Priority 24/7 support</li>
                    </ul>
                  </div>
                  
                  <PlanSelection />
                </div>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </CardContent>
    </Card>
  );
};