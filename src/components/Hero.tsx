import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { isDocs, isChecks } from "@/config/appFlavor";
import { useSubscription } from "@/hooks/useSubscription";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { PlanSelection } from "./PlanSelection";
import { useState } from "react";
import heroImage from "@/assets/hero-fairground.jpg";
import logo from "@/assets/logo.png";

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

    // Check if user has advanced plan
    const hasAdvancedAccess = subscription?.subscriptionStatus === 'advanced';
    
    if (hasAdvancedAccess) {
      navigate('/checks');
    } else {
      setShowUpgradeDialog(true);
    }
  };

  return (
    <section className="relative min-h-screen flex items-center md:items-center overflow-hidden">
      {/* Background Image with Overlay */}
      <div className="absolute inset-0 z-0">
        <img 
          src={heroImage} 
          alt="Professional fairground with modern rides showcasing safety and organization"
          className="w-full h-full object-cover"
        />
        <div className="absolute inset-0 bg-hero-gradient opacity-[0.65]" />
      </div>

      {/* Content */}
      <div className="relative z-10 container mx-auto px-6 pt-32 md:pt-24 text-center text-white">
        <h1 className="text-5xl sm:text-6xl md:text-8xl font-bold mb-6 leading-tight drop-shadow-[0_4px_12px_rgba(0,0,0,1)] [text-shadow:_0_2px_20px_rgb(0_0_0_/_100%)]">
          Complete
          <br />
          Operations
          <br />
          <span className="drop-shadow-[0_4px_12px_rgba(0,0,0,1)] [text-shadow:_0_2px_20px_rgb(0_0_0_/_100%)]">
            Management
          </span>
        </h1>
        
        <p className="text-xl md:text-2xl mb-8 max-w-3xl mx-auto leading-relaxed drop-shadow-[0_3px_10px_rgba(0,0,0,1)] [text-shadow:_0_1px_15px_rgb(0_0_0_/_100%)]">
          The complete management solution designed specifically for showmen. 
          Choose your tool: manage documents & compliance, or handle operations & maintenance.
        </p>
        
        <div className="flex flex-col sm:flex-row gap-4 justify-center items-center">
          <Button 
            size="lg" 
            className="bg-accent hover:bg-accent/90 text-accent-foreground px-8 py-4 text-lg font-semibold shadow-glow transition-smooth min-w-[280px]"
            onClick={handleDocsApp}
          >
            📄 Documents & Compliance
          </Button>
          <Button 
            size="lg"
            className="bg-primary hover:bg-primary/90 text-primary-foreground px-8 py-4 text-lg font-semibold shadow-glow transition-smooth min-w-[280px]"
            onClick={handleChecksApp}
          >
            ⚙️ Operations & Maintenance
          </Button>
        </div>
        
        <div className="mt-6 flex flex-col sm:flex-row gap-4 justify-center items-center">
          <Button 
            variant="outline" 
            size="lg"
            className="border-2 border-white/30 text-white hover:bg-white/10 px-8 py-4 text-lg backdrop-blur-sm transition-smooth"
            onClick={() => navigate('/demo')}
          >
            View Demo
          </Button>
        </div>
        
        <div className="mt-12 text-sm drop-shadow-[0_2px_8px_rgba(0,0,0,1)] [text-shadow:_0_1px_10px_rgb(0_0_0_/_100%)]">
          <p>✓ 30-day free trial • ✓ No setup fees • ✓ Cancel anytime</p>
        </div>
      </div>

      {/* Scroll Indicator */}
      <div className="absolute bottom-8 left-1/2 transform -translate-x-1/2 animate-bounce">
        <div className="w-6 h-10 border-2 border-white/30 rounded-full flex justify-center">
          <div className="w-1 h-3 bg-white/60 rounded-full mt-2 animate-pulse" />
        </div>
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