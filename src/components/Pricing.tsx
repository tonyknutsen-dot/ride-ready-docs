import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Check } from "lucide-react";

const Pricing = () => {
  const features = [
    "Unlimited document storage",
    "All document types supported",
    "Technical bulletin access",
    "Mobile app access",
    "Automated compliance reminders",
    "Council-ready document packages",
    "24/7 customer support",
    "Data backup & security"
  ];

  return (
    <section className="py-20 bg-background">
      <div className="container mx-auto px-6">
        <div className="text-center mb-16">
          <h2 className="text-4xl md:text-5xl font-bold mb-6 text-primary">
            Simple, Transparent Pricing
          </h2>
          <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
            One affordable monthly price gives you access to everything you need 
            to manage your fairground documentation professionally.
          </p>
        </div>

        <div className="max-w-lg mx-auto">
          <Card className="relative overflow-hidden shadow-elegant hover:shadow-glow transition-smooth border-2 border-primary/20">
            {/* Popular badge */}
            <div className="absolute top-0 left-1/2 transform -translate-x-1/2 -translate-y-1/2">
              <div className="bg-accent-gradient px-6 py-2 rounded-full">
                <span className="text-sm font-semibold text-accent-foreground">Most Popular</span>
              </div>
            </div>

            <CardHeader className="text-center pt-12 pb-8">
              <CardTitle className="text-3xl font-bold text-primary mb-2">
                Professional Plan
              </CardTitle>
              <div className="mb-4">
                <span className="text-5xl font-bold text-primary">£29</span>
                <span className="text-xl text-muted-foreground">/month</span>
              </div>
              <p className="text-muted-foreground">
                Everything you need to manage your fairground documents
              </p>
            </CardHeader>

            <CardContent className="px-8 pb-8">
              <ul className="space-y-4 mb-8">
                {features.map((feature, index) => (
                  <li key={index} className="flex items-center">
                    <div className="bg-primary/10 rounded-full p-1 mr-3 flex-shrink-0">
                      <Check className="h-4 w-4 text-primary" />
                    </div>
                    <span className="text-foreground">{feature}</span>
                  </li>
                ))}
              </ul>

              <Button 
                className="w-full bg-primary hover:bg-primary/90 text-primary-foreground py-4 text-lg font-semibold shadow-elegant transition-smooth"
                size="lg"
              >
                Start 30-Day Free Trial
              </Button>

              <div className="text-center mt-6 space-y-2 text-sm text-muted-foreground">
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
          <Button variant="outline" size="lg">
            Contact Sales
          </Button>
        </div>
      </div>
    </section>
  );
};

export default Pricing;