import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useAuth } from "@/contexts/AuthContext";
import { useSubscription, PRICING } from "@/hooks/useSubscription";
import { useToast } from "@/hooks/use-toast";
import { Loader2, ArrowLeft, CheckCircle2, Crown, Receipt, CreditCard, Calendar, ExternalLink, Settings } from "lucide-react";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogTrigger } from "@/components/ui/dialog";
import { PlanSelection } from "@/components/PlanSelection";
import { format } from "date-fns";

export default function PlanBilling() {
  const { user } = useAuth();
  const { toast } = useToast();
  const nav = useNavigate();
  const [searchParams] = useSearchParams();
  const { subscription, loading, openCustomerPortal, refreshSubscription, checkSubscriptionStatus } = useSubscription();
  const [portalLoading, setPortalLoading] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);

  // Handle success/cancel from Stripe checkout
  useEffect(() => {
    const success = searchParams.get('success');
    const canceled = searchParams.get('canceled');

    if (success === 'true') {
      toast({ 
        title: "Subscription activated!", 
        description: "Thank you for subscribing. Your plan is now active.",
      });
      // Sync subscription status
      checkSubscriptionStatus();
      // Clear URL params
      nav('/billing', { replace: true });
    } else if (canceled === 'true') {
      toast({ 
        title: "Checkout canceled", 
        description: "No changes were made to your subscription.",
        variant: "destructive"
      });
      nav('/billing', { replace: true });
    }
  }, [searchParams, toast, nav, checkSubscriptionStatus]);

  const handleManageSubscription = async () => {
    setPortalLoading(true);
    try {
      await openCustomerPortal();
    } catch (error) {
      console.error('Portal error:', error);
      toast({ 
        title: "Couldn't open billing portal", 
        description: "Please try again later.", 
        variant: "destructive" 
      });
    } finally {
      setPortalLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="p-4">
        <Button variant="ghost" onClick={() => nav('/settings')} className="mb-3">
          <ArrowLeft className="w-4 h-4 mr-2" />Back to Settings
        </Button>
        <Card className="border-2 border-border">
          <CardContent className="py-10 flex items-center justify-center text-muted-foreground">
            <Loader2 className="w-5 h-5 mr-2 animate-spin" /> Loading…
          </CardContent>
        </Card>
      </div>
    );
  }

  const plan = subscription?.subscriptionPlan ?? subscription?.subscriptionStatus ?? "trial";
  const isTrialOrExpired = plan === "trial" || plan === "expired" || !subscription?.stripeSubscriptionId;
  const billingCycle = subscription?.billingCycle ?? "monthly";

  const getPlanPrice = () => {
    if (plan === "basic") {
      return billingCycle === "yearly" ? PRICING.basic.yearly : PRICING.basic.monthly;
    } else if (plan === "advanced") {
      return billingCycle === "yearly" ? PRICING.advanced.yearly : PRICING.advanced.monthly;
    }
    return 0;
  };

  const getPlanName = () => {
    if (plan === "advanced") return "Operations & Maintenance";
    if (plan === "basic") return "Documents & Compliance";
    if (plan === "trial") return "Free Trial";
    return "Expired";
  };

  return (
    <div className="p-4 max-w-2xl mx-auto space-y-4 pb-20 md:pb-4">
      <Button variant="ghost" onClick={() => nav('/settings')} className="hover:bg-primary/10">
        <ArrowLeft className="w-4 h-4 mr-2" />Back to Settings
      </Button>

      {/* Current Plan Card */}
      <Card className="border-2 border-accent/50 bg-gradient-to-br from-accent/10 to-transparent shadow-elegant">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            {plan === "advanced" && <Crown className="w-5 h-5 text-accent" />}
            Plan & Billing
          </CardTitle>
          <CardDescription>Manage your subscription plan and billing.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Current Plan Display */}
          <div className="rounded-lg border-2 border-primary/20 p-4 space-y-3 bg-gradient-to-br from-primary/5 to-transparent">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                  <CheckCircle2 className="w-5 h-5 text-primary" />
                </div>
                <div>
                  <div className="font-semibold flex items-center gap-2">
                    {getPlanName()}
                    {!isTrialOrExpired && (
                      <Badge variant="outline" className="text-xs bg-accent/20 border-accent/50 text-accent-foreground">
                        {billingCycle === "yearly" ? "Annual" : "Monthly"}
                      </Badge>
                    )}
                  </div>
                  <div className="text-sm text-muted-foreground">
                    {plan === "advanced" 
                      ? "Document storage + operations & maintenance features" 
                      : plan === "basic"
                      ? "Essential document storage for compliance"
                      : plan === "trial"
                      ? `${subscription?.daysRemaining} days remaining in trial`
                      : "Your trial has expired"}
                  </div>
                </div>
              </div>
              {plan === "advanced" && <Crown className="w-6 h-6 text-accent" />}
            </div>

            {/* Subscription Details */}
            {!isTrialOrExpired && (
              <>
                <Separator className="bg-primary/20" />
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div className="flex items-center gap-3 p-3 rounded-lg bg-secondary/50 border border-success/20">
                    <div className="w-8 h-8 rounded-full bg-success/10 flex items-center justify-center">
                      <CreditCard className="w-4 h-4 text-success" />
                    </div>
                    <div>
                      <div className="text-muted-foreground text-xs">Price</div>
                      <div className="font-semibold">
                        £{getPlanPrice().toFixed(2)}/{billingCycle === "yearly" ? "year" : "month"}
                      </div>
                    </div>
                  </div>
                  {subscription?.currentPeriodEnd && (
                    <div className="flex items-center gap-3 p-3 rounded-lg bg-secondary/50 border border-info/20">
                      <div className="w-8 h-8 rounded-full bg-info/10 flex items-center justify-center">
                        <Calendar className="w-4 h-4 text-info" />
                      </div>
                      <div>
                        <div className="text-muted-foreground text-xs">Renews</div>
                        <div className="font-semibold">
                          {format(new Date(subscription.currentPeriodEnd), "MMM d, yyyy")}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
                {subscription?.extraItemsCount > 0 && (
                  <div className="text-sm text-muted-foreground p-2 rounded bg-accent/10 border border-accent/20">
                    +{subscription.extraItemsCount} extra items (£{(subscription.extraItemsCount * 0.75).toFixed(2)}/month)
                  </div>
                )}
              </>
            )}
          </div>

          <Separator />

          {/* Actions */}
          <div className="space-y-3">
            {isTrialOrExpired ? (
              <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
                <DialogTrigger asChild>
                  <Button className="w-full bg-gradient-to-r from-accent to-primary hover:opacity-90 text-white shadow-md">
                    <Crown className="w-4 h-4 mr-2" />
                    {plan === "expired" ? "Reactivate Subscription" : "Upgrade Now"}
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
                  <PlanSelection onClose={() => setDialogOpen(false)} />
                </DialogContent>
              </Dialog>
            ) : (
              <div className="flex flex-col sm:flex-row gap-3">
                <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
                  <DialogTrigger asChild>
                    <Button variant="outline" className="flex-1 border-2 border-accent/50 hover:bg-accent/10 hover:border-accent">
                      <Crown className="w-4 h-4 mr-2 text-accent" />
                      Change Plan
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
                    <PlanSelection onClose={() => setDialogOpen(false)} />
                  </DialogContent>
                </Dialog>
                
                <Button 
                  variant="outline" 
                  className="flex-1 border-2 hover:bg-primary/10 hover:border-primary"
                  onClick={handleManageSubscription}
                  disabled={portalLoading}
                >
                  {portalLoading ? (
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  ) : (
                    <Settings className="w-4 h-4 mr-2 text-primary" />
                  )}
                  Manage Subscription
                  <ExternalLink className="w-3 h-3 ml-1" />
                </Button>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Item Usage Card */}
      <Card className="border-2 border-info/30 bg-gradient-to-br from-info/5 to-transparent shadow-elegant">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-full bg-info/10 flex items-center justify-center">
              <Receipt className="w-4 h-4 text-info" />
            </div>
            Item Usage
          </CardTitle>
          <CardDescription>Track your item usage against your plan limits.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            <div className="flex justify-between items-center">
              <span className="text-sm text-muted-foreground">Items used</span>
              <span className="font-semibold text-lg">
                {subscription?.rideCount ?? 0} / {subscription?.rideLimit ?? 5}
              </span>
            </div>
            <div className="w-full bg-secondary rounded-full h-3 border border-info/20 overflow-hidden">
              <div 
                className="bg-gradient-to-r from-info to-primary h-3 rounded-full transition-all shadow-sm"
                style={{ 
                  width: `${Math.min(100, ((subscription?.rideCount ?? 0) / (subscription?.rideLimit ?? 5)) * 100)}%` 
                }}
              />
            </div>
            {subscription && subscription.rideCount >= subscription.rideLimit && (
              <p className="text-xs text-warning font-medium p-2 rounded bg-warning/10 border border-warning/20">
                ⚠️ You've reached your item limit. Extra items cost £0.75/month each.
              </p>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Billing History Card */}
      <Card className="border-2 border-success/30 bg-gradient-to-br from-success/5 to-transparent shadow-elegant">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-full bg-success/10 flex items-center justify-center">
              <Receipt className="w-4 h-4 text-success" />
            </div>
            Billing History
          </CardTitle>
          <CardDescription>View your invoices and payment history.</CardDescription>
        </CardHeader>
        <CardContent>
          {!isTrialOrExpired ? (
            <div className="space-y-3">
              <p className="text-sm text-muted-foreground">
                View and download your invoices in the Stripe billing portal.
              </p>
              <Button 
                variant="outline" 
                size="sm"
                onClick={handleManageSubscription}
                disabled={portalLoading}
                className="border-2 border-success/50 hover:bg-success/10 hover:border-success"
              >
                {portalLoading ? (
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                ) : (
                  <ExternalLink className="w-4 h-4 mr-2 text-success" />
                )}
                View Invoices
              </Button>
            </div>
          ) : (
            <div className="rounded-lg border-2 border-dashed border-muted p-8 text-center bg-secondary/30">
              <div className="w-12 h-12 rounded-full bg-muted/50 flex items-center justify-center mx-auto mb-3">
                <Receipt className="w-6 h-6 text-muted-foreground" />
              </div>
              <p className="text-sm text-muted-foreground">
                No billing history yet. Subscribe to a plan to see your invoices here.
              </p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
