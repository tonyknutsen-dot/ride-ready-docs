import { useState } from 'react';
import { Check, FileText, Cog, Loader2 } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { useSubscription, PRICING } from '@/hooks/useSubscription';
import { toast } from 'sonner';

interface PlanSelectionProps {
  onClose?: () => void;
}

export const PlanSelection: React.FC<PlanSelectionProps> = ({ onClose }) => {
  const { subscription, createCheckout } = useSubscription();
  const [basicBillingCycle, setBasicBillingCycle] = useState<'monthly' | 'yearly'>('monthly');
  const [advancedBillingCycle, setAdvancedBillingCycle] = useState<'monthly' | 'yearly'>('monthly');
  const [loadingPlan, setLoadingPlan] = useState<string | null>(null);

  const handleSelectPlan = async (plan: 'basic' | 'advanced') => {
    const billingCycle = plan === 'basic' ? basicBillingCycle : advancedBillingCycle;
    setLoadingPlan(plan);
    try {
      await createCheckout(plan, billingCycle);
      toast.success('Redirecting to checkout...');
      onClose?.();
    } catch (error) {
      console.error('Checkout error:', error);
      toast.error('Failed to create checkout session. Please try again.');
    } finally {
      setLoadingPlan(null);
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
    'Everything in Documents & Compliance',
    'Daily, monthly & yearly checks',
    'Inspection scheduling',
    'NDT testing schedules',
    'Maintenance tracking',
    'Calendar integration',
    'Notifications & alerts',
    'Risk assessment builder (downloadable, printable, emailable)',
    'Advanced reporting',
    'Priority support'
  ];

  const getPrice = (plan: 'basic' | 'advanced', cycle: 'monthly' | 'yearly') => {
    const pricing = PRICING[plan];
    return cycle === 'yearly' ? pricing.yearly : pricing.monthly;
  };

  const getSavings = (plan: 'basic' | 'advanced') => {
    const pricing = PRICING[plan];
    const yearlyCost = pricing.yearly;
    const monthlyCostYearly = pricing.monthly * 12;
    return (monthlyCostYearly - yearlyCost).toFixed(2);
  };

  const isCurrentPlan = (plan: 'basic' | 'advanced', cycle: 'monthly' | 'yearly') => {
    return subscription?.subscriptionStatus === plan && subscription?.billingCycle === cycle;
  };

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
        <Card className={`relative ${isCurrentPlan('basic', basicBillingCycle) ? 'border-primary border-2' : ''}`}>
          {isCurrentPlan('basic', basicBillingCycle) && (
            <Badge className="absolute -top-2 left-1/2 transform -translate-x-1/2 bg-primary">
              Current Plan
            </Badge>
          )}
          <CardHeader>
            <div className="flex items-center gap-2">
              <FileText className="h-5 w-5 text-primary" />
              <CardTitle>Documents & Compliance</CardTitle>
            </div>
            <CardDescription>
              Essential document storage & compliance management
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Billing toggle for Basic */}
            <div className="flex items-center justify-center gap-3 p-2 bg-muted/50 rounded-lg">
              <Label 
                htmlFor="basic-billing-toggle" 
                className={`text-sm cursor-pointer ${basicBillingCycle === 'monthly' ? 'font-semibold text-foreground' : 'text-muted-foreground'}`}
              >
                Monthly
              </Label>
              <Switch
                id="basic-billing-toggle"
                checked={basicBillingCycle === 'yearly'}
                onCheckedChange={(checked) => setBasicBillingCycle(checked ? 'yearly' : 'monthly')}
              />
              <Label 
                htmlFor="basic-billing-toggle" 
                className={`text-sm cursor-pointer ${basicBillingCycle === 'yearly' ? 'font-semibold text-foreground' : 'text-muted-foreground'}`}
              >
                Yearly
              </Label>
            </div>

            <div>
              <div className="text-2xl font-bold">
                £{getPrice('basic', basicBillingCycle).toFixed(2)}
                <span className="text-sm font-normal text-muted-foreground">
                  /{basicBillingCycle === 'yearly' ? 'year' : 'month'}
                </span>
              </div>
              {basicBillingCycle === 'yearly' && (
                <p className="text-xs text-green-600 mt-1">Save £{getSavings('basic')} per year</p>
              )}
              <p className="text-xs text-muted-foreground mt-1">Up to 5 items • 75p/item after</p>
            </div>
            
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
              variant="secondary"
              onClick={() => handleSelectPlan('basic')}
              disabled={isCurrentPlan('basic', basicBillingCycle) || loadingPlan !== null}
            >
              {loadingPlan === 'basic' ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Processing...
                </>
              ) : isCurrentPlan('basic', basicBillingCycle) ? (
                'Current Plan'
              ) : (
                'Choose This Plan'
              )}
            </Button>
          </CardContent>
        </Card>

        {/* Advanced Plan */}
        <Card className={`relative ${isCurrentPlan('advanced', advancedBillingCycle) ? 'border-primary border-2' : 'border-primary'}`}>
          {isCurrentPlan('advanced', advancedBillingCycle) ? (
            <Badge className="absolute -top-2 left-1/2 transform -translate-x-1/2 bg-primary">
              Current Plan
            </Badge>
          ) : (
            <Badge className="absolute -top-2 left-1/2 transform -translate-x-1/2">
              Most Popular
            </Badge>
          )}
          <CardHeader>
            <div className="flex items-center gap-2">
              <Cog className="h-5 w-5 text-primary" />
              <CardTitle>Operations & Maintenance</CardTitle>
            </div>
            <CardDescription>
              Complete documents + operations & maintenance solution
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Billing toggle for Advanced */}
            <div className="flex items-center justify-center gap-3 p-2 bg-muted/50 rounded-lg">
              <Label 
                htmlFor="advanced-billing-toggle" 
                className={`text-sm cursor-pointer ${advancedBillingCycle === 'monthly' ? 'font-semibold text-foreground' : 'text-muted-foreground'}`}
              >
                Monthly
              </Label>
              <Switch
                id="advanced-billing-toggle"
                checked={advancedBillingCycle === 'yearly'}
                onCheckedChange={(checked) => setAdvancedBillingCycle(checked ? 'yearly' : 'monthly')}
              />
              <Label 
                htmlFor="advanced-billing-toggle" 
                className={`text-sm cursor-pointer ${advancedBillingCycle === 'yearly' ? 'font-semibold text-foreground' : 'text-muted-foreground'}`}
              >
                Yearly
              </Label>
            </div>

            <div>
              <div className="text-2xl font-bold">
                £{getPrice('advanced', advancedBillingCycle).toFixed(2)}
                <span className="text-sm font-normal text-muted-foreground">
                  /{advancedBillingCycle === 'yearly' ? 'year' : 'month'}
                </span>
              </div>
              {advancedBillingCycle === 'yearly' && (
                <p className="text-xs text-green-600 mt-1">Save £{getSavings('advanced')} per year</p>
              )}
              <p className="text-xs text-muted-foreground mt-1">Up to 10 items • 75p/item after</p>
            </div>
            
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
              onClick={() => handleSelectPlan('advanced')}
              disabled={isCurrentPlan('advanced', advancedBillingCycle) || loadingPlan !== null}
            >
              {loadingPlan === 'advanced' ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Processing...
                </>
              ) : isCurrentPlan('advanced', advancedBillingCycle) ? (
                'Current Plan'
              ) : (
                'Choose This Plan'
              )}
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
