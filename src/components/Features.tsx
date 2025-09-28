import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Shield, FileText, Users, Gauge } from "lucide-react";

const Features = () => {
  const features = [
    {
      icon: <FileText className="h-12 w-12 text-primary" />,
      title: "All Documents in One Place",
      description: "Risk assessments, method statements, insurance certificates, technical bulletins - everything organized by attraction and easily accessible.",
      items: ["Risk Assessments", "Method Statements", "Build Up/Down Procedures", "Manual Handling Documents"]
    },
    {
      icon: <Shield className="h-12 w-12 text-primary" />,
      title: "Safety & Compliance",
      description: "Keep all your safety documentation up to date with automated reminders for renewals and compliance deadlines.",
      items: ["Insurance Certificates", "Pre-use Inspections", "Design Reviews", "Declaration of Compliance"]
    },
    {
      icon: <Gauge className="h-12 w-12 text-primary" />,
      title: "Technical Bulletins",
      description: "Access the latest technical bulletins for your specific attraction types. Stay informed about updates and modifications.",
      items: ["Chair-o-Plane Bulletins", "Equipment-Specific Updates", "Manufacturer Notices", "Safety Alerts"]
    },
    {
      icon: <Users className="h-12 w-12 text-primary" />,
      title: "Built for Showmen",
      description: "Designed by industry professionals who understand the unique challenges of fairground operations and council requirements.",
      items: ["Council Compliance", "Land Owner Requirements", "Quick Document Sharing", "Mobile Access"]
    }
  ];

  return (
    <section className="py-20 bg-secondary/30">
      <div className="container mx-auto px-6">
        <div className="text-center mb-16">
          <h2 className="text-4xl md:text-5xl font-bold mb-6 text-primary">
            Everything You Need for Document Management
          </h2>
          <p className="text-xl text-muted-foreground max-w-3xl mx-auto">
            Streamline your operations with our comprehensive document management system 
            tailored specifically for fairground professionals.
          </p>
        </div>

        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-8">
          {features.map((feature, index) => (
            <Card 
              key={index} 
              className="transition-smooth hover:shadow-elegant hover:bg-card-hover group cursor-default"
            >
              <CardHeader className="text-center pb-4">
                <div className="mx-auto mb-4 p-3 bg-primary/5 rounded-full w-fit group-hover:bg-primary/10 transition-smooth">
                  {feature.icon}
                </div>
                <CardTitle className="text-xl font-semibold text-primary">
                  {feature.title}
                </CardTitle>
              </CardHeader>
              
              <CardContent className="pt-0">
                <p className="text-muted-foreground mb-4 leading-relaxed">
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
    </section>
  );
};

export default Features;