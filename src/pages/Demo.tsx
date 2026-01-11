import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useNavigate } from "react-router-dom";
import { 
  ArrowLeft,
  ArrowRight,
  Monitor,
  Smartphone,
  CheckCircle,
  Play
} from "lucide-react";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import { useDetectedTerminology } from "@/hooks/useTerminology";
import { useState } from "react";

// Import demo screenshots
import demoDashboard from "@/assets/demo-dashboard.jpg";
import demoRides from "@/assets/demo-rides.jpg";
import demoChecks from "@/assets/demo-checks.jpg";

const Demo = () => {
  const navigate = useNavigate();
  const terminology = useDetectedTerminology();
  const [activeScreen, setActiveScreen] = useState(0);

  const screens = [
    {
      title: "Dashboard Overview",
      description: "Get a complete view of your operations at a glance. Track documents, rides, maintenance records, and upcoming inspections all in one place.",
      image: demoDashboard,
      features: ["Real-time statistics", "Quick action buttons", "System status at a glance"]
    },
    {
      title: "Equipment Management",
      description: "Organize all your rides and equipment with detailed records, documents, and compliance tracking for each item.",
      image: demoRides,
      features: ["Ride catalog with images", "Document management per ride", "Status indicators"]
    },
    {
      title: "Safety Checklists",
      description: "Complete digital safety checks on any device. Daily, monthly, and yearly inspection templates with full audit history.",
      image: demoChecks,
      features: ["Mobile-friendly checklists", "Progress tracking", "Digital signatures"]
    }
  ];

  const nextScreen = () => {
    setActiveScreen((prev) => (prev + 1) % screens.length);
  };

  const prevScreen = () => {
    setActiveScreen((prev) => (prev - 1 + screens.length) % screens.length);
  };

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <main className="container mx-auto px-6 pt-24 pb-12">
        {/* Header Section */}
        <div className="text-center mb-12">
          <Button 
            variant="ghost" 
            onClick={() => navigate('/')}
            className="mb-6 text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Home
          </Button>
          
          <h1 className="text-4xl md:text-5xl font-bold mb-4 text-foreground">
            See the App in Action
          </h1>
          <p className="text-xl text-muted-foreground max-w-3xl mx-auto">
            Take a visual tour of Ride Ready Docs. These screenshots show exactly what you'll get 
            when you sign up – a powerful, easy-to-use platform for {terminology.isUK ? 'showmen' : 'operators'}.
          </p>
        </div>

        {/* Device Toggle */}
        <div className="flex justify-center gap-2 mb-8">
          <Badge variant="secondary" className="px-4 py-2 gap-2">
            <Monitor className="w-4 h-4" />
            Desktop & Tablet
          </Badge>
          <Badge variant="outline" className="px-4 py-2 gap-2">
            <Smartphone className="w-4 h-4" />
            Mobile Ready
          </Badge>
        </div>

        {/* Screenshot Gallery */}
        <div className="max-w-6xl mx-auto mb-16">
          <Card className="overflow-hidden border-2 border-primary/30 shadow-elegant bg-gradient-to-b from-card to-primary/[0.02]">
            {/* Browser Chrome */}
            <div className="bg-gradient-to-r from-secondary to-primary/10 px-4 py-3 border-b border-primary/20 flex items-center gap-2">
              <div className="flex gap-1.5">
                <div className="w-3 h-3 rounded-full bg-destructive"></div>
                <div className="w-3 h-3 rounded-full bg-accent"></div>
                <div className="w-3 h-3 rounded-full bg-success"></div>
              </div>
              <div className="flex-1 mx-4">
                <div className="bg-card border border-primary/20 rounded-md px-4 py-1.5 text-sm text-muted-foreground max-w-md mx-auto text-center">
                  app.ridereadydocs.com/{screens[activeScreen].title.toLowerCase().replace(' ', '-')}
                </div>
              </div>
            </div>

            {/* Screenshot Display */}
            <div className="relative aspect-video bg-gradient-to-br from-secondary to-primary/10">
              <img 
                src={screens[activeScreen].image} 
                alt={screens[activeScreen].title}
                className="w-full h-full object-cover object-top"
              />
              
              {/* Navigation Arrows */}
              <button 
                onClick={prevScreen}
                className="absolute left-4 top-1/2 -translate-y-1/2 p-3 bg-background/90 hover:bg-background rounded-full shadow-lg transition-all hover:scale-110"
              >
                <ArrowLeft className="w-5 h-5" />
              </button>
              <button 
                onClick={nextScreen}
                className="absolute right-4 top-1/2 -translate-y-1/2 p-3 bg-background/90 hover:bg-background rounded-full shadow-lg transition-all hover:scale-110"
              >
                <ArrowRight className="w-5 h-5" />
              </button>
            </div>

            {/* Screen Info */}
            <CardContent className="p-6 bg-gradient-to-b from-secondary/50 to-transparent">
              <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
                <div className="flex-1">
                  <h2 className="text-2xl font-bold mb-2">{screens[activeScreen].title}</h2>
                  <p className="text-muted-foreground">{screens[activeScreen].description}</p>
                </div>
                <div className="flex flex-wrap gap-2">
                  {screens[activeScreen].features.map((feature, idx) => (
                    <Badge key={idx} variant="secondary" className="gap-1">
                      <CheckCircle className="w-3 h-3" />
                      {feature}
                    </Badge>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Screen Dots */}
          <div className="flex justify-center gap-2 mt-6">
            {screens.map((screen, idx) => (
              <button
                key={idx}
                onClick={() => setActiveScreen(idx)}
                className={`w-3 h-3 rounded-full transition-all ${
                  idx === activeScreen 
                    ? 'bg-primary w-8' 
                    : 'bg-muted-foreground/30 hover:bg-muted-foreground/50'
                }`}
              />
            ))}
          </div>
        </div>

        {/* Thumbnail Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-16">
          {screens.map((screen, idx) => (
            <Card 
              key={idx}
              className={`cursor-pointer transition-all hover:shadow-elegant overflow-hidden border-2 ${
                idx === activeScreen ? 'ring-2 ring-primary border-primary/30' : 'border-border/50 hover:border-primary/30'
              }`}
              onClick={() => setActiveScreen(idx)}
            >
              <div className="aspect-video bg-gradient-to-br from-secondary to-primary/10 relative">
                <img 
                  src={screen.image} 
                  alt={screen.title}
                  className="w-full h-full object-cover object-top"
                />
                {idx === activeScreen && (
                  <div className="absolute inset-0 bg-primary/10 flex items-center justify-center">
                    <Badge className="bg-primary text-primary-foreground">
                      <Play className="w-3 h-3 mr-1" />
                      Viewing
                    </Badge>
                  </div>
                )}
              </div>
              <CardContent className="p-4">
                <h3 className="font-semibold">{screen.title}</h3>
                <p className="text-sm text-muted-foreground line-clamp-2">{screen.description}</p>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Feature Highlights */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-16">
          {[
            { title: "Cloud-Based", desc: "Access from any device, anywhere" },
            { title: "Real-Time Sync", desc: "Changes update instantly" },
            { title: "Secure Storage", desc: "Enterprise-grade encryption" },
            { title: "Offline Ready", desc: "Works without internet" }
          ].map((feature, idx) => (
            <Card key={idx} className="text-center p-6 border-2 border-primary/20 bg-gradient-to-b from-card to-primary/[0.02] hover:shadow-elegant transition-all">
              <CheckCircle className="w-8 h-8 text-primary mx-auto mb-3" />
              <h3 className="font-semibold mb-1">{feature.title}</h3>
              <p className="text-sm text-muted-foreground">{feature.desc}</p>
            </Card>
          ))}
        </div>

        {/* CTA Section */}
        <Card className="max-w-2xl mx-auto text-center border-2 border-accent/30 bg-gradient-to-br from-accent/5 to-primary/5">
          <CardContent className="p-8">
            <h2 className="text-2xl font-bold mb-4">Ready to get started?</h2>
            <p className="text-muted-foreground mb-6">
              Join hundreds of {terminology.isUK ? 'showmen' : 'operators'} who trust Ride Ready Docs 
              to keep their operations safe and compliant.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Button 
                size="lg" 
                className="bg-primary hover:bg-primary/90"
                onClick={() => navigate('/auth')}
              >
                Start Free Trial
              </Button>
              <Button 
                variant="outline" 
                size="lg"
                onClick={() => navigate('/#pricing')}
              >
                View Pricing
              </Button>
            </div>
          </CardContent>
        </Card>
      </main>
      <Footer />
    </div>
  );
};

export default Demo;
