import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";

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
    <section className="py-20 bg-primary text-white relative overflow-hidden">
      {/* Background Pattern */}
      <div className="absolute inset-0 opacity-10">
        <div className="absolute inset-0" 
             style={{
               backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23ffffff' fill-opacity='0.3'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")`,
             }}
        />
      </div>

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
            className="border-2 border-white/30 text-white hover:bg-white/10 px-8 py-4 text-lg backdrop-blur-sm transition-smooth min-w-[250px]"
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