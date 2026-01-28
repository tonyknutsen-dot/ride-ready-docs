import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Download, Smartphone, WifiOff, Zap, Share, ArrowRight } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { useInstallPrompt } from "@/hooks/useInstallPrompt";

const InstallSection = () => {
  const { isInstalled, isInstallable, promptInstall, isIOS, isStandalone } = useInstallPrompt();

  const benefits = [
    {
      icon: Smartphone,
      title: "Install on Any Device",
      description: "Add to your home screen on iPhone, Android, or desktop—no app store needed."
    },
    {
      icon: WifiOff,
      title: "Works Offline",
      description: "Complete checks and access data even without an internet connection."
    },
    {
      icon: Zap,
      title: "Lightning Fast",
      description: "Instant launch from your home screen, just like a native app."
    },
    {
      icon: Share,
      title: "Share with Your Team",
      description: "Easily share the app with staff, contractors, and colleagues."
    }
  ];

  const handleInstall = async () => {
    await promptInstall();
  };

  const handleShare = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: 'Ride Ready Docs',
          text: 'Complete operations management for fairground and amusement operators. Manage documents, safety checks, and stay compliant.',
          url: window.location.origin,
        });
      } catch (err) {
        // User cancelled or share failed
        console.log('Share cancelled');
      }
    } else {
      // Fallback: copy to clipboard
      await navigator.clipboard.writeText(window.location.origin);
    }
  };

  return (
    <section className="py-16 md:py-20 bg-gradient-to-b from-background to-secondary/30">
      <div className="container mx-auto px-4 md:px-6">
        <div className="max-w-5xl mx-auto">
          {/* Header */}
          <div className="text-center mb-12">
            <Badge variant="outline" className="mb-4 border-primary/30 text-primary">
              <Download className="h-3 w-3 mr-1" />
              Install & Go
            </Badge>
            <h2 className="text-3xl md:text-4xl font-bold mb-4 tracking-tight">
              Take It With You <span className="text-primary">Everywhere</span>
            </h2>
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
              Install Ride Ready Docs on your device for instant access, offline functionality, 
              and a native app experience—completely free.
            </p>
          </div>

          {/* Benefits Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-10">
            {benefits.map((benefit, index) => (
              <Card 
                key={index} 
                className="bg-card/50 border-border/50 hover:border-primary/30 transition-colors"
              >
                <CardContent className="pt-6">
                  <div className="p-2 bg-primary/10 rounded-lg w-fit mb-3">
                    <benefit.icon className="h-5 w-5 text-primary" />
                  </div>
                  <h3 className="font-semibold text-foreground mb-1">{benefit.title}</h3>
                  <p className="text-sm text-muted-foreground">{benefit.description}</p>
                </CardContent>
              </Card>
            ))}
          </div>

          {/* Quick Install Steps */}
          <div className="bg-card rounded-2xl border border-border/50 p-6 md:p-8 mb-8">
            <h3 className="text-xl font-semibold mb-6 text-center">Quick Install Guide</h3>
            
            <div className="grid md:grid-cols-3 gap-6">
              {/* iOS */}
              <div className="text-center">
                <div className="inline-flex items-center justify-center w-12 h-12 bg-secondary rounded-full mb-3">
                  <span className="text-lg font-bold text-foreground">iOS</span>
                </div>
                <p className="text-sm text-muted-foreground">
                  Open in Safari → Tap <Share className="inline h-4 w-4 mx-1" /> Share → "Add to Home Screen"
                </p>
              </div>
              
              {/* Android */}
              <div className="text-center">
                <div className="inline-flex items-center justify-center w-12 h-12 bg-secondary rounded-full mb-3">
                  <Smartphone className="h-5 w-5 text-foreground" />
                </div>
                <p className="text-sm text-muted-foreground">
                  Open in Chrome → Tap menu (⋮) → "Install app" or "Add to Home screen"
                </p>
              </div>
              
              {/* Desktop */}
              <div className="text-center">
                <div className="inline-flex items-center justify-center w-12 h-12 bg-secondary rounded-full mb-3">
                  <Download className="h-5 w-5 text-foreground" />
                </div>
                <p className="text-sm text-muted-foreground">
                  Look for install icon in address bar → Click "Install"
                </p>
              </div>
            </div>
          </div>

          {/* CTA Buttons */}
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            {isInstalled || isStandalone ? (
              <div className="inline-flex items-center gap-2 px-4 py-2 bg-green-500/10 text-green-600 rounded-full">
                <Zap className="h-4 w-4" />
                <span className="font-medium">Already Installed!</span>
              </div>
            ) : isInstallable && !isIOS ? (
              <Button 
                size="lg" 
                onClick={handleInstall}
                className="gap-2"
              >
                <Download className="h-5 w-5" />
                Install Now
              </Button>
            ) : (
              <Link to="/install">
                <Button size="lg" className="gap-2">
                  <Download className="h-5 w-5" />
                  View Install Guide
                  <ArrowRight className="h-4 w-4" />
                </Button>
              </Link>
            )}
            
            <Button 
              size="lg" 
              variant="outline"
              onClick={handleShare}
              className="gap-2"
            >
              <Share className="h-5 w-5" />
              Share with Colleagues
            </Button>
          </div>

          {/* Help text */}
          <p className="text-center text-sm text-muted-foreground mt-6">
            Need detailed instructions?{" "}
            <Link to="/install" className="text-primary hover:underline">
              View our full install guide
            </Link>
          </p>
        </div>
      </div>
    </section>
  );
};

export default InstallSection;
