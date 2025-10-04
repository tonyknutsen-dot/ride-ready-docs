import { Check, FileText, Cog } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useSubscription } from '@/hooks/useSubscription';
import { toast } from 'sonner';

interface PlanSelectionProps {
  onClose?: () => void;
}

export const PlanSelection: React.FC<PlanSelectionProps> = ({ onClose }) => {
  const { subscription, upgradeSubscription } = useSubscription();

  const handleUpgrade = async (plan: 'basic' | 'advanced') => {
    try {
      await upgradeSubscription(plan);
      toast.success(`Successfully upgraded to ${plan} plan!`);
      onClose?.();
    } catch (error) {
      toast.error('Failed to upgrade subscription. Please try again.');
    }
  };

  const basicFeatures = [
    'File upload & storage',
    'Document management',
    'Email alerts 30 & 7 days before document expiry',
    'Basic organization',
    'Email support'
  ];

  const advancedFeatures = [
    'Everything in Basic',
    'Full ride management system',
    'Inspection scheduling',
    'Maintenance tracking',
    'Calendar integration',
    'Advanced reporting',
    'Priority support'
  ];

  return (
    <div className="space-y-6">
      <div className="text-center">
        <h2 className="text-2xl font-bold">Choose Your Plan</h2>
        <p className="text-muted-foreground mt-2">
          Select the plan that best fits your needs
        </p>
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        {/* Basic Plan */}
        <Card className="relative">
          <CardHeader>
            <div className="flex items-center gap-2">
              <FileText className="h-5 w-5 text-primary" />
              <CardTitle>Basic Plan</CardTitle>
            </div>
            <CardDescription>
              Perfect for simple document management
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="text-2xl font-bold">£12.99<span className="text-sm font-normal text-muted-foreground">/month</span></div>
            
            <ul className="space-y-2">
              {basicFeatures.map((feature, index) => (
                <li key={index} className="flex items-center gap-2">
                  <Check className="h-4 w-4 text-primary" />
                  <span className="text-sm">{feature}</span>
                </li>
              ))}
            </ul>

            <Button 
              className="w-full" 
              variant="outline"
              onClick={() => handleUpgrade('basic')}
              disabled={subscription?.subscriptionStatus === 'basic'}
            >
              {subscription?.subscriptionStatus === 'basic' ? 'Current Plan' : 'Choose Basic'}
            </Button>
          </CardContent>
        </Card>

        {/* Advanced Plan */}
        <Card className="relative border-primary">
          <Badge className="absolute -top-2 left-1/2 transform -translate-x-1/2">
            Most Popular
          </Badge>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Cog className="h-5 w-5 text-primary" />
              <CardTitle>Advanced Plan</CardTitle>
            </div>
            <CardDescription>
              Complete ride management solution
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="text-2xl font-bold">£27.99<span className="text-sm font-normal text-muted-foreground">/month</span></div>
            
            <ul className="space-y-2">
              {advancedFeatures.map((feature, index) => (
                <li key={index} className="flex items-center gap-2">
                  <Check className="h-4 w-4 text-primary" />
                  <span className="text-sm">{feature}</span>
                </li>
              ))}
            </ul>

            <Button 
              className="w-full"
              onClick={() => handleUpgrade('advanced')}
              disabled={subscription?.subscriptionStatus === 'advanced'}
            >
              {subscription?.subscriptionStatus === 'advanced' ? 'Current Plan' : 'Choose Advanced'}
            </Button>
          </CardContent>
        </Card>
      </div>

      {subscription?.isTrialActive && (
        <div className="text-center text-sm text-muted-foreground">
          You can continue with your free trial or upgrade now for immediate access to more features.
        </div>
      )}
    </div>
  );
};