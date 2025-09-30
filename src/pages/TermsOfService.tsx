import Header from "@/components/Header";
import Footer from "@/components/Footer";
import { Card, CardContent } from "@/components/ui/card";

const TermsOfService = () => {
  return (
    <div className="min-h-screen bg-background">
      <Header />
      
      <main className="pt-24 pb-16">
        <div className="container mx-auto px-6 max-w-4xl">
          <h1 className="text-4xl font-bold mb-6">Terms of Service</h1>
          <p className="text-muted-foreground mb-8">Last updated: {new Date().toLocaleDateString()}</p>

          <Card className="mb-8">
            <CardContent className="pt-6 space-y-6">
              <section>
                <h2 className="text-2xl font-semibold mb-4">1. Acceptance of Terms</h2>
                <p className="text-muted-foreground">
                  By accessing and using Ride Ready Docs ("the Service"), you accept and agree to be bound by these Terms of Service. This Service is designed specifically for fairground professionals to manage ride documents, inspections, and compliance records. If you do not agree to these terms, please do not use the Service.
                </p>
              </section>

              <section>
                <h2 className="text-2xl font-semibold mb-4">2. Service Description</h2>
                <p className="text-muted-foreground mb-4">
                  Ride Ready Docs provides a cloud-based document management and compliance tracking platform that includes:
                </p>
                <ul className="list-disc pl-6 text-muted-foreground space-y-2">
                  <li>Storage and organization of ride documents and certificates</li>
                  <li>Annual inspection and NDT testing schedule management</li>
                  <li>Daily, monthly, and yearly check templates and logging</li>
                  <li>Maintenance record tracking and reporting</li>
                  <li>Document expiry notifications and reminders</li>
                  <li>Technical bulletin library and matching</li>
                  <li>Report generation and compliance tracking</li>
                </ul>
              </section>

              <section>
                <h2 className="text-2xl font-semibold mb-4">3. Account Registration and Eligibility</h2>
                <h3 className="text-xl font-semibold mb-2">3.1 Account Creation</h3>
                <p className="text-muted-foreground mb-4">
                  To use the Service, you must create an account with accurate and complete information. You are responsible for maintaining the confidentiality of your account credentials.
                </p>
                
                <h3 className="text-xl font-semibold mb-2">3.2 Eligibility</h3>
                <p className="text-muted-foreground mb-4">
                  You must be at least 18 years old and have the legal authority to enter into these terms on behalf of your business or organization. This Service is intended for professional business use.
                </p>

                <h3 className="text-xl font-semibold mb-2">3.3 Account Security</h3>
                <p className="text-muted-foreground">
                  You are responsible for all activities under your account. Notify us immediately of any unauthorized access or security breaches.
                </p>
              </section>

              <section>
                <h2 className="text-2xl font-semibold mb-4">4. Subscription Plans and Billing</h2>
                <h3 className="text-xl font-semibold mb-2">4.1 Free Trial</h3>
                <p className="text-muted-foreground mb-4">
                  New users receive a 30-day free trial with full access to all features. No credit card is required to start the trial. At the end of the trial, you must select a paid plan to continue using the Service.
                </p>

                <h3 className="text-xl font-semibold mb-2">4.2 Subscription Plans</h3>
                <ul className="list-disc pl-6 text-muted-foreground space-y-2 mb-4">
                  <li><strong>Basic Plan:</strong> £29.99/month - Up to 10 rides, core features</li>
                  <li><strong>Advanced Plan:</strong> £49.99/month - Unlimited rides, all features including technical bulletins and advanced reporting</li>
                </ul>

                <h3 className="text-xl font-semibold mb-2">4.3 Payment Terms</h3>
                <p className="text-muted-foreground mb-4">
                  Subscriptions are billed monthly in advance. Payments are processed securely through our payment provider. Prices are subject to change with 30 days notice.
                </p>

                <h3 className="text-xl font-semibold mb-2">4.4 Cancellation and Refunds</h3>
                <p className="text-muted-foreground">
                  You may cancel your subscription at any time. Cancellation takes effect at the end of the current billing period. We do not provide refunds for partial months, but you retain access until the end of your paid period.
                </p>
              </section>

              <section>
                <h2 className="text-2xl font-semibold mb-4">5. User Responsibilities</h2>
                <h3 className="text-xl font-semibold mb-2">5.1 Accurate Information</h3>
                <p className="text-muted-foreground mb-4">
                  You are responsible for ensuring all information, documents, and records uploaded to the Service are accurate and current. While we provide tools for tracking and reminders, you remain responsible for compliance with all applicable regulations and safety standards.
                </p>

                <h3 className="text-xl font-semibold mb-2">5.2 Document Verification</h3>
                <p className="text-muted-foreground mb-4">
                  The Service provides document management and tracking tools but does not verify the validity of certificates, inspection reports, or other documents. You are responsible for ensuring all documents are legitimate and compliant with relevant regulations including ADIPS, HSE, and local authority requirements.
                </p>

                <h3 className="text-xl font-semibold mb-2">5.3 Prohibited Uses</h3>
                <p className="text-muted-foreground mb-4">You agree not to:</p>
                <ul className="list-disc pl-6 text-muted-foreground space-y-2">
                  <li>Upload malicious software or harmful content</li>
                  <li>Share account access with unauthorized users</li>
                  <li>Attempt to breach security or access other users' data</li>
                  <li>Use the Service for illegal purposes or fraud</li>
                  <li>Reverse engineer or copy the Service</li>
                  <li>Resell or redistribute the Service</li>
                </ul>
              </section>

              <section>
                <h2 className="text-2xl font-semibold mb-4">6. Data Ownership and Usage</h2>
                <h3 className="text-xl font-semibold mb-2">6.1 Your Data</h3>
                <p className="text-muted-foreground mb-4">
                  You retain all rights to your data, including ride information, documents, and records. We do not claim ownership of your content.
                </p>

                <h3 className="text-xl font-semibold mb-2">6.2 Data Backup</h3>
                <p className="text-muted-foreground mb-4">
                  While we maintain regular backups, you are encouraged to maintain your own copies of critical documents. We provide data export functionality for this purpose.
                </p>

                <h3 className="text-xl font-semibold mb-2">6.3 Data Deletion</h3>
                <p className="text-muted-foreground">
                  Upon account closure or cancellation, your data will be retained for 90 days to allow for reactivation, after which it will be permanently deleted. You can request immediate deletion by contacting support.
                </p>
              </section>

              <section>
                <h2 className="text-2xl font-semibold mb-4">7. Service Availability and Support</h2>
                <h3 className="text-xl font-semibold mb-2">7.1 Uptime</h3>
                <p className="text-muted-foreground mb-4">
                  We strive for 99.9% uptime but do not guarantee uninterrupted access. Scheduled maintenance will be announced in advance when possible.
                </p>

                <h3 className="text-xl font-semibold mb-2">7.2 Support</h3>
                <p className="text-muted-foreground">
                  Email support is available to all subscribers. Advanced plan users receive priority support. We aim to respond within 24 hours during business days.
                </p>
              </section>

              <section>
                <h2 className="text-2xl font-semibold mb-4">8. Limitations of Liability</h2>
                <p className="text-muted-foreground mb-4">
                  <strong>IMPORTANT:</strong> Ride Ready Docs is a documentation and tracking tool. It does not replace professional inspections, safety assessments, or regulatory compliance obligations.
                </p>
                <ul className="list-disc pl-6 text-muted-foreground space-y-2">
                  <li>We are not responsible for missed inspections or expired documents</li>
                  <li>We do not verify the accuracy or validity of uploaded documents</li>
                  <li>We are not liable for regulatory fines or safety incidents</li>
                  <li>Our total liability is limited to the amount paid for the Service in the past 12 months</li>
                  <li>We do not provide legal, safety, or engineering advice</li>
                </ul>
              </section>

              <section>
                <h2 className="text-2xl font-semibold mb-4">9. Indemnification</h2>
                <p className="text-muted-foreground">
                  You agree to indemnify and hold Ride Ready Docs harmless from any claims, damages, or expenses arising from your use of the Service, violation of these terms, or violation of any rights of third parties.
                </p>
              </section>

              <section>
                <h2 className="text-2xl font-semibold mb-4">10. Modifications to Service and Terms</h2>
                <p className="text-muted-foreground">
                  We reserve the right to modify, suspend, or discontinue any part of the Service with reasonable notice. We may update these Terms with 30 days notice for material changes. Continued use after changes constitutes acceptance.
                </p>
              </section>

              <section>
                <h2 className="text-2xl font-semibold mb-4">11. Termination</h2>
                <p className="text-muted-foreground mb-4">
                  We may terminate or suspend your account for:
                </p>
                <ul className="list-disc pl-6 text-muted-foreground space-y-2">
                  <li>Violation of these Terms</li>
                  <li>Non-payment of fees</li>
                  <li>Fraudulent or illegal activity</li>
                  <li>Extended period of inactivity</li>
                </ul>
              </section>

              <section>
                <h2 className="text-2xl font-semibold mb-4">12. Governing Law</h2>
                <p className="text-muted-foreground">
                  These Terms are governed by the laws of England and Wales. Any disputes will be resolved in the courts of England and Wales.
                </p>
              </section>

              <section>
                <h2 className="text-2xl font-semibold mb-4">13. Contact Information</h2>
                <p className="text-muted-foreground mb-4">
                  For questions about these Terms of Service:
                </p>
                <ul className="list-none pl-0 text-muted-foreground space-y-2">
                  <li><strong>Email:</strong> legal@ridereadydocs.com</li>
                  <li><strong>Support:</strong> support@ridereadydocs.com</li>
                  <li><strong>Phone:</strong> +44 (0) 1234 567890</li>
                </ul>
              </section>

              <section className="border-t pt-6">
                <p className="text-sm text-muted-foreground italic">
                  By using Ride Ready Docs, you acknowledge that this is a documentation tool to assist with compliance management. You remain solely responsible for ensuring your rides, equipment, and operations meet all applicable safety standards and regulatory requirements. Always consult with qualified inspectors and comply with ADIPS, HSE, and local authority regulations.
                </p>
              </section>
            </CardContent>
          </Card>
        </div>
      </main>

      <Footer />
    </div>
  );
};

export default TermsOfService;
