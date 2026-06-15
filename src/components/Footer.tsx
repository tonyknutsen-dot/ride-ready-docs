import { MapPin } from "lucide-react";
import { Link } from "react-router-dom";
import { APP_VERSION } from "@/config/appVersion";
import AboutAppDialog from "./AboutAppDialog";

const Footer = () => {
  const currentYear = new Date().getFullYear();

  return (
    <footer className="bg-gradient-to-b from-foreground to-foreground/95 text-background py-16">
      <div className="container mx-auto px-4 md:px-6">
        <div className="grid md:grid-cols-5 gap-10 md:gap-8">
          {/* Brand */}
          <div className="md:col-span-2">
            <h3 className="text-xl font-bold mb-4">Ride Ready Docs</h3>
            <div className="mt-6">
              <h4 className="font-semibold mb-3 text-sm uppercase tracking-wider text-background/50">
                Solutions
              </h4>
              <ul className="grid grid-cols-1 sm:grid-cols-2 gap-y-2 gap-x-4 text-sm">
                <li><Link to="/fairground-ride-software" className="text-background/70 hover:text-accent transition-colors">Fairground Ride Software</Link></li>
                <li><Link to="/showmen-digital-records" className="text-background/70 hover:text-accent transition-colors">Digital Records for Showmen</Link></li>
                <li><Link to="/ride-checks-defect-maintenance" className="text-background/70 hover:text-accent transition-colors">Checks, Defects & Maintenance</Link></li>
                <li><Link to="/inflatable-operator-records" className="text-background/70 hover:text-accent transition-colors">Inflatable Operator Records</Link></li>
                <li><Link to="/ride-document-management" className="text-background/70 hover:text-accent transition-colors">Ride Document Management</Link></li>
              </ul>
            </div>
          </div>
            <p className="text-background/70 mb-6 max-w-md text-sm leading-relaxed">
              Ride Ready Docs helps operators, controllers and event professionals organise
              equipment records, documents, checks, maintenance, defects and operational logs
              in one secure system.
            </p>
            <div className="flex items-center gap-2 text-background/60 text-sm">
              <MapPin className="h-4 w-4" />
              <span>Serving operators worldwide</span>
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
                <Link to="/data-independence" className="text-background/70 hover:text-accent transition-colors">
                  Data Independence
                </Link>
              </li>
              <li>
                <Link to="/security" className="text-background/70 hover:text-accent transition-colors">
                  Security
                </Link>
              </li>
            </ul>
          </div>

          {/* Legal */}
          <div>
            <h4 className="font-semibold mb-4 text-sm uppercase tracking-wider text-background/50">
              Legal
            </h4>
            <ul className="space-y-3 text-sm">
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
                <Link to="/cookies" className="text-background/70 hover:text-accent transition-colors">
                  Cookie Policy
                </Link>
              </li>
            </ul>
          </div>
        </div>

        <div className="border-t border-background/10 mt-12 pt-8 text-center text-background/50 text-sm space-y-4">
          <p className="text-xs text-background/60 max-w-2xl mx-auto">
            Ride Ready Docs is an independent platform. We do not share your operational data
            with inspectors, regulators or third parties unless required to provide the service,
            requested by you, or required by law.
          </p>
          <p>&copy; {currentYear} Ride Ready Docs. All rights reserved.</p>
          <div className="flex items-center justify-center gap-2">
            <span className="text-xs font-mono opacity-70">{APP_VERSION}</span>
            <span className="opacity-50">•</span>
            <AboutAppDialog 
              trigger={
                <button className="text-xs hover:text-accent transition-colors underline-offset-2 hover:underline">
                  App Info
                </button>
              } 
            />
          </div>
        </div>
      </div>
    </footer>
  );
};

export default Footer;