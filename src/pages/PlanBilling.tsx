import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useTester } from "@/contexts/TesterContext";
import { useStaff } from "@/contexts/StaffContext";
import { useSubscription } from "@/hooks/useSubscription";
import { useToast } from "@/hooks/use-toast";
import { Loader2, ArrowLeft, CheckCircle2, Crown, Receipt, CreditCard, Calendar, ExternalLink, Settings, FlaskConical, Unlock, RefreshCw, X, ShieldAlert, Lock, Gauge, TrendingUp, FileText, Users, Bell, Shield, Wrench } from "lucide-react";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogTrigger } from "@/components/ui/dialog";
import { PlanSelection } from "@/components/PlanSelection";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { StripeInstructionModal } from "@/components/StripeInstructionModal";
import { format } from "date-fns";

const PLAN_FEATURES = [
  { icon: CheckCircle2, label: "Billable items determine your current plan" },
  { icon: Gauge, label: "Each plan has an item limit and next tier" },
  { icon: Wrench, label: "Registered items are tracked across all categories" },
  { icon: Shield, label: "Non-billable items are tracked separately" },
  { icon: TrendingUp, label: "Upgrade plan when nearing your item limit" },
  { icon: Users, label: "Self-serve limit is 50 billable items" },
];

import { RIDE_TIERS } from '@/config/stripePricing';

// Derive tier limits from single source of truth
const TIER_LIMITS: Record<string, number> = Object.fromEntries(
  Object.entries(RIDE_TIERS).map(([key, val]) => [key, val.max])
);

export default function PlanBilling() {
  const { user } = useAuth();
  const { isTester } = useTester();
  const { isStaff, isOwner } = useStaff();
  const { toast } = useToast();
  const nav = useNavigate();
  const [searchParams] = useSearchParams();
  const { subscription, loading, openCustomerPortal, refreshSubscription, checkSubscriptionStatus } = useSubscription();
  const [portalLoading, setPortalLoading] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [showReturnBanner, setShowReturnBanner] = useState(false);
  const [showStripeModal, setShowStripeModal] = useState(false);

  // Handle success/cancel from Stripe checkout — must be before any early returns
  useEffect(() => {
    const success = searchParams.get('success');
    const canceled = searchParams.get('canceled');

    if (success === 'true') {
      // Refresh the auth session in case the JWT expired while user was in Stripe
      supabase.auth.refreshSession().then(() => {
        checkSubscriptionStatus();
      });
      toast({ 
        title: "Subscription activated!", 
        description: "Thank you for subscribing. Your plan is now active.",
      });
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

  // Show the instruction modal instead of directly opening Stripe
  const handleManageSubscriptionClick = () => {
    setShowStripeModal(true);
  };

  const handleContinueToStripe = async () => {
    setPortalLoading(true);
    setShowReturnBanner(true);
    setShowStripeModal(false);
    try {
      await openCustomerPortal();
    } catch (error) {
      console.error('Portal error:', error);
      setShowReturnBanner(false);
      toast({ 
        title: "Couldn't open billing portal", 
        description: "Please try again later.", 
        variant: "destructive" 
      });
    } finally {
      setPortalLoading(false);
    }
  };

  const handleRefreshAndDismiss = async () => {
    await supabase.auth.refreshSession();
    await checkSubscriptionStatus();
    setShowReturnBanner(false);
    toast({ title: "Subscription status updated", description: "Your billing information is now current." });
  };

  // Block staff members from accessing billing
  if (isStaff && !isOwner) {
    return (
      <div className="p-4 max-w-2xl mx-auto space-y-4 pb-20 md:pb-4">
        <Button variant="ghost" onClick={() => nav('/overview')} className="hover:bg-primary/10">
          <ArrowLeft className="w-4 h-4 mr-2" />Back to Overview
        </Button>
        <Card className="border-2 border-destructive/30 bg-gradient-to-br from-destructive/5 to-transparent shadow-elegant">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ShieldAlert className="w-5 h-5 text-destructive" />
              Access Restricted
            </CardTitle>
            <CardDescription>Staff members cannot access billing settings.</CardDescription>
          </CardHeader>
          <CardContent>
            <Alert className="border-destructive/30">
              <ShieldAlert className="h-4 w-4" />
              <AlertTitle>Staff Account</AlertTitle>
              <AlertDescription>
                Billing and subscription management is only available to the account owner.
                Please contact your organisation administrator if you need to discuss billing matters.
              </AlertDescription>
            </Alert>
          </CardContent>
        </Card>
      </div>
    );
  }

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

  // TESTER BYPASS: Show tester billing page
  if (isTester) {
    return (
      <div className="p-4 max-w-2xl mx-auto space-y-4 pb-20 md:pb-4">
        <Button variant="ghost" onClick={() => nav('/settings')} className="hover:bg-primary/10">
          <ArrowLeft className="w-4 h-4 mr-2" />Back to Settings
        </Button>

        <Card className="border-2 border-warning/50 bg-gradient-to-br from-warning/10 to-transparent shadow-elegant">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FlaskConical className="w-5 h-5 text-warning" />
              Tester Account
            </CardTitle>
            <CardDescription>You have full access without billing.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="rounded-lg border-2 border-warning/30 p-4 space-y-3 bg-warning/5">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-warning/20 flex items-center justify-center">
                  <Unlock className="w-5 h-5 text-warning" />
                </div>
                <div>
                  <div className="font-semibold flex items-center gap-2">
                    All Features Unlocked
                    <Badge variant="outline" className="text-xs bg-warning/20 border-warning/50">
                      Tester
                    </Badge>
                  </div>
                  <div className="text-sm text-muted-foreground">
                    Full access to all paid features without any charges
                  </div>
                </div>
              </div>
            </div>

            <Separator />

            <div className="bg-muted/50 rounded-lg p-4 text-sm space-y-2">
              <p className="font-medium">Tester Benefits:</p>
              <ul className="list-disc list-inside space-y-1 text-muted-foreground">
                <li>Full access to all features</li>
                <li>Unlimited registered items</li>
                <li>No Stripe checkout or invoices</li>
                <li>Activity flagged as test data</li>
              </ul>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  const status = subscription?.subscriptionStatus ?? "trial";
  const isTrialOrExpired = status === "trial" || status === "expired" || !subscription?.hasStripeSubscription;

  const getPlanName = () => {
    if (status === 'active') return `${subscription?.tierLabel || 'Starter'} Plan`;
    if (status === "trial") return "Free Trial";
    return "Expired";
  };

  return (
    <div className="p-4 max-w-2xl mx-auto space-y-4 pb-20 md:pb-4">
      <Button variant="ghost" onClick={() => nav('/settings')} className="hover:bg-primary/10">
        <ArrowLeft className="w-4 h-4 mr-2" />Back to Settings
      </Button>

      {/* Return from Stripe Banner */}
      {showReturnBanner && (
        <Alert className="border-2 border-info bg-info/10 animate-pulse">
          <RefreshCw className="h-5 w-5 text-info" />
          <AlertTitle className="text-info font-semibold">Finished with Stripe?</AlertTitle>
          <AlertDescription className="flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between mt-2">
            <span className="text-sm">
              If you've completed your changes in the Stripe tab, click below to refresh your subscription status.
            </span>
            <div className="flex gap-2">
              <Button size="sm" onClick={handleRefreshAndDismiss} className="bg-info hover:bg-info/90 text-white">
                <RefreshCw className="w-4 h-4 mr-1" /> Refresh Status
              </Button>
              <Button size="sm" variant="ghost" onClick={() => setShowReturnBanner(false)}>
                <X className="w-4 h-4" />
              </Button>
            </div>
          </AlertDescription>
        </Alert>
      )}

      {/* Current Plan Card */}
      <Card className="border border-[#BFDBFE] bg-card shadow-sm">
        <CardHeader className="pb-3">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-[#DBEAFE] flex items-center justify-center">
              <Crown className="w-4 h-4 text-[#1D4ED8]" />
            </div>
            <div>
              <CardTitle className="text-base">Plan & Billing</CardTitle>
              <CardDescription className="text-xs">Manage your current plan, item limit, and invoices.</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Plan identity row */}
          <div className="flex items-start justify-between gap-3 p-4 rounded-xl bg-[#F8FAFC] border border-[#E2E8F0]">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <span className="font-bold text-foreground">{getPlanName()}</span>
                {!isTrialOrExpired && (
                  <Badge className="text-[10px] px-2 py-0 bg-[#DBEAFE] text-[#1D4ED8] border-[#BFDBFE] hover:bg-[#DBEAFE]">
                    Active
                  </Badge>
                )}
              </div>
              <p className="text-xs text-muted-foreground">
                {status === 'active'
                  ? `Your pricing is based on billable items in your current plan.`
                  : status === "trial"
                  ? `${subscription?.daysRemaining} days remaining in trial`
                  : "Your trial has expired — choose an upgrade plan to continue."}
              </p>
            </div>
            {!isTrialOrExpired && subscription?.tierPrice && (
              <div className="text-right shrink-0">
                <div className="text-2xl font-bold text-foreground leading-none">
                  £{subscription.tierPrice.toFixed(2)}
                </div>
                <div className="text-[11px] text-muted-foreground">/month</div>
              </div>
            )}
          </div>

          {/* Price + renewal tiles (active only) */}
          {!isTrialOrExpired && (
            <div className="grid grid-cols-2 gap-2">
              <div className="flex items-center gap-2 p-3 rounded-lg bg-[#F0FDF4] border border-[#BBF7D0]">
                <CreditCard className="w-4 h-4 text-[#16A34A] shrink-0" />
                <div>
                  <div className="text-[10px] text-muted-foreground uppercase tracking-wide">Price</div>
                  <div className="text-sm font-semibold">£{subscription?.tierPrice?.toFixed(2)}/mo</div>
                </div>
              </div>
              {subscription?.currentPeriodEnd && (
                <div className="flex items-center gap-2 p-3 rounded-lg bg-[#EFF6FF] border border-[#BFDBFE]">
                  <Calendar className="w-4 h-4 text-[#1D4ED8] shrink-0" />
                  <div>
                    <div className="text-[10px] text-muted-foreground uppercase tracking-wide">Renews</div>
                    <div className="text-sm font-semibold">
                      {format(new Date(subscription.currentPeriodEnd), "MMM d, yyyy")}
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Billing model */}
          <div className="space-y-2">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Billing model</p>
            <div className="grid grid-cols-1 gap-1.5">
              {PLAN_FEATURES.map(({ icon: Icon, label }) => (
                <div key={label} className="flex items-center gap-2">
                  <Icon className="h-3.5 w-3.5 text-[#16A34A] shrink-0" />
                  <span className="text-xs text-muted-foreground">{label}</span>
                </div>
              ))}
            </div>
          </div>

          <Separator />

          {/* Actions */}
          <div className="space-y-3">
            {isTrialOrExpired ? (
              <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
                <DialogTrigger asChild>
                  <Button className="w-full bg-gradient-to-r from-accent to-primary hover:opacity-90 text-white shadow-md">
                    <Crown className="w-4 h-4 mr-2" />
                    {status === "expired" ? "Reactivate Subscription" : "Subscribe Now"}
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
                  <PlanSelection onClose={() => setDialogOpen(false)} />
                </DialogContent>
              </Dialog>
            ) : (
              <Button
                variant="outline"
                className="w-full border-2 hover:bg-primary/10 hover:border-primary"
                onClick={handleManageSubscriptionClick}
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
            )}
          </div>
        </CardContent>
      </Card>

      {/* Ride Usage Card */}
      {(() => {
        const billable = subscription?.billableRideCount ?? 0;
        const planKey = (subscription?.currentTier ?? 'starter').toLowerCase();
        const limit = TIER_LIMITS[planKey] ?? 5;
        const isNearLimit = limit !== Infinity && billable >= limit * 0.8;
        const isAtLimit = limit !== Infinity && billable >= limit;
        const pct = limit === Infinity ? 0 : Math.min(100, Math.round((billable / limit) * 100));
        const barColor = isAtLimit ? '#DC2626' : isNearLimit ? '#F59E0B' : '#1D4ED8';

        return (
          <Card className="border border-[#C7D2FE] bg-card shadow-sm">
            <CardHeader className="pb-3">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-[#EEF2FF] flex items-center justify-center">
                  <Gauge className="w-4 h-4 text-[#4F46E5]" />
                </div>
                <div>
                  <CardTitle className="text-base">Equipment Usage</CardTitle>
                  <CardDescription className="text-xs">Your pricing is based on billable registered items.</CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Usage meter */}
              {limit !== Infinity && (
                <div className="space-y-2">
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-muted-foreground">Billable items used</span>
                    <span className="text-sm font-bold text-foreground">{billable} of {limit}</span>
                  </div>
                  <div className="h-2 rounded-full bg-[#E2E8F0] overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all duration-500"
                      style={{ width: `${pct}%`, backgroundColor: barColor }}
                    />
                  </div>
                  {(isNearLimit || isAtLimit) && (
                    <p className="text-[11px] font-medium" style={{ color: barColor }}>
                      {isAtLimit ? "You've reached the item limit for your current plan. Choose an upgrade plan to move to the next tier, or contact support for capacity above the self-serve limit." : "Approaching your item limit — review the next tier and upgrade plan options."}
                    </p>
                  )}
                </div>
              )}

              {/* Stats row */}
              <div className="space-y-2">
                <div className="flex justify-between items-center py-2 border-b border-border">
                  <span className="text-sm text-muted-foreground">Billable items</span>
                  <span className="font-semibold">{billable}</span>
                </div>
                <div className="flex justify-between items-center py-2 border-b border-border">
                  <span className="text-sm text-muted-foreground">Non-billable items</span>
                  <span className="font-semibold">{subscription?.freeAssetCount ?? 0}</span>
                </div>
                <div className="flex justify-between items-center py-2">
                  <span className="text-sm font-medium">Current tier</span>
                  <Badge variant="outline" className="bg-[#EEF2FF] border-[#C7D2FE] text-[#4F46E5] text-[11px]">
                    {subscription?.tierLabel} — up to {limit === Infinity ? 'unlimited' : limit} items
                  </Badge>
                </div>
              </div>

              {/* Upgrade nudge */}
              {(isNearLimit || isAtLimit) && !isTrialOrExpired && (
                <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
                  <DialogTrigger asChild>
                    <Button size="sm" className="w-full bg-[#1D4ED8] hover:bg-[#1E40AF] text-white">
                      <TrendingUp className="w-3.5 h-3.5 mr-1.5" />
                      Upgrade Plan
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
                    <PlanSelection onClose={() => setDialogOpen(false)} />
                  </DialogContent>
                </Dialog>
              )}
            </CardContent>
          </Card>
        );
      })()}


      {/* Billing History Card */}
      <Card className="border border-[#BBF7D0] bg-card shadow-sm">
        <CardHeader className="pb-3">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-[#F0FDF4] flex items-center justify-center">
              <Receipt className="w-4 h-4 text-[#16A34A]" />
            </div>
            <div>
              <CardTitle className="text-base">Billing History</CardTitle>
              <CardDescription className="text-xs">Access your invoices, receipts, and payment confirmations.</CardDescription>
            </div>
          </div>
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
                onClick={handleManageSubscriptionClick}
                disabled={portalLoading}
                className="border border-[#BBF7D0] hover:bg-[#F0FDF4] text-[#16A34A] hover:border-[#16A34A]"
              >
                {portalLoading ? (
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                ) : (
                  <ExternalLink className="w-4 h-4 mr-2" />
                )}
                Open Billing Portal
              </Button>
            </div>
          ) : (
            <div className="rounded-lg border border-dashed border-muted p-8 text-center bg-muted/20">
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

      {/* Trust footer */}
      <p className="text-center text-[11px] text-muted-foreground pb-2">
        🔒 Payments processed securely via Stripe. Your card details are never stored on our servers.
      </p>

      {/* Stripe Instruction Modal */}
      <StripeInstructionModal
        open={showStripeModal}
        onClose={() => setShowStripeModal(false)}
        onContinue={handleContinueToStripe}
        isPortal={true}
        loading={portalLoading}
      />
    </div>
  );
}
