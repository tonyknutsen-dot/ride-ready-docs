import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Check, Star, ChevronDown } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useState } from "react";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";

const Pricing = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [isAnnual, setIsAnnual] = useState(false);

  // Monthly prices
  const basicMonthly = 12.99;
  const advancedMonthly = 20.99;
  
  // Annual prices (2 months free)
  const basicAnnual = basicMonthly * 10;
  const advancedAnnual = advancedMonthly * 10;
  
  // Savings
  const basicSavings = (basicMonthly * 12 - basicAnnual).toFixed(0);
  const advancedSavings = (advancedMonthly * 12 - advancedAnnual).toFixed(0);

  const basicFeatures = [
    "Up to 10 rides or equipment",
    "50p/month per additional ride",
    "100 documents storage",
    "Expiry alerts (30 & 7 days)",
    "Insurance & safety compliance certificates",
    "Declaration of Compliance (DOC) certificates",
    "Organize by ride",
    "Email support"
  ];

  const advancedFeatures = [
    "Everything in Essential, plus:",
    "Up to 12 rides included (50p/month per additional ride)",
    "Unlimited document storage",
    "All document types supported",
    "Daily, monthly & yearly checks",
    "Inspection scheduling & reminders",
    "NDT testing management",
    "Maintenance log & history",
    "Calendar dashboard",
    "Risk assessment builder",
    "Council-ready document packs",
    "Reports & analytics",
    "Priority support"
  ];

  return (
    <section className="py-12 md:py-16 bg-background">
      <div className="container mx-auto px-4 md:px-6">
        {/* Section Header */}
        <div className="text-center mb-10 max-w-2xl mx-auto">
          <h2 className="text-3xl md:text-4xl lg:text-5xl font-bold mb-6 tracking-tight">
            Simple, <span className="text-primary">Transparent</span> Pricing
          </h2>
          <p className="text-lg text-muted-foreground mb-6">
            Choose the perfect plan for your fairground documentation needs. No hidden fees.
          </p>
          
          {/* Billing Toggle */}
          <div className="inline-flex items-center gap-1 bg-muted p-1.5 rounded-xl border-2 border-border shadow-card">
            <button
              onClick={() => setIsAnnual(false)}
              className={`px-6 py-3 rounded-lg text-base font-semibold transition-all ${
                !isAnnual 
                  ? 'bg-primary text-primary-foreground shadow-lg' 
                  : 'text-muted-foreground hover:text-foreground hover:bg-muted-foreground/10'
              }`}
            >
              Monthly
            </button>
            <button
              onClick={() => setIsAnnual(true)}
              className={`px-6 py-3 rounded-lg text-base font-semibold transition-all flex items-center gap-2 ${
                isAnnual 
                  ? 'bg-primary text-primary-foreground shadow-lg' 
                  : 'text-muted-foreground hover:text-foreground hover:bg-muted-foreground/10'
              }`}
            >
              Annual
              <span className={`text-xs px-2 py-1 rounded-full font-bold ${
                isAnnual 
                  ? 'bg-primary-foreground/20 text-primary-foreground' 
                  : 'bg-accent text-accent-foreground'
              }`}>
                2 months free
              </span>
            </button>
          </div>
        </div>

        <div className="grid md:grid-cols-2 gap-6 lg:gap-8 max-w-5xl mx-auto">
          {/* Essential Plan */}
          <Card className="relative border-2 border-border/50 shadow-card hover:shadow-elegant transition-all duration-300">
            <CardHeader className="text-center pb-6 pt-8">
              <div className="inline-flex items-center justify-center w-12 h-12 bg-accent/10 rounded-xl mb-4 mx-auto">
                <Star className="h-6 w-6 text-accent" />
              </div>
              <CardTitle className="text-2xl font-bold mb-2">
                Documents & Compliance
              </CardTitle>
              <p className="text-sm text-muted-foreground mb-4">
                Essential plan for fairground operators
              </p>
              <div className="flex flex-col items-center">
                <div className="flex items-baseline justify-center gap-1">
                  <span className="text-4xl md:text-5xl font-bold">
                    £{isAnnual ? basicAnnual.toFixed(2) : basicMonthly.toFixed(2)}
                  </span>
                  <span className="text-muted-foreground">/{isAnnual ? 'year' : 'month'}</span>
                </div>
                {isAnnual && (
                  <p className="text-sm text-accent font-medium mt-2">
                    Save £{basicSavings}/year
                  </p>
                )}
              </div>
            </CardHeader>

            <CardContent className="px-6 pb-8">
              <ul className="space-y-3 mb-8">
                {basicFeatures.map((feature, index) => (
                  <li key={index} className="flex items-start gap-3">
                    <div className="flex-shrink-0 w-5 h-5 bg-accent/10 rounded-full flex items-center justify-center mt-0.5">
                      <Check className="h-3 w-3 text-accent" />
                    </div>
                    <span className={`text-sm ${index === 1 ? 'font-medium text-accent' : 'text-foreground/80'}`}>
                      {feature}
                    </span>
                  </li>
                ))}
              </ul>

              <Button 
                className="w-full py-5 text-base font-semibold bg-primary hover:bg-primary/90 shadow-elegant transition-all" 
                size="lg" 
                onClick={() => navigate(user ? '/overview' : '/auth')}
              >
                {user ? 'Go to Dashboard' : 'Start 30-Day Free Trial'}
              </Button>
              
              <p className="text-center mt-4 text-xs text-muted-foreground">
                ✓ No credit card required • ✓ Cancel anytime
              </p>
            </CardContent>
          </Card>

          {/* Advanced Plan */}
          <Card className="relative border-2 border-primary/30 shadow-elegant bg-gradient-to-b from-primary/[0.02] to-transparent">
            {/* Popular badge */}
            <div className="absolute -top-3 left-1/2 transform -translate-x-1/2">
              <div className="bg-primary text-primary-foreground px-4 py-1 rounded-full text-sm font-semibold shadow-lg">
                Most Popular
              </div>
            </div>

            <CardHeader className="text-center pb-6 pt-10">
              <div className="inline-flex items-center justify-center w-12 h-12 bg-primary/10 rounded-xl mb-4 mx-auto">
                <Star className="h-6 w-6 text-primary fill-primary" />
              </div>
              <CardTitle className="text-2xl font-bold mb-2">
                Operations & Maintenance
              </CardTitle>
              <p className="text-sm text-muted-foreground mb-4">
                Complete documents + operations solution
              </p>
              <div className="flex flex-col items-center">
                <div className="flex items-baseline justify-center gap-1">
                  <span className="text-4xl md:text-5xl font-bold text-primary">
                    £{isAnnual ? advancedAnnual.toFixed(2) : advancedMonthly.toFixed(2)}
                  </span>
                  <span className="text-muted-foreground">/{isAnnual ? 'year' : 'month'}</span>
                </div>
                {isAnnual && (
                  <p className="text-sm text-primary font-medium mt-2">
                    Save £{advancedSavings}/year
                  </p>
                )}
              </div>
            </CardHeader>

            <CardContent className="px-6 pb-8">
              <ul className="space-y-3 mb-8">
                {advancedFeatures.map((feature, index) => (
                  <li key={index} className="flex items-start gap-3">
                    <div className="flex-shrink-0 w-5 h-5 bg-primary/10 rounded-full flex items-center justify-center mt-0.5">
                      <Check className="h-3 w-3 text-primary" />
                    </div>
                    <span className={`text-sm ${index === 0 ? 'font-medium text-primary' : 'text-foreground/80'}`}>
                      {feature}
                    </span>
                  </li>
                ))}
              </ul>

              <Button 
                className="w-full py-5 text-base font-semibold bg-primary hover:bg-primary/90 shadow-elegant transition-all" 
                size="lg" 
                onClick={() => navigate(user ? '/overview' : '/auth')}
              >
                {user ? 'Go to Dashboard' : 'Start 30-Day Free Trial'}
              </Button>

              <p className="text-center mt-4 text-xs text-muted-foreground">
                ✓ No credit card required • ✓ Full access for 30 days
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Bottom CTA */}
        <div className="text-center mt-12">
          <p className="text-muted-foreground mb-4">
            Need a custom solution for your fairground business?
          </p>
          <Button 
            variant="ghost" 
            size="lg" 
            className="text-primary hover:text-primary hover:bg-primary/5"
            onClick={() => navigate('/auth')}
          >
            Contact Sales →
          </Button>
        </div>

        {/* FAQ Section */}
        <div className="mt-16 md:mt-24 max-w-3xl mx-auto">
          <h3 className="text-2xl md:text-3xl font-bold text-center mb-8">
            Frequently Asked Questions
          </h3>
          
          <Accordion type="single" collapsible className="space-y-3">
            <AccordionItem value="rides" className="border border-border/50 rounded-lg px-6 bg-card">
              <AccordionTrigger className="text-left font-medium hover:no-underline py-4">
                How do ride limits work?
              </AccordionTrigger>
              <AccordionContent className="text-muted-foreground pb-4">
                The Documents & Compliance plan includes up to 10 rides. The Operations & Maintenance plan includes up to 12 rides. 
                If you need to manage more rides, each additional ride costs just 50p per month. This allows you to scale 
                your account as your business grows without paying for capacity you don't need.
              </AccordionContent>
            </AccordionItem>

            <AccordionItem value="billing" className="border border-border/50 rounded-lg px-6 bg-card">
              <AccordionTrigger className="text-left font-medium hover:no-underline py-4">
                How does billing work?
              </AccordionTrigger>
              <AccordionContent className="text-muted-foreground pb-4">
                You can choose to pay monthly or annually. Annual plans include 2 months free (pay for 10 months, get 12). 
                Your subscription renews automatically, and you can cancel anytime. Any additional ride charges are added 
                to your monthly or annual bill.
              </AccordionContent>
            </AccordionItem>

            <AccordionItem value="trial" className="border border-border/50 rounded-lg px-6 bg-card">
              <AccordionTrigger className="text-left font-medium hover:no-underline py-4">
                What's included in the 30-day free trial?
              </AccordionTrigger>
              <AccordionContent className="text-muted-foreground pb-4">
                Your free trial gives you full access to all features of your chosen plan for 30 days. No credit card 
                is required to start. You can add rides, upload documents, run checks, and explore every feature. 
                At the end of your trial, simply choose a plan to continue.
              </AccordionContent>
            </AccordionItem>

            <AccordionItem value="upgrade" className="border border-border/50 rounded-lg px-6 bg-card">
              <AccordionTrigger className="text-left font-medium hover:no-underline py-4">
                Can I upgrade or downgrade my plan?
              </AccordionTrigger>
              <AccordionContent className="text-muted-foreground pb-4">
                Yes! You can upgrade to the Operations & Maintenance plan at any time and we'll prorate the difference. 
                If you need to downgrade, you can do so at the end of your current billing period. Your data is always 
                retained when changing plans.
              </AccordionContent>
            </AccordionItem>

            <AccordionItem value="documents" className="border border-border/50 rounded-lg px-6 bg-card">
              <AccordionTrigger className="text-left font-medium hover:no-underline py-4">
                What document types can I store?
              </AccordionTrigger>
              <AccordionContent className="text-muted-foreground pb-4">
                The Documents & Compliance plan supports essential documents including insurance certificates and Declaration of Compliance (DOC) certificates 
                (known as ADIPS certificates in the UK). The Operations & Maintenance plan supports all document types including maintenance records, 
                NDT reports, risk assessments, operator manuals, and any other documentation you need to keep organised.
              </AccordionContent>
            </AccordionItem>

            <AccordionItem value="support" className="border border-border/50 rounded-lg px-6 bg-card">
              <AccordionTrigger className="text-left font-medium hover:no-underline py-4">
                What support is available?
              </AccordionTrigger>
              <AccordionContent className="text-muted-foreground pb-4">
                All plans include email support. The Operations & Maintenance plan includes priority support with faster 
                response times. We also have a comprehensive Help Centre with guides and tutorials to help you get the 
                most out of RideDoc.
              </AccordionContent>
            </AccordionItem>
          </Accordion>
        </div>
      </div>
    </section>
  );
};

export default Pricing;