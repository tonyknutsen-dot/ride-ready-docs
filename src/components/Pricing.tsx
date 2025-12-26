import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Check, Star } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";

const Pricing = () => {
  const navigate = useNavigate();
  const { user } = useAuth();

  const basicFeatures = [
    "Up to 8 rides or equipment",
    "Document storage (up to 100 documents)",
    "Email alerts 30 & 7 days before expiry",
    "Basic document types supported",
    "Organize documents by ride",
    "Web-based dashboard access",
    "Email support"
  ];

  const advancedFeatures = [
    "Everything in Essential, plus:",
    "Up to 8 rides or equipment",
    "Unlimited document storage",
    "All document types supported",
    "Daily, monthly & yearly checks",
    "Inspection management & scheduling",
    "NDT testing schedules",
    "Maintenance tracking",
    "Calendar & scheduling system",
    "Risk assessment builder",
    "Council-ready document packages",
    "Advanced reporting & analytics",
    "Priority 24/7 support"
  ];

  return (
    <section className="py-12 md:py-16 bg-background">
      <div className="container mx-auto px-4 md:px-6">
        {/* Section Header */}
        <div className="text-center mb-16 max-w-2xl mx-auto">
          <h2 className="text-3xl md:text-4xl lg:text-5xl font-bold mb-6 tracking-tight">
            Simple, <span className="text-primary">Transparent</span> Pricing
          </h2>
          <p className="text-lg text-muted-foreground">
            Choose the perfect plan for your fairground documentation needs. No hidden fees.
          </p>
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
              <div className="flex items-baseline justify-center gap-1">
                <span className="text-4xl md:text-5xl font-bold">£12.99</span>
                <span className="text-muted-foreground">/month</span>
              </div>
            </CardHeader>

            <CardContent className="px-6 pb-8">
              <ul className="space-y-3 mb-8">
                {basicFeatures.map((feature, index) => (
                  <li key={index} className="flex items-start gap-3">
                    <div className="flex-shrink-0 w-5 h-5 bg-accent/10 rounded-full flex items-center justify-center mt-0.5">
                      <Check className="h-3 w-3 text-accent" />
                    </div>
                    <span className="text-sm text-foreground/80">{feature}</span>
                  </li>
                ))}
              </ul>

              <Button 
                variant="outline" 
                className="w-full py-5 text-base font-semibold border-2 hover:bg-accent/5 hover:border-accent/50 transition-all" 
                size="lg" 
                onClick={() => navigate(user ? '/overview' : '/auth')}
              >
                {user ? 'Go to Dashboard' : 'Start Free Trial'}
              </Button>
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
              <div className="flex items-baseline justify-center gap-1">
                <span className="text-4xl md:text-5xl font-bold text-primary">£27.99</span>
                <span className="text-muted-foreground">/month</span>
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
                {user ? 'Go to Dashboard' : 'Start Free Trial'}
              </Button>

              <p className="text-center mt-4 text-xs text-muted-foreground">
                ✓ No setup fees • ✓ Full access during trial
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
      </div>
    </section>
  );
};

export default Pricing;