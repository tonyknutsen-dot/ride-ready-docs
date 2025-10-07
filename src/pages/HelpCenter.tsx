import Header from "@/components/Header";
import Footer from "@/components/Footer";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { FileText, Calendar, Bell, Upload, CheckCircle, Shield, Mail, Crown, ArrowRight } from "lucide-react";
import { useSubscription } from "@/hooks/useSubscription";
import { ContactSupportDialog } from "@/components/ContactSupportDialog";
import { useState } from "react";
import { useNavigate } from "react-router-dom";
const HelpCenter = () => {
  const { subscription } = useSubscription();
  const navigate = useNavigate();
  const [selectedGuide, setSelectedGuide] = useState<number | null>(null);
  const isAdvanced = subscription?.subscriptionStatus === 'advanced';
  
  const quickLinks = [
    {
      icon: Upload,
      title: "Adding Your First Ride",
      description: "Learn how to add rides and upload documents",
      planRequired: "basic",
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
      planRequired: "advanced",
      route: "/calendar",
      steps: [
        "Go to your ride's detail page",
        "Select the 'Inspections' tab",
        "Click 'Schedule Inspection'",
        "Choose inspection type (Annual, ADIPS, NDT, etc.)",
        "Set the due date and add any notes",
        "The system will automatically send reminders before the due date"
      ]
    },
    {
      icon: CheckCircle,
      title: "Daily Checks",
      description: "Create and complete safety check templates",
      planRequired: "advanced",
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
      planRequired: "advanced",
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
      planRequired: "basic",
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
      planRequired: "advanced",
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
      planRequired: "basic",
      questions: [
        {
          q: "How do I start using Showmen's Ride Ready?",
          a: "After signing up, start by completing your profile with your company and showman details. Then add your first ride with its details (manufacturer, serial number, etc.). Once added, you can upload documents.",
          planRequired: "basic"
        },
        {
          q: "What's included in the free trial?",
          a: "The 30-day free trial includes full access to all features: unlimited rides, document storage, inspection scheduling, daily checks, maintenance tracking, and notifications. No credit card required to start.",
          planRequired: "basic"
        },
        {
          q: "Can I import existing documents?",
          a: "Yes! You can upload documents in PDF, JPG, PNG, and other common formats. There's no limit to the number of documents you can upload per ride.",
          planRequired: "basic"
        }
      ]
    },
    {
      category: "Rides and Equipment",
      planRequired: "basic",
      questions: [
        {
          q: "How many rides can I add?",
          a: "Documents & Compliance allows up to 10 rides. Operations & Maintenance supports unlimited rides, generators, and equipment.",
          planRequired: "basic"
        },
        {
          q: "Can I manage generators and other equipment?",
          a: "Yes! The system supports all types of fairground equipment - rides, generators, trailers, and any other equipment requiring documentation.",
          planRequired: "basic"
        },
        {
          q: "What information should I include for each ride?",
          a: "Include the ride name, manufacturer, year manufactured, serial number, and select the appropriate category. You can also add owner name if managing rides for multiple owners.",
          planRequired: "basic"
        }
      ]
    },
    {
      category: "Documents",
      planRequired: "basic",
      questions: [
        {
          q: "What types of documents can I upload?",
          a: "You can upload any document related to your rides: ADIPS certificates, insurance documents, test certificates, manuals, risk assessments, electrical certificates, NDT reports, and more.",
          planRequired: "basic"
        },
        {
          q: "How does document expiry tracking work?",
          a: "When uploading documents, set an expiry date. The system automatically tracks expiry dates and sends notifications (Operations & Maintenance feature).",
          planRequired: "basic"
        },
        {
          q: "Can I replace an expired document?",
          a: "Yes! When uploading a new version, you can link it to the old document. The system maintains version history so you can track document updates over time.",
          planRequired: "basic"
        },
        {
          q: "What are Global Documents?",
          a: "Global Documents are documents that apply across all your rides (like insurance policies, operator licenses, business certificates). Upload them once and access from anywhere without duplicating.",
          planRequired: "basic"
        },
        {
          q: "How do I send documents to councils or inspectors?",
          a: "Use the 'Send Documents' feature on any ride. Select which documents to include, add recipient email addresses, include a message, and send. Perfect for ADIPS inspections or council submissions.",
          planRequired: "basic"
        }
      ]
    },
    {
      category: "Inspections (Operations & Maintenance)",
      planRequired: "advanced",
      questions: [
        {
          q: "How do I set up annual inspections?",
          a: "Go to the Inspections tab for your ride, click 'Schedule Inspection', select the inspection type (Annual, ADIPS, etc.), and set the due date. The system will send automatic reminders.",
          planRequired: "advanced"
        },
        {
          q: "What is NDT testing?",
          a: "NDT (Non-Destructive Testing) includes methods like ultrasonic testing, magnetic particle inspection, and dye penetrant testing to check structural integrity of ride components without damaging them.",
          planRequired: "advanced"
        },
        {
          q: "Can I record inspection results?",
          a: "Yes! After inspections, you can log results, upload the inspection report, record the certificate number, note any conditions or recommendations, and set the next inspection due date.",
          planRequired: "advanced"
        }
      ]
    },
    {
      category: "Safety Checks (Operations & Maintenance)",
      planRequired: "advanced",
      questions: [
        {
          q: "What are check templates?",
          a: "Templates are customizable checklists for routine safety inspections. Create daily, monthly, or yearly templates with specific items to check before operating your rides.",
          planRequired: "advanced"
        },
        {
          q: "What's the difference between daily, monthly, and yearly checks?",
          a: "Daily checks are pre-operational safety checks required before public use. Monthly checks cover routine maintenance items. Yearly checks are comprehensive annual safety reviews. Each serves different compliance requirements.",
          planRequired: "advanced"
        },
        {
          q: "How do I create a daily check template?",
          a: "Go to your ride, select 'Daily Checks', click 'Manage Templates', then 'Create New Template'. Add check items like 'Check emergency stops', 'Inspect restraints', etc. Save and start using daily.",
          planRequired: "advanced"
        },
        {
          q: "Can I create multiple check templates for one ride?",
          a: "Yes! You can create different templates for different scenarios - setup checks, breakdown checks, weather-related checks, or checks for different operating modes.",
          planRequired: "advanced"
        },
        {
          q: "Do I need to complete checks every day?",
          a: "ADIPS and HSE guidelines require pre-operational safety checks each day before public use. Our daily check system helps you document compliance with these requirements.",
          planRequired: "advanced"
        },
        {
          q: "How are check records stored?",
          a: "All completed checks are automatically saved with date, time, operator name, and results. You can view check history and export as PDF for inspections or audits.",
          planRequired: "advanced"
        }
      ]
    },
    {
      category: "Maintenance Tracking (Operations & Maintenance)",
      planRequired: "advanced",
      questions: [
        {
          q: "How do I log maintenance activities?",
          a: "In the Maintenance tab, click 'Log Maintenance', describe the work performed, list parts replaced, record costs, and attach any related documents like invoices or parts receipts.",
          planRequired: "advanced"
        },
        {
          q: "Can I track maintenance costs?",
          a: "Yes! Each maintenance entry can include costs for parts and labor. The system tracks total maintenance spending per ride, helping you budget and plan for replacements.",
          planRequired: "advanced"
        },
        {
          q: "How do I schedule preventive maintenance?",
          a: "Log regular maintenance activities with their frequency. The system will remind you when maintenance is due based on your schedule (e.g., lubrication every 3 months).",
          planRequired: "advanced"
        }
      ]
    },
    {
      category: "Risk Assessments (Operations & Maintenance)",
      planRequired: "advanced",
      questions: [
        {
          q: "What is the Risk Assessment Builder?",
          a: "The Risk Assessment Builder helps you create comprehensive risk assessments for your rides. Identify hazards, assess risks, document control measures, and generate professional reports.",
          planRequired: "advanced"
        },
        {
          q: "How do I create a risk assessment?",
          a: "Go to your ride's Risk Assessment tab, click 'New Assessment', add hazard items (e.g., 'Rider ejection', 'Mechanical failure'), rate severity and likelihood, document control measures, and save.",
          planRequired: "advanced"
        },
        {
          q: "Can I export risk assessments?",
          a: "Yes! Generate PDF reports that are downloadable, printable, and emailable. Perfect for council submissions, ADIPS inspections, or sharing with your team.",
          planRequired: "advanced"
        },
        {
          q: "Do I need separate assessments for each ride?",
          a: "Yes, each ride should have its own risk assessment as hazards vary by ride type. However, you can use previous assessments as templates to speed up the process for similar rides.",
          planRequired: "advanced"
        },
        {
          q: "How often should risk assessments be reviewed?",
          a: "Review annually, or whenever there are significant changes to the ride, operating procedures, or after any incidents. Keep dated records of all reviews for compliance.",
          planRequired: "advanced"
        }
      ]
    },
    {
      category: "Technical Bulletins (Operations & Maintenance)",
      planRequired: "advanced",
      questions: [
        {
          q: "What are technical bulletins?",
          a: "Technical bulletins are safety notices and updates from ride manufacturers about potential issues, required modifications, or important operational information.",
          planRequired: "advanced"
        },
        {
          q: "How do I find relevant bulletins for my rides?",
          a: "The Technical Bulletins feature automatically matches bulletins to your rides based on manufacturer and category. You can also search the bulletin library.",
          planRequired: "advanced"
        }
      ]
    },
    {
      category: "Notifications (Operations & Maintenance)",
      planRequired: "advanced",
      questions: [
        {
          q: "What notifications will I receive?",
          a: "You'll receive reminders for: upcoming inspections (30 days before), expiring documents (30 days, 7 days, and on expiry), overdue maintenance, and NDT testing due dates.",
          planRequired: "advanced"
        },
        {
          q: "How are notifications delivered?",
          a: "Notifications appear in the app's Notification Center (bell icon) and are also sent via email to your registered email address.",
          planRequired: "advanced"
        }
      ]
    },
    {
      category: "Reports (Operations & Maintenance)",
      planRequired: "advanced",
      questions: [
        {
          q: "What reports can I generate?",
          a: "Generate inspection reports, maintenance history reports, daily check logs, risk assessments, and compliance summaries. Reports can be exported as PDFs for regulatory submissions.",
          planRequired: "advanced"
        },
        {
          q: "How do I prepare for an ADIPS inspection?",
          a: "Use the calendar view to ensure all inspections and documents are current. Generate a compliance report showing all active certificates, recent inspection reports, and maintenance history.",
          planRequired: "advanced"
        }
      ]
    },
    {
      category: "Account and Billing",
      questions: [
        {
          q: "How do I upgrade from Documents & Compliance to Operations & Maintenance?",
          a: "Go to Settings > Plan & Billing and select 'Upgrade'. You'll immediately gain access to operations & maintenance features and be billed the difference for the current period."
        },
        {
          q: "What happens if I don't upgrade after the trial?",
          a: "Your account will be downgraded to read-only access. You can view your data but won't be able to add new rides or documents until you subscribe to a paid plan."
        },
        {
          q: "Can I cancel my subscription?",
          a: "Yes, cancel anytime from Settings > Plan & Billing. You'll retain access until the end of your paid period. Your data remains accessible for 90 days after cancellation."
        },
        {
          q: "Do you offer discounts for multiple accounts?",
          a: "Contact us for multi-account or showman guild pricing. We offer discounts for organizations managing multiple showman accounts."
        }
      ]
    },
    {
      category: "Security and Data",
      questions: [
        {
          q: "Is my data secure?",
          a: "Yes! We use bank-level encryption, secure Supabase infrastructure, regular backups, and row-level security policies. Your data is stored in UK/EU data centers."
        },
        {
          q: "Can I export my data?",
          a: "Yes, you can download all your documents and export records at any time. This ensures you always have backup copies of critical information."
        },
        {
          q: "Who can see my documents?",
          a: "Only you and users you authorize can access your documents. We have strict row-level security - you can only see data for your own rides and equipment."
        },
        {
          q: "What happens to my data if I cancel?",
          a: "Your data is retained for 90 days to allow reactivation. After 90 days, all data is permanently deleted. You can request immediate deletion by contacting support."
        }
      ]
    }
  ];
  return <div className="min-h-screen bg-background">
      <Header />
      
      <main className="pt-24 pb-16">
        {/* Hero Section */}
        <section className="container mx-auto px-6 py-16 text-center">
          <h1 className="text-4xl md:text-5xl font-bold mb-6">
            Help Center
          </h1>
          <p className="text-xl text-muted-foreground max-w-3xl mx-auto">
            Find answers to common questions and learn how to get the most out of Ride Ready Docs
          </p>
        </section>

        {/* Quick Links */}
        <section className="container mx-auto px-6 py-8">
          <h2 className="text-2xl font-bold mb-6">Quick Start Guides</h2>
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {quickLinks.map((link, index) => (
              <Card 
                key={index} 
                className={`hover:border-primary transition-smooth cursor-pointer hover:shadow-lg ${
                  link.planRequired === 'advanced' && !isAdvanced ? 'opacity-60' : ''
                }`}
                onClick={() => setSelectedGuide(index)}
              >
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center mb-3">
                      <link.icon className="h-5 w-5 text-primary" />
                    </div>
                    {link.planRequired === 'advanced' && (
                      <Badge variant="secondary" className="flex items-center gap-1">
                        <Crown className="h-3 w-3" />
                        Advanced
                      </Badge>
                    )}
                  </div>
                  <CardTitle className="text-lg">{link.title}</CardTitle>
                  <CardDescription>{link.description}</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center text-sm text-primary font-medium">
                    View step-by-step guide
                    <ArrowRight className="h-4 w-4 ml-2" />
                  </div>
                </CardContent>
              </Card>
            ))}
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
          <h2 className="text-3xl font-bold mb-8 text-center">Frequently Asked Questions</h2>
          
          <div className="max-w-4xl mx-auto space-y-6">
            {faqs.map((category, catIndex) => (
              <div key={catIndex}>
                <div className="flex items-center gap-2 mb-4">
                  <h3 className="text-2xl font-bold">{category.category}</h3>
                  {category.planRequired === 'advanced' && (
                    <Badge variant="secondary" className="flex items-center gap-1">
                      <Crown className="h-3 w-3" />
                      Advanced
                    </Badge>
                  )}
                </div>
                <Accordion type="single" collapsible className="w-full space-y-2">
                  {category.questions.map((item, qIndex) => (
                    <AccordionItem 
                      key={`faq-${catIndex}-${qIndex}`} 
                      value={`faq-${catIndex}-${qIndex}`} 
                      className="border rounded-lg px-4 bg-card"
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
            ))}
          </div>
        </section>

        {/* Contact Support */}
        <section className="container mx-auto px-6 py-[22px]">
          <Card className="max-w-2xl mx-auto text-center bg-primary/5 border-primary/20">
            <CardHeader>
              <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-4">
                <Mail className="h-6 w-6 text-primary" />
              </div>
              <CardTitle className="text-2xl">Still Need Help?</CardTitle>
              <CardDescription className="text-base">
                Our support team is here to help with any questions
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="space-y-2 text-muted-foreground">
                  <p><strong>Response Time:</strong> Within 24 hours (business days)</p>
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
    </div>;
};
export default HelpCenter;