import { FileText, Mail, Phone, MapPin } from "lucide-react";

const Footer = () => {
  return (
    <footer className="bg-primary text-primary-foreground py-16">
      <div className="container mx-auto px-6">
        <div className="grid md:grid-cols-4 gap-8">
          {/* Brand */}
          <div className="md:col-span-2">
            <div className="flex items-center space-x-2 mb-4">
              <div className="bg-accent p-2 rounded-lg">
                <FileText className="h-6 w-6 text-accent-foreground" />
              </div>
              <span className="text-xl font-bold">ShowmenDocs</span>
            </div>
            <p className="text-primary-foreground/80 mb-6 max-w-md">
              The complete document management solution designed specifically for fairground 
              professionals. Keep all your ride documents, safety certificates, and technical 
              bulletins organized in one secure place.
            </p>
            <div className="space-y-2 text-primary-foreground/80">
              <div className="flex items-center space-x-2">
                <Phone className="h-4 w-4" />
                <span>+44 (0) 1234 567890</span>
              </div>
              <div className="flex items-center space-x-2">
                <Mail className="h-4 w-4" />
                <span>support@showmendocs.com</span>
              </div>
              <div className="flex items-center space-x-2">
                <MapPin className="h-4 w-4" />
                <span>London, United Kingdom</span>
              </div>
            </div>
          </div>

          {/* Quick Links */}
          <div>
            <h4 className="font-semibold mb-4">Quick Links</h4>
            <ul className="space-y-2 text-primary-foreground/80">
              <li><a href="#features" className="hover:text-accent transition-smooth">Features</a></li>
              <li><a href="#pricing" className="hover:text-accent transition-smooth">Pricing</a></li>
              <li><a href="#demo" className="hover:text-accent transition-smooth">Demo</a></li>
              <li><a href="#contact" className="hover:text-accent transition-smooth">Contact</a></li>
            </ul>
          </div>

          {/* Resources */}
          <div>
            <h4 className="font-semibold mb-4">Resources</h4>
            <ul className="space-y-2 text-primary-foreground/80">
              <li><a href="#help" className="hover:text-accent transition-smooth">Help Center</a></li>
              <li><a href="#privacy" className="hover:text-accent transition-smooth">Privacy Policy</a></li>
              <li><a href="#terms" className="hover:text-accent transition-smooth">Terms of Service</a></li>
              <li><a href="#security" className="hover:text-accent transition-smooth">Security</a></li>
            </ul>
          </div>
        </div>

        <div className="border-t border-primary-foreground/20 mt-12 pt-8 text-center text-primary-foreground/60">
          <p>&copy; 2024 ShowmenDocs. All rights reserved. Built for the fairground community.</p>
        </div>
      </div>
    </footer>
  );
};

export default Footer;