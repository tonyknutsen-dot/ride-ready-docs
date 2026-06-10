import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { lazy, Suspense } from "react";
import heroImage from "@/assets/hero-fairground.jpg";
import { ArrowRight, Check, Globe, Smartphone } from "lucide-react";

// Lazy load non-critical components to improve LCP
const DeviceHintBanner = lazy(() => import("./DeviceHintBanner"));
const TrustBadges = lazy(() => import("./TrustBadges"));

const Hero = () => {
  const navigate = useNavigate();
  const { user } = useAuth();

  const handlePrimary = () => {
    navigate(user ? '/overview' : '/auth');
  };

  const handleSecondary = () => {
    const el = document.getElementById('features');
    if (el) el.scrollIntoView({ behavior: 'smooth' });
  };

  return (
    <section className="relative min-h-[100dvh] flex items-center overflow-hidden">
      {/* Background Image with Overlay - optimized loading */}
      <div className="absolute inset-0 z-0">
        <img 
          src={heroImage} 
          alt="Professional fairground with modern rides"
          className="w-full h-full object-cover"
          width={1920}
          height={1080}
          loading="eager"
          fetchPriority="high"
          decoding="async"
          style={{ contentVisibility: 'auto' }}
        />
        <div className="absolute inset-0 bg-gradient-to-b from-black/40 via-black/25 to-black/60" />
      </div>

      {/* Local readability panel behind text */}
      <div className="absolute inset-x-0 top-1/2 -translate-y-1/2 h-[70%] z-[1] pointer-events-none">
        <div className="max-w-4xl mx-auto h-full bg-[hsl(215_55%_10%)]/35 blur-2xl rounded-full" />
      </div>

      {/* Content */}
      <div className="relative z-10 container mx-auto px-4 md:px-6 pt-24 pb-16 md:pt-24 md:pb-20">
        <div className="max-w-4xl mx-auto text-center">
          {/* Badge */}
          <div className="inline-flex items-center gap-2 bg-white/10 backdrop-blur-sm border border-white/20 rounded-full px-4 py-1.5 mb-6 animate-fade-up">
            <span className="w-2 h-2 bg-accent rounded-full animate-pulse" />
            <span className="text-sm font-medium text-white/90">Trusted by operators worldwide</span>
          </div>

          {/* Headline */}
          <h1 className="text-4xl sm:text-5xl md:text-6xl lg:text-7xl font-bold text-white mb-4 leading-[1.1] tracking-tight animate-fade-up animate-delay-100" style={{ textShadow: '0 2px 16px rgba(0,0,0,0.6), 0 1px 3px rgba(0,0,0,0.5)' }}>
            Ride compliance documents,{' '}
            <span className="text-[hsl(210_55%_82%)]">checks and logs</span>{' '}
            in one place
          </h1>
          <p className="text-base sm:text-lg md:text-xl text-white mb-6 max-w-2xl mx-auto" style={{ textShadow: '0 1px 8px rgba(0,0,0,0.7)' }}>
            for amusement ride and inflatable operators
          </p>

          {/* Subheadline - LCP element */}
          <p className="text-base md:text-lg text-white/95 mb-10 max-w-2xl mx-auto leading-relaxed" style={{ textShadow: '0 1px 6px rgba(0,0,0,0.7)' }}>
            Ride Ready Docs helps amusement ride and inflatable operators manage daily checks,
            defect reports, maintenance records, risk assessments, wind logs, pressure readings
            and compliance document sharing from one mobile-friendly system.
          </p>

          {/* CTA Buttons — single primary + secondary */}
          <div className="flex flex-col sm:flex-row gap-4 justify-center items-center mb-6 animate-fade-up animate-delay-300">
            <Button
              size="lg"
              className="w-full sm:w-auto bg-accent hover:bg-accent/90 text-accent-foreground px-8 py-6 text-base font-semibold shadow-glow transition-smooth group"
              onClick={handlePrimary}
            >
              Start Free Trial
              <ArrowRight className="ml-2 h-4 w-4 transition-transform group-hover:translate-x-1" />
            </Button>
            <Button
              size="lg"
              className="w-full sm:w-auto bg-[hsl(215_45%_18%)] hover:bg-[hsl(215_45%_24%)] text-white border-2 border-white/70 px-8 py-6 text-base font-semibold"
              onClick={handleSecondary}
            >
              See Features
            </Button>
          </div>

          {/* Trust Badges */}
          <div className="mt-10 animate-fade-up animate-delay-500">
            <Suspense fallback={null}>
              <TrustBadges variant="hero" />
            </Suspense>
          </div>

          {/* Device suitability note */}
          <p className="mt-6 text-xs sm:text-sm text-white/95 max-w-2xl mx-auto flex items-start sm:items-center justify-center gap-2 px-2" style={{ textShadow: '0 1px 6px rgba(0,0,0,0.7)' }}>
            <Smartphone className="h-4 w-4 text-accent shrink-0 mt-0.5 sm:mt-0" />
            <span>
              Works on mobile, tablet and laptop. Daily checks, defects, wind logs and pressure readings
              are designed for mobile; initial setup and bulk document uploads are easier on tablet or laptop.
            </span>
          </p>

          {/* Trust indicators */}
          <div className="mt-6 flex flex-wrap justify-center gap-x-6 gap-y-2 text-sm text-white/95 animate-fade-up animate-delay-500" style={{ textShadow: '0 1px 6px rgba(0,0,0,0.7)' }}>
            <div className="flex items-center gap-2">
              <Check className="h-4 w-4 text-accent" />
              <span>No credit card required</span>
            </div>
            <div className="flex items-center gap-2">
              <Check className="h-4 w-4 text-accent" />
              <span>Full access for 14 days</span>
            </div>
            <div className="flex items-center gap-2">
              <Check className="h-4 w-4 text-accent" />
              <span>Works on mobile, tablet and laptop</span>
            </div>
          </div>


          {/* Device Hint for Mobile Users */}
          <div className="mt-6 max-w-lg mx-auto animate-fade-up animate-delay-600">
            <Suspense fallback={null}>
              <DeviceHintBanner variant="hero" />
            </Suspense>
          </div>

        </div>
      </div>

      {/* Scroll Indicator */}
      <div className="absolute bottom-6 left-1/2 transform -translate-x-1/2 animate-bounce">
        <a href="#features" className="block" aria-label="Scroll to features">
          <div className="w-6 h-10 border-2 border-white/40 rounded-full flex justify-center hover:border-white/60 transition-colors">
            <div className="w-1 h-3 bg-white/60 rounded-full mt-2" />
          </div>
        </a>
      </div>
    </section>
  );
};

export default Hero;