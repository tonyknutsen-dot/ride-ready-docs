import Header from "@/components/Header";
import Footer from "@/components/Footer";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Shield, Lock, Database, Eye, CheckCircle, Server } from "lucide-react";

const Security = () => {
  const securityFeatures = [
    {
      icon: Lock,
      title: "End-to-End Encryption",
      description: "All data transmitted between your browser and our servers is encrypted using industry-standard TLS 1.3 protocol, ensuring your documents and information are protected during transmission."
    },
    {
      icon: Database,
      title: "Secure Data Storage",
      description: "Your documents are stored on Supabase's secure infrastructure with at-rest encryption. Database backups are encrypted and stored in geographically distributed locations."
    },
    {
      icon: Eye,
      title: "Row-Level Security",
      description: "Every database query is protected with row-level security policies, ensuring users can only access their own rides, documents, and records. No user can view another user's data."
    },
    {
      icon: Shield,
      title: "Authentication Security",
      description: "Secure authentication powered by Supabase Auth with password hashing using bcrypt, optional two-factor authentication, and secure session management."
    },
    {
      icon: Server,
      title: "UK/EU Data Centers",
      description: "Your data is stored in secure data centers located in the UK and EU, ensuring compliance with GDPR and UK data protection regulations."
    },
    {
      icon: CheckCircle,
      title: "Regular Security Audits",
      description: "We conduct regular security assessments, dependency updates, and penetration testing to identify and address potential vulnerabilities."
    }
  ];

  const practices = [
    {
      title: "Data Protection",
      items: [
        "All passwords are hashed and salted using industry-standard algorithms",
        "Sensitive data is encrypted both in transit and at rest",
        "Regular automated backups with encrypted storage",
        "Strict access controls and authentication requirements",
        "No third-party access to your documents or data"
      ]
    },
    {
      title: "Infrastructure Security",
      items: [
        "Hosted on Supabase's enterprise-grade infrastructure",
        "DDoS protection and traffic filtering",
        "Regular security patches and updates",
        "24/7 infrastructure monitoring and alerting",
        "Redundant systems for high availability"
      ]
    },
    {
      title: "Application Security",
      items: [
        "Input validation and sanitization on all user data",
        "Protection against SQL injection and XSS attacks",
        "CSRF protection on all form submissions",
        "Rate limiting to prevent abuse",
        "Secure file upload validation and scanning"
      ]
    },
    {
      title: "Privacy & Compliance",
      items: [
        "GDPR compliant data processing and storage",
        "Clear data retention and deletion policies",
        "No selling or sharing of user data",
        "Minimal data collection - only what's necessary",
        "User rights to access, correct, and delete data"
      ]
    }
  ];

  const userSecurity = [
    "Choose a strong, unique password for your account",
    "Never share your account credentials",
    "Log out when using shared computers",
    "Keep your email account secure (password recovery)",
    "Review notification settings for suspicious activity",
    "Regularly review your document access logs",
    "Report any security concerns immediately"
  ];

  return (
    <div className="min-h-screen bg-background">
      <Header />
      
      <main className="pt-24 pb-16">
        {/* Hero Section */}
        <section className="container mx-auto px-6 py-16 text-center">
          <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-6">
            <Shield className="h-8 w-8 text-primary" />
          </div>
          <h1 className="text-4xl md:text-5xl font-bold mb-6">
            Security & Data Protection
          </h1>
          <p className="text-xl text-muted-foreground max-w-3xl mx-auto">
            Your ride documents and compliance records are critical to your business. We take security seriously and implement multiple layers of protection to keep your data safe.
          </p>
        </section>

        {/* Security Features */}
        <section className="container mx-auto px-6 py-16">
          <h2 className="text-3xl font-bold mb-8 text-center">Our Security Measures</h2>
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {securityFeatures.map((feature, index) => (
              <Card key={index} className="border-2">
                <CardHeader>
                  <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center mb-4">
                    <feature.icon className="h-6 w-6 text-primary" />
                  </div>
                  <CardTitle className="text-xl">{feature.title}</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-muted-foreground">{feature.description}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </section>

        {/* Security Practices */}
        <section className="container mx-auto px-6 py-16 bg-muted/30 rounded-2xl my-16">
          <h2 className="text-3xl font-bold mb-12 text-center">Security Best Practices</h2>
          <div className="grid md:grid-cols-2 gap-8 max-w-5xl mx-auto">
            {practices.map((practice, index) => (
              <Card key={index}>
                <CardHeader>
                  <CardTitle className="text-xl">{practice.title}</CardTitle>
                </CardHeader>
                <CardContent>
                  <ul className="space-y-3">
                    {practice.items.map((item, itemIndex) => (
                      <li key={itemIndex} className="flex items-start space-x-2">
                        <CheckCircle className="h-5 w-5 text-primary flex-shrink-0 mt-0.5" />
                        <span className="text-muted-foreground">{item}</span>
                      </li>
                    ))}
                  </ul>
                </CardContent>
              </Card>
            ))}
          </div>
        </section>

        {/* Data Handling */}
        <section className="container mx-auto px-6 py-16">
          <div className="max-w-4xl mx-auto">
            <Card>
              <CardHeader>
                <CardTitle className="text-2xl">How We Handle Your Data</CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                <div>
                  <h3 className="text-lg font-semibold mb-3">Data Collection</h3>
                  <p className="text-muted-foreground">
                    We only collect data necessary to provide our document management service: account information, ride details, documents you upload, and inspection/maintenance records. We do not collect unnecessary personal information.
                  </p>
                </div>

                <div>
                  <h3 className="text-lg font-semibold mb-3">Data Usage</h3>
                  <p className="text-muted-foreground">
                    Your data is used solely to provide the service you subscribe to: storing documents, tracking inspections, sending reminders, and generating reports. We do not analyze your data for advertising or sell it to third parties.
                  </p>
                </div>

                <div>
                  <h3 className="text-lg font-semibold mb-3">Data Retention</h3>
                  <p className="text-muted-foreground">
                    Active account data is retained indefinitely to ensure you have access to historical records. After account cancellation, data is retained for 90 days to allow reactivation, then permanently deleted. You can request immediate deletion at any time.
                  </p>
                </div>

                <div>
                  <h3 className="text-lg font-semibold mb-3">Data Portability</h3>
                  <p className="text-muted-foreground">
                    You can export your data at any time. Download all documents, export records as CSV, or generate PDF reports. Your data is yours, and you're free to take it with you.
                  </p>
                </div>

                <div>
                  <h3 className="text-lg font-semibold mb-3">Backup & Recovery</h3>
                  <p className="text-muted-foreground">
                    We maintain daily encrypted backups stored in multiple geographic locations. In the unlikely event of data loss, we can restore your information from recent backups.
                  </p>
                </div>
              </CardContent>
            </Card>
          </div>
        </section>

        {/* User Responsibilities */}
        <section className="container mx-auto px-6 py-16">
          <Card className="max-w-4xl mx-auto bg-primary/5 border-primary/20">
            <CardHeader>
              <CardTitle className="text-2xl">Your Role in Security</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground mb-6">
                Security is a shared responsibility. Here's how you can help protect your account:
              </p>
              <ul className="space-y-3">
                {userSecurity.map((item, index) => (
                  <li key={index} className="flex items-start space-x-2">
                    <CheckCircle className="h-5 w-5 text-primary flex-shrink-0 mt-0.5" />
                    <span className="text-muted-foreground">{item}</span>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        </section>

        {/* Compliance */}
        <section className="container mx-auto px-6 py-16">
          <div className="max-w-4xl mx-auto">
            <Card>
              <CardHeader>
                <CardTitle className="text-2xl">Regulatory Compliance</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <h3 className="text-lg font-semibold mb-2">GDPR Compliance</h3>
                  <p className="text-muted-foreground">
                    We fully comply with the General Data Protection Regulation (GDPR). You have the right to access, correct, delete, and export your personal data at any time.
                  </p>
                </div>
                <div>
                  <h3 className="text-lg font-semibold mb-2">UK Data Protection</h3>
                  <p className="text-muted-foreground">
                    Our data handling practices comply with the UK Data Protection Act 2018. We are registered with the UK Information Commissioner's Office (ICO).
                  </p>
                </div>
                <div>
                  <h3 className="text-lg font-semibold mb-2">Industry Standards</h3>
                  <p className="text-muted-foreground">
                    While not legally required for our industry, we follow security best practices from standards like ISO 27001 and SOC 2 to ensure robust data protection.
                  </p>
                </div>
              </CardContent>
            </Card>
          </div>
        </section>

        {/* Report Security Issues */}
        <section className="container mx-auto px-6 py-16">
          <Card className="max-w-2xl mx-auto text-center border-2 border-destructive/20">
            <CardHeader>
              <div className="w-12 h-12 rounded-full bg-destructive/10 flex items-center justify-center mx-auto mb-4">
                <Shield className="h-6 w-6 text-destructive" />
              </div>
              <CardTitle className="text-2xl">Report a Security Issue</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground mb-6">
                If you discover a security vulnerability or have concerns about your account security, please contact us immediately:
              </p>
              <div className="space-y-2 text-muted-foreground">
                <p><strong>Security Email:</strong> security@ridereadydocs.com</p>
                <p><strong>Response Time:</strong> Within 24 hours for critical issues</p>
              </div>
              <p className="text-sm text-muted-foreground mt-6 italic">
                We take all security reports seriously and will investigate promptly. Responsible disclosure is appreciated.
              </p>
            </CardContent>
          </Card>
        </section>
      </main>

      <Footer />
    </div>
  );
};

export default Security;
