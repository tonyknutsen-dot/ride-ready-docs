import Header from "@/components/Header";
import Footer from "@/components/Footer";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { FileText, Calendar, Bell, Upload, CheckCircle, Shield, Mail, ArrowRight, ArrowLeft } from "lucide-react";
import { useSubscription } from "@/hooks/useSubscription";
import { ContactSupportDialog } from "@/components/ContactSupportDialog";
import { HelpChatWidget } from "@/components/HelpChatWidget";
import { useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useTerminology } from "@/hooks/useTerminology";

const HelpCenter = () => {
  const { subscription } = useSubscription();
  const navigate = useNavigate();
  const location = useLocation();
  const { terminology } = useTerminology();
  const [selectedGuide, setSelectedGuide] = useState<number | null>(null);
  
  const quickLinks = [
    {
      icon: Upload,
      title: "Adding Your First Ride",
      description: "Learn how to add rides and upload documents",
      route: "/rides",
      steps: [
        "Navigate to the Rides page from the main menu",
        "Click the 'Add Ride' button in the top right",
        "Fill in ride details: name, manufacturer, serial number, year",
        "Select the appropriate category for your ride",
        "Click 'Save' to create your ride",
        "Once created, you can upload documents from the ride detail page"
      ]
    },
    {
      icon: Calendar,
      title: "Setting Up Inspections",
      description: "Schedule annual inspections and NDT testing",
      route: "/calendar",
      steps: [
        "Go to your ride's detail page",
        "Select the 'Inspections' tab",
        "Click 'Schedule Inspection'",
        "Choose inspection type (Annual, Safety Compliance, NDT, etc.)",
        "Set the due date and add any notes",
        "The system will automatically send reminders before the due date"
      ]
    },
    {
      icon: CheckCircle,
      title: "Daily Checks",
      description: "Create and complete safety check templates",
      route: "/checks",
      steps: [
        "Navigate to the Checks page",
        "Click 'Manage Templates' to create a new template",
        "Add check items relevant to your ride (e.g., 'Check emergency stops')",
        "Save your template",
        "Each day before operation, complete the check",
        "Mark each item as passed or failed with optional notes"
      ]
    },
    {
      icon: Bell,
      title: "Notifications",
      description: "Configure reminders and alerts",
      route: "/overview",
      steps: [
        "Notifications are automatically set up for your account",
        "You'll receive alerts for: expiring documents (30 & 7 days), upcoming inspections, overdue maintenance",
        "Check the notification center (bell icon) for in-app alerts",
        "Email notifications are sent to your registered email",
        "Ensure documents have expiry dates set to receive timely reminders"
      ]
    },
    {
      icon: FileText,
      title: "Managing Documents",
      description: "Upload, organize, and track document expiry",
      route: "/rides",
      steps: [
        "Open your ride's detail page",
        "Go to the 'Documents' tab",
        "Click 'Upload Document'",
        "Select document type and expiry date",
        "Choose your file (PDF, JPG, PNG supported)",
        "Add notes if needed and save",
        "View all documents organized by type and track expiry dates"
      ]
    },
    {
      icon: Shield,
      title: "Compliance Reports",
      description: "Generate inspection and maintenance reports",
      route: "/overview",
      steps: [
        "Access the Reports section from your dashboard",
        "Select report type: Inspection History, Maintenance Log, or Daily Checks",
        "Choose date range and specific rides",
        "Click 'Generate Report'",
        "Review the compiled report",
        "Export as PDF for regulatory submissions or record keeping"
      ]
    }
  ];

  const faqs = [
    {
      category: "Getting Started",
      questions: [
        {
          q: "How do I start using Ride Ready Docs?",
          a: `After signing up, start by completing your profile with your company and ${terminology.isUK ? 'showman' : 'operator'} details. Then add your first ride with its details (manufacturer, serial number, etc.). Once added, you can upload documents.`,
        },
        {
          q: "What's included in the free trial?",
          a: "The free trial gives you full access to all features. No credit card required to start. After the trial, choose a plan based on your number of rides.",
        },
        {
          q: "Can I import existing documents?",
          a: "Yes! You can upload documents in PDF, JPG, PNG, and other common formats. There's no limit to the number of documents you can upload per ride.",
        }
      ]
    },
    {
      category: "Rides and Equipment",
      questions: [
        {
          q: "How many rides can I add?",
          a: "Your plan tier is based on the number of billable rides (rides and inflatables). Starter covers 1–5 rides (£9.99/mo), Operator covers 6–12 (£19.99/mo), Professional covers 13–25 (£34.99/mo), and Enterprise covers 25+ (£49.99/mo). Stalls, generators, and trailers are included free with any active plan.",
        },
        {
          q: "Can I manage different types of equipment?",
          a: "Yes! The system supports all types of fairground equipment - rides, food stalls, stalls, games, inflatables, generators, and any other equipment requiring documentation.",
        },
        {
          q: "What information should I include for each ride?",
          a: "Include the ride name, manufacturer, year manufactured, serial number, and select the appropriate category. You can also add owner name if managing rides for multiple owners.",
        }
      ]
    },
    {
      category: "Documents",
      questions: [
        {
          q: "What types of documents can I upload?",
          a: "You can upload any document related to your equipment: annual inspection certificates, insurance documents, test certificates, manuals, risk assessments, electrical certificates, NDT reports, and more.",
        },
        {
          q: "How does document expiry tracking work?",
          a: "When uploading documents, set an expiry date. The system automatically tracks expiry dates and sends email notifications 30 days and 7 days before expiry.",
        },
        {
          q: "Can I replace an expired document?",
          a: "Yes! When uploading a new version, you can link it to the old document. The system maintains version history so you can track document updates over time.",
        },
        {
          q: "What are Global Documents?",
          a: "Global Documents are documents that apply across all your rides (like insurance policies, operator licenses, business certificates). Upload them once and access from anywhere without duplicating.",
        },
        {
          q: "How do I send documents to councils or inspectors?",
          a: `Use the 'Send Documents' feature on any ride. Select which documents to include, add recipient email addresses, include a message, and send. Perfect for safety compliance inspections or ${terminology.isUK ? 'council' : 'authority'} submissions.`,
        }
      ]
    },
    {
      category: "Inspections",
      questions: [
        {
          q: "How do I set up annual inspections?",
          a: "Go to the Inspections tab for your ride, click 'Schedule Inspection', select the inspection type (Annual, Safety Compliance, etc.), and set the due date. The system will send automatic reminders.",
        },
        {
          q: "What is NDT testing?",
          a: "NDT (Non-Destructive Testing) includes methods like ultrasonic testing, magnetic particle inspection, and dye penetrant testing to check structural integrity of ride components without damaging them.",
        },
        {
          q: "Can I record inspection results?",
          a: "Yes! After inspections, you can log results, upload the inspection report, record the certificate number, note any conditions or recommendations, and set the next inspection due date.",
        }
      ]
    },
    {
      category: "Safety Checks",
      questions: [
        {
          q: "What are check templates?",
          a: "Templates are customizable checklists for routine safety inspections. Create daily, monthly, or yearly templates with specific items to check before operating your rides.",
        },
        {
          q: "What's the difference between daily, monthly, and yearly checks?",
          a: "Daily checks are pre-operational safety checks required before public use. Monthly checks cover routine maintenance items. Yearly checks are comprehensive annual safety reviews. Each serves different compliance requirements.",
        },
        {
          q: "How do I create a daily check template?",
          a: "Go to your ride, select 'Daily Checks', click 'Manage Templates', then 'Create New Template'. Add check items like 'Check emergency stops', 'Inspect restraints', etc. Save and start using daily.",
        },
        {
          q: "Can I create multiple check templates for one ride?",
          a: "Yes! You can create different templates for different scenarios - setup checks, breakdown checks, weather-related checks, or checks for different operating modes.",
        },
        {
          q: "Do I need to complete checks every day?",
          a: "Industry guidelines require pre-operational safety checks each day before public use. Our daily check system helps you document compliance with these requirements.",
        },
        {
          q: "How are check records stored?",
          a: "All completed checks are automatically saved with date, time, operator name, and results. You can view check history and export as PDF for inspections or audits.",
        }
      ]
    },
    {
      category: "Maintenance Tracking",
      questions: [
        {
          q: "How do I log maintenance activities?",
          a: "In the Maintenance tab, click 'Log Maintenance', describe the work performed, list parts replaced, record costs, and attach any related documents like invoices or parts receipts.",
        },
        {
          q: "Can I track maintenance costs?",
          a: "Yes! Each maintenance entry can include costs for parts and labor. The system tracks total maintenance spending per ride, helping you budget and plan for replacements.",
        },
        {
          q: "How do I schedule preventive maintenance?",
          a: "Log regular maintenance activities with their frequency. The system will remind you when maintenance is due based on your schedule (e.g., lubrication every 3 months).",
        }
      ]
    },
    {
      category: "Risk Assessments",
      questions: [
        {
          q: "What is the Risk Assessment Builder?",
          a: "The Risk Assessment Builder helps you create comprehensive risk assessments for your rides. Identify hazards, assess risks, document control measures, and generate professional reports.",
        },
        {
          q: "How do I create a risk assessment?",
          a: "Go to your ride's Risk Assessment tab, click 'New Assessment', add hazard items (e.g., 'Rider ejection', 'Mechanical failure'), rate severity and likelihood, document control measures, and save.",
        },
        {
          q: "Can I export risk assessments?",
          a: "Yes! Generate PDF reports that are downloadable, printable, and emailable. Perfect for regulatory submissions, inspections, or sharing with your team.",
        },
        {
          q: "Do I need separate assessments for each ride?",
          a: "Yes, each ride should have its own risk assessment as hazards vary by ride type. However, you can use previous assessments as templates to speed up the process for similar rides.",
        },
        {
          q: "How often should risk assessments be reviewed?",
          a: "Review annually, or whenever there are significant changes to the ride, operating procedures, or after any incidents. Keep dated records of all reviews for compliance.",
        }
      ]
    },
    {
      category: "Notifications",
      questions: [
        {
          q: "What notifications will I receive?",
          a: "You'll receive reminders for: upcoming inspections, expiring documents (30 days and 7 days before), overdue maintenance, and NDT testing due dates.",
        },
        {
          q: "How are notifications delivered?",
          a: "Notifications appear in the app's Notification Center (bell icon) and are also sent via email to your registered email address.",
        }
      ]
    },
    {
      category: "Reports",
      questions: [
        {
          q: "What reports can I generate?",
          a: "Generate inspection reports, maintenance history reports, daily check logs, risk assessments, and compliance summaries. Reports can be exported as PDFs for regulatory submissions.",
        },
        {
          q: "How do I prepare for an annual inspection?",
          a: "Use the calendar view to ensure all inspections and documents are current. Generate a compliance report showing all active certificates, recent inspection reports, and maintenance history.",
        }
      ]
    },
    {
      category: "Account and Billing",
      questions: [
        {
          q: "How does pricing work?",
          a: "Ride Ready Docs is priced by the number of billable rides you manage. Starter (1–5 rides) is £9.99/mo, Operator (6–12) is £19.99/mo, Professional (13–25) is £34.99/mo, and Enterprise (25+) is £49.99/mo. All plans include full access to every feature. Stalls, generators, and trailers are included free."
        },
        {
          q: "What happens if I don't subscribe after the trial?",
          a: "Your account will be restricted to read-only access. You can view your data but won't be able to add new rides or documents until you subscribe to a paid plan."
        },
        {
          q: "Can I cancel my subscription?",
          a: "Yes, cancel anytime from Settings > Plan & Billing. You'll retain access until the end of your paid period. Your data remains accessible for 90 days after cancellation."
        },
        {
          q: "What happens when I add more rides?",
          a: "Your plan automatically adjusts to the correct tier when your ride count changes. For example, going from 5 to 6 rides moves you from Starter (£9.99/mo) to Operator (£19.99/mo)."
        },
        {
          q: "Do you offer discounts for multiple accounts?",
          a: `Contact us for multi-account or ${terminology.isUK ? 'showman guild' : 'operator association'} pricing. We offer discounts for organizations managing multiple accounts.`
        }
      ]
    },
    {
      category: "Staff Management",
      questions: [
        {
          q: "How do I invite staff members?",
          a: "Go to the Staff page from the main menu, click 'Invite Staff', enter their email address, and select which features they can access. They'll receive an email invitation to join your organisation.",
        },
        {
          q: "What permissions can I give staff members?",
          a: "You can grant access to specific features: Calendar, Documents, Checks, Maintenance, Risk Assessments, and Send Documents. Staff never have access to billing, settings, or staff management.",
        },
        {
          q: "Can staff members see all my equipment?",
          a: "By default, staff can see all your equipment. You can restrict access to specific rides when inviting them. Staff can only access the features you've enabled for them.",
        },
        {
          q: "How do I remove a staff member?",
          a: "Go to the Staff page, find the staff member, and click 'Remove'. Their access is revoked immediately. They can no longer log in to your organisation's data.",
        },
        {
          q: "Can I change staff permissions after inviting them?",
          a: "Yes, go to the Staff page, click on the staff member, and update their feature access. Changes take effect immediately.",
        }
      ]
    },
    {
      category: "Security and Data",
      questions: [
        {
          q: "Is my data secure?",
          a: `Yes! We use bank-level encryption, secure Supabase infrastructure, regular backups, and row-level security policies. Your data is stored in ${terminology.isUK ? 'UK/EU' : 'secure'} data centers.`
        },
        {
          q: "Can I export my data?",
          a: "Yes, you can download all your documents and export records at any time. This ensures you always have backup copies of critical information."
        },
        {
          q: "Who can see my documents?",
          a: "Only you and staff members you authorize can access your documents. We have strict row-level security - you can only see data for your own organisation's equipment."
        },
        {
          q: "What happens to my data if I cancel?",
          a: "Your data is retained for 90 days to allow reactivation. After 90 days, all data is permanently deleted. You can request immediate deletion by contacting support."
        }
      ]
    }
  ];

  return (
    <div className="min-h-screen bg-background">
      <Header />
      
      <main className="pt-24 pb-16">
        {/* Back Button */}
        <div className="container mx-auto px-6 pt-4">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              if (location.key === 'default') {
                navigate('/');
                return;
              }
              navigate(-1);
            }}
            className="gap-1.5 -ml-2 text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="h-4 w-4" />
            Back
          </Button>
        </div>
        
        {/* Hero Section */}
        <section className="container mx-auto px-6 py-12 text-center">
          <div className="inline-flex items-center gap-3 px-4 py-2 rounded-full bg-gradient-to-r from-info/10 to-primary/10 border border-info/30 mb-6">
            <FileText className="h-5 w-5 text-info" />
            <span className="text-sm font-medium text-info">Knowledge Base</span>
          </div>
          <h1 className="text-4xl md:text-5xl font-bold mb-6 bg-gradient-to-r from-primary via-info to-accent bg-clip-text text-transparent">
            Help Center
          </h1>
          <p className="text-xl text-muted-foreground max-w-3xl mx-auto">
            Find answers to common questions and learn how to get the most out of Ride Ready Docs
          </p>
        </section>

        {/* AI Help Chat */}
        <section className="container mx-auto px-6 py-8">
          <div className="max-w-3xl mx-auto">
            <HelpChatWidget />
          </div>
        </section>

        {/* Quick Links */}
        <section className="container mx-auto px-6 py-8">
          <h2 className="text-2xl font-bold mb-6 flex items-center gap-3">
            <span className="w-8 h-8 rounded-lg bg-gradient-to-br from-primary to-info flex items-center justify-center">
              <CheckCircle className="h-4 w-4 text-white" />
            </span>
            Quick Start Guides
          </h2>
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {quickLinks.map((link, index) => {
              const colorVariants = [
                { bg: 'from-primary/10 to-info/5', border: 'border-primary/30', iconBg: 'bg-gradient-to-br from-primary to-primary/80', hoverBorder: 'hover:border-primary' },
                { bg: 'from-info/10 to-accent/5', border: 'border-info/30', iconBg: 'bg-gradient-to-br from-info to-info/80', hoverBorder: 'hover:border-info' },
                { bg: 'from-success/10 to-primary/5', border: 'border-success/30', iconBg: 'bg-gradient-to-br from-success to-success/80', hoverBorder: 'hover:border-success' },
                { bg: 'from-accent/10 to-info/5', border: 'border-accent/30', iconBg: 'bg-gradient-to-br from-accent to-accent/80', hoverBorder: 'hover:border-accent' },
                { bg: 'from-warning/10 to-primary/5', border: 'border-warning/30', iconBg: 'bg-gradient-to-br from-warning to-warning/80', hoverBorder: 'hover:border-warning' },
                { bg: 'from-destructive/10 to-info/5', border: 'border-destructive/30', iconBg: 'bg-gradient-to-br from-destructive to-destructive/80', hoverBorder: 'hover:border-destructive' },
              ];
              const variant = colorVariants[index % colorVariants.length];
              
              return (
                <Card 
                  key={index} 
                  className={`border-2 ${variant.border} bg-gradient-to-br ${variant.bg} ${variant.hoverBorder} transition-all cursor-pointer hover:shadow-elegant group`}
                  onClick={() => setSelectedGuide(index)}
                >
                  <CardHeader>
                    <div className={`w-12 h-12 rounded-xl ${variant.iconBg} flex items-center justify-center mb-3 shadow-lg group-hover:scale-105 transition-transform`}>
                      <link.icon className="h-6 w-6 text-white" />
                    </div>
                    <CardTitle className="text-lg">{link.title}</CardTitle>
                    <CardDescription>{link.description}</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="flex items-center text-sm text-primary font-medium group-hover:translate-x-1 transition-transform">
                      View step-by-step guide
                      <ArrowRight className="h-4 w-4 ml-2" />
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </section>

        {/* Guide Dialog */}
        <Dialog open={selectedGuide !== null} onOpenChange={() => setSelectedGuide(null)}>
          <DialogContent className="max-w-2xl">
            {selectedGuide !== null && (
              <>
                <DialogHeader>
                  <div className="flex items-center gap-3 mb-2">
                    <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center">
                      {(() => {
                        const Icon = quickLinks[selectedGuide].icon;
                        return <Icon className="h-6 w-6 text-primary" />;
                      })()}
                    </div>
                    <div>
                      <DialogTitle className="text-2xl">{quickLinks[selectedGuide].title}</DialogTitle>
                      <DialogDescription>{quickLinks[selectedGuide].description}</DialogDescription>
                    </div>
                  </div>
                </DialogHeader>
                
                <div className="space-y-4 mt-4">
                  <h4 className="font-semibold text-lg">Step-by-Step Guide:</h4>
                  <div className="space-y-3">
                    {quickLinks[selectedGuide].steps.map((step, idx) => (
                      <div key={idx} className="flex gap-3">
                        <div className="flex-shrink-0 w-6 h-6 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-sm font-semibold">
                          {idx + 1}
                        </div>
                        <p className="text-muted-foreground pt-0.5">{step}</p>
                      </div>
                    ))}
                  </div>
                  
                  <div className="pt-4 flex gap-3">
                    <Button 
                      onClick={() => {
                        navigate(quickLinks[selectedGuide].route);
                        setSelectedGuide(null);
                      }}
                      className="flex-1"
                    >
                      Go to {quickLinks[selectedGuide].title.split(' ')[0]} Page
                    </Button>
                    <Button 
                      variant="outline" 
                      onClick={() => setSelectedGuide(null)}
                    >
                      Close
                    </Button>
                  </div>
                </div>
              </>
            )}
          </DialogContent>
        </Dialog>

        {/* FAQs */}
        <section className="container mx-auto px-6 py-0">
          <h2 className="text-3xl font-bold mb-8 text-center flex items-center justify-center gap-3">
            <span className="w-10 h-10 rounded-xl bg-gradient-to-br from-info to-accent flex items-center justify-center shadow-lg">
              <FileText className="h-5 w-5 text-white" />
            </span>
            Frequently Asked Questions
          </h2>
          
          <div className="max-w-4xl mx-auto space-y-8">
            {faqs.map((category, catIndex) => {
              const categoryColors = [
                { border: 'border-primary/20', bg: 'bg-gradient-to-r from-primary/5 to-transparent' },
                { border: 'border-info/20', bg: 'bg-gradient-to-r from-info/5 to-transparent' },
                { border: 'border-success/20', bg: 'bg-gradient-to-r from-success/5 to-transparent' },
                { border: 'border-accent/20', bg: 'bg-gradient-to-r from-accent/5 to-transparent' },
              ];
              const catColor = categoryColors[catIndex % categoryColors.length];
              
              return (
                <div key={catIndex} className={`p-6 rounded-2xl border-2 ${catColor.border} ${catColor.bg}`}>
                  <h3 className="text-2xl font-bold mb-4">{category.category}</h3>
                  <Accordion type="single" collapsible className="w-full space-y-2">
                    {category.questions.map((item, qIndex) => (
                      <AccordionItem 
                        key={`faq-${catIndex}-${qIndex}`} 
                        value={`faq-${catIndex}-${qIndex}`} 
                        className="border-2 border-border/50 rounded-xl px-4 bg-card shadow-sm hover:shadow-md transition-shadow"
                      >
                        <AccordionTrigger className="text-left hover:no-underline py-4">
                          <span className="font-medium">{item.q}</span>
                        </AccordionTrigger>
                        <AccordionContent className="text-muted-foreground pb-4">
                          {item.a}
                        </AccordionContent>
                      </AccordionItem>
                    ))}
                  </Accordion>
                </div>
              );
            })}
          </div>
        </section>

        {/* Contact Support */}
        <section className="container mx-auto px-6 py-8">
          <Card className="max-w-2xl mx-auto text-center border-2 border-info/30 bg-gradient-to-br from-info/10 via-primary/5 to-accent/5 shadow-elegant">
            <CardHeader>
              <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-info to-primary flex items-center justify-center mx-auto mb-4 shadow-lg">
                <Mail className="h-8 w-8 text-white" />
              </div>
              <CardTitle className="text-2xl">Still Need Help?</CardTitle>
              <CardDescription className="text-base">
                Our support team is here to help with any questions
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-success/10 border border-success/30 text-success text-sm font-medium">
                  <CheckCircle className="h-4 w-4" />
                  Response within 24 hours
                </div>
                <div className="mt-4">
                  <ContactSupportDialog />
                </div>
              </div>
            </CardContent>
          </Card>
        </section>
      </main>

      <Footer />
    </div>
  );
};

export default HelpCenter;
