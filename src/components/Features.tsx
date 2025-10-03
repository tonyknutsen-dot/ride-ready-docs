import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Shield, FileText, CheckSquare, Wrench, Calendar, Bell, FolderOpen, Share2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";

const Features = () => {
  const docsFeatures = [
    {
      icon: <FolderOpen className="h-10 w-10 text-accent" />,
      title: "Organized Document Storage",
      description: "All your compliance documents organized by ride and equipment, instantly accessible from anywhere.",
      items: ["Risk Assessments", "Method Statements", "Insurance Certificates", "Build Up/Down Procedures"]
    },
    {
      icon: <Shield className="h-10 w-10 text-accent" />,
      title: "Compliance Tracking",
      description: "Never miss a renewal with automated reminders for insurance, certifications, and compliance deadlines.",
      items: ["Insurance Renewals", "Certificate Tracking", "Compliance Deadlines", "Document Expiry Alerts"]
    },
    {
      icon: <Share2 className="h-10 w-10 text-accent" />,
      title: "Easy Document Sharing",
      description: "Share documents instantly with councils, landowners, and inspectors. Send complete compliance packs in seconds.",
      items: ["Council Requirements", "Landowner Packs", "Quick Sharing", "Email Integration"]
    }
  ];

  const checksFeatures = [
    {
      icon: <CheckSquare className="h-10 w-10 text-primary" />,
      title: "Daily, Monthly & Yearly Checks",
      description: "Complete your safety checks digitally. Create custom templates and maintain detailed inspection history.",
      items: ["Daily Safety Checks", "Monthly Inspections", "Annual Thorough Examinations", "Custom Templates"]
    },
    {
      icon: <Wrench className="h-10 w-10 text-primary" />,
      title: "Maintenance Logging",
      description: "Track all maintenance, repairs, and servicing. Keep a complete service history for every piece of equipment.",
      items: ["Service Records", "Repair Logs", "Parts Tracking", "Maintenance History"]
    },
    {
      icon: <Bell className="h-10 w-10 text-primary" />,
      title: "Technical Bulletins",
      description: "Receive the latest technical bulletins for your specific equipment. Stay informed about safety updates and modifications.",
      items: ["Equipment-Specific Bulletins", "Safety Alerts", "Manufacturer Updates", "Automatic Matching"]
    },
    {
      icon: <Calendar className="h-10 w-10 text-primary" />,
      title: "Inspection Scheduling",
      description: "Schedule external inspections and get reminders. Track ADIPS, NDT, and other third-party inspection requirements.",
      items: ["ADIPS Scheduling", "NDT Reminders", "External Inspections", "Automated Notifications"]
    }
  ];

  return (
    <section className="py-20 bg-secondary/30">
      <div className="container mx-auto px-6">
        <div className="text-center mb-16">
          <h2 className="text-4xl md:text-5xl font-bold mb-6">
            Two Powerful Apps for Complete Operations Management
          </h2>
          <p className="text-xl text-muted-foreground max-w-3xl mx-auto">
            Choose the tool you need or use both together. Built specifically for showmen by industry professionals.
          </p>
        </div>

        {/* Documents & Compliance App */}
        <div className="mb-16">
          <div className="flex items-center justify-center gap-3 mb-8">
            <h3 className="text-2xl font-bold text-accent">
              📄 Documents & Compliance App
            </h3>
          </div>
          <p className="text-center text-muted-foreground mb-8 max-w-2xl mx-auto">
            Store, organize, and share all your compliance documents. Keep everything accessible and up-to-date.
          </p>
          <div className="grid md:grid-cols-3 gap-6 max-w-5xl mx-auto">
            {docsFeatures.map((feature, index) => (
              <Card 
                key={index} 
                className="transition-smooth hover:shadow-elegant hover:bg-card-hover group cursor-default border-accent/20"
              >
                <CardHeader className="text-center pb-4">
                  <div className="mx-auto mb-4 p-3 bg-accent/5 rounded-full w-fit group-hover:bg-accent/10 transition-smooth">
                    {feature.icon}
                  </div>
                  <CardTitle className="text-lg font-semibold">
                    {feature.title}
                  </CardTitle>
                </CardHeader>
                
                <CardContent className="pt-0">
                  <p className="text-muted-foreground text-sm mb-4 leading-relaxed">
                    {feature.description}
                  </p>
                  
                  <ul className="space-y-2">
                    {feature.items.map((item, itemIndex) => (
                      <li key={itemIndex} className="flex items-center text-sm text-foreground">
                        <div className="w-1.5 h-1.5 bg-accent rounded-full mr-3 flex-shrink-0" />
                        {item}
                      </li>
                    ))}
                  </ul>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>

        {/* Daily/Monthly/Yearly Checks App */}
        <div>
          <div className="flex items-center justify-center gap-3 mb-8">
            <h3 className="text-2xl font-bold text-primary">
              ✓ Daily/Monthly/Yearly Checks App
            </h3>
          </div>
          <p className="text-center text-muted-foreground mb-8 max-w-2xl mx-auto">
            Complete safety checks, log maintenance, track inspections, and receive technical bulletins for your equipment.
          </p>
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
            {checksFeatures.map((feature, index) => (
              <Card 
                key={index} 
                className="transition-smooth hover:shadow-elegant hover:bg-card-hover group cursor-default border-primary/20"
              >
                <CardHeader className="text-center pb-4">
                  <div className="mx-auto mb-4 p-3 bg-primary/5 rounded-full w-fit group-hover:bg-primary/10 transition-smooth">
                    {feature.icon}
                  </div>
                  <CardTitle className="text-lg font-semibold">
                    {feature.title}
                  </CardTitle>
                </CardHeader>
                
                <CardContent className="pt-0">
                  <p className="text-muted-foreground text-sm mb-4 leading-relaxed">
                    {feature.description}
                  </p>
                  
                  <ul className="space-y-2">
                    {feature.items.map((item, itemIndex) => (
                      <li key={itemIndex} className="flex items-center text-sm text-foreground">
                        <div className="w-1.5 h-1.5 bg-primary rounded-full mr-3 flex-shrink-0" />
                        {item}
                      </li>
                    ))}
                  </ul>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
};

export default Features;