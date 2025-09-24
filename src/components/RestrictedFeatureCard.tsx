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
              Upgrade to Access
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-4xl">
            <PlanSelection />
          </DialogContent>
        </Dialog>
      </CardContent>
    </Card>
  );
};