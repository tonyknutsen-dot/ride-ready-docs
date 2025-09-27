import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Check } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";

const Pricing = () => {
  const navigate = useNavigate();
  const { user } = useAuth();

  const basicFeatures = [
    "Ride management & setup",
    "Document storage (up to 100 documents)",
    "Basic document types supported",
    "Organize documents by ride",
    "Web-based dashboard access",
    "Email support"
  ];

  const advancedFeatures = [
    "All Basic plan features",
    "Unlimited document storage",
    "All document types supported", 
    "Technical bulletin access",
    "Maintenance tracking & scheduling",
    "Calendar & inspection scheduling",
    "Automated compliance reminders",
    "Council-ready document packages",
    "Advanced reporting & analytics",
    "Priority 24/7 support",
    "Multi-user collaboration"
  ];

  return (
    <section className="py-20 bg-background">
      <div className="container mx-auto px-6">
        <div className="text-center mb-16">
          <h2 className="text-4xl md:text-5xl font-bold mb-6 text-primary">
            Simple, Transparent Pricing
          </h2>
          <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
            Choose the perfect plan for your fairground documentation needs.
          </p>
        </div>

        <div className="grid md:grid-cols-2 gap-8 max-w-6xl mx-auto">
          {/* Basic Plan */}
          <Card className="relative shadow-elegant hover:shadow-glow transition-smooth border-2 border-muted/20">
            <CardHeader className="text-center pt-8 pb-6">
              <CardTitle className="text-2xl font-bold text-primary mb-2">
                Basic Plan
              </CardTitle>
              <div className="mb-4">
                <span className="text-4xl font-bold text-primary">£19</span>
                <span className="text-xl text-muted-foreground">/month</span>
              </div>
              <p className="text-muted-foreground">
                Essential features for small fairground operators
              </p>
            </CardHeader>

            <CardContent className="px-6 pb-8">
              <ul className="space-y-3 mb-8">
                {basicFeatures.map((feature, index) => (
                  <li key={index} className="flex items-center">
                    <div className="bg-primary/10 rounded-full p-1 mr-3 flex-shrink-0">
                      <Check className="h-4 w-4 text-primary" />
                    </div>
                    <span className="text-foreground text-sm">{feature}</span>
                  </li>
                ))}
              </ul>

              <Button 
                variant="outline"
                className="w-full py-3 text-lg font-semibold transition-smooth"
                size="lg"
                onClick={() => navigate(user ? '/dashboard' : '/auth')}
              >
                {user ? 'Go to Dashboard' : 'Start Free Trial'}
              </Button>
            </CardContent>
          </Card>

          {/* Advanced Plan */}
          <Card className="relative shadow-elegant hover:shadow-glow transition-smooth border-2 border-primary/20">
            {/* Popular badge */}
            <div className="absolute top-0 left-1/2 transform -translate-x-1/2 -translate-y-1/2">
              <div className="bg-primary px-6 py-2 rounded-full">
                <span className="text-sm font-semibold text-primary-foreground">Most Popular</span>
              </div>
            </div>

            <CardHeader className="text-center pt-12 pb-6">
              <CardTitle className="text-2xl font-bold text-primary mb-2">
                Advanced Plan
              </CardTitle>
              <div className="mb-4">
                <span className="text-4xl font-bold text-primary">£39</span>
                <span className="text-xl text-muted-foreground">/month</span>
              </div>
              <p className="text-muted-foreground">
                Complete solution for professional fairground operations
              </p>
            </CardHeader>

            <CardContent className="px-6 pb-8">
              <ul className="space-y-3 mb-8">
                {advancedFeatures.map((feature, index) => (
                  <li key={index} className="flex items-center">
                    <div className="bg-primary/10 rounded-full p-1 mr-3 flex-shrink-0">
                      <Check className="h-4 w-4 text-primary" />
                    </div>
                    <span className="text-foreground text-sm">{feature}</span>
                  </li>
                ))}
              </ul>

              <Button 
                className="w-full bg-primary hover:bg-primary/90 text-primary-foreground py-3 text-lg font-semibold shadow-elegant transition-smooth"
                size="lg"
                onClick={() => navigate(user ? '/dashboard' : '/auth')}
              >
                {user ? 'Go to Dashboard' : 'Start Free Trial'}
              </Button>

              <div className="text-center mt-4 space-y-1 text-sm text-muted-foreground">
                <p>✓ No setup fees • ✓ Cancel anytime</p>
                <p>✓ Full access during trial period</p>
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="text-center mt-12">
          <p className="text-muted-foreground mb-4">
            Need a custom solution for your fairground business?
          </p>
          <Button variant="outline" size="lg" onClick={() => navigate(user ? '/dashboard' : '/auth')}>
            {user ? 'Go to Dashboard' : 'Contact Sales'}
          </Button>
        </div>
      </div>
    </section>
  );
};

export default Pricing;