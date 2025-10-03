import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import heroImage from "@/assets/hero-fairground.jpg";

const CallToAction = () => {
  const navigate = useNavigate();
  const { user, loading } = useAuth();

  const handleStartTrial = () => {
    console.log('Button clicked, User:', user, 'Loading:', loading);
    if (loading) {
      console.log('Still loading, waiting...');
      return;
    }
    
    const destination = user ? '/dashboard' : '/auth';
    console.log('Navigating to:', destination);
    navigate(destination);
  };

  return (
    <section className="py-20 text-primary-foreground relative overflow-hidden">
      {/* Background Image */}
      <div 
        className="absolute inset-0 bg-cover bg-center bg-no-repeat"
        style={{ backgroundImage: `url(${heroImage})` }}
      />
      {/* Dark Overlay */}
      <div className="absolute inset-0 bg-gradient-to-br from-primary/95 via-primary/90 to-primary/95" />

      <div className="container mx-auto px-6 text-center relative z-10">
        <h2 className="text-4xl md:text-5xl font-bold mb-6 drop-shadow-[0_4px_12px_rgba(0,0,0,1)]">
          Ready to Transform Your
          <br />
          <span className="bg-accent-gradient bg-clip-text text-transparent drop-shadow-[0_4px_12px_rgba(0,0,0,1)]">
            Fairground Operations?
          </span>
        </h2>
        
        <p className="text-xl md:text-2xl mb-8 max-w-3xl mx-auto opacity-90 drop-shadow-[0_3px_10px_rgba(0,0,0,1)]">
          Manage documents, complete safety checks, and stay compliant. 
          Join showmen who trust RideReady for their complete operations management.
        </p>
        
        <div className="flex flex-col sm:flex-row gap-4 justify-center items-center">
          <Button 
            size="lg" 
            className="bg-accent hover:bg-accent/90 text-accent-foreground px-8 py-4 text-lg font-semibold shadow-glow transition-smooth min-w-[250px]"
            onClick={() => navigate('/auth')}
          >
            Start Free 30-Day Trial
          </Button>
          <Button 
            variant="outline" 
            size="lg"
            className="border-2 border-primary-foreground/30 bg-primary-foreground/5 text-primary-foreground hover:bg-primary-foreground/10 px-8 py-4 text-lg backdrop-blur-sm transition-smooth min-w-[250px]"
            onClick={() => navigate('/demo')}
          >
            View Demo
          </Button>
        </div>
        
        <div className="mt-8 text-sm opacity-90 drop-shadow-[0_2px_8px_rgba(0,0,0,1)]">
          <p>✓ No credit card required • ✓ Both apps included • ✓ Cancel anytime</p>
        </div>
      </div>
    </section>
  );
};

export default CallToAction;