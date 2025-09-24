import { Button } from "@/components/ui/button";
import { FileText, Menu, LogOut, User } from "lucide-react";
import { useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";

const Header = () => {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
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
          <Link to="/" className="flex items-center space-x-2">
            <div className="bg-primary p-2 rounded-lg">
              <FileText className="h-6 w-6 text-primary-foreground" />
            </div>
            <span className="text-xl font-bold text-primary">Ride Ready Docs</span>
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
                <a href="#contact" className="text-foreground hover:text-primary transition-smooth">
                  Contact
                </a>
              </>
            )}
            {user && (
              <Link to="/dashboard" className="text-foreground hover:text-primary transition-smooth">
                Dashboard
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

          {/* Mobile Menu Button */}
          <button
            className="md:hidden p-2 rounded-lg hover:bg-muted transition-smooth"
            onClick={() => setIsMenuOpen(!isMenuOpen)}
          >
            <Menu className="h-6 w-6 text-foreground" />
          </button>
        </div>

        {/* Mobile Menu */}
        {isMenuOpen && (
          <div className="md:hidden border-t border-border/50 py-4">
            <nav className="flex flex-col space-y-4">
              {!user ? (
                <>
                  <a href="#features" className="text-foreground hover:text-primary transition-smooth">
                    Features
                  </a>
                  <a href="#pricing" className="text-foreground hover:text-primary transition-smooth">
                    Pricing
                  </a>
                  <a href="#contact" className="text-foreground hover:text-primary transition-smooth">
                    Contact
                  </a>
                  <div className="flex flex-col space-y-2 pt-2">
                    <Link to="/auth">
                      <Button variant="ghost" className="justify-start w-full">
                        Sign In
                      </Button>
                    </Link>
                    <Link to="/auth">
                      <Button className="bg-primary hover:bg-primary/90 text-primary-foreground w-full">
                        Start Free Trial
                      </Button>
                    </Link>
                  </div>
                </>
              ) : (
                <>
                  <Link to="/dashboard" className="text-foreground hover:text-primary transition-smooth">
                    Dashboard
                  </Link>
                  <div className="flex items-center space-x-2 text-sm text-muted-foreground py-2">
                    <User className="h-4 w-4" />
                    <span>{user.email}</span>
                  </div>
                  <Button
                    variant="outline"
                    onClick={handleSignOut}
                    className="justify-start w-full"
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
    </header>
  );
};

export default Header;