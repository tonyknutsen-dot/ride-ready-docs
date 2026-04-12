import Header from "@/components/Header";
import Footer from "@/components/Footer";
import { Card, CardContent } from "@/components/ui/card";

const PrivacyPolicy = () => {
  return (
    <div className="min-h-screen bg-background">
      <Header />
      
      <main className="pt-24 pb-16">
        <div className="container mx-auto px-6 max-w-4xl">
          <h1 className="text-4xl font-bold mb-6">Privacy Policy</h1>
          <p className="text-muted-foreground mb-8">Last updated: {new Date().toLocaleDateString('en-GB')}</p>

          <Card className="mb-8 border-2 border-primary/20 bg-gradient-to-b from-card to-primary/[0.02]">
            <CardContent className="pt-6 space-y-6">
              <section>
                <h2 className="text-2xl font-semibold mb-4">1. Introduction</h2>
                <p className="text-muted-foreground">
                  Ride Ready Docs ("we", "our", or "us") is committed to protecting your privacy. This Privacy Policy explains how we collect, use, disclose, and safeguard your information when you use our document management platform designed for fairground professionals.
                </p>
              </section>

              <section>
                <h2 className="text-2xl font-semibold mb-4">2. Information We Collect</h2>
                <h3 className="text-xl font-semibold mb-2">2.1 Account Information</h3>
                <ul className="list-disc pl-6 text-muted-foreground space-y-2 mb-4">
                  <li>Email address and password</li>
                  <li>Company name and showman name</li>
                  <li>Controller name and business address</li>
                  <li>Contact information</li>
                </ul>
                
                <h3 className="text-xl font-semibold mb-2">2.2 Ride and Equipment Data</h3>
                <ul className="list-disc pl-6 text-muted-foreground space-y-2 mb-4">
                  <li>Ride names, manufacturers, serial numbers</li>
                  <li>Equipment specifications and categories</li>
                  <li>Ownership and operational details</li>
                </ul>

                <h3 className="text-xl font-semibold mb-2">2.3 Documents and Records</h3>
                <ul className="list-disc pl-6 text-muted-foreground space-y-2 mb-4">
                  <li>Safety certificates and inspection reports</li>
                  <li>Insurance documents and Declaration of Compliance (DOC) certificates</li>
                  <li>Maintenance records and NDT test reports</li>
                  <li>Technical bulletins and manuals</li>
                  <li>Daily check logs and signatures</li>
                </ul>

                <h3 className="text-xl font-semibold mb-2">2.4 Usage Information</h3>
                <ul className="list-disc pl-6 text-muted-foreground space-y-2">
                  <li>Log data and access times</li>
                  <li>Feature usage and interactions</li>
                  <li>Device information and IP addresses</li>
                </ul>
              </section>

              <section>
                <h2 className="text-2xl font-semibold mb-4">3. How We Use Your Information</h2>
                <ul className="list-disc pl-6 text-muted-foreground space-y-2">
                  <li>Provide and maintain the document management service</li>
                  <li>Send inspection and maintenance reminders</li>
                  <li>Track document expiry dates and compliance deadlines</li>
                  <li>Generate inspection and maintenance reports</li>
                  <li>Provide customer support and technical assistance</li>
                  <li>Improve our platform and develop new features</li>
                  <li>Process subscription payments and billing</li>
                  <li>Send important service updates and notifications</li>
                </ul>
              </section>

              <section>
                <h2 className="text-2xl font-semibold mb-4">4. Data Storage and Security</h2>
                <p className="text-muted-foreground mb-4">
                  Your data is stored securely using Supabase infrastructure with the following protections:
                </p>
                <ul className="list-disc pl-6 text-muted-foreground space-y-2">
                  <li>End-to-end encryption for data transmission</li>
                  <li>Secure database with row-level security policies</li>
                  <li>Regular security audits and updates</li>
                  <li>Backup systems to prevent data loss</li>
                  <li>Access controls and authentication protocols</li>
                </ul>
              </section>

              <section>
                <h2 className="text-2xl font-semibold mb-4">5. Data Sharing and Disclosure</h2>
                <p className="text-muted-foreground mb-4">
                  <strong className="text-foreground">We do not sell, monitor, review, or routinely access your personal documents or data.</strong> 
                  Your documents are yours — the platform owner cannot browse user files and no admin interface exists for this purpose.
                </p>
                <p className="text-muted-foreground mb-4">
                  Data is never shared with regulatory bodies (including HSE or local authorities) unless legally compelled by a court order.
                </p>
                <p className="text-muted-foreground mb-4">
                  We may share your information only in these limited circumstances:
                </p>
                <ul className="list-disc pl-6 text-muted-foreground space-y-2">
                  <li><strong>With your consent:</strong> When you explicitly request document sharing (e.g., sending documents via email)</li>
                  <li><strong>Service providers:</strong> Trusted third parties who assist in operating our platform (e.g., hosting, payment processing) — they cannot access document contents</li>
                  <li><strong>Legal requirements:</strong> Only when legally compelled by a court order or similar legal process</li>
                </ul>
              </section>

              <section>
                <h2 className="text-2xl font-semibold mb-4">6. Your Rights and Choices</h2>
                <ul className="list-disc pl-6 text-muted-foreground space-y-2">
                  <li><strong>Access:</strong> Request a copy of your personal data</li>
                  <li><strong>Correction:</strong> Update or correct inaccurate information</li>
                  <li><strong>Deletion:</strong> Request deletion of your account and associated data. Note: if your account has created operational records (inspections, defect reports, maintenance logs), full deletion may not be possible to preserve audit integrity. In such cases, your account can be removed from the organisation and/or suspended, and personal data may be anonymised upon request.</li>
                  <li><strong>Export:</strong> Download your documents and records</li>
                  <li><strong>Opt-out:</strong> Unsubscribe from marketing communications (service notifications will continue)</li>
                </ul>
              </section>

              <section>
                <h2 className="text-2xl font-semibold mb-4">7. Data Retention</h2>
                <p className="text-muted-foreground mb-4">
                  We retain your information for as long as your account is active or as needed to provide services. Due to the compliance nature of fairground operations, we recommend keeping inspection and maintenance records for at least 7 years as per industry best practices. Upon account closure, data will be deleted within 90 days unless legal obligations require longer retention.
                </p>

                <h3 className="text-xl font-semibold mb-2">7.1 Retention by Account State</h3>
                <ul className="list-disc pl-6 text-muted-foreground space-y-2 mb-4">
                  <li><strong>Active accounts:</strong> All data is retained and accessible for the duration of the account's active status.</li>
                  <li><strong>Pending invitations:</strong> Invitation records are retained only while the invitation is valid. Expired or revoked invitations are removed, though audit records of the invitation event may be preserved.</li>
                  <li><strong>Staff removed from an organisation:</strong> Organisation membership is removed, but any operational records created by the staff member (checks, defect reports, maintenance logs, wind logs, pressure readings) are retained with their original attribution for audit and legal traceability. The staff member's personal account may continue to exist independently.</li>
                  <li><strong>Suspended accounts:</strong> Minimal account data is retained to enforce the suspension (email, suspension status, suspension reason, and audit trail). Suspended accounts remain blocked from sign-in, new account creation with the same email, and invitation acceptance.</li>
                  <li><strong>Test and demo accounts:</strong> Accounts with no real operational history may be permanently deleted by an administrator. All associated test data is removed.</li>
                  <li><strong>Accounts with operational history:</strong> Accounts that have created real inspection records, defect reports, maintenance logs, or other compliance-related data cannot be hard-deleted. Instead, they should be removed from the organisation and/or suspended. This preserves the integrity of the operational audit trail.</li>
                </ul>

                <h3 className="text-xl font-semibold mb-2">7.2 Future Anonymisation</h3>
                <p className="text-muted-foreground">
                  In the future, we may introduce an anonymisation option for accounts with historical records. This would remove personally identifiable information while preserving the integrity of operational records for audit and compliance purposes (e.g., replacing a name with "Former Staff Member"). This ensures compliance with data minimisation principles while maintaining legal traceability.
                </p>
              </section>

              <section>
                <h2 className="text-2xl font-semibold mb-4">8. Cookies and Tracking</h2>
                <p className="text-muted-foreground">
                  We use essential cookies for authentication and session management. We do not use advertising or tracking cookies. You can manage cookie preferences through your browser settings.
                </p>
              </section>

              <section>
                <h2 className="text-2xl font-semibold mb-4">9. Children's Privacy</h2>
                <p className="text-muted-foreground">
                  Ride Ready Docs is designed for business use by fairground operators and is not intended for children under 16. We do not knowingly collect information from children.
                </p>
              </section>

              <section>
                <h2 className="text-2xl font-semibold mb-4">10. International Data Transfers</h2>
                <p className="text-muted-foreground">
                  Your data is stored in secure data centers. If data is transferred internationally, we ensure appropriate safeguards are in place to protect your information in compliance with applicable data protection laws.
                </p>
              </section>

              <section>
                <h2 className="text-2xl font-semibold mb-4">11. Changes to This Policy</h2>
                <p className="text-muted-foreground">
                  We may update this Privacy Policy periodically. We will notify you of significant changes via email or through the platform. Continued use of our services after changes indicates acceptance of the updated policy.
                </p>
              </section>

              <section>
                <h2 className="text-2xl font-semibold mb-4">12. Contact Us</h2>
                <p className="text-muted-foreground">
                  For questions about this Privacy Policy or to exercise your rights:
                </p>
                <ul className="list-none pl-0 text-muted-foreground space-y-2 mt-4">
                  <li><strong>Email:</strong> support@ridereadydocs.com</li>
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

export default PrivacyPolicy;
