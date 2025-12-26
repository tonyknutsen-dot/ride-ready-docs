import { Button } from "@/components/ui/button";
import { Menu, X, LogOut, User } from "lucide-react";
import { useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import logo from "@/assets/logo.png";
import { ContactSupportDialog } from "@/components/ContactSupportDialog";

const Header = () => {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [contactDialogOpen, setContactDialogOpen] = useState(false);
  const { user, signOut } = useAuth();
  const { toast } = useToast();

  const handleSignOut = async () => {
    const { error } = await signOut();
    if (error) {
      toast({
        title: "Error signing out",
        description: error.message,
        variant: "destructive",
      });
    } else {
      toast({
        title: "Signed out successfully",
        description: "You have been signed out of your account.",
      });
    }
  };

  return (
    <header className="fixed top-0 left-0 right-0 z-50 bg-background/80 backdrop-blur-md border-b border-border/40">
      <div className="container mx-auto px-4 md:px-6">
        <div className="flex items-center justify-between h-16">
          {/* Logo */}
          <Link to="/" className="flex items-center group">
            <img 
              src={logo} 
              alt="Showmen's Ride Ready" 
              className="h-12 w-auto transition-transform group-hover:scale-105" 
            />
          </Link>

          {/* Desktop Navigation */}
          <nav className="hidden md:flex items-center gap-1">
            {!user && (
              <>
                <a 
                  href="#features" 
                  className="px-4 py-2 text-sm font-medium text-foreground/80 hover:text-foreground rounded-md hover:bg-muted transition-smooth"
                >
                  Features
                </a>
                <a 
                  href="#pricing" 
                  className="px-4 py-2 text-sm font-medium text-foreground/80 hover:text-foreground rounded-md hover:bg-muted transition-smooth"
                >
                  Pricing
                </a>
                <button 
                  onClick={() => setContactDialogOpen(true)}
                  className="px-4 py-2 text-sm font-medium text-foreground/80 hover:text-foreground rounded-md hover:bg-muted transition-smooth"
                >
                  Contact
                </button>
              </>
            )}
            {user && (
              <Link 
                to="/overview" 
                className="px-4 py-2 text-sm font-medium text-foreground/80 hover:text-foreground rounded-md hover:bg-muted transition-smooth"
              >
                Dashboard
              </Link>
            )}
          </nav>

          {/* Desktop CTA */}
          <div className="hidden md:flex items-center gap-3">
            {!user ? (
              <>
                <Link to="/auth">
                  <Button variant="ghost" size="sm" className="text-foreground/80 hover:text-foreground">
                    Sign In
                  </Button>
                </Link>
                <Link to="/auth">
                  <Button size="sm" className="bg-primary hover:bg-primary/90 text-primary-foreground shadow-sm">
                    Start Free Trial
                  </Button>
                </Link>
              </>
            ) : (
              <>
                <div className="flex items-center gap-2 text-sm text-muted-foreground px-3 py-1.5 bg-muted rounded-full">
                  <User className="h-3.5 w-3.5" />
                  <span className="max-w-[150px] truncate">{user.email}</span>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleSignOut}
                  className="gap-2 text-muted-foreground hover:text-foreground"
                >
                  <LogOut className="h-4 w-4" />
                  Sign Out
                </Button>
              </>
            )}
          </div>

          {/* Mobile Actions */}
          <div className="md:hidden flex items-center gap-2">
            {!user && (
              <Link to="/auth">
                <Button size="sm" className="bg-primary hover:bg-primary/90 text-primary-foreground">
                  Sign In
                </Button>
              </Link>
            )}
            <button
              className="p-2 rounded-lg hover:bg-muted transition-smooth"
              onClick={() => setIsMenuOpen(!isMenuOpen)}
              aria-label={isMenuOpen ? "Close menu" : "Open menu"}
            >
              {isMenuOpen ? (
                <X className="h-5 w-5 text-foreground" />
              ) : (
                <Menu className="h-5 w-5 text-foreground" />
              )}
            </button>
          </div>
        </div>

        {/* Mobile Menu */}
        {isMenuOpen && (
          <div className="md:hidden border-t border-border/40 py-4 animate-fade-in">
            <nav className="flex flex-col gap-1">
              {!user ? (
                <>
                  <a 
                    href="#features" 
                    className="px-4 py-3 text-foreground hover:bg-muted rounded-lg transition-smooth"
                    onClick={() => setIsMenuOpen(false)}
                  >
                    Features
                  </a>
                  <a 
                    href="#pricing" 
                    className="px-4 py-3 text-foreground hover:bg-muted rounded-lg transition-smooth"
                    onClick={() => setIsMenuOpen(false)}
                  >
                    Pricing
                  </a>
                  <button 
                    className="px-4 py-3 text-left text-foreground hover:bg-muted rounded-lg transition-smooth"
                    onClick={() => {
                      setIsMenuOpen(false);
                      setContactDialogOpen(true);
                    }}
                  >
                    Contact
                  </button>
                  <div className="border-t border-border/40 pt-3 mt-2">
                    <Link to="/auth" onClick={() => setIsMenuOpen(false)}>
                      <Button className="w-full bg-primary hover:bg-primary/90 text-primary-foreground">
                        Start Free Trial
                      </Button>
                    </Link>
                  </div>
                </>
              ) : (
                <>
                  <Link 
                    to="/overview" 
                    className="px-4 py-3 text-foreground hover:bg-muted rounded-lg transition-smooth"
                    onClick={() => setIsMenuOpen(false)}
                  >
                    Dashboard
                  </Link>
                  <div className="flex items-center gap-2 text-sm text-muted-foreground px-4 py-3 bg-muted/50 rounded-lg">
                    <User className="h-4 w-4" />
                    <span className="truncate">{user.email}</span>
                  </div>
                  <Button
                    variant="ghost"
                    onClick={handleSignOut}
                    className="justify-start text-destructive hover:text-destructive hover:bg-destructive/10"
                  >
                    <LogOut className="h-4 w-4 mr-2" />
                    Sign Out
                  </Button>
                </>
              )}
            </nav>
          </div>
        )}
      </div>
      
      <ContactSupportDialog 
        open={contactDialogOpen} 
        onOpenChange={setContactDialogOpen} 
      />
    </header>
  );
};

export default Header;