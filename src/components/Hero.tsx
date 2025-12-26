import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useSubscription } from "@/hooks/useSubscription";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { PlanSelection } from "./PlanSelection";
import { useState } from "react";
import heroImage from "@/assets/hero-fairground.jpg";
import { FileText, Settings, ArrowRight, Check } from "lucide-react";

const Hero = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { subscription } = useSubscription();
  const [showUpgradeDialog, setShowUpgradeDialog] = useState(false);

  const handleDocsApp = () => {
    const destination = user ? '/dashboard' : '/auth';
    navigate(destination);
  };

  const handleChecksApp = () => {
    if (!user) {
      navigate('/auth');
      return;
    }

    const hasAdvancedAccess = subscription?.subscriptionStatus === 'advanced';
    
    if (hasAdvancedAccess) {
      navigate('/checks');
    } else {
      setShowUpgradeDialog(true);
    }
  };

  return (
    <section className="relative min-h-[100dvh] flex items-center overflow-hidden">
      {/* Background Image with Overlay */}
      <div className="absolute inset-0 z-0">
        <img 
          src={heroImage} 
          alt="Professional fairground with modern rides"
          className="w-full h-full object-cover"
        />
        <div className="absolute inset-0 bg-gradient-to-b from-black/50 via-black/40 to-black/70" />
      </div>

      {/* Content */}
      <div className="relative z-10 container mx-auto px-4 md:px-6 pt-24 pb-16 md:pt-24 md:pb-20">
        <div className="max-w-4xl mx-auto text-center">
          {/* Badge */}
          <div className="inline-flex items-center gap-2 bg-white/10 backdrop-blur-sm border border-white/20 rounded-full px-4 py-1.5 mb-6 animate-fade-up">
            <span className="w-2 h-2 bg-accent rounded-full animate-pulse" />
            <span className="text-sm font-medium text-white/90">Built for fairground professionals</span>
          </div>

          {/* Headline */}
          <h1 className="text-4xl sm:text-5xl md:text-6xl lg:text-7xl font-bold text-white mb-6 leading-[1.1] tracking-tight animate-fade-up animate-delay-100">
            Complete Operations
            <br />
            <span className="text-accent">Management</span>
          </h1>
          
          {/* Subheadline */}
          <p className="text-lg md:text-xl text-white/80 mb-10 max-w-2xl mx-auto leading-relaxed animate-fade-up animate-delay-200">
            The all-in-one platform designed for showmen. Manage documents, track compliance, 
            handle safety checks, and stay organized—all in one place.
          </p>
          
          {/* CTA Buttons */}
          <div className="flex flex-col sm:flex-row gap-4 justify-center items-center mb-8 animate-fade-up animate-delay-300">
            <Button 
              size="lg" 
              className="w-full sm:w-auto bg-accent hover:bg-accent/90 text-accent-foreground px-8 py-6 text-base font-semibold shadow-glow transition-smooth group"
              onClick={handleDocsApp}
            >
              <FileText className="mr-2 h-5 w-5" />
              Documents & Compliance
              <ArrowRight className="ml-2 h-4 w-4 transition-transform group-hover:translate-x-1" />
            </Button>
            <Button 
              size="lg"
              className="w-full sm:w-auto bg-primary hover:bg-primary/90 text-primary-foreground px-8 py-6 text-base font-semibold shadow-elegant transition-smooth group"
              onClick={handleChecksApp}
            >
              <Settings className="mr-2 h-5 w-5" />
              Operations & Maintenance
              <ArrowRight className="ml-2 h-4 w-4 transition-transform group-hover:translate-x-1" />
            </Button>
          </div>

          {/* Secondary CTA */}
          <div className="animate-fade-up animate-delay-400">
            <Button 
              variant="outline" 
              size="lg"
              className="border-2 border-white/30 text-white bg-white/10 hover:bg-white/20 backdrop-blur-sm px-6 py-5 text-base transition-smooth"
              onClick={() => navigate('/demo')}
            >
              View Demo
            </Button>
          </div>
          
          {/* Trust indicators */}
          <div className="mt-12 flex flex-wrap justify-center gap-x-6 gap-y-2 text-sm text-white/70 animate-fade-up animate-delay-500">
            <div className="flex items-center gap-2">
              <Check className="h-4 w-4 text-accent" />
              <span>30-day free trial</span>
            </div>
            <div className="flex items-center gap-2">
              <Check className="h-4 w-4 text-accent" />
              <span>No setup fees</span>
            </div>
            <div className="flex items-center gap-2">
              <Check className="h-4 w-4 text-accent" />
              <span>Cancel anytime</span>
            </div>
          </div>
        </div>
      </div>

      {/* Scroll Indicator */}
      <div className="absolute bottom-6 left-1/2 transform -translate-x-1/2 animate-bounce">
        <a href="#features" className="block">
          <div className="w-6 h-10 border-2 border-white/40 rounded-full flex justify-center hover:border-white/60 transition-colors">
            <div className="w-1 h-3 bg-white/60 rounded-full mt-2" />
          </div>
        </a>
      </div>

      {/* Upgrade Dialog */}
      <Dialog open={showUpgradeDialog} onOpenChange={setShowUpgradeDialog}>
        <DialogContent className="max-w-4xl">
          <PlanSelection />
        </DialogContent>
      </Dialog>
    </section>
  );
};

export default Hero;