import Header from "@/components/Header";
import Footer from "@/components/Footer";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Shield, Lock, UserX, Server, CheckCircle, Eye, FileText, Building2, Key } from "lucide-react";
import { Link } from "react-router-dom";
import TrustBadges from "@/components/TrustBadges";

const DataIndependence = () => {
  const commitments = [
    {
      icon: Building2,
      title: "We Are NOT an Inspection Body",
      description: "RideReadyDocs is a document management platform. We do not conduct inspections, audits, or assessments of any kind."
    },
    {
      icon: UserX,
      title: "We Are NOT a Regulator",
      description: "We have no regulatory authority. We do not report to, work for, or share data with any regulatory body, including the HSE or any local authority."
    },
    {
      icon: Shield,
      title: "We Do NOT Share Your Data",
      description: "Your documents are never shared with HSE, local councils, inspectors, or any third party. Period. We would only disclose data if legally compelled by a court order."
    },
    {
      icon: Lock,
      title: "Your Documents Are Yours",
      description: "We cannot see your documents without your explicit request. There is no admin 'browse all files' feature. Your files are isolated by your account."
    },
    {
      icon: Eye,
      title: "All Access Is Logged & Auditable",
      description: "Every document view, download, and share is logged. You can see your own activity log in Settings. If anyone accessed your files, you'd know."
    },
    {
      icon: Server,
      title: "Technical Isolation",
      description: "Row-Level Security ensures database queries only return your own data. Storage folders are isolated by user ID. Even our developers cannot casually browse user files."
    }
  ];

  return (
    <div className="min-h-screen bg-background">
      <Header />
      
      <main className="pt-24 pb-16">
        {/* Hero Section */}
        <section className="container mx-auto px-6 py-16 text-center">
          <div className="w-16 h-16 rounded-full bg-gradient-to-br from-primary/20 to-accent/20 flex items-center justify-center mx-auto mb-6 border-2 border-primary/30">
            <Shield className="h-8 w-8 text-primary" />
          </div>
          <h1 className="text-4xl md:text-5xl font-bold mb-6">
            Data Independence Statement
          </h1>
          <p className="text-xl text-muted-foreground max-w-3xl mx-auto mb-8">
            Your documents belong to you. We are an independent platform — not an inspector, not a regulator, and not a reporting tool.
          </p>
          <TrustBadges variant="default" />
        </section>

        {/* Main Statement */}
        <section className="container mx-auto px-6 py-8">
          <Card className="max-w-4xl mx-auto border-2 border-primary/30 bg-gradient-to-b from-primary/5 to-transparent">
            <CardHeader className="text-center pb-4">
              <CardTitle className="text-2xl">Our Commitment to You</CardTitle>
            </CardHeader>
            <CardContent className="text-center pb-8">
              <p className="text-lg text-muted-foreground leading-relaxed">
                RideReadyDocs was built to help fairground and amusement operators manage their compliance records efficiently and securely. 
                We understand the sensitivity around documentation in this industry, which is why we've designed the platform so that 
                <strong className="text-foreground"> we cannot see your paperwork unless you explicitly ask us to help</strong>.
              </p>
            </CardContent>
          </Card>
        </section>

        {/* Commitments Grid */}
        <section className="container mx-auto px-6 py-16">
          <h2 className="text-3xl font-bold mb-8 text-center">Our Privacy Commitments</h2>
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6 max-w-6xl mx-auto">
            {commitments.map((commitment, index) => (
              <Card key={index} className="border-2 border-primary/20 hover:border-primary/40 transition-all hover:shadow-elegant bg-gradient-to-b from-card to-primary/[0.02]">
                <CardHeader>
                  <div className="w-12 h-12 rounded-lg bg-gradient-to-br from-primary/20 to-accent/20 flex items-center justify-center mb-4 border border-primary/30">
                    <commitment.icon className="h-6 w-6 text-primary" />
                  </div>
                  <CardTitle className="text-lg">{commitment.title}</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-muted-foreground text-sm">{commitment.description}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </section>

        {/* Technical Details */}
        <section className="container mx-auto px-6 py-16 bg-gradient-to-br from-secondary via-primary/5 to-accent/5 rounded-2xl my-8 border-2 border-primary/20">
          <div className="max-w-4xl mx-auto">
            <h2 className="text-3xl font-bold mb-8 text-center">How We Protect Your Privacy</h2>
            
            <div className="space-y-6">
              <Card className="border-2 border-border/50">
                <CardHeader>
                  <CardTitle className="text-xl flex items-center gap-3">
                    <Lock className="h-5 w-5 text-primary" />
                    Encryption
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <ul className="space-y-2">
                    <li className="flex items-start gap-2">
                      <CheckCircle className="h-4 w-4 text-success mt-1 flex-shrink-0" />
                      <span className="text-muted-foreground text-sm">TLS 1.3 encryption for all data in transit</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <CheckCircle className="h-4 w-4 text-success mt-1 flex-shrink-0" />
                      <span className="text-muted-foreground text-sm">AES-256 encryption for all data at rest</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <CheckCircle className="h-4 w-4 text-success mt-1 flex-shrink-0" />
                      <span className="text-muted-foreground text-sm">Files stored by unique ID, not human-readable names</span>
                    </li>
                  </ul>
                </CardContent>
              </Card>

              <Card className="border-2 border-border/50">
                <CardHeader>
                  <CardTitle className="text-xl flex items-center gap-3">
                    <Server className="h-5 w-5 text-primary" />
                    Access Controls
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <ul className="space-y-2">
                    <li className="flex items-start gap-2">
                      <CheckCircle className="h-4 w-4 text-success mt-1 flex-shrink-0" />
                      <span className="text-muted-foreground text-sm">Row-Level Security on all database tables — you only see your own data</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <CheckCircle className="h-4 w-4 text-success mt-1 flex-shrink-0" />
                      <span className="text-muted-foreground text-sm">Storage buckets isolated by user ID folder structure</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <CheckCircle className="h-4 w-4 text-success mt-1 flex-shrink-0" />
                      <span className="text-muted-foreground text-sm">No global admin document browser exists in the platform</span>
                    </li>
                  </ul>
                </CardContent>
              </Card>

              <Card className="border-2 border-border/50">
                <CardHeader>
                  <CardTitle className="text-xl flex items-center gap-3">
                    <FileText className="h-5 w-5 text-primary" />
                    Audit Trail
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <ul className="space-y-2">
                    <li className="flex items-start gap-2">
                      <CheckCircle className="h-4 w-4 text-success mt-1 flex-shrink-0" />
                      <span className="text-muted-foreground text-sm">All document views, downloads, and shares are logged</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <CheckCircle className="h-4 w-4 text-success mt-1 flex-shrink-0" />
                      <span className="text-muted-foreground text-sm">You can view your activity log in Settings at any time</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <CheckCircle className="h-4 w-4 text-success mt-1 flex-shrink-0" />
                      <span className="text-muted-foreground text-sm">Any support access requires your explicit request and is logged</span>
                    </li>
                  </ul>
                </CardContent>
              </Card>

              <Card className="border-2 border-warning/30 bg-gradient-to-b from-warning/5 to-transparent">
                <CardHeader>
                  <CardTitle className="text-xl flex items-center gap-3">
                    <Key className="h-5 w-5 text-warning" />
                    Support Access
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-muted-foreground text-sm mb-4">
                    If you ever need help with your account, you can grant us temporary, time-limited access to troubleshoot. This access is:
                  </p>
                  <ul className="space-y-2">
                    <li className="flex items-start gap-2">
                      <CheckCircle className="h-4 w-4 text-success mt-1 flex-shrink-0" />
                      <span className="text-muted-foreground text-sm">Only granted when you explicitly request it</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <CheckCircle className="h-4 w-4 text-success mt-1 flex-shrink-0" />
                      <span className="text-muted-foreground text-sm">Logged in your activity history</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <CheckCircle className="h-4 w-4 text-success mt-1 flex-shrink-0" />
                      <span className="text-muted-foreground text-sm">Automatically expires after the time you choose</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <CheckCircle className="h-4 w-4 text-success mt-1 flex-shrink-0" />
                      <span className="text-muted-foreground text-sm">Revocable by you at any time</span>
                    </li>
                  </ul>
                </CardContent>
              </Card>
            </div>
          </div>
        </section>

        {/* Bottom Statement */}
        <section className="container mx-auto px-6 py-16">
          <Card className="max-w-3xl mx-auto text-center border-2 border-accent/30 bg-gradient-to-b from-card to-accent/[0.03]">
            <CardContent className="pt-8 pb-8">
              <p className="text-lg font-medium mb-4">
                "This system was built by someone who knows how inspections actually work — and why operators need control of their own records."
              </p>
              <p className="text-muted-foreground">
                RideReadyDocs is an independent platform. We do not share your data with inspectors, regulators, or any third party.
              </p>
              <div className="mt-6 flex flex-wrap justify-center gap-4">
                <Link to="/security" className="text-primary hover:underline text-sm font-medium">
                  Security Details →
                </Link>
                <Link to="/privacy" className="text-primary hover:underline text-sm font-medium">
                  Privacy Policy →
                </Link>
              </div>
            </CardContent>
          </Card>
        </section>
      </main>

      <Footer />
    </div>
  );
};

export default DataIndependence;
