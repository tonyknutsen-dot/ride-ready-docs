import { MapPin } from "lucide-react";
import { Link } from "react-router-dom";

const Footer = () => {
  const currentYear = new Date().getFullYear();

  return (
    <footer className="bg-foreground text-background py-16">
      <div className="container mx-auto px-4 md:px-6">
        <div className="grid md:grid-cols-4 gap-10 md:gap-8">
          {/* Brand */}
          <div className="md:col-span-2">
            <h3 className="text-xl font-bold mb-4">Showmen's Ride Ready</h3>
            <p className="text-background/70 mb-6 max-w-md text-sm leading-relaxed">
              The complete document management solution designed specifically for fairground 
              professionals. Keep all your ride documents, safety certificates, and compliance 
              records organized in one secure place.
            </p>
            <div className="flex items-center gap-2 text-background/60 text-sm">
              <MapPin className="h-4 w-4" />
              <span>London, United Kingdom</span>
            </div>
          </div>

          {/* Quick Links */}
          <div>
            <h4 className="font-semibold mb-4 text-sm uppercase tracking-wider text-background/50">
              Quick Links
            </h4>
            <ul className="space-y-3 text-sm">
              <li>
                <a href="#features" className="text-background/70 hover:text-accent transition-colors">
                  Features
                </a>
              </li>
              <li>
                <a href="#pricing" className="text-background/70 hover:text-accent transition-colors">
                  Pricing
                </a>
              </li>
              <li>
                <Link to="/demo" className="text-background/70 hover:text-accent transition-colors">
                  Demo
                </Link>
              </li>
              <li>
                <Link to="/how-it-works" className="text-background/70 hover:text-accent transition-colors">
                  How It Works
                </Link>
              </li>
            </ul>
          </div>

          {/* Resources */}
          <div>
            <h4 className="font-semibold mb-4 text-sm uppercase tracking-wider text-background/50">
              Resources
            </h4>
            <ul className="space-y-3 text-sm">
              <li>
                <Link to="/help" className="text-background/70 hover:text-accent transition-colors">
                  Help Center
                </Link>
              </li>
              <li>
                <Link to="/privacy" className="text-background/70 hover:text-accent transition-colors">
                  Privacy Policy
                </Link>
              </li>
              <li>
                <Link to="/terms" className="text-background/70 hover:text-accent transition-colors">
                  Terms of Service
                </Link>
              </li>
              <li>
                <Link to="/security" className="text-background/70 hover:text-accent transition-colors">
                  Security
                </Link>
              </li>
            </ul>
          </div>
        </div>

        <div className="border-t border-background/10 mt-12 pt-8 text-center text-background/50 text-sm">
          <p>&copy; {currentYear} Showmen's Ride Ready. All rights reserved. Built for the fairground community.</p>
        </div>
      </div>
    </footer>
  );
};

export default Footer;