import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Link, useNavigate } from "react-router-dom";
import { Shield, FileText, Clock, Mail, Loader2, CheckCircle2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { getEmailSuggestion } from "@/utils/emailSuggestion";
import { toast } from "sonner";
import { getIdentityCache } from "@/lib/offlineDb";

const isStandaloneMode = () =>
  window.matchMedia('(display-mode: standalone)').matches ||
  (window.navigator as any).standalone === true ||
  document.referrer.includes('android-app://');

const ComingSoon = () => {
  const navigate = useNavigate();

  // When opened as installed PWA, skip the landing page
  useEffect(() => {
    if (!isStandaloneMode()) return;
    const tryRedirect = async () => {
      // When offline, skip getSession (it can hang) and use cached identity
      if (!navigator.onLine) {
        try {
          // Try to find any cached identity in IndexedDB
          const { db } = await import('@/lib/offlineDb');
          const allCached = await db.table('identityCache').toArray();
          if (allCached.length > 0) {
            const cached = allCached[0];
            const target = cached?.lastVisitedRoute || '/overview';
            navigate(target, { replace: true });
          } else {
            navigate('/auth', { replace: true });
          }
        } catch {
          navigate('/auth', { replace: true });
        }
        return;
      }
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (session?.user) {
          const cached = await getIdentityCache(session.user.id);
          const target = cached?.lastVisitedRoute || '/overview';
          navigate(target, { replace: true });
        } else {
          navigate('/auth', { replace: true });
        }
      } catch {
        navigate('/overview', { replace: true });
      }
    };
    tryRedirect();
  }, [navigate]);
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [honeypot, setHoneypot] = useState(""); // Bot detection
  const [isLoading, setIsLoading] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [emailSuggestion, setEmailSuggestion] = useState<string | null>(null);

  const handleEmailChange = (value: string) => {
    setEmail(value);
    
    // Check for typos after user has typed enough
    if (value.includes("@") && value.length > 5) {
      const suggestion = getEmailSuggestion(value);
      setEmailSuggestion(suggestion?.suggested || null);
    } else {
      setEmailSuggestion(null);
    }
  };

  const acceptSuggestion = () => {
    if (emailSuggestion) {
      setEmail(emailSuggestion);
      setEmailSuggestion(null);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!email.trim()) {
      toast.error("Please enter your email address");
      return;
    }

    // Basic email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email.trim())) {
      toast.error("Please enter a valid email address");
      return;
    }

    setIsLoading(true);

    try {
      const { data, error } = await supabase.functions.invoke("early-access-signup", {
        body: { 
          email: email.trim(), 
          name: name.trim() || undefined,
          honeypot // Will be filtered by bot detection
        },
      });

      if (error) throw error;

      if (data?.success) {
        setIsSuccess(true);
        toast.success(data.message || "You're on the list!");
      } else if (data?.error) {
        toast.error(data.error);
      }
    } catch (error: any) {
      console.error("Signup error:", error);
      
      if (error.message?.includes("429") || error.status === 429) {
        toast.error("Too many attempts. Please try again later.");
      } else {
        toast.error("Something went wrong. Please try again.");
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Header */}
      <header className="fixed top-0 left-0 right-0 z-50 bg-background/80 backdrop-blur-md border-b border-border/40">
        <div className="container mx-auto px-4 md:px-6">
          <div className="flex items-center justify-between h-16">
            <span className="font-bold text-xl text-foreground">
              Ride Ready Docs
            </span>
            <Link to="/auth">
              <Button size="sm" className="bg-primary hover:bg-primary/90 text-primary-foreground">
                Sign In
              </Button>
            </Link>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 flex items-center justify-center pt-16 px-4">
        <div className="max-w-xl text-center space-y-8">
          {/* Icon */}
          <div className="mx-auto w-20 h-20 rounded-2xl bg-primary/10 flex items-center justify-center">
            <FileText className="w-10 h-10 text-primary" />
          </div>

          {/* Title */}
          <div className="space-y-4">
            <div className="inline-flex items-center gap-2 px-3 py-1 bg-amber-500/10 border border-amber-500/20 rounded-full text-amber-600 dark:text-amber-400 text-sm font-medium">
              <Clock className="w-4 h-4" />
              Coming Soon
            </div>
            <h1 className="text-4xl md:text-5xl font-bold text-foreground tracking-tight">
              Ride Ready Docs
            </h1>
            <p className="text-lg text-muted-foreground max-w-md mx-auto">
              The complete documentation management platform for amusement ride operators. 
              We're putting the finishing touches on something special.
            </p>
          </div>

          {/* Features Preview */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-left">
            <div className="p-4 rounded-xl bg-card border border-border">
              <Shield className="w-6 h-6 text-primary mb-2" />
              <h3 className="font-semibold text-foreground">Secure</h3>
              <p className="text-sm text-muted-foreground">Enterprise-grade security for your documents</p>
            </div>
            <div className="p-4 rounded-xl bg-card border border-border">
              <FileText className="w-6 h-6 text-primary mb-2" />
              <h3 className="font-semibold text-foreground">Organized</h3>
              <p className="text-sm text-muted-foreground">Keep all compliance docs in one place</p>
            </div>
            <div className="p-4 rounded-xl bg-card border border-border">
              <Clock className="w-6 h-6 text-primary mb-2" />
              <h3 className="font-semibold text-foreground">Automated</h3>
              <p className="text-sm text-muted-foreground">Never miss an expiry or inspection date</p>
            </div>
          </div>

          {/* Early Access Signup */}
          <Card className="border-primary/30 bg-card shadow-lg">
            <CardContent className="p-6">
              {isSuccess ? (
                <div className="text-center py-4">
                  <div className="mx-auto w-12 h-12 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center mb-4">
                    <CheckCircle2 className="w-6 h-6 text-green-600 dark:text-green-400" />
                  </div>
                  <h3 className="text-lg font-semibold text-foreground mb-2">You're on the list!</h3>
                  <p className="text-sm text-muted-foreground">
                    We've sent a confirmation to your inbox. We'll notify you as soon as we launch.
                  </p>
                </div>
              ) : (
                <form onSubmit={handleSubmit} className="space-y-4">
                  <div className="flex items-center gap-2 justify-center mb-2">
                    <Mail className="w-5 h-5 text-primary" />
                    <h3 className="text-lg font-semibold text-foreground">Get Early Access</h3>
                  </div>
                  <p className="text-sm text-muted-foreground text-center">
                    Be the first to know when we launch.
                  </p>
                  
                  {/* Hidden honeypot field for bot detection */}
                  <div className="sr-only" aria-hidden="true">
                    <Label htmlFor="website">Website</Label>
                    <Input
                      type="text"
                      id="website"
                      name="website"
                      value={honeypot}
                      onChange={(e) => setHoneypot(e.target.value)}
                      tabIndex={-1}
                      autoComplete="off"
                    />
                  </div>

                  <div className="space-y-3">
                    <div className="space-y-1.5">
                      <Label htmlFor="name" className="text-left block">
                        Name <span className="text-muted-foreground text-xs">(Optional)</span>
                      </Label>
                      <Input
                        id="name"
                        type="text"
                        placeholder="Your name"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        maxLength={100}
                        disabled={isLoading}
                      />
                    </div>
                    
                    <div className="space-y-1.5">
                      <Label htmlFor="email" className="text-left block">
                        Email <span className="text-destructive">*</span>
                      </Label>
                      <Input
                        id="email"
                        type="email"
                        placeholder="you@company.com"
                        value={email}
                        onChange={(e) => handleEmailChange(e.target.value)}
                        maxLength={255}
                        required
                        disabled={isLoading}
                      />
                      {emailSuggestion && (
                        <button
                          type="button"
                          onClick={acceptSuggestion}
                          className="text-xs text-primary hover:underline text-left w-full"
                        >
                          Did you mean <strong>{emailSuggestion}</strong>?
                        </button>
                      )}
                    </div>
                  </div>

                  <Button 
                    type="submit" 
                    className="w-full bg-primary hover:bg-primary/90" 
                    disabled={isLoading}
                  >
                    {isLoading ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        Signing up...
                      </>
                    ) : (
                      "Join the Waitlist"
                    )}
                  </Button>
                  
                  <p className="text-xs text-muted-foreground text-center">
                    We'll only email you about launch updates. No spam, ever.
                  </p>
                </form>
              )}
            </CardContent>
          </Card>

          {/* CTA */}
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              Already have an account?
            </p>
            <Link to="/auth">
              <Button variant="outline" size="lg">
                Sign In to Your Account
              </Button>
            </Link>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="py-6 text-center text-sm text-muted-foreground border-t border-border/40">
        <p>© {new Date().getFullYear()} Ride Ready Docs. All rights reserved.</p>
      </footer>
    </div>
  );
};

export default ComingSoon;
