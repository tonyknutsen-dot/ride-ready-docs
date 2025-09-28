import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import heroImage from "@/assets/hero-fairground.jpg";

const Hero = () => {
  const navigate = useNavigate();
  const { user } = useAuth();

  const handleStartTrial = () => {
    const destination = user ? '/dashboard' : '/auth';
    navigate(destination);
  };

  return (
    <section className="relative min-h-screen flex items-center overflow-hidden">
      {/* Background Image with Overlay */}
      <div className="absolute inset-0 z-0">
        <img 
          src={heroImage} 
          alt="Professional fairground with modern rides showcasing safety and organization"
          className="w-full h-full object-cover"
        />
        <div className="absolute inset-0 bg-hero-gradient opacity-85" />
      </div>

      {/* Content */}
      <div className="relative z-10 container mx-auto px-6 text-center text-white">
        <h1 className="text-5xl md:text-7xl font-bold mb-6 leading-tight">
          Your Documents,
          <br />
          <span className="bg-accent-gradient bg-clip-text text-transparent">
            Organized & Secure
          </span>
        </h1>
        
        <p className="text-xl md:text-2xl mb-8 max-w-3xl mx-auto opacity-90 leading-relaxed">
          The complete document management solution designed specifically for showmen. 
          Store all your ride documents, safety certificates, and technical bulletins for rides, generators, and equipment in one secure place.
        </p>
        
        <div className="flex flex-col sm:flex-row gap-4 justify-center items-center">
          <Button 
            size="lg" 
            className="bg-accent hover:bg-accent/90 text-accent-foreground px-8 py-4 text-lg font-semibold shadow-glow transition-smooth"
            onClick={handleStartTrial}
          >
            Start Free Trial
          </Button>
          <Button 
            variant="outline" 
            size="lg"
            className="border-2 border-white/30 text-white hover:bg-white/10 px-8 py-4 text-lg backdrop-blur-sm transition-smooth"
            onClick={() => navigate('/demo')}
          >
            View Demo
          </Button>
        </div>
        
        <div className="mt-12 text-sm opacity-75">
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