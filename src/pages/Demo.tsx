import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useNavigate } from "react-router-dom";
import { 
  FileText, 
  Shield, 
  Calendar, 
  Upload, 
  Users, 
  BarChart3, 
  CheckCircle, 
  AlertCircle,
  Clock,
  ArrowLeft,
  Wrench,
  CheckSquare,
  Bell,
  FolderOpen,
  Share2
} from "lucide-react";
import Header from "@/components/Header";
import Footer from "@/components/Footer";

const Demo = () => {
  const navigate = useNavigate();

  const basicFeatures = [
    {
      icon: <FolderOpen className="w-6 h-6" />,
      title: "Organized Document Storage",
      description: "All your compliance documents organized by ride and equipment",
      status: "active",
      count: "127 documents"
    },
    {
      icon: <Shield className="w-6 h-6" />,
      title: "Compliance Tracking",
      description: "Automated reminders for insurance, certifications, and compliance deadlines",
      status: "warning",
      count: "3 due soon"
    },
    {
      icon: <Share2 className="w-6 h-6" />,
      title: "Easy Document Sharing",
      description: "Share documents instantly with councils, landowners, and inspectors",
      status: "active",
      count: "5 shared today"
    }
  ];

  const advancedFeatures = [
    {
      icon: <CheckSquare className="w-6 h-6" />,
      title: "Daily, Monthly & Yearly Checks",
      description: "Complete safety checks digitally with custom templates and detailed history",
      status: "active",
      count: "8 completed"
    },
    {
      icon: <Wrench className="w-6 h-6" />,
      title: "Maintenance Logging",
      description: "Track all maintenance, repairs, and servicing with complete service history",
      status: "active",
      count: "12 logs"
    },
    {
      icon: <Bell className="w-6 h-6" />,
      title: "Technical Bulletins",
      description: "Receive latest technical bulletins for your specific equipment",
      status: "active",
      count: "3 new"
    },
    {
      icon: <Calendar className="w-6 h-6" />,
      title: "Inspection Scheduling",
      description: "Schedule external inspections and track ADIPS, NDT, and third-party requirements",
      status: "active",
      count: "Next: Today"
    }
  ];

  const recentActivity = [
    { type: "upload", title: "Safety Certificate - Carousel Mk3", time: "2 hours ago" },
    { type: "inspection", title: "Annual Inspection Completed - Ferris Wheel", time: "1 day ago" },
    { type: "reminder", title: "NDT Testing Due - Waltzer", time: "2 days ago" },
    { type: "document", title: "Technical Bulletin TB-2024-001 Added", time: "3 days ago" }
  ];

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <main className="container mx-auto px-6 pt-24 pb-12">
        {/* Header Section */}
        <div className="text-center mb-12">
          <Button 
            variant="ghost" 
            onClick={() => navigate('/')}
            className="mb-6 text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Home
          </Button>
          
          <h1 className="text-4xl md:text-5xl font-bold mb-4 text-foreground">
            Live Demo Dashboard
          </h1>
          <p className="text-xl text-muted-foreground max-w-3xl mx-auto">
            Experience how Ride Ready Docs streamlines document management for showmen. 
            This demo shows real functionality with sample data.
          </p>
        </div>

        {/* Stats Overview */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-12">
          <Card className="text-center">
            <CardContent className="p-6">
              <div className="text-3xl font-bold text-primary mb-2">127</div>
              <div className="text-sm text-muted-foreground">Total Documents</div>
            </CardContent>
          </Card>
          <Card className="text-center">
            <CardContent className="p-6">
              <div className="text-3xl font-bold text-accent mb-2">8</div>
              <div className="text-sm text-muted-foreground">Active Rides</div>
            </CardContent>
          </Card>
          <Card className="text-center">
            <CardContent className="p-6">
              <div className="text-3xl font-bold text-green-600 mb-2">12</div>
              <div className="text-sm text-muted-foreground">Compliant Rides</div>
            </CardContent>
          </Card>
          <Card className="text-center">
            <CardContent className="p-6">
              <div className="text-3xl font-bold text-orange-600 mb-2">3</div>
              <div className="text-sm text-muted-foreground">Due Soon</div>
            </CardContent>
          </Card>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Main Features */}
          <div className="lg:col-span-2 space-y-8">
            {/* Basic Plan Features */}
            <Card className="border-2 border-accent/30 shadow-lg bg-accent/5 animate-fade-in">
              <CardHeader className="pb-4 bg-accent/10 rounded-t-lg">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-accent/20 rounded-lg">
                      <FileText className="w-7 h-7 text-accent" />
                    </div>
                    <h2 className="text-2xl font-bold text-foreground">
                      Documents & Compliance
                    </h2>
                  </div>
                  <Badge className="bg-accent text-accent-foreground text-base px-4 py-1.5 font-semibold self-start sm:self-center">
                    📄 Documents & Compliance
                  </Badge>
                </div>
                <p className="text-sm text-muted-foreground mt-3 ml-14">
                  Store, organize, and share all your compliance documents
                </p>
              </CardHeader>
              <CardContent className="space-y-3 pt-6">
                {basicFeatures.map((feature, index) => (
                  <div key={index} className="flex items-start space-x-4 p-4 bg-card border-2 border-accent/20 rounded-lg hover:bg-accent/5 hover:shadow-md transition-all hover:scale-[1.02]">
                    <div className="text-accent mt-1 p-2 bg-accent/10 rounded-lg">{feature.icon}</div>
                    <div className="flex-1">
                      <div className="flex items-center justify-between mb-2 gap-2">
                        <h3 className="font-semibold text-base">{feature.title}</h3>
                        <Badge variant={feature.status === "warning" ? "destructive" : "secondary"} className="shrink-0">
                          {feature.count}
                        </Badge>
                      </div>
                      <p className="text-sm text-muted-foreground leading-relaxed">{feature.description}</p>
                    </div>
                    <div className="mt-1 shrink-0">
                      {feature.status === "warning" ? (
                        <AlertCircle className="w-5 h-5 text-orange-500" />
                      ) : (
                        <CheckCircle className="w-5 h-5 text-green-500" />
                      )}
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>

            {/* Divider */}
            <div className="relative py-4">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t-2 border-dashed border-muted-foreground/20"></div>
              </div>
              <div className="relative flex justify-center">
                <span className="bg-background px-4 text-sm font-medium text-muted-foreground">
                  Advanced Features Below
                </span>
              </div>
            </div>

            {/* Advanced Plan Features */}
            <Card className="border-2 border-primary/30 shadow-lg bg-primary/5 animate-fade-in">
              <CardHeader className="pb-4 bg-primary/10 rounded-t-lg">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-primary/20 rounded-lg">
                      <Wrench className="w-7 h-7 text-primary" />
                    </div>
                    <h2 className="text-2xl font-bold text-foreground">
                      Operations & Maintenance
                    </h2>
                  </div>
                  <Badge className="bg-primary text-primary-foreground text-base px-4 py-1.5 font-semibold self-start sm:self-center">
                    ⚙️ Operations & Maintenance
                  </Badge>
                </div>
                <p className="text-sm text-muted-foreground mt-3 ml-14">
                  Complete safety checks, track maintenance, and manage inspections
                </p>
              </CardHeader>
              <CardContent className="space-y-3 pt-6">
                {advancedFeatures.map((feature, index) => (
                  <div key={index} className="flex items-start space-x-4 p-4 bg-card border-2 border-primary/20 rounded-lg hover:bg-primary/5 hover:shadow-md transition-all hover:scale-[1.02]">
                    <div className="text-primary mt-1 p-2 bg-primary/10 rounded-lg">{feature.icon}</div>
                    <div className="flex-1">
                      <div className="flex items-center justify-between mb-2 gap-2">
                        <h3 className="font-semibold text-base">{feature.title}</h3>
                        <Badge variant="secondary" className="shrink-0">
                          {feature.count}
                        </Badge>
                      </div>
                      <p className="text-sm text-muted-foreground leading-relaxed">{feature.description}</p>
                    </div>
                    <div className="mt-1 shrink-0">
                      <CheckCircle className="w-5 h-5 text-green-500" />
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>

            {/* Sample Document List */}
            <Card>
              <CardHeader>
                <h2 className="text-2xl font-semibold flex items-center">
                  <FileText className="w-6 h-6 mr-2 text-primary" />
                  Recent Documents
                </h2>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {[
                    { name: "Safety Certificate - Carousel Mk3.pdf", date: "March 15, 2024", status: "Valid" },
                    { name: "Insurance Policy - Public Liability.pdf", date: "March 10, 2024", status: "Valid" },
                    { name: "NDT Report - Ferris Wheel Structure.pdf", date: "March 8, 2024", status: "Valid" },
                    { name: "Technical Bulletin TB-2024-001.pdf", date: "March 5, 2024", status: "New" }
                  ].map((doc, index) => (
                    <div key={index} className="flex items-center justify-between p-3 border rounded-lg hover:bg-muted/50 transition-colors">
                      <div className="flex items-center space-x-3">
                        <FileText className="w-5 h-5 text-muted-foreground" />
                        <div>
                          <div className="font-medium">{doc.name}</div>
                          <div className="text-sm text-muted-foreground">{doc.date}</div>
                        </div>
                      </div>
                      <Badge variant={doc.status === "New" ? "default" : "secondary"}>
                        {doc.status}
                      </Badge>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <h2 className="text-xl font-semibold flex items-center">
                  <Clock className="w-5 h-5 mr-2 text-primary" />
                  Recent Activity
                </h2>
              </CardHeader>
              <CardContent className="space-y-4">
                {recentActivity.map((activity, index) => (
                  <div key={index} className="flex items-start space-x-3">
                    <div className="w-2 h-2 bg-primary rounded-full mt-2 flex-shrink-0" />
                    <div>
                      <div className="font-medium text-sm">{activity.title}</div>
                      <div className="text-xs text-muted-foreground">{activity.time}</div>
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <h2 className="text-xl font-semibold flex items-center">
                  <Users className="w-5 h-5 mr-2 text-primary" />
                  Quick Actions
                </h2>
              </CardHeader>
              <CardContent className="space-y-3">
                <Button className="w-full" variant="outline">
                  <Upload className="w-4 h-4 mr-2" />
                  Upload Document
                </Button>
                <Button className="w-full" variant="outline">
                  <Calendar className="w-4 h-4 mr-2" />
                  Schedule Inspection
                </Button>
                <Button className="w-full" variant="outline">
                  <BarChart3 className="w-4 h-4 mr-2" />
                  Generate Report
                </Button>
              </CardContent>
            </Card>
          </div>
        </div>

        {/* CTA Section */}
        <div className="text-center mt-16">
          <Card className="max-w-2xl mx-auto">
            <CardContent className="p-8">
              <h2 className="text-2xl font-bold mb-4">Ready to get started?</h2>
              <p className="text-muted-foreground mb-6">
                This demo shows just a fraction of what Ride Ready Docs can do for your business. 
                Start your free trial today and experience the full platform.
              </p>
              <div className="flex flex-col sm:flex-row gap-4 justify-center">
                <Button 
                  size="lg" 
                  className="bg-accent hover:bg-accent/90 text-accent-foreground"
                  onClick={() => navigate('/auth')}
                >
                  Start Free Trial
                </Button>
                <Button 
                  variant="outline" 
                  size="lg"
                  onClick={() => navigate('/')}
                >
                  Learn More
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </main>
      <Footer />
    </div>
  );
};

export default Demo;