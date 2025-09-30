import Header from "@/components/Header";
import Footer from "@/components/Footer";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { CheckCircle, Upload, Calendar, Bell, FileText, Shield } from "lucide-react";
import { useNavigate } from "react-router-dom";

const HowItWorks = () => {
  const navigate = useNavigate();

  const steps = [
    {
      icon: Upload,
      title: "1. Add Your Rides",
      description: "Start by adding your fairground rides, generators, and equipment to the system. Include details like manufacturer, serial number, and year manufactured."
    },
    {
      icon: FileText,
      title: "2. Upload Documents",
      description: "Upload all your ride documents - safety certificates, insurance, manuals, ADIPS certificates, test certificates, and technical bulletins. Organize them by ride or keep global documents accessible to all."
    },
    {
      icon: Calendar,
      title: "3. Schedule Inspections",
      description: "Set up annual inspections, NDT testing schedules, and daily/monthly/yearly check templates. The system automatically tracks due dates and sends reminders."
    },
    {
      icon: Bell,
      title: "4. Get Notifications",
      description: "Receive automatic alerts for upcoming inspections, expiring documents, and overdue maintenance. Never miss a critical deadline again."
    },
    {
      icon: CheckCircle,
      title: "5. Complete Daily Checks",
      description: "Use customizable templates to perform daily, monthly, and yearly safety checks. Record results digitally with signatures and weather conditions."
    },
    {
      icon: Shield,
      title: "6. Stay Compliant",
      description: "Generate reports, track maintenance history, and access everything from anywhere. Stay audit-ready with organized, searchable records."
    }
  ];

  const features = [
    {
      title: "Document Management",
      items: [
        "Store unlimited documents per ride",
        "Automatic expiry tracking",
        "Version control for updated documents",
        "Global documents accessible to all rides",
        "Quick search and filtering"
      ]
    },
    {
      title: "Inspection Management",
      items: [
        "Annual inspection tracking with ADIPS integration",
        "NDT testing schedules (ultrasonic, magnetic particle, etc.)",
        "Custom daily/monthly/yearly check templates",
        "Digital signatures and weather logging",
        "Inspection history and reports"
      ]
    },
    {
      title: "Maintenance Tracking",
      items: [
        "Log all maintenance activities",
        "Track parts replaced and costs",
        "Schedule preventive maintenance",
        "Attach supporting documents",
        "Complete maintenance history"
      ]
    },
    {
      title: "Compliance & Reporting",
      items: [
        "Generate inspection reports",
        "Export records for audits",
        "Technical bulletin library",
        "Calendar view of all events",
        "Automated reminder system"
      ]
    }
  ];

  return (
    <div className="min-h-screen bg-background">
      <Header />
      
      <main className="pt-24 pb-16">
        {/* Hero Section */}
        <section className="container mx-auto px-6 py-16 text-center">
          <h1 className="text-4xl md:text-5xl font-bold mb-6">
            How Ride Ready Docs Works
          </h1>
          <p className="text-xl text-muted-foreground max-w-3xl mx-auto mb-8">
            A complete document and compliance management system designed specifically for fairground professionals. 
            Here's how to get started and make the most of your platform.
          </p>
        </section>

        {/* Steps Section */}
        <section className="container mx-auto px-6 py-16">
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
            {steps.map((step, index) => (
              <Card key={index} className="border-2 hover:border-primary transition-smooth">
                <CardHeader>
                  <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center mb-4">
                    <step.icon className="h-6 w-6 text-primary" />
                  </div>
                  <CardTitle className="text-xl">{step.title}</CardTitle>
                </CardHeader>
                <CardContent>
                  <CardDescription className="text-base">{step.description}</CardDescription>
                </CardContent>
              </Card>
            ))}
          </div>
        </section>

        {/* Features Section */}
        <section className="container mx-auto px-6 py-16 bg-muted/30 rounded-2xl my-16">
          <h2 className="text-3xl font-bold text-center mb-12">
            Everything You Need to Stay Compliant
          </h2>
          <div className="grid md:grid-cols-2 gap-8">
            {features.map((feature, index) => (
              <Card key={index}>
                <CardHeader>
                  <CardTitle>{feature.title}</CardTitle>
                </CardHeader>
                <CardContent>
                  <ul className="space-y-3">
                    {feature.items.map((item, itemIndex) => (
                      <li key={itemIndex} className="flex items-start space-x-2">
                        <CheckCircle className="h-5 w-5 text-primary flex-shrink-0 mt-0.5" />
                        <span>{item}</span>
                      </li>
                    ))}
                  </ul>
                </CardContent>
              </Card>
            ))}
          </div>
        </section>

        {/* CTA Section */}
        <section className="container mx-auto px-6 py-16 text-center">
          <h2 className="text-3xl font-bold mb-6">
            Ready to Get Started?
          </h2>
          <p className="text-xl text-muted-foreground mb-8 max-w-2xl mx-auto">
            Join showmen across the UK who are simplifying their document management and staying inspection-ready.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Button 
              size="lg"
              onClick={() => navigate('/auth')}
              className="bg-primary hover:bg-primary/90"
            >
              Start Your Free 30-Day Trial
            </Button>
            <Button 
              size="lg"
              variant="outline"
              onClick={() => navigate('/demo')}
            >
              Try the Demo
            </Button>
          </div>
        </section>
      </main>

      <Footer />
    </div>
  );
};

export default HowItWorks;
