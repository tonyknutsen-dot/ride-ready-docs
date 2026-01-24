import Header from "@/components/Header";
import Footer from "@/components/Footer";
import { Card, CardContent } from "@/components/ui/card";

const DataProcessingAgreement = () => {
  return (
    <div className="min-h-screen bg-background">
      <Header />
      
      <main className="pt-24 pb-16">
        <div className="container mx-auto px-6 max-w-4xl">
          <h1 className="text-4xl font-bold mb-6">Data Processing Agreement</h1>
          <p className="text-muted-foreground mb-8">Last updated: {new Date().toLocaleDateString()}</p>

          <Card className="mb-8">
            <CardContent className="pt-6 space-y-6">
              <section>
                <h2 className="text-2xl font-semibold mb-4">1. Introduction</h2>
                <p className="text-muted-foreground">
                  This Data Processing Agreement ("DPA") forms part of the agreement between Ride Ready Docs ("Processor", "we", "us") and the Customer ("Controller", "you") for the provision of document management services. This DPA sets out the terms under which we process personal data on your behalf in compliance with applicable data protection laws including GDPR, CCPA, and other regional regulations.
                </p>
              </section>

              <section>
                <h2 className="text-2xl font-semibold mb-4">2. Definitions</h2>
                <ul className="list-disc pl-6 text-muted-foreground space-y-2">
                  <li><strong>"Personal Data"</strong> means any information relating to an identified or identifiable natural person.</li>
                  <li><strong>"Data Subject"</strong> means the individual to whom Personal Data relates.</li>
                  <li><strong>"Processing"</strong> means any operation performed on Personal Data, including collection, storage, alteration, retrieval, use, disclosure, or erasure.</li>
                  <li><strong>"Sub-processor"</strong> means any third party engaged by us to process Personal Data on your behalf.</li>
                  <li><strong>"Supervisory Authority"</strong> means the relevant data protection authority in your jurisdiction.</li>
                </ul>
              </section>

              <section>
                <h2 className="text-2xl font-semibold mb-4">3. Scope of Processing</h2>
                <h3 className="text-xl font-semibold mb-2">3.1 Categories of Data Subjects</h3>
                <ul className="list-disc pl-6 text-muted-foreground space-y-2 mb-4">
                  <li>Your employees and staff members</li>
                  <li>Inspectors and compliance officers</li>
                  <li>Third-party recipients of documents</li>
                  <li>Equipment operators and maintenance personnel</li>
                </ul>
                
                <h3 className="text-xl font-semibold mb-2">3.2 Categories of Personal Data</h3>
                <ul className="list-disc pl-6 text-muted-foreground space-y-2 mb-4">
                  <li>Contact information (names, email addresses, phone numbers)</li>
                  <li>Business information (company names, addresses, registration details)</li>
                  <li>Inspection records including inspector names and signatures</li>
                  <li>Maintenance logs with personnel details</li>
                  <li>Document metadata and access logs</li>
                </ul>

                <h3 className="text-xl font-semibold mb-2">3.3 Nature and Purpose of Processing</h3>
                <p className="text-muted-foreground">
                  We process Personal Data solely to provide the document management services as described in our Terms of Service, including: storing and organizing documents, tracking inspections and maintenance, sending reminders and notifications, generating compliance reports, and enabling document sharing with authorized recipients.
                </p>
              </section>

              <section>
                <h2 className="text-2xl font-semibold mb-4">4. Obligations of the Processor</h2>
                <h3 className="text-xl font-semibold mb-2">4.1 Lawfulness</h3>
                <p className="text-muted-foreground mb-4">
                  We will process Personal Data only in accordance with your documented instructions, unless required by law to process otherwise. If we are required to process Personal Data for any other purpose, we will inform you before such processing, unless prohibited by law.
                </p>

                <h3 className="text-xl font-semibold mb-2">4.2 Confidentiality</h3>
                <p className="text-muted-foreground mb-4">
                  We ensure that all personnel authorized to process Personal Data are bound by appropriate confidentiality obligations and have received training on data protection requirements.
                </p>

                <h3 className="text-xl font-semibold mb-2">4.3 Security Measures</h3>
                <p className="text-muted-foreground mb-4">We implement appropriate technical and organizational measures to ensure a level of security appropriate to the risk, including:</p>
                <ul className="list-disc pl-6 text-muted-foreground space-y-2">
                  <li>Encryption of Personal Data in transit (TLS 1.3) and at rest</li>
                  <li>Row-level security ensuring data isolation between customers</li>
                  <li>Regular security assessments and penetration testing</li>
                  <li>Access controls and authentication mechanisms</li>
                  <li>Regular backups with encrypted storage</li>
                  <li>Incident response and disaster recovery procedures</li>
                </ul>
              </section>

              <section>
                <h2 className="text-2xl font-semibold mb-4">5. Sub-processors</h2>
                <p className="text-muted-foreground mb-4">
                  You authorize us to engage the following Sub-processors:
                </p>
                <ul className="list-disc pl-6 text-muted-foreground space-y-2 mb-4">
                  <li><strong>Supabase Inc.</strong> - Database hosting, authentication, and file storage (secure global data centers)</li>
                  <li><strong>Resend</strong> - Email delivery services</li>
                  <li><strong>Payment processor</strong> - Subscription billing (if applicable)</li>
                </ul>
                <p className="text-muted-foreground">
                  We will notify you of any intended changes to Sub-processors, giving you the opportunity to object. All Sub-processors are bound by data processing agreements with equivalent protections.
                </p>
              </section>

              <section>
                <h2 className="text-2xl font-semibold mb-4">6. Data Subject Rights</h2>
                <p className="text-muted-foreground mb-4">
                  We will assist you in responding to requests from Data Subjects exercising their rights under GDPR, including:
                </p>
                <ul className="list-disc pl-6 text-muted-foreground space-y-2">
                  <li>Right of access to Personal Data</li>
                  <li>Right to rectification of inaccurate data</li>
                  <li>Right to erasure ("right to be forgotten")</li>
                  <li>Right to restriction of processing</li>
                  <li>Right to data portability</li>
                  <li>Right to object to processing</li>
                </ul>
              </section>

              <section>
                <h2 className="text-2xl font-semibold mb-4">7. Data Breach Notification</h2>
                <p className="text-muted-foreground">
                  In the event of a Personal Data breach, we will notify you without undue delay and in any event within 48 hours of becoming aware of the breach. The notification will include: the nature of the breach, categories and approximate number of affected Data Subjects, likely consequences, and measures taken or proposed to address the breach.
                </p>
              </section>

              <section>
                <h2 className="text-2xl font-semibold mb-4">8. International Transfers</h2>
                <p className="text-muted-foreground">
                  Personal Data is stored in secure data centers. Where data is transferred internationally, we ensure appropriate safeguards are in place, such as Standard Contractual Clauses (SCCs) or adequacy decisions, in compliance with applicable data protection laws.
                </p>
              </section>

              <section>
                <h2 className="text-2xl font-semibold mb-4">9. Audits and Inspections</h2>
                <p className="text-muted-foreground">
                  We will make available to you all information necessary to demonstrate compliance with this DPA and allow for audits, including inspections, conducted by you or an auditor mandated by you. Any audit shall be conducted with reasonable notice and during normal business hours.
                </p>
              </section>

              <section>
                <h2 className="text-2xl font-semibold mb-4">10. Data Retention and Deletion</h2>
                <p className="text-muted-foreground">
                  Upon termination of the services or upon your request, we will delete or return all Personal Data within 90 days, unless retention is required by applicable law. You may request immediate deletion at any time. We will provide written confirmation of data deletion upon request.
                </p>
              </section>

              <section>
                <h2 className="text-2xl font-semibold mb-4">11. Liability</h2>
                <p className="text-muted-foreground">
                  Each party's liability under this DPA is subject to the limitations set out in the main agreement. We shall be liable for damage caused by processing that infringes GDPR or this DPA only to the extent caused by our non-compliance with GDPR or deviation from your lawful instructions.
                </p>
              </section>

              <section>
                <h2 className="text-2xl font-semibold mb-4">12. Term and Termination</h2>
                <p className="text-muted-foreground">
                  This DPA shall remain in effect for the duration of the main service agreement. The obligations regarding data security, confidentiality, and deletion shall survive termination.
                </p>
              </section>

              <section>
                <h2 className="text-2xl font-semibold mb-4">13. Contact Information</h2>
                <p className="text-muted-foreground">
                  For questions regarding this DPA or to exercise any rights:
                </p>
                <ul className="list-none pl-0 text-muted-foreground space-y-2 mt-4">
                  <li><strong>Data Protection Contact:</strong> privacy@ridereadydocs.com</li>
                  <li><strong>General Email:</strong> support@ridereadydocs.com</li>
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

export default DataProcessingAgreement;