import Header from "@/components/Header";
import Footer from "@/components/Footer";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  FileText, Calendar, Bell, Upload, CheckCircle, Shield, Mail,
  ArrowRight, ArrowLeft, Search, Cog, Wrench, BarChart2, Users,
  LifeBuoy, Lightbulb, AlertCircle, ChevronDown, ChevronRight
} from "lucide-react";
import { useSubscription } from "@/hooks/useSubscription";
import { ContactSupportDialog } from "@/components/ContactSupportDialog";
import { HelpChatWidget } from "@/components/HelpChatWidget";
import { RequestFeatureDialog } from "@/components/RequestFeatureDialog";
import { BugReportDialog } from "@/components/BugReportDialog";
import { useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useTerminology } from "@/hooks/useTerminology";

// ── types ────────────────────────────────────────────────────────────────────
interface HelpTopic {
  icon: React.ElementType;
  title: string;
  description: string;
  route?: string;
  steps?: string[];
  faqs?: { q: string; a: string }[];
}

// ── data ─────────────────────────────────────────────────────────────────────
const coreModules: HelpTopic[] = [
  {
    icon: Cog,
    title: "Equipment",
    description: "Manage rides, stalls, and asset records.",
    route: "/rides",
    steps: [
      "Navigate to the Equipment page from the main menu.",
      "Click 'Add Ride' in the top right corner.",
      "Fill in ride details: name, manufacturer, serial number, year.",
      "Select the appropriate category for your ride.",
      "Click 'Save' to create your ride record.",
      "Open any ride to upload documents, schedule inspections, and log maintenance.",
    ],
    faqs: [
      { q: "How many items can I add?", a: "Each registered item counts toward your plan allowance. Starter: 1–5, Operator: 6–12, Professional: 13–25, Business: 26–50. Need more than 50 items? Contact us for a larger operator plan. Stalls, generators, and trailers are included free." },
      { q: "Can I manage different types of equipment?", a: "Yes — rides, stalls, inflatables, generators, food units, and more are all supported." },
    ],
  },
  {
    icon: CheckCircle,
    title: "Checks",
    description: "Complete daily, weekly, and annual inspections.",
    route: "/checks",
    steps: [
      "Go to the Checks page.",
      "Click 'Manage Templates' to create a checklist.",
      "Add check items such as 'Inspect restraints' or 'Check emergency stops'.",
      "Save your template.",
      "Each day, open the template and mark each item as pass or fail.",
      "All completed checks are stored with timestamp and operator name.",
    ],
    faqs: [
      { q: "Can I create multiple templates per ride?", a: "Yes — create templates for setup, breakdown, weather checks, or different operating modes." },
      { q: "How are check records stored?", a: "All records are saved automatically and can be exported as PDF for audits." },
    ],
  },
  {
    icon: FileText,
    title: "Documents",
    description: "Upload risk assessments, manuals, and certificates.",
    route: "/rides",
    steps: [
      "Open your ride's detail page.",
      "Go to the 'Documents' tab.",
      "Click 'Upload Document' and select type, expiry date, and file.",
      "Supported formats: PDF, Word, Excel, JPG, PNG, and many more.",
      "Documents with expiry dates trigger automatic email reminders at 30 days and 7 days.",
      "Use 'Global Documents' for fleet-wide files like insurance policies.",
    ],
    faqs: [
      { q: "What are Global Documents?", a: "Documents that apply across all rides — e.g., insurance policy or operator licence. Upload once, visible everywhere." },
      { q: "Can I replace an expired document?", a: "Yes — upload a new version and link it to the previous document. Full version history is maintained." },
    ],
  },
  {
    icon: Wrench,
    title: "Maintenance",
    description: "Log repairs and servicing work.",
    route: "/maintenance",
    steps: [
      "In the Maintenance tab, click 'Log Maintenance'.",
      "Describe the work performed and list parts replaced.",
      "Record costs for parts and labour.",
      "Attach related documents such as invoices or receipts.",
      "Set a 'Next due' date if the task is recurring.",
      "View maintenance history per ride at any time.",
    ],
    faqs: [
      { q: "Can I track maintenance costs?", a: "Yes — each entry includes cost fields. The system totals spending per ride to support budget planning." },
    ],
  },
  {
    icon: Calendar,
    title: "Calendar",
    description: "Track inspections and expiry dates.",
    route: "/calendar",
    steps: [
      "Open the Calendar from the main menu.",
      "Events are auto-populated from inspection schedules and document expiry dates.",
      "Click 'Add Event' to create manual entries.",
      "Select a day to view all events for that date.",
      "Use the Upcoming section to see events in the next 7 days.",
    ],
    faqs: [
      { q: "How are events generated?", a: "Inspections, NDT schedules, and document expiry dates are automatically added to your calendar when set." },
    ],
  },
];

const advancedFeatures: HelpTopic[] = [
  {
    icon: BarChart2,
    title: "Reports",
    description: "Generate compliance and inspection reports.",
    steps: [
      "Access Reports from the ride detail page or overview dashboard.",
      "Select report type: Inspection History, Maintenance Log, or Daily Checks.",
      "Choose the date range and specific rides.",
      "Click 'Generate Report' to compile the data.",
      "Export as PDF for regulatory submissions or record keeping.",
    ],
  },
  {
    icon: Bell,
    title: "Notifications",
    description: "Manage reminders and alerts.",
    steps: [
      "Notifications are automatically configured for your account.",
      "Alerts include: expiring documents (30 & 7 days), upcoming inspections, overdue maintenance.",
      "Check the notification centre (bell icon) for in-app alerts.",
      "Email notifications are sent to your registered address.",
      "Ensure documents have expiry dates set to receive timely reminders.",
    ],
  },
  {
    icon: Users,
    title: "User Roles",
    description: "Assign permissions and access levels.",
    steps: [
      "Go to the Staff page from the main menu.",
      "Click 'Invite Staff' and enter their email.",
      "Select which modules they can access: Checks, Documents, Maintenance, Calendar, etc.",
      "Staff never have access to billing or account settings.",
      "Permissions can be updated at any time from the Staff page.",
    ],
  },
  {
    icon: Shield,
    title: "Compliance Tracking",
    description: "Monitor inspection and document status.",
    steps: [
      "Use the Overview dashboard to see fleet-wide compliance status.",
      "Red/amber indicators highlight overdue or expiring items.",
      "The Calendar shows all upcoming inspection and expiry events.",
      "Generate compliance reports to share with inspectors or councils.",
    ],
  },
];

// ── component ─────────────────────────────────────────────────────────────────
const HelpCenter = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { terminology } = useTerminology();
  const [search, setSearch] = useState("");
  const [selectedTopic, setSelectedTopic] = useState<HelpTopic | null>(null);
  const [guideOpen, setGuideOpen] = useState(false);
  const [guideExpanded, setGuideExpanded] = useState(false);

  const filterTopics = (topics: HelpTopic[]) => {
    if (!search.trim()) return topics;
    const q = search.toLowerCase();
    return topics.filter(
      (t) =>
        t.title.toLowerCase().includes(q) ||
        t.description.toLowerCase().includes(q)
    );
  };

  const openTopic = (topic: HelpTopic) => {
    setSelectedTopic(topic);
    setGuideOpen(true);
  };

  // ── sub-components ──────────────────────────────────────────────────────────
  const TopicRow = ({ topic }: { topic: HelpTopic }) => (
    <button
      onClick={() => openTopic(topic)}
      className="w-full flex items-center gap-3 p-3.5 rounded-[14px] bg-white border border-[#E2E8F0] text-left transition-all hover:border-[#1E3A5F] hover:bg-[#F1F5F9] group"
    >
      <div className="flex-shrink-0 w-9 h-9 rounded-lg bg-[#F1F5F9] flex items-center justify-center">
        <topic.icon className="h-5 w-5 text-[#475569] group-hover:text-[#1E3A5F] transition-colors" strokeWidth={2} />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-[#0F172A]">{topic.title}</p>
        <p className="text-xs text-[#64748B] mt-0.5 truncate">{topic.description}</p>
      </div>
      <ChevronRight className="h-4 w-4 text-[#94A3B8] flex-shrink-0 group-hover:text-[#1E3A5F] transition-colors" />
    </button>
  );

  const SectionHeading = ({ children }: { children: React.ReactNode }) => (
    <h2 className="text-base font-semibold text-[#0F172A] mt-6 mb-2">{children}</h2>
  );

  // ── render ──────────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-[#F8FAFC]">
      <Header />

      <main className="pt-24 pb-16">
        <div className="container mx-auto px-4" style={{ maxWidth: 900 }}>

          {/* Back */}
          <div className="pt-4 pb-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => (location.key === "default" ? navigate("/") : navigate(-1))}
              className="gap-1.5 -ml-2 text-[#64748B] hover:text-[#0F172A]"
            >
              <ArrowLeft className="h-4 w-4" />
              Back
            </Button>
          </div>

          {/* ── HEADER ─────────────────────────────────────────────────────── */}
          <div className="mb-5">
            <h1 className="text-2xl font-semibold text-[#0F172A]">Help & Support</h1>
            <p className="text-sm text-[#64748B] mt-1">
              Get help, track requests, and share feedback.
            </p>
          </div>

          {/* ── GET HELP NOW ──────────────────────────────────────────────── */}
          <SectionHeading>Get Help Now</SectionHeading>
          <div className="space-y-2.5 mb-1">
            <HelpChatWidget />
            <ContactSupportDialog
              trigger={
                <button className="w-full flex items-center gap-3 p-3.5 rounded-[14px] bg-white border border-[#E2E8F0] text-left transition-all hover:border-[#1E3A5F] hover:bg-[#F1F5F9] group">
                  <div className="flex-shrink-0 w-9 h-9 rounded-lg bg-[#F1F5F9] flex items-center justify-center">
                    <LifeBuoy className="h-5 w-5 text-[#475569] group-hover:text-[#1E3A5F] transition-colors" strokeWidth={2} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-[#0F172A]">Contact Support</p>
                    <p className="text-xs text-[#64748B] mt-0.5">Send a new message to our team.</p>
                  </div>
                  <ChevronRight className="h-4 w-4 text-[#94A3B8] flex-shrink-0" />
                </button>
              }
            />
          </div>

          {/* ── TRACK MY HELP ──────────────────────────────────────────────── */}
          <SectionHeading>Track My Help</SectionHeading>
          <div className="mb-1">
            <button
              onClick={() => navigate('/support-requests')}
              className="w-full flex items-center gap-3 p-3.5 rounded-[14px] bg-white border border-[#E2E8F0] text-left transition-all hover:border-[#1E3A5F] hover:bg-[#F1F5F9] group"
            >
              <div className="flex-shrink-0 w-9 h-9 rounded-lg bg-[#F1F5F9] flex items-center justify-center">
                <Mail className="h-5 w-5 text-[#475569] group-hover:text-[#1E3A5F] transition-colors" strokeWidth={2} />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-[#0F172A]">My Support Requests</p>
                <p className="text-xs text-[#64748B] mt-0.5">View replies and conversation history.</p>
              </div>
              <ChevronRight className="h-4 w-4 text-[#94A3B8] flex-shrink-0" />
            </button>
          </div>

          {/* ── PRODUCT FEEDBACK ───────────────────────────────────────────── */}
          <SectionHeading>Product Feedback</SectionHeading>
          <p className="text-xs text-[#64748B] -mt-1 mb-2.5">Reviewed separately from support requests.</p>
          <div className="grid grid-cols-2 gap-2.5 mb-1">
            <RequestFeatureDialog
              trigger={
                <button className="flex items-center gap-3 p-3.5 rounded-[14px] bg-white border border-[#E2E8F0] text-left transition-all hover:border-[#1E3A5F] hover:bg-[#F1F5F9] group w-full">
                  <div className="flex-shrink-0 w-9 h-9 rounded-lg bg-[#F1F5F9] flex items-center justify-center">
                    <Lightbulb className="h-5 w-5 text-[#475569] group-hover:text-[#1E3A5F] transition-colors" strokeWidth={2} />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-[#0F172A]">Request Feature</p>
                    <p className="text-xs text-[#64748B] mt-0.5">Suggest an improvement.</p>
                  </div>
                </button>
              }
            />
            <BugReportDialog
              trigger={
                <button className="flex items-center gap-3 p-3.5 rounded-[14px] bg-white border border-[#E2E8F0] text-left transition-all hover:border-[#1E3A5F] hover:bg-[#F1F5F9] group w-full">
                  <div className="flex-shrink-0 w-9 h-9 rounded-lg bg-[#F1F5F9] flex items-center justify-center">
                    <AlertCircle className="h-5 w-5 text-[#475569] group-hover:text-[#1E3A5F] transition-colors" strokeWidth={2} />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-[#0F172A]">Report Issue</p>
                    <p className="text-xs text-[#64748B] mt-0.5">Log a bug or problem.</p>
                  </div>
                </button>
              }
            />
          </div>

          {/* ── GUIDES & MODULES ───────────────────────────────────────────── */}
          <SectionHeading>Guides & Modules</SectionHeading>
          <div className="relative mb-3">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-[#64748B]" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search help topics…"
              className="w-full bg-white border border-[#E2E8F0] rounded-xl pl-10 pr-4 py-3 text-sm text-[#0F172A] placeholder-[#94A3B8] outline-none focus:border-[#1E3A5F] transition-colors"
            />
          </div>

          {filterTopics(coreModules).length > 0 && (
            <>
              <p className="text-xs font-semibold uppercase tracking-wide text-[#94A3B8] mb-2 px-1">Core</p>
              <div className="grid sm:grid-cols-2 gap-2.5">
                {filterTopics(coreModules).map((t) => (
                  <TopicRow key={t.title} topic={t} />
                ))}
              </div>
            </>
          )}

          {filterTopics(advancedFeatures).length > 0 && (
            <>
              <p className="text-xs font-semibold uppercase tracking-wide text-[#94A3B8] mb-2 mt-4 px-1">Advanced</p>
              <div className="grid sm:grid-cols-2 gap-2.5">
                {filterTopics(advancedFeatures).map((t) => (
                  <TopicRow key={t.title} topic={t} />
                ))}
              </div>
            </>
          )}

          {search && filterTopics(coreModules).length === 0 && filterTopics(advancedFeatures).length === 0 && (
            <div className="text-center py-10 text-sm text-[#64748B]">
              No topics found for "<span className="font-medium text-[#0F172A]">{search}</span>". Try different keywords.
            </div>
          )}

          {/* ── COLLAPSIBLE FAQs ────────────────────────────────────────────── */}
          <div className="mt-6 bg-white border border-[#E2E8F0] rounded-2xl overflow-hidden">
            <button
              onClick={() => setGuideExpanded(!guideExpanded)}
              className="w-full flex items-center justify-between px-5 py-4 text-left hover:bg-[#F8FAFC] transition-colors"
            >
              <span className="text-sm font-semibold text-[#0F172A]">Frequently asked questions</span>
              <ChevronDown
                className={`h-4 w-4 text-[#475569] transition-transform duration-200 ${guideExpanded ? "rotate-180" : ""}`}
              />
            </button>

            {guideExpanded && (
              <div className="px-5 pb-5 border-t border-[#E2E8F0]">
                {[
                  {
                    category: "Getting Started",
                    questions: [
                      { q: "How do I start using Ride Ready Docs?", a: `Complete your profile with company and ${terminology.isUK ? "showman" : "operator"} details, then add your first ride. Once added, upload documents and schedule inspections.` },
                      { q: "What's included in the free trial?", a: "Full access to all features. No credit card required. After the trial, choose a plan based on your number of rides." },
                    ],
                  },
                  {
                    category: "Documents",
                    questions: [
                      { q: "What types of documents can I upload?", a: "Annual inspection certificates, insurance, test certificates, manuals, risk assessments, electrical certificates, NDT reports, and more." },
                      { q: "How does document expiry tracking work?", a: "Set an expiry date when uploading. The system sends email reminders 30 and 7 days before expiry." },
                      { q: `How do I send documents to ${terminology.isUK ? "councils" : "authorities"} or inspectors?`, a: `Use 'Send Documents' on any ride. Select documents, add recipient emails, add a message, and send.` },
                    ],
                  },
                  {
                    category: "Account & Billing",
                    questions: [
                      { q: "How does pricing work?", a: "Starter (1–5 items) £9.99/mo · Operator (6–12) £19.99/mo · Professional (13–25) £34.99/mo · Business (26–50) £44.99/mo. All plans include every feature. Stalls and generators are free. Need more than 50 items? Contact us." },
                      { q: "Can I cancel my subscription?", a: "Yes, cancel anytime from Settings > Plan & Billing. Access continues until the end of your paid period. Data retained for 90 days." },
                    ],
                  },
                  {
                    category: "Staff Management",
                    questions: [
                      { q: "How do I invite staff members?", a: "Staff page → Invite Staff → enter email → select feature access. Staff receive an email invitation." },
                      { q: "What permissions can staff have?", a: "Calendar, Documents, Checks, Maintenance, Risk Assessments, and Send Documents. Staff never access billing or settings." },
                    ],
                  },
                  {
                    category: "Security & Data",
                    questions: [
                      { q: "Is my data secure?", a: `Bank-level encryption, row-level security, and regular backups. Data stored in ${terminology.isUK ? "UK/EU" : "secure"} data centres.` },
                      { q: "What happens to my data if I cancel?", a: "Retained for 90 days to allow reactivation, then permanently deleted. Request immediate deletion via support." },
                    ],
                  },
                ].map((cat, ci) => (
                  <div key={ci} className="mt-4">
                    <p className="text-xs font-semibold uppercase tracking-wide text-[#94A3B8] mb-2">{cat.category}</p>
                    <Accordion type="single" collapsible className="space-y-1.5">
                      {cat.questions.map((item, qi) => (
                        <AccordionItem
                          key={`faq-${ci}-${qi}`}
                          value={`faq-${ci}-${qi}`}
                          className="border border-[#E2E8F0] rounded-xl px-4 bg-white"
                        >
                          <AccordionTrigger className="text-sm font-medium text-[#0F172A] text-left hover:no-underline py-3.5">
                            {item.q}
                          </AccordionTrigger>
                          <AccordionContent className="text-sm text-[#475569] pb-4 leading-relaxed">
                            {item.a}
                          </AccordionContent>
                        </AccordionItem>
                      ))}
                    </Accordion>
                  </div>
                ))}
              </div>
            )}
          </div>

        </div>
      </main>

      {/* ── TOPIC DETAIL DIALOG ─────────────────────────────────────────────── */}
      <Dialog open={guideOpen} onOpenChange={setGuideOpen}>
        <DialogContent className="max-w-lg">
          {selectedTopic && (
            <>
              <DialogHeader>
                <div className="flex items-center gap-3 mb-1">
                  <div className="w-10 h-10 rounded-lg bg-[#F1F5F9] flex items-center justify-center">
                    <selectedTopic.icon className="h-5 w-5 text-[#1E3A5F]" strokeWidth={2} />
                  </div>
                  <div>
                    <DialogTitle className="text-lg">{selectedTopic.title}</DialogTitle>
                    <DialogDescription className="text-xs">{selectedTopic.description}</DialogDescription>
                  </div>
                </div>
              </DialogHeader>

              <div className="space-y-5 mt-2">
                {selectedTopic.steps && (
                  <div
                    className="rounded-[14px] border border-[#E2E8F0] p-4 space-y-3"
                    style={{ borderLeft: "3px solid #1E3A5F" }}
                  >
                    <p className="text-xs font-semibold uppercase tracking-wide text-[#94A3B8]">Step-by-step guide</p>
                    {selectedTopic.steps.map((step, i) => (
                      <div key={i} className="flex gap-3">
                        <div className="flex-shrink-0 w-5 h-5 rounded-full bg-[#1E3A5F] text-white flex items-center justify-center text-xs font-semibold">
                          {i + 1}
                        </div>
                        <p className="text-sm text-[#475569] leading-relaxed pt-px">{step}</p>
                      </div>
                    ))}
                  </div>
                )}

                {selectedTopic.faqs && selectedTopic.faqs.length > 0 && (
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wide text-[#94A3B8] mb-2">Common questions</p>
                    <Accordion type="single" collapsible className="space-y-1.5">
                      {selectedTopic.faqs.map((faq, i) => (
                        <AccordionItem
                          key={i}
                          value={`d-faq-${i}`}
                          className="border border-[#E2E8F0] rounded-xl px-4 bg-white"
                        >
                          <AccordionTrigger className="text-sm font-medium text-[#0F172A] text-left hover:no-underline py-3">
                            {faq.q}
                          </AccordionTrigger>
                          <AccordionContent className="text-sm text-[#475569] pb-3 leading-relaxed">
                            {faq.a}
                          </AccordionContent>
                        </AccordionItem>
                      ))}
                    </Accordion>
                  </div>
                )}

                {selectedTopic.route && (
                  <div className="flex gap-2 pt-1">
                    <Button
                      onClick={() => { navigate(selectedTopic.route!); setGuideOpen(false); }}
                      className="flex-1 bg-[#1E3A5F] hover:bg-[#162d4a] text-white rounded-xl text-sm"
                    >
                      Go to {selectedTopic.title}
                      <ArrowRight className="h-4 w-4 ml-1.5" />
                    </Button>
                    <Button variant="outline" onClick={() => setGuideOpen(false)} className="rounded-xl text-sm">
                      Close
                    </Button>
                  </div>
                )}
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>

      <Footer />
    </div>
  );
};

export default HelpCenter;
