import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { isDocs, isChecks } from "@/config/appFlavor";
import heroImage from "@/assets/hero-fairground.jpg";

const Hero = () => {
  const navigate = useNavigate();
  const { user } = useAuth();

  const handleDocsApp = () => {
    const destination = user ? '/dashboard' : '/auth';
    navigate(destination);
  };

  const handleChecksApp = () => {
    const destination = user ? '/checks' : '/auth';
    navigate(destination);
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
        <div className="absolute inset-0 bg-hero-gradient opacity-95" />
      </div>

      {/* Content */}
      <div className="relative z-10 container mx-auto px-6 pt-32 md:pt-0 text-center text-white">
        <h1 className="text-5xl sm:text-6xl md:text-8xl font-bold mb-6 leading-tight drop-shadow-[0_4px_12px_rgba(0,0,0,1)] [text-shadow:_0_2px_20px_rgb(0_0_0_/_100%)]">
          Your
          <br />
          Documents
          <br />
          <span className="drop-shadow-[0_4px_12px_rgba(0,0,0,1)] [text-shadow:_0_2px_20px_rgb(0_0_0_/_100%)]">
            Organized & Secure
          </span>
        </h1>
        
        <p className="text-xl md:text-2xl mb-8 max-w-3xl mx-auto leading-relaxed drop-shadow-[0_3px_10px_rgba(0,0,0,1)] [text-shadow:_0_1px_15px_rgb(0_0_0_/_100%)]">
          The complete management solution designed specifically for showmen. 
          Choose your tool: manage documents & compliance, or handle daily/monthly/yearly checks.
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
            ✓ Daily/Monthly/Yearly Checks
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
    </section>
  );
};

export default Hero;