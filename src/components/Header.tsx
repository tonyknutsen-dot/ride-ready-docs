import { Button } from "@/components/ui/button";
import { Menu, LogOut, User } from "lucide-react";
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
    <header className="fixed top-0 left-0 right-0 z-50 bg-white/95 backdrop-blur-sm border-b border-border/50">
      <div className="container mx-auto px-6">
        <div className="flex items-center justify-between h-16">
          {/* Logo */}
          <Link to="/" className="flex items-center">
            <img src={logo} alt="Ride Ready Docs" className="h-20 w-auto" />
          </Link>

          {/* Desktop Navigation */}
          <nav className="hidden md:flex items-center space-x-8">
            {!user && (
              <>
                <a href="#features" className="text-foreground hover:text-primary transition-smooth">
                  Features
                </a>
                <a href="#pricing" className="text-foreground hover:text-primary transition-smooth">
                  Pricing
                </a>
                <button 
                  onClick={() => setContactDialogOpen(true)}
                  className="text-foreground hover:text-primary transition-smooth"
                >
                  Contact
                </button>
              </>
            )}
            {user && (
              <Link to="/overview" className="text-foreground hover:text-primary transition-smooth">
                Overview
              </Link>
            )}
          </nav>

          {/* Desktop CTA */}
          <div className="hidden md:flex items-center space-x-4">
            {!user ? (
              <>
                <Link to="/auth">
                  <Button variant="ghost" className="text-foreground hover:text-primary">
                    Sign In
                  </Button>
                </Link>
                <Link to="/auth">
                  <Button className="bg-primary hover:bg-primary/90 text-primary-foreground">
                    Start Free Trial
                  </Button>
                </Link>
              </>
            ) : (
              <>
                <div className="flex items-center space-x-2 text-sm text-muted-foreground">
                  <User className="h-4 w-4" />
                  <span>{user.email}</span>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleSignOut}
                  className="flex items-center space-x-2"
                >
                  <LogOut className="h-4 w-4" />
                  <span>Sign Out</span>
                </Button>
              </>
            )}
          </div>

          {/* Mobile Actions */}
          <div className="md:hidden flex items-center space-x-2">
            {!user ? (
              <>
                <Link to="/auth">
                  <Button size="sm" className="bg-primary hover:bg-primary/90 text-primary-foreground">
                    Sign In
                  </Button>
                </Link>
                <button
                  className="p-2 rounded-lg hover:bg-muted transition-smooth"
                  onClick={() => setIsMenuOpen(!isMenuOpen)}
                  aria-label="Open menu"
                >
                  <Menu className="h-6 w-6 text-foreground" />
                </button>
              </>
            ) : (
              <>
                <Link to="/overview">
                  <Button size="sm" variant="outline">
                    Overview
                  </Button>
                </Link>
                <button
                  className="p-2 rounded-lg hover:bg-muted transition-smooth"
                  onClick={() => setIsMenuOpen(!isMenuOpen)}
                  aria-label="Open menu"
                >
                  <Menu className="h-6 w-6 text-foreground" />
                </button>
              </>
            )}
          </div>
        </div>

        {/* Mobile Menu */}
        {isMenuOpen && (
          <div className="md:hidden border-t border-border/50 py-4 bg-background/95 backdrop-blur-sm">
            <nav className="flex flex-col space-y-4">
              {!user ? (
                <>
                  <a 
                    href="#features" 
                    className="text-foreground hover:text-primary transition-smooth py-2 px-2 rounded-lg hover:bg-muted"
                    onClick={() => setIsMenuOpen(false)}
                  >
                    Features
                  </a>
                  <a 
                    href="#pricing" 
                    className="text-foreground hover:text-primary transition-smooth py-2 px-2 rounded-lg hover:bg-muted"
                    onClick={() => setIsMenuOpen(false)}
                  >
                    Pricing
                  </a>
                  <button 
                    className="text-foreground hover:text-primary transition-smooth py-2 px-2 rounded-lg hover:bg-muted text-left"
                    onClick={() => {
                      setIsMenuOpen(false);
                      setContactDialogOpen(true);
                    }}
                  >
                    Contact
                  </button>
                  <div className="border-t border-border/50 pt-4 mt-2">
                    <Link to="/auth" onClick={() => setIsMenuOpen(false)}>
                      <Button className="bg-primary hover:bg-primary/90 text-primary-foreground w-full mb-2">
                        Start Free Trial
                      </Button>
                    </Link>
                  </div>
                </>
              ) : (
                <>
                  <div className="flex items-center space-x-2 text-sm text-muted-foreground py-2 px-2 bg-muted/50 rounded-lg">
                    <User className="h-4 w-4" />
                    <span className="truncate">{user.email}</span>
                  </div>
                  <Button
                    variant="outline"
                    onClick={handleSignOut}
                    className="justify-start w-full text-destructive hover:text-destructive"
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