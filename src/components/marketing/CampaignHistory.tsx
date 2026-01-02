import { useState, useEffect, useCallback } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { format } from "date-fns";
import { Mail, Clock, CheckCircle, XCircle, Eye, Users } from "lucide-react";

interface Campaign {
  id: string;
  name: string;
  subject: string;
  html_content: string;
  status: string;
  recipient_count: number;
  sent_count: number;
  sent_at: string | null;
  created_at: string;
}

interface CampaignRecipient {
  id: string;
  status: string;
  sent_at: string | null;
  error_message: string | null;
  contact: {
    email: string;
    name: string | null;
  };
}

export const CampaignHistory = () => {
  const { user } = useAuth();
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedCampaign, setSelectedCampaign] = useState<Campaign | null>(null);
  const [recipients, setRecipients] = useState<CampaignRecipient[]>([]);
  const [loadingRecipients, setLoadingRecipients] = useState(false);

  const fetchCampaigns = useCallback(async () => {
    if (!user) return;

    try {
      const { data, error } = await supabase
        .from("email_campaigns")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false });

      if (error) throw error;
      setCampaigns(data || []);
    } catch (error: any) {
      console.error("Error fetching campaigns:", error);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    fetchCampaigns();
  }, [fetchCampaigns]);

  const fetchRecipients = async (campaignId: string) => {
    setLoadingRecipients(true);
    try {
      const { data, error } = await supabase
        .from("campaign_recipients")
        .select(`
          id,
          status,
          sent_at,
          error_message,
          contact:marketing_contacts(email, name)
        `)
        .eq("campaign_id", campaignId)
        .order("sent_at", { ascending: false });

      if (error) throw error;
      setRecipients((data || []).map(r => ({
        ...r,
        contact: Array.isArray(r.contact) ? r.contact[0] : r.contact
      })) as CampaignRecipient[]);
    } catch (error: any) {
      console.error("Error fetching recipients:", error);
    } finally {
      setLoadingRecipients(false);
    }
  };

  const handleViewDetails = (campaign: Campaign) => {
    setSelectedCampaign(campaign);
    fetchRecipients(campaign.id);
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "sent":
        return <Badge className="bg-green-100 text-green-800">Sent</Badge>;
      case "sending":
        return <Badge className="bg-blue-100 text-blue-800">Sending</Badge>;
      case "draft":
        return <Badge variant="secondary">Draft</Badge>;
      case "failed":
        return <Badge variant="destructive">Failed</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="py-8 text-center">
          <p className="text-muted-foreground">Loading campaigns...</p>
        </CardContent>
      </Card>
    );
  }

  if (campaigns.length === 0) {
    return (
      <Card>
        <CardContent className="py-8 text-center">
          <Mail className="h-12 w-12 mx-auto text-muted-foreground mb-2" />
          <p className="text-muted-foreground">
            No campaigns sent yet. Create your first campaign!
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle>Campaign History</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="divide-y">
            {campaigns.map((campaign) => (
              <div
                key={campaign.id}
                className="py-4 flex flex-col sm:flex-row sm:items-center gap-3"
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <p className="font-medium truncate">{campaign.name}</p>
                    {getStatusBadge(campaign.status)}
                  </div>
                  <p className="text-sm text-muted-foreground truncate">
                    Subject: {campaign.subject}
                  </p>
                  <div className="flex items-center gap-4 mt-1 text-xs text-muted-foreground">
                    <span className="flex items-center gap-1">
                      <Users className="h-3 w-3" />
                      {campaign.sent_count}/{campaign.recipient_count} sent
                    </span>
                    <span className="flex items-center gap-1">
                      <Clock className="h-3 w-3" />
                      {campaign.sent_at 
                        ? format(new Date(campaign.sent_at), "MMM d, yyyy HH:mm")
                        : format(new Date(campaign.created_at), "MMM d, yyyy HH:mm")}
                    </span>
                  </div>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleViewDetails(campaign)}
                >
                  <Eye className="h-4 w-4 mr-2" />
                  Details
                </Button>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <Dialog open={!!selectedCampaign} onOpenChange={() => setSelectedCampaign(null)}>
        <DialogContent className="max-w-2xl max-h-[80vh]">
          <DialogHeader>
            <DialogTitle>{selectedCampaign?.name}</DialogTitle>
          </DialogHeader>

          {selectedCampaign && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-muted-foreground">Subject</p>
                  <p className="font-medium">{selectedCampaign.subject}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Status</p>
                  {getStatusBadge(selectedCampaign.status)}
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Recipients</p>
                  <p className="font-medium">
                    {selectedCampaign.sent_count} / {selectedCampaign.recipient_count}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Sent At</p>
                  <p className="font-medium">
                    {selectedCampaign.sent_at
                      ? format(new Date(selectedCampaign.sent_at), "MMM d, yyyy HH:mm")
                      : "Not sent yet"}
                  </p>
                </div>
              </div>

              <div>
                <p className="text-sm text-muted-foreground mb-2">Recipients</p>
                {loadingRecipients ? (
                  <p className="text-sm text-muted-foreground">Loading...</p>
                ) : (
                  <ScrollArea className="h-64 border rounded-lg">
                    <div className="divide-y">
                      {recipients.map((recipient) => (
                        <div
                          key={recipient.id}
                          className="p-3 flex items-center gap-3"
                        >
                          {recipient.status === "sent" ? (
                            <CheckCircle className="h-4 w-4 text-green-600 shrink-0" />
                          ) : recipient.status === "failed" ? (
                            <XCircle className="h-4 w-4 text-destructive shrink-0" />
                          ) : (
                            <Clock className="h-4 w-4 text-muted-foreground shrink-0" />
                          )}
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium truncate">
                              {recipient.contact?.name || recipient.contact?.email}
                            </p>
                            {recipient.contact?.name && (
                              <p className="text-xs text-muted-foreground truncate">
                                {recipient.contact.email}
                              </p>
                            )}
                            {recipient.error_message && (
                              <p className="text-xs text-destructive">
                                {recipient.error_message}
                              </p>
                            )}
                          </div>
                          <Badge variant="outline" className="text-xs shrink-0">
                            {recipient.status}
                          </Badge>
                        </div>
                      ))}
                    </div>
                  </ScrollArea>
                )}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
};
