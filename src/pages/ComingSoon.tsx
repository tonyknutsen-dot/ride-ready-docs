import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";
import { Shield, FileText, Clock } from "lucide-react";

const ComingSoon = () => {
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

          {/* CTA */}
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              Already have an account?
            </p>
            <Link to="/auth">
              <Button size="lg" className="bg-primary hover:bg-primary/90 text-primary-foreground">
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
