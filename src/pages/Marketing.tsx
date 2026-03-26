import { useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { AdminLayout } from "@/components/admin/AdminLayout";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ContactManager } from "@/components/marketing/ContactManager";
import { CampaignBuilder } from "@/components/marketing/CampaignBuilder";
import { CampaignHistory } from "@/components/marketing/CampaignHistory";
import { Users, Mail, History, Megaphone } from "lucide-react";

const Marketing = () => {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState("contacts");

  if (!user) {
    return null;
  }

  return (
    <AdminLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-xl md:text-2xl font-bold flex items-center gap-2">
            <Megaphone className="h-5 w-5 md:h-6 md:w-6 text-primary" />
            Marketing Campaigns
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Manage contacts and send email campaigns to your clients
          </p>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          <TabsList className="grid w-full grid-cols-3 max-w-md">
            <TabsTrigger value="contacts" className="flex items-center gap-2">
              <Users className="h-4 w-4" />
              <span className="hidden sm:inline">Contacts</span>
            </TabsTrigger>
            <TabsTrigger value="campaigns" className="flex items-center gap-2">
              <Mail className="h-4 w-4" />
              <span className="hidden sm:inline">Campaigns</span>
            </TabsTrigger>
            <TabsTrigger value="history" className="flex items-center gap-2">
              <History className="h-4 w-4" />
              <span className="hidden sm:inline">History</span>
            </TabsTrigger>
          </TabsList>

          <TabsContent value="contacts">
            <ContactManager />
          </TabsContent>

          <TabsContent value="campaigns">
            <CampaignBuilder onCampaignSent={() => setActiveTab("history")} />
          </TabsContent>

          <TabsContent value="history">
            <CampaignHistory />
          </TabsContent>
        </Tabs>
      </div>
    </AdminLayout>
  );
};

export default Marketing;
