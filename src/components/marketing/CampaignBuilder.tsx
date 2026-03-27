import { useState, useEffect, useCallback, useRef } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { toast } from "sonner";
import { Send, Eye, Users, Tag, Info, FlaskConical, CheckCircle2, ChevronDown, Mail } from "lucide-react";
import { CampaignPreview } from "./CampaignPreview";
import { format } from "date-fns";
import { useIsMobile } from "@/hooks/use-mobile";
import { useAuditLog } from "@/hooks/useAuditLog";

const PERSONALISATION_TOKENS = [
  { token: "{{first_name}}", label: "First Name", sample: "John" },
  { token: "{{name}}", label: "Name", sample: "John Doe" },
  { token: "{{company}}", label: "Company", sample: "Acme Corp" },
  { token: "{{email}}", label: "Email", sample: "john@example.com" },
];

const UTILITY_TOKENS = [
  { token: "{{website_url}}", label: "Website URL", sample: "https://ridereadydocs.com" },
  { token: "{{support_email}}", label: "Support Email", sample: "info@ridereadydocs.com" },
  { token: "{{unsubscribe_url}}", label: "Unsubscribe URL", sample: "#unsubscribe" },
];

const DEFAULT_CONTENT = `Dear {{first_name}},

Thank you for your continued trust in our compliance management services. We wanted to share some important updates that may benefit your operations.

Keeping your equipment documentation current is essential for safety and regulatory compliance. Our platform makes it simple to stay on top of inspections, certifications, and maintenance records.

If you have any questions or need assistance, please don't hesitate to reach out.

Kind regards,
The Ride Ready Docs Team`;

interface MarketingContact {
  id: string;
  email: string;
  name: string | null;
  company_name: string | null;
  tags: string[];
  is_subscribed: boolean;
}

interface CampaignBuilderProps {
  onCampaignSent: () => void;
}

interface TestSendResult {
  sentTo: string;
  sentAt: string;
  fromName: string;
  fromEmail: string;
  replyTo: string;
}

export const CampaignBuilder = ({ onCampaignSent }: CampaignBuilderProps) => {
  const { user } = useAuth();
  const isMobile = useIsMobile();
  const { logEvent } = useAuditLog();
  const [contacts, setContacts] = useState<MarketingContact[]>([]);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const [identityOpen, setIdentityOpen] = useState(false);
  
  // Campaign form
  const [campaignName, setCampaignName] = useState("");
  const [subject, setSubject] = useState("Updates from Ride Ready Docs");
  const [content, setContent] = useState(DEFAULT_CONTENT);
  
  // Recipient selection
  const [selectionMode, setSelectionMode] = useState<"all" | "tags" | "custom">("all");
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [selectedContactIds, setSelectedContactIds] = useState<string[]>([]);

  // Refs for token insertion
  const subjectRef = useRef<HTMLInputElement>(null);
  const contentRef = useRef<HTMLTextAreaElement>(null);
  const lastFocusedField = useRef<"subject" | "content">("content");

  // Test send
  const [showTestDialog, setShowTestDialog] = useState(false);
  const [testEmail, setTestEmail] = useState(user?.email || "");
  const [sendingTest, setSendingTest] = useState(false);
  const [lastTestResult, setLastTestResult] = useState<TestSendResult | null>(null);

  const insertToken = (token: string) => {
    const field = lastFocusedField.current;
    if (field === "subject") {
      const el = subjectRef.current;
      if (el) {
        const start = el.selectionStart ?? subject.length;
        const end = el.selectionEnd ?? subject.length;
        const newVal = subject.slice(0, start) + token + subject.slice(end);
        setSubject(newVal);
        requestAnimationFrame(() => {
          el.focus();
          el.setSelectionRange(start + token.length, start + token.length);
        });
      }
    } else {
      const el = contentRef.current;
      if (el) {
        const start = el.selectionStart ?? content.length;
        const end = el.selectionEnd ?? content.length;
        const newVal = content.slice(0, start) + token + content.slice(end);
        setContent(newVal);
        requestAnimationFrame(() => {
          el.focus();
          el.setSelectionRange(start + token.length, start + token.length);
        });
      }
    }
  };

  const fetchContacts = useCallback(async () => {
    if (!user) return;
    try {
      const { data, error } = await supabase
        .from("marketing_contacts")
        .select("id, email, name, company_name, tags, is_subscribed")
        .eq("user_id", user.id)
        .eq("is_subscribed", true)
        .order("name");
      if (error) throw error;
      setContacts(data || []);
    } catch (error: any) {
      console.error("Error fetching contacts:", error);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => { fetchContacts(); }, [fetchContacts]);

  useEffect(() => {
    if (user?.email && !testEmail) setTestEmail(user.email);
  }, [user?.email]);

  const allTags = Array.from(new Set(contacts.flatMap(c => c.tags || [])));

  const getSelectedRecipients = (): MarketingContact[] => {
    if (selectionMode === "all") return contacts;
    if (selectionMode === "tags") return contacts.filter(c => c.tags?.some(tag => selectedTags.includes(tag)));
    return contacts.filter(c => selectedContactIds.includes(c.id));
  };

  const selectedRecipients = getSelectedRecipients();

  const handleTagToggle = (tag: string) => {
    setSelectedTags(prev => prev.includes(tag) ? prev.filter(t => t !== tag) : [...prev, tag]);
  };

  const handleContactToggle = (contactId: string) => {
    setSelectedContactIds(prev => prev.includes(contactId) ? prev.filter(id => id !== contactId) : [...prev, contactId]);
  };

  const handleSelectAll = () => {
    if (selectedContactIds.length === contacts.length) {
      setSelectedContactIds([]);
    } else {
      setSelectedContactIds(contacts.map(c => c.id));
    }
  };

  const handleSendTest = async () => {
    if (!user || !testEmail.trim() || !subject.trim() || !content.trim()) {
      toast.error("Please fill in subject and content before sending a test");
      return;
    }
    setSendingTest(true);
    try {
      const { data: session } = await supabase.auth.getSession();
      const response = await supabase.functions.invoke("send-test-marketing-email", {
        body: { testEmail: testEmail.trim(), subject: subject.trim(), content },
        headers: { Authorization: `Bearer ${session.session?.access_token}` },
      });
      if (response.error) throw new Error(response.error.message || "Failed to send test email");
      const result = response.data as TestSendResult;
      setLastTestResult(result);
      setShowTestDialog(false);
      toast.success(`Test email sent to ${testEmail.trim()}`);
    } catch (error: any) {
      console.error("Test send error:", error);
      toast.error(error.message || "Failed to send test email");
    } finally {
      setSendingTest(false);
    }
  };

  const handleSendCampaign = async () => {
    if (!user) return;
    if (!campaignName.trim() || !subject.trim() || !content.trim()) {
      toast.error("Please fill in all required fields");
      return;
    }
    if (selectedRecipients.length === 0) {
      toast.error("Please select at least one recipient");
      return;
    }
    setSending(true);
    try {
      const { data: campaign, error: campaignError } = await supabase
        .from("email_campaigns")
        .insert({
          user_id: user.id,
          name: campaignName.trim(),
          subject: subject.trim(),
          html_content: content,
          status: "sending",
          recipient_count: selectedRecipients.length,
        })
        .select()
        .single();
      if (campaignError) throw campaignError;

      const recipientRecords = selectedRecipients.map(contact => ({
        campaign_id: campaign.id,
        contact_id: contact.id,
        status: "pending",
      }));
      const { error: recipientsError } = await supabase.from("campaign_recipients").insert(recipientRecords);
      if (recipientsError) throw recipientsError;

      const { data: session } = await supabase.auth.getSession();
      const response = await supabase.functions.invoke("send-marketing-campaign", {
        body: { campaignId: campaign.id },
        headers: { Authorization: `Bearer ${session.session?.access_token}` },
      });
      if (response.error) throw new Error(response.error.message || "Failed to send campaign");

      toast.success(`Campaign sent to ${selectedRecipients.length} recipients!`);
      setCampaignName("");
      setSubject("");
      setContent("");
      setSelectionMode("all");
      setSelectedTags([]);
      setSelectedContactIds([]);
      setLastTestResult(null);
      onCampaignSent();
    } catch (error: any) {
      console.error("Error sending campaign:", error);
      toast.error(error.message || "Failed to send campaign");
    } finally {
      setSending(false);
    }
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="py-8 text-center">
          <p className="text-muted-foreground">Loading...</p>
        </CardContent>
      </Card>
    );
  }

  if (contacts.length === 0) {
    return (
      <Card>
        <CardContent className="py-8 text-center">
          <Users className="h-12 w-12 mx-auto text-muted-foreground mb-2" />
          <p className="text-muted-foreground">Add contacts first before creating a campaign</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-3 md:space-y-6">
      {/* Sending Identity — collapsed on mobile */}
      <Collapsible open={isMobile ? identityOpen : true} onOpenChange={setIdentityOpen}>
        <Card className="border-dashed">
          <CardContent className="py-2.5 px-3 md:py-3 md:px-4">
            {isMobile ? (
              <CollapsibleTrigger className="flex items-center justify-between w-full text-left gap-2">
                <div className="flex items-center gap-2 min-w-0">
                  <Mail className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                  <div className="text-xs min-w-0">
                    <span className="text-muted-foreground">From: </span>
                    <span className="font-medium text-foreground">Ride Ready Docs</span>
                    <span className="text-muted-foreground block truncate">info@ridereadydocs.com</span>
                  </div>
                </div>
                <ChevronDown className={`h-3.5 w-3.5 text-muted-foreground shrink-0 transition-transform duration-200 ${identityOpen ? "rotate-180" : ""}`} />
              </CollapsibleTrigger>
            ) : (
              <div className="flex items-center gap-2 mb-2">
                <Info className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm font-medium">Sending Identity</span>
              </div>
            )}
            {isMobile ? (
              <CollapsibleContent>
                <div className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1.5 text-xs text-muted-foreground mt-2.5 pt-2.5 border-t">
                  <span className="font-medium">Provider</span>
                  <span className="text-foreground">Resend</span>
                   <span className="font-medium">From name</span>
                   <span className="text-foreground">Ride Ready Docs</span>
                   <span className="font-medium">From email</span>
                   <span className="text-foreground break-all">info@ridereadydocs.com</span>
                   <span className="font-medium">Reply-to</span>
                   <span className="text-foreground break-all">info@ridereadydocs.com</span>
                </div>
              </CollapsibleContent>
            ) : (
              <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs text-muted-foreground">
                <span>Provider</span>
                <span className="text-foreground">Resend</span>
                <span>From name</span>
                <span className="text-foreground">Ride Ready Docs</span>
                <span>From email</span>
                <span className="text-foreground">info@ridereadydocs.com</span>
                <span>Reply-to</span>
                <span className="text-foreground">info@ridereadydocs.com</span>
              </div>
            )}
          </CardContent>
        </Card>
      </Collapsible>

      {/* Compose Campaign */}
      <Card>
        <CardHeader className="pb-3 md:pb-4 px-3 md:px-6 pt-4 md:pt-6">
          <CardTitle className="text-base md:text-2xl">Compose Campaign</CardTitle>
          <CardDescription className="text-xs md:text-sm">
            Use tokens like {`{{name}}`}, {`{{company}}`}, {`{{email}}`} for personalisation.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3 md:space-y-4 px-3 md:px-6 pb-4 md:pb-6">
          <div className="space-y-1.5">
            <Label htmlFor="campaignName" className="text-xs md:text-sm">Campaign Name *</Label>
            <Input
              id="campaignName"
              value={campaignName}
              onChange={(e) => setCampaignName(e.target.value)}
              placeholder="January Newsletter"
            />
            <p className="text-[11px] md:text-xs text-muted-foreground">Internal reference only</p>
          </div>
          
          <div className="space-y-1.5">
            <Label htmlFor="subject" className="text-xs md:text-sm">Email Subject *</Label>
            <Input
              id="subject"
              ref={subjectRef}
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              onFocus={() => { lastFocusedField.current = "subject"; }}
              placeholder="Exciting news from {{company}}!"
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="content" className="text-xs md:text-sm">Email Content *</Label>
            <Textarea
              id="content"
              ref={contentRef}
              value={content}
              onChange={(e) => setContent(e.target.value)}
              onFocus={() => { lastFocusedField.current = "content"; }}
              placeholder={`Dear {{name}},\n\nI hope this email finds you well...\n\nBest regards`}
              rows={isMobile ? 8 : 12}
              className="font-mono text-sm"
            />
          </div>

          <div className="space-y-2.5 p-2.5 md:p-3 bg-muted rounded-lg">
            <div>
              <div className="flex items-center gap-1.5 mb-1.5">
                <Tag className="h-3 w-3 text-muted-foreground shrink-0" />
                <span className="text-[11px] text-muted-foreground font-semibold uppercase tracking-wide">Personalisation</span>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {PERSONALISATION_TOKENS.map(({ token, label }) => (
                  <button
                    key={token}
                    type="button"
                    onClick={() => insertToken(token)}
                    className="inline-flex items-center px-2 py-1 rounded-md bg-background border border-border text-xs font-mono text-foreground hover:bg-accent hover:text-accent-foreground active:scale-95 transition-all cursor-pointer"
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>
            <div className="pt-1.5 border-t border-border/50">
              <div className="flex items-center gap-1.5 mb-1.5">
                <Info className="h-3 w-3 text-muted-foreground shrink-0" />
                <span className="text-[11px] text-muted-foreground font-semibold uppercase tracking-wide">Links &amp; Utility</span>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {UTILITY_TOKENS.map(({ token, label }) => (
                  <button
                    key={token}
                    type="button"
                    onClick={() => insertToken(token)}
                    className="inline-flex items-center px-2 py-1 rounded-md bg-background border border-dashed border-muted-foreground/30 text-xs font-mono text-muted-foreground hover:bg-accent hover:text-accent-foreground active:scale-95 transition-all cursor-pointer"
                  >
                    {label}
                  </button>
                ))}
              </div>
              <p className="text-[10px] text-muted-foreground/70 mt-1">Website &amp; unsubscribe links are already in the footer. Only insert here if needed in the body.</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Recipients */}
      <Card>
        <CardHeader className="pb-3 md:pb-4 px-3 md:px-6 pt-4 md:pt-6">
          <div className="flex items-center gap-2">
            <CardTitle className="text-base md:text-lg">Recipients</CardTitle>
            <Badge variant="secondary" className="text-xs tabular-nums">{selectedRecipients.length}</Badge>
          </div>
          <CardDescription className="text-xs md:text-sm">
            Select who receives this campaign
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3 md:space-y-4 px-3 md:px-6 pb-4 md:pb-6">
          <Tabs value={selectionMode} onValueChange={(v) => setSelectionMode(v as any)}>
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="all" className="text-xs md:text-sm">All</TabsTrigger>
              <TabsTrigger value="tags" className="text-xs md:text-sm">Tags</TabsTrigger>
              <TabsTrigger value="custom" className="text-xs md:text-sm">Custom</TabsTrigger>
            </TabsList>

            <TabsContent value="all" className="pt-3">
              <div className="flex items-center gap-2 text-xs md:text-sm text-muted-foreground">
                <Users className="h-4 w-4 shrink-0" />
                All {contacts.length} subscribed contacts will receive this email
              </div>
            </TabsContent>

            <TabsContent value="tags" className="pt-3">
              {allTags.length === 0 ? (
                <p className="text-xs md:text-sm text-muted-foreground">No tags found. Add tags to contacts first.</p>
              ) : (
                <div className="space-y-2">
                  <p className="text-xs text-muted-foreground">Select tags to filter recipients:</p>
                  <div className="flex flex-wrap gap-1.5">
                    {allTags.map(tag => (
                      <Badge
                        key={tag}
                        variant={selectedTags.includes(tag) ? "default" : "outline"}
                        className="cursor-pointer text-xs"
                        onClick={() => handleTagToggle(tag)}
                      >
                        <Tag className="h-3 w-3 mr-1" />
                        {tag}
                      </Badge>
                    ))}
                  </div>
                  {selectedTags.length > 0 && (
                    <p className="text-xs text-muted-foreground">{selectedRecipients.length} contacts match</p>
                  )}
                </div>
              )}
            </TabsContent>

            <TabsContent value="custom" className="pt-3">
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-muted-foreground">{selectedContactIds.length} selected</span>
                  <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={handleSelectAll}>
                    {selectedContactIds.length === contacts.length ? "Deselect All" : "Select All"}
                  </Button>
                </div>
                <ScrollArea className="h-52 md:h-64 border rounded-lg p-2">
                  <div className="space-y-0.5">
                    {contacts.map(contact => (
                      <div
                        key={contact.id}
                        className="flex items-center gap-2 p-1.5 md:p-2 rounded hover:bg-muted cursor-pointer"
                        onClick={() => handleContactToggle(contact.id)}
                      >
                        <Checkbox
                          checked={selectedContactIds.includes(contact.id)}
                          onCheckedChange={() => handleContactToggle(contact.id)}
                        />
                        <div className="flex-1 min-w-0">
                          <p className="text-xs md:text-sm font-medium truncate">{contact.name || contact.email}</p>
                          {contact.name && (
                            <p className="text-[11px] md:text-xs text-muted-foreground truncate">{contact.email}</p>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              </div>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>

      {/* Last test send indicator */}
      {lastTestResult && (
        <div className="flex items-start gap-2 px-3 py-2 rounded-lg border bg-muted/50 text-xs">
          <CheckCircle2 className="h-3.5 w-3.5 text-primary shrink-0 mt-0.5" />
          <span className="text-muted-foreground">
            Test sent to <span className="font-medium text-foreground">{lastTestResult.sentTo}</span>
            {" · "}
            {format(new Date(lastTestResult.sentAt), "MMM d, HH:mm")}
          </span>
        </div>
      )}

      {/* Pre-send summary + Campaign Actions */}
      <div className="space-y-2">
        {isMobile && (
          <div className="flex items-center justify-between px-3 py-2 rounded-lg bg-muted/60 text-xs">
            <span className="text-muted-foreground">
              Recipients: <span className="font-semibold text-foreground tabular-nums">{selectedRecipients.length}</span>
            </span>
            <span className="text-muted-foreground">
              From: <span className="font-medium text-foreground">info@ridereadydocs.com</span>
            </span>
          </div>
        )}
        <div className="flex flex-col md:flex-row gap-2">
          <Button
            variant="outline"
            onClick={() => setShowPreview(true)}
            disabled={!content}
            className="w-full md:w-auto disabled:opacity-40 disabled:border-border"
          >
            <Eye className="h-4 w-4 mr-2" />
            Preview
          </Button>
          <Button
            variant="outline"
            onClick={() => setShowTestDialog(true)}
            disabled={!subject || !content}
            className="w-full md:w-auto disabled:opacity-40 disabled:border-border"
          >
            <FlaskConical className="h-4 w-4 mr-2" />
            Send Test
          </Button>
          <Button
            onClick={handleSendCampaign}
            disabled={sending || selectedRecipients.length === 0 || !campaignName || !subject || !content}
            className="w-full md:flex-1 disabled:opacity-40"
          >
            <Send className="h-4 w-4 mr-2" />
            {sending ? "Sending..." : `Send to ${selectedRecipients.length} Recipients`}
          </Button>
        </div>
      </div>

      <CampaignPreview
        open={showPreview}
        onOpenChange={setShowPreview}
        subject={subject}
        content={content}
        sampleContact={selectedRecipients[0] || contacts[0]}
      />

      {/* Test Send Dialog */}
      <Dialog open={showTestDialog} onOpenChange={setShowTestDialog}>
        <DialogContent className="max-w-[calc(100vw-2rem)] sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base">
              <FlaskConical className="h-4 w-4" />
              Send Test Email
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <p className="text-xs text-muted-foreground">
              Send a real email using the full branded template. Subject will be prefixed with [TEST].
            </p>
            <div className="space-y-1.5">
              <Label htmlFor="testEmail" className="text-xs">Send to email address</Label>
              <Input
                id="testEmail"
                type="email"
                value={testEmail}
                onChange={(e) => setTestEmail(e.target.value)}
                placeholder="your@email.com"
              />
            </div>
            <div className="p-2.5 rounded-lg bg-muted text-[11px] space-y-1">
              <p className="text-muted-foreground"><span className="font-medium text-foreground">Subject:</span> [TEST] {subject || "(empty)"}</p>
              <p className="text-muted-foreground"><span className="font-medium text-foreground">From:</span> Ride Ready Docs &lt;info@ridereadydocs.com&gt;</p>
              <p className="text-muted-foreground"><span className="font-medium text-foreground">Reply-to:</span> info@ridereadydocs.com</p>
            </div>
            <div className="flex flex-col-reverse sm:flex-row gap-2 sm:justify-end">
              <Button variant="outline" onClick={() => setShowTestDialog(false)} className="w-full sm:w-auto">
                Cancel
              </Button>
              <Button
                onClick={handleSendTest}
                disabled={sendingTest || !testEmail.trim()}
                className="w-full sm:w-auto"
              >
                <Send className="h-4 w-4 mr-2" />
                {sendingTest ? "Sending..." : "Send Test"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};
