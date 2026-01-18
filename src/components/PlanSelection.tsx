import { useState } from 'react';
import { Check, FileText, Cog, Loader2, ExternalLink, FlaskConical, Unlock } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { useSubscription, PRICING } from '@/hooks/useSubscription';
import { useTester } from '@/contexts/TesterContext';
import { toast } from 'sonner';

interface PlanSelectionProps {
  onClose?: () => void;
}

export const PlanSelection: React.FC<PlanSelectionProps> = ({ onClose }) => {
  const { subscription, createCheckout, openCustomerPortal } = useSubscription();
  const { isTester } = useTester();
  const [basicBillingCycle, setBasicBillingCycle] = useState<'monthly' | 'yearly'>('monthly');
  const [advancedBillingCycle, setAdvancedBillingCycle] = useState<'monthly' | 'yearly'>('monthly');
  const [loadingPlan, setLoadingPlan] = useState<string | null>(null);

  // TESTER BYPASS: Show tester info instead of plan selection
  if (isTester) {
    return (
      <div className="space-y-6">
        <div className="text-center">
          <div className="w-16 h-16 rounded-full bg-warning/20 flex items-center justify-center mx-auto mb-4">
            <FlaskConical className="h-8 w-8 text-warning" />
          </div>
          <h2 className="text-2xl font-bold">Tester Account</h2>
          <p className="text-muted-foreground mt-2">
            You have full access to all features without a subscription.
          </p>
        </div>
        <Card className="border-warning/50 bg-warning/5">
          <CardContent className="p-6 text-center">
            <div className="flex items-center justify-center gap-2 text-warning mb-2">
              <Unlock className="h-5 w-5" />
              <span className="font-semibold">All Paid Features Unlocked</span>
            </div>
            <p className="text-sm text-muted-foreground">
              As a tester, you can access all features including Operations & Maintenance 
              without any billing. Your activity is flagged as test data.
            </p>
          </CardContent>
        </Card>
        <Button variant="outline" className="w-full" onClick={onClose}>
          Close
        </Button>
      </div>
    );
  }

  // Check if user has an active paid subscription
  const hasActiveSubscription = subscription?.stripeSubscriptionId && 
    (subscription?.subscriptionStatus === 'basic' || subscription?.subscriptionStatus === 'advanced');

  const handleSelectPlan = async (plan: 'basic' | 'advanced') => {
    if (loadingPlan) return; // Prevent double-clicks
    
    const billingCycle = plan === 'basic' ? basicBillingCycle : advancedBillingCycle;
    setLoadingPlan(plan);
    
    try {
      // If user already has a subscription, redirect to customer portal for plan changes
      if (hasActiveSubscription) {
        toast.info('Opening billing portal to manage your plan...');
        await openCustomerPortal();
        onClose?.();
        return;
      }
      
      // Otherwise create a new checkout session
      await createCheckout(plan, billingCycle);
      toast.success('Redirecting to checkout...');
      onClose?.();
    } catch (error) {
      console.error('Checkout error:', error);
      toast.error('Failed to process request. Please try again.');
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
        <h2 className="text-2xl font-bold">
          {hasActiveSubscription ? 'Manage Your Plan' : 'Choose Your Plan'}
        </h2>
        <p className="text-muted-foreground mt-2">
          {hasActiveSubscription 
            ? 'To change your plan or billing cycle, you\'ll be taken to our secure billing portal where any unused time will be credited to your new plan.'
            : 'Select the plan that best fits your needs'}
        </p>
      </div>

      {/* Info banner for existing subscribers */}
      {hasActiveSubscription && (
        <div className="bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800 rounded-lg p-4 text-sm">
          <p className="text-blue-800 dark:text-blue-200">
            <strong>How plan changes work:</strong> When you switch plans or billing cycles, 
            Stripe automatically calculates any unused time from your current plan and credits 
            it toward your new plan. You only pay the difference.
          </p>
        </div>
      )}

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
              <div className="flex items-center gap-1">
                <Label 
                  htmlFor="basic-billing-toggle" 
                  className={`text-sm cursor-pointer ${basicBillingCycle === 'yearly' ? 'font-semibold text-foreground' : 'text-muted-foreground'}`}
                >
                  Yearly
                </Label>
                <Badge className="text-[10px] px-2 py-0.5 animate-savings-badge text-white font-semibold border-0">
                  2 months free
                </Badge>
              </div>
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
              className="w-full border-2 border-primary/20 hover:border-primary hover:bg-primary hover:text-primary-foreground transition-all"
              variant="outline"
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
              ) : hasActiveSubscription ? (
                <>
                  Manage Plan
                  <ExternalLink className="ml-2 h-3 w-3" />
                </>
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
              <div className="flex items-center gap-1">
                <Label 
                  htmlFor="advanced-billing-toggle" 
                  className={`text-sm cursor-pointer ${advancedBillingCycle === 'yearly' ? 'font-semibold text-foreground' : 'text-muted-foreground'}`}
                >
                  Yearly
                </Label>
                <Badge className="text-[10px] px-2 py-0.5 animate-savings-badge text-white font-semibold border-0">
                  2 months free
                </Badge>
              </div>
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
              ) : hasActiveSubscription ? (
                <>
                  Manage Plan
                  <ExternalLink className="ml-2 h-3 w-3" />
                </>
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
