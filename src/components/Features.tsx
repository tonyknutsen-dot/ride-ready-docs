import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Shield, FileText, CheckSquare, Wrench, Calendar, FolderOpen, Share2, FileCheck, BarChart3, CalendarDays, Building2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";

const Features = () => {
  const docsFeatures = [
    {
      icon: <FolderOpen className="h-8 w-8" />,
      title: "Document Storage",
      description: "All compliance documents organized by ride, accessible from anywhere."
    },
    {
      icon: <Shield className="h-8 w-8" />,
      title: "Compliance Tracking",
      description: "Automated reminders for insurance, certifications, and deadlines."
    },
    {
      icon: <FileCheck className="h-8 w-8" />,
      title: "DOC Certificates",
      description: "Declaration of Conformity management with expiry tracking."
    },
    {
      icon: <Building2 className="h-8 w-8" />,
      title: "Global Documents",
      description: "Company-wide documents shared across your entire operation."
    },
    {
      icon: <Share2 className="h-8 w-8" />,
      title: "Easy Sharing",
      description: "Send compliance packs to councils and landowners in seconds."
    },
    {
      icon: <BarChart3 className="h-8 w-8" />,
      title: "Report Generation",
      description: "Professional compliance reports and audit-ready documentation."
    }
  ];

  const checksFeatures = [
    {
      icon: <CheckSquare className="h-8 w-8" />,
      title: "Safety Checks",
      description: "Digital daily, monthly, and yearly checklists with custom templates."
    },
    {
      icon: <Wrench className="h-8 w-8" />,
      title: "Maintenance Logging",
      description: "Track all repairs, servicing, and parts for complete history."
    },
    {
      icon: <CalendarDays className="h-8 w-8" />,
      title: "Calendar Overview",
      description: "Visual dashboard with all deadlines and color-coded priorities."
    },
    {
      icon: <Calendar className="h-8 w-8" />,
      title: "Inspection Scheduling",
      description: "ADIPS, NDT, and third-party inspection reminders automated."
    }
  ];

  return (
    <section className="py-20 md:py-28 bg-secondary/50">
      <div className="container mx-auto px-4 md:px-6">
        {/* Section Header */}
        <div className="text-center mb-10 max-w-3xl mx-auto">
          <Badge variant="outline" className="mb-4 border-primary/30 text-primary">
            Features
          </Badge>
          <h2 className="text-3xl md:text-4xl lg:text-5xl font-bold mb-6 tracking-tight">
            Two Powerful Apps,{" "}
            <span className="text-primary">One Complete Solution</span>
          </h2>
          <p className="text-lg text-muted-foreground">
            Choose the tool you need or use both together. Built specifically for showmen by industry professionals.
          </p>
        </div>

        {/* Documents & Compliance App */}
        <div className="mb-10">
          <div className="flex flex-col md:flex-row items-start md:items-center gap-4 mb-8">
            <div className="flex items-center gap-3">
              <div className="p-2.5 bg-accent/10 rounded-xl">
                <FileText className="h-6 w-6 text-accent" />
              </div>
              <h3 className="text-xl md:text-2xl font-bold">Documents & Compliance</h3>
            </div>
            <Badge className="bg-accent/10 text-accent border-accent/20 hover:bg-accent/20">
              Essential Plan
            </Badge>
          </div>
          
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {docsFeatures.map((feature, index) => (
              <Card 
                key={index} 
                className="group border-border/50 bg-card shadow-card hover:shadow-elegant transition-all duration-300 hover:-translate-y-1"
              >
                <CardHeader className="pb-3">
                  <div className="text-accent mb-3 group-hover:scale-110 transition-transform duration-300">
                    {feature.icon}
                  </div>
                  <CardTitle className="text-lg font-semibold">
                    {feature.title}
                  </CardTitle>
                </CardHeader>
                <CardContent className="pt-0">
                  <p className="text-sm text-muted-foreground leading-relaxed">
                    {feature.description}
                  </p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>

        {/* Operations & Maintenance App */}
        <div>
          <div className="flex flex-col md:flex-row items-start md:items-center gap-4 mb-8">
            <div className="flex items-center gap-3">
              <div className="p-2.5 bg-primary/10 rounded-xl">
                <Wrench className="h-6 w-6 text-primary" />
              </div>
              <h3 className="text-xl md:text-2xl font-bold">Operations & Maintenance</h3>
            </div>
            <Badge className="bg-primary/10 text-primary border-primary/20 hover:bg-primary/20">
              Advanced Plan
            </Badge>
          </div>
          
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {checksFeatures.map((feature, index) => (
              <Card 
                key={index} 
                className="group border-border/50 bg-card shadow-card hover:shadow-elegant transition-all duration-300 hover:-translate-y-1"
              >
                <CardHeader className="pb-3">
                  <div className="text-primary mb-3 group-hover:scale-110 transition-transform duration-300">
                    {feature.icon}
                  </div>
                  <CardTitle className="text-lg font-semibold">
                    {feature.title}
                  </CardTitle>
                </CardHeader>
                <CardContent className="pt-0">
                  <p className="text-sm text-muted-foreground leading-relaxed">
                    {feature.description}
                  </p>
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