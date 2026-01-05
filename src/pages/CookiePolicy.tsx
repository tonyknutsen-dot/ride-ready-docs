import Header from "@/components/Header";
import Footer from "@/components/Footer";
import { Card, CardContent } from "@/components/ui/card";
import { Cookie, Shield, Settings, BarChart3 } from "lucide-react";

const CookiePolicy = () => {
  const cookieTypes = [
    {
      icon: Shield,
      title: "Essential Cookies",
      description: "Required for the website to function properly. These cannot be disabled.",
      examples: [
        "Authentication session cookies",
        "Security tokens (CSRF protection)",
        "Cookie consent preferences",
        "Load balancing identifiers"
      ],
      retention: "Session or up to 30 days"
    },
    {
      icon: Settings,
      title: "Functional Cookies",
      description: "Remember your preferences and settings to improve your experience.",
      examples: [
        "Language preferences",
        "Theme settings (light/dark mode)",
        "UI preferences (sidebar state, etc.)",
        "Device hint dismissal"
      ],
      retention: "Up to 1 year"
    },
    {
      icon: BarChart3,
      title: "Analytics Cookies",
      description: "Help us understand how visitors use our website so we can improve it.",
      examples: [
        "Page view tracking",
        "Feature usage statistics",
        "Error monitoring",
        "Performance metrics"
      ],
      retention: "Up to 2 years"
    }
  ];

  return (
    <div className="min-h-screen bg-background">
      <Header />
      
      <main className="pt-24 pb-16">
        <div className="container mx-auto px-6 max-w-4xl">
          {/* Hero Section */}
          <div className="text-center mb-12">
            <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-6">
              <Cookie className="h-8 w-8 text-primary" />
            </div>
            <h1 className="text-4xl font-bold mb-4">Cookie Policy</h1>
            <p className="text-muted-foreground">Last updated: {new Date().toLocaleDateString()}</p>
          </div>

          <Card className="mb-8">
            <CardContent className="pt-6 space-y-6">
              <section>
                <h2 className="text-2xl font-semibold mb-4">What Are Cookies?</h2>
                <p className="text-muted-foreground">
                  Cookies are small text files that are stored on your device when you visit a website. They are widely used to make websites work efficiently and to provide information to website owners. We use cookies to enhance your experience, keep you logged in, and remember your preferences.
                </p>
              </section>

              <section>
                <h2 className="text-2xl font-semibold mb-4">Our Cookie Usage</h2>
                <p className="text-muted-foreground mb-4">
                  Ride Ready Docs uses a minimal set of cookies, focused on essential functionality rather than advertising or tracking. We do not use cookies to serve advertisements or track you across other websites.
                </p>
                <div className="bg-muted/30 rounded-lg p-4">
                  <p className="text-sm font-medium text-primary">
                    We do NOT use advertising cookies or sell your data to third parties.
                  </p>
                </div>
              </section>
            </CardContent>
          </Card>

          {/* Cookie Types */}
          <h2 className="text-2xl font-bold mb-6">Types of Cookies We Use</h2>
          <div className="space-y-6 mb-8">
            {cookieTypes.map((cookie, index) => (
              <Card key={index}>
                <CardContent className="pt-6">
                  <div className="flex items-start gap-4">
                    <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                      <cookie.icon className="h-6 w-6 text-primary" />
                    </div>
                    <div className="flex-1">
                      <h3 className="text-xl font-semibold mb-2">{cookie.title}</h3>
                      <p className="text-muted-foreground mb-4">{cookie.description}</p>
                      <div className="grid md:grid-cols-2 gap-4">
                        <div>
                          <h4 className="text-sm font-semibold mb-2">Examples:</h4>
                          <ul className="list-disc pl-4 text-sm text-muted-foreground space-y-1">
                            {cookie.examples.map((example, i) => (
                              <li key={i}>{example}</li>
                            ))}
                          </ul>
                        </div>
                        <div>
                          <h4 className="text-sm font-semibold mb-2">Retention Period:</h4>
                          <p className="text-sm text-muted-foreground">{cookie.retention}</p>
                        </div>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          <Card className="mb-8">
            <CardContent className="pt-6 space-y-6">
              <section>
                <h2 className="text-2xl font-semibold mb-4">Third-Party Cookies</h2>
                <p className="text-muted-foreground mb-4">
                  Some cookies on our site are set by third-party services we use:
                </p>
                <ul className="list-disc pl-6 text-muted-foreground space-y-2">
                  <li><strong>Supabase:</strong> Authentication and session management</li>
                  <li><strong>Error monitoring:</strong> To identify and fix technical issues</li>
                </ul>
                <p className="text-muted-foreground mt-4">
                  These third parties have their own privacy policies governing cookie usage.
                </p>
              </section>

              <section>
                <h2 className="text-2xl font-semibold mb-4">Managing Your Cookie Preferences</h2>
                <p className="text-muted-foreground mb-4">
                  You can control and manage cookies in several ways:
                </p>
                <ul className="list-disc pl-6 text-muted-foreground space-y-2">
                  <li><strong>Cookie banner:</strong> When you first visit our site, you can accept or customize your cookie preferences using the consent banner.</li>
                  <li><strong>Browser settings:</strong> Most browsers allow you to refuse cookies or delete existing cookies. Note that blocking essential cookies may affect site functionality.</li>
                  <li><strong>In-app settings:</strong> Some preferences can be managed within your account settings.</li>
                </ul>
              </section>

              <section>
                <h2 className="text-2xl font-semibold mb-4">Browser-Specific Instructions</h2>
                <p className="text-muted-foreground mb-4">
                  To manage cookies through your browser, refer to:
                </p>
                <ul className="list-disc pl-6 text-muted-foreground space-y-2">
                  <li><a href="https://support.google.com/chrome/answer/95647" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">Google Chrome</a></li>
                  <li><a href="https://support.mozilla.org/en-US/kb/cookies-information-websites-store-on-your-computer" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">Mozilla Firefox</a></li>
                  <li><a href="https://support.apple.com/guide/safari/manage-cookies-sfri11471/mac" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">Safari</a></li>
                  <li><a href="https://support.microsoft.com/en-us/microsoft-edge/delete-cookies-in-microsoft-edge-63947406-40ac-c3b8-57b9-2a946a29ae09" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">Microsoft Edge</a></li>
                </ul>
              </section>

              <section>
                <h2 className="text-2xl font-semibold mb-4">Local Storage</h2>
                <p className="text-muted-foreground">
                  In addition to cookies, we use browser local storage to persist certain preferences (such as UI settings and dismissal states). Local storage is similar to cookies but is not sent with each request. You can clear local storage through your browser's developer tools or settings.
                </p>
              </section>

              <section>
                <h2 className="text-2xl font-semibold mb-4">Changes to This Policy</h2>
                <p className="text-muted-foreground">
                  We may update this Cookie Policy from time to time to reflect changes in our practices or for legal, operational, or regulatory reasons. We will notify you of significant changes by updating the "Last updated" date at the top of this page.
                </p>
              </section>

              <section>
                <h2 className="text-2xl font-semibold mb-4">Contact Us</h2>
                <p className="text-muted-foreground">
                  If you have questions about our use of cookies, please contact us:
                </p>
                <ul className="list-none pl-0 text-muted-foreground space-y-2 mt-4">
                  <li><strong>Email:</strong> info@knutssoftware.co.uk</li>
                </ul>
              </section>
            </CardContent>
          </Card>
        </div>
      </main>

      <Footer />
    </div>
  );
};

export default CookiePolicy;