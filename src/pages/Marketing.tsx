import { useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import AppHeader from "@/components/AppHeader";
import MobileBottomNav from "@/components/MobileBottomNav";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ContactManager } from "@/components/marketing/ContactManager";
import { CampaignBuilder } from "@/components/marketing/CampaignBuilder";
import { CampaignHistory } from "@/components/marketing/CampaignHistory";
import { Users, Mail, History } from "lucide-react";

const Marketing = () => {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState("contacts");

  if (!user) {
    return null;
  }

  return (
    <div className="min-h-screen bg-background pb-20 md:pb-0">
      <AppHeader />
      
      <main className="container mx-auto px-4 py-6 max-w-6xl">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-foreground">Marketing</h1>
          <p className="text-muted-foreground">
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
      </main>

      <MobileBottomNav />
    </div>
  );
};

export default Marketing;
