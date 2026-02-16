import { Button } from "@/components/ui/button";
import { useNavigate, Link } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { ArrowRight, Sparkles, Share, Download } from "lucide-react";
import { useDetectedTerminology } from "@/hooks/useTerminology";

const CallToAction = () => {
  const navigate = useNavigate();
  const { user, loading } = useAuth();
  const terminology = useDetectedTerminology();

  const handleStartTrial = () => {
    if (loading) return;
    navigate(user ? '/overview' : '/auth');
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
        console.log('Share cancelled');
      }
    } else {
      await navigator.clipboard.writeText(window.location.origin);
    }
  };

  return (
    <section className="py-20 md:py-28 bg-primary relative overflow-hidden">
      {/* Background Pattern */}
      <div className="absolute inset-0 opacity-[0.03]">
        <div 
          className="absolute inset-0" 
          style={{
            backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23ffffff' fill-opacity='1'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")`
          }} 
        />
      </div>

      {/* Gradient orbs */}
      <div className="absolute top-0 left-1/4 w-96 h-96 bg-accent/20 rounded-full blur-3xl" />
      <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-white/10 rounded-full blur-3xl" />

      <div className="container mx-auto px-4 md:px-6 relative z-10">
        <div className="max-w-3xl mx-auto text-center">
          {/* Badge */}
          <div className="inline-flex items-center gap-2 bg-white/10 backdrop-blur-sm rounded-full px-4 py-1.5 mb-6">
            <Sparkles className="h-4 w-4 text-accent" />
            <span className="text-sm font-medium text-white/90">Start your free trial today</span>
          </div>

          <h2 className="text-3xl md:text-4xl lg:text-5xl font-bold text-white mb-6 tracking-tight">
            Ready to Transform Your
            <br />
            <span className="text-accent">Fairground Operations?</span>
          </h2>
          
          <p className="text-lg md:text-xl text-white/80 mb-10 max-w-2xl mx-auto leading-relaxed">
            Manage documents, complete safety checks, and stay compliant. 
            Join {terminology.isUK ? 'showmen' : 'operators'} who trust RideReady for their complete operations management.
          </p>
          
          <div className="flex flex-col sm:flex-row gap-4 justify-center items-center">
            <Button 
              size="lg" 
              className="w-full sm:w-auto bg-accent hover:bg-accent/90 text-accent-foreground px-8 py-6 text-base font-semibold shadow-glow transition-smooth group"
              onClick={handleStartTrial}
            >
              Start Free 14-Day Trial
              <ArrowRight className="ml-2 h-4 w-4 transition-transform group-hover:translate-x-1" />
            </Button>
            
            <Button 
              size="lg" 
              variant="outline"
              className="w-full sm:w-auto border-white/30 text-white hover:bg-white/10 px-6 py-6 text-base font-semibold"
              onClick={handleShare}
            >
              <Share className="mr-2 h-4 w-4" />
              Share with a Colleague
            </Button>
          </div>
          
          <div className="mt-10 flex flex-wrap justify-center gap-x-6 gap-y-2 text-sm text-white/70">
            <span>✓ No credit card required</span>
            <span>✓ Both apps included</span>
            <span>✓ Install on any device</span>
          </div>

          {/* Install hint */}
          <div className="mt-8 pt-8 border-t border-white/10">
            <p className="text-white/60 text-sm mb-3">
              Works on all your devices — install it like a native app
            </p>
            <Link to="/install">
              <Button 
                variant="ghost" 
                size="sm" 
                className="text-white/70 hover:text-white hover:bg-white/10"
              >
                <Download className="mr-2 h-4 w-4" />
                Learn how to install
              </Button>
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
};

export default CallToAction;