import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Check, Star } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { RIDE_TIERS, getTierLabel, type RideTier } from "@/hooks/useSubscription";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { PublicContactDialog } from "@/components/PublicContactDialog";

const allFeatures = [
  "Document storage & organisation",
  "Expiry alerts (30 & 7 days)",
  "Insurance & safety compliance certificates",
  "Declaration of Compliance (DOC)",
  "Pre-use, daily, weekly, monthly & yearly checks",
  "Inspection scheduling & reminders",
  "NDT testing management",
  "Maintenance log & history",
  "Calendar dashboard",
  "Risk assessment builder",
  "Council-ready document packs",
  "Reports & analytics",
  "Priority support",
];

const tiers: { key: RideTier; rides: string }[] = [
  { key: "starter", rides: "1–5 rides" },
  { key: "operator", rides: "6–12 rides" },
  { key: "professional", rides: "13–25 rides" },
  { key: "enterprise", rides: "25+ rides" },
];

const Pricing = () => {
  const navigate = useNavigate();
  const { user } = useAuth();

  return (
    <section className="py-12 md:py-16 bg-background">
      <div className="container mx-auto px-4 md:px-6">
        {/* Section Header */}
        <div className="text-center mb-10 max-w-2xl mx-auto">
          <h2 className="text-3xl md:text-4xl lg:text-5xl font-bold mb-6 tracking-tight">
            All-in-One Ride <span className="text-primary">Compliance System</span>
          </h2>
          <p className="text-lg text-muted-foreground mb-2">
            Priced fairly by number of rides. Every feature included.
          </p>
          <p className="text-sm text-muted-foreground">
            Stalls, kiosks & generators included free within paid plans.
          </p>
        </div>

        {/* Pricing Table */}
        <Card className="max-w-3xl mx-auto border-2 border-primary/20 shadow-elegant">
          <CardContent className="p-0">
            {/* Table Header */}
            <div className="grid grid-cols-3 gap-4 px-6 py-4 bg-primary/5 border-b font-semibold text-sm">
              <span>Ride Count</span>
              <span className="text-center">Monthly Price</span>
              <span className="text-right">Includes</span>
            </div>

            {/* Tier Rows */}
            {tiers.map(({ key, rides }, index) => {
              const tier = RIDE_TIERS[key];
              const isPopular = key === "operator";
              return (
                <div
                  key={key}
                  className={`grid grid-cols-3 gap-4 px-6 py-5 items-center ${
                    index < tiers.length - 1 ? "border-b" : ""
                  } ${isPopular ? "bg-primary/5" : ""}`}
                >
                  <div>
                    <div className="font-semibold flex items-center gap-2">
                      {getTierLabel(key)}
                      {isPopular && (
                        <span className="text-[10px] bg-primary text-primary-foreground px-2 py-0.5 rounded-full font-bold">
                          Popular
                        </span>
                      )}
                    </div>
                    <div className="text-sm text-muted-foreground">{rides}</div>
                  </div>
                  <div className="text-center">
                    {key === "enterprise" ? (
                      <span className="text-muted-foreground font-medium">Contact us</span>
                    ) : (
                      <span className="text-2xl font-bold">
                        £{tier.monthly}
                        <span className="text-sm font-normal text-muted-foreground">/mo</span>
                      </span>
                    )}
                  </div>
                  <div className="text-right text-sm text-muted-foreground">
                    Full system access
                  </div>
                </div>
              );
            })}
          </CardContent>
        </Card>

        {/* Features List */}
        <div className="max-w-3xl mx-auto mt-10">
          <h3 className="text-xl font-bold text-center mb-6">Everything Included</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {allFeatures.map((feature, index) => (
              <div key={index} className="flex items-center gap-3">
                <div className="flex-shrink-0 w-5 h-5 bg-primary/10 rounded-full flex items-center justify-center">
                  <Check className="h-3 w-3 text-primary" />
                </div>
                <span className="text-sm text-foreground/80">{feature}</span>
              </div>
            ))}
          </div>
        </div>

        {/* CTA */}
        <div className="text-center mt-10">
          <Button
            size="lg"
            className="px-8 py-5 text-base font-semibold shadow-elegant"
            onClick={() => navigate(user ? "/overview" : "/auth")}
          >
            {user ? "Go to Dashboard" : "Start Free Trial"}
          </Button>
          <p className="mt-4 text-xs text-muted-foreground">
            ✓ 14-day free trial • ✓ No credit card required • ✓ Full access • ✓ Cancel anytime
          </p>
        </div>

        {/* Contact */}
        <div className="text-center mt-8">
          <p className="text-muted-foreground mb-4">Need a custom solution for your business?</p>
          <PublicContactDialog
            triggerLabel="Contact Sales →"
            triggerVariant="ghost"
            triggerClassName="text-primary hover:text-primary hover:bg-primary/5"
          />
        </div>

        {/* FAQ */}
        <div className="mt-16 md:mt-24 max-w-3xl mx-auto">
          <h3 className="text-2xl md:text-3xl font-bold text-center mb-8">
            Frequently Asked Questions
          </h3>

          <Accordion type="single" collapsible className="space-y-3">
            <AccordionItem value="pricing" className="border-2 border-primary/20 rounded-lg px-6 bg-gradient-to-r from-card to-primary/[0.02]">
              <AccordionTrigger className="text-left font-medium hover:no-underline py-4">
                How does ride-based pricing work?
              </AccordionTrigger>
              <AccordionContent className="text-muted-foreground pb-4">
                Your plan is based on the number of rides you manage. Stalls, kiosks, generators, and support equipment are included free within any paid plan and don't count toward your ride total. Your billing adjusts automatically as you add or remove rides.
              </AccordionContent>
            </AccordionItem>

            <AccordionItem value="trial" className="border-2 border-success/20 rounded-lg px-6 bg-gradient-to-r from-card to-success/[0.02]">
              <AccordionTrigger className="text-left font-medium hover:no-underline py-4">
                What's included in the free trial?
              </AccordionTrigger>
              <AccordionContent className="text-muted-foreground pb-4">
                Your 14-day free trial gives you full access to every feature — document storage, checks, maintenance, risk assessments, and more. No credit card required. When your trial ends, simply choose a plan to continue.
              </AccordionContent>
            </AccordionItem>

            <AccordionItem value="stalls" className="border-2 border-accent/20 rounded-lg px-6 bg-gradient-to-r from-card to-accent/[0.02]">
              <AccordionTrigger className="text-left font-medium hover:no-underline py-4">
                Do stalls and generators count toward my plan?
              </AccordionTrigger>
              <AccordionContent className="text-muted-foreground pb-4">
                No. Stalls, kiosks, generators, trailers, and support equipment are included free within any paid plan. Only rides and inflatables count toward your ride tier pricing.
              </AccordionContent>
            </AccordionItem>

            <AccordionItem value="features" className="border-2 border-info/20 rounded-lg px-6 bg-gradient-to-r from-card to-info/[0.02]">
              <AccordionTrigger className="text-left font-medium hover:no-underline py-4">
                Are any features locked behind higher plans?
              </AccordionTrigger>
              <AccordionContent className="text-muted-foreground pb-4">
                No. Every paying user gets access to every feature — documents, checks, maintenance, risk assessments, calendar, reports, and more. The only difference between tiers is the number of rides you can manage.
              </AccordionContent>
            </AccordionItem>

            <AccordionItem value="support" className="border-2 border-primary/20 rounded-lg px-6 bg-gradient-to-r from-card to-primary/[0.02]">
              <AccordionTrigger className="text-left font-medium hover:no-underline py-4">
                What support is available?
              </AccordionTrigger>
              <AccordionContent className="text-muted-foreground pb-4">
                All plans include priority email support and access to our Help Centre with guides and tutorials.
              </AccordionContent>
            </AccordionItem>
          </Accordion>
        </div>
      </div>
    </section>
  );
};

export default Pricing;
