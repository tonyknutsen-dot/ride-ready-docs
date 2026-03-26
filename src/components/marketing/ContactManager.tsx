import { useState, useEffect, useCallback } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import { Plus, Upload, Search, Trash2, Edit, Mail, MailX, Users } from "lucide-react";
import { CSVImportDialog } from "./CSVImportDialog";
import { useAuditLog } from "@/hooks/useAuditLog";

interface MarketingContact {
  id: string;
  email: string;
  name: string | null;
  company_name: string | null;
  notes: string | null;
  tags: string[];
  is_subscribed: boolean;
  created_at: string;
  unsubscribed_at: string | null;
}

export const ContactManager = () => {
  const { user } = useAuth();
  const [contacts, setContacts] = useState<MarketingContact[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [showImportDialog, setShowImportDialog] = useState(false);
  const [editingContact, setEditingContact] = useState<MarketingContact | null>(null);
  const [formData, setFormData] = useState({
    email: "",
    name: "",
    company_name: "",
    notes: "",
    tags: "",
  });

  const fetchContacts = useCallback(async () => {
    if (!user) return;

    try {
      const { data, error } = await supabase
        .from("marketing_contacts")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false });

      if (error) throw error;
      setContacts(data || []);
    } catch (error: any) {
      console.error("Error fetching contacts:", error);
      toast.error("Failed to load contacts");
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    fetchContacts();
  }, [fetchContacts]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    try {
      const tagsArray = formData.tags
        .split(",")
        .map((tag) => tag.trim())
        .filter((tag) => tag.length > 0);

      const contactData = {
        user_id: user.id,
        email: formData.email.trim().toLowerCase(),
        name: formData.name.trim() || null,
        company_name: formData.company_name.trim() || null,
        notes: formData.notes.trim() || null,
        tags: tagsArray,
      };

      if (editingContact) {
        const { error } = await supabase
          .from("marketing_contacts")
          .update(contactData)
          .eq("id", editingContact.id);

        if (error) throw error;
        toast.success("Contact updated successfully");
      } else {
        const { error } = await supabase
          .from("marketing_contacts")
          .insert(contactData);

        if (error) {
          if (error.code === "23505") {
            toast.error("A contact with this email already exists");
            return;
          }
          throw error;
        }
        toast.success("Contact added successfully");
      }

      setFormData({ email: "", name: "", company_name: "", notes: "", tags: "" });
      setEditingContact(null);
      setShowAddDialog(false);
      fetchContacts();
    } catch (error: any) {
      console.error("Error saving contact:", error);
      toast.error("Failed to save contact");
    }
  };

  const handleEdit = (contact: MarketingContact) => {
    setEditingContact(contact);
    setFormData({
      email: contact.email,
      name: contact.name || "",
      company_name: contact.company_name || "",
      notes: contact.notes || "",
      tags: contact.tags?.join(", ") || "",
    });
    setShowAddDialog(true);
  };

  const handleDelete = async (contactId: string) => {
    try {
      const { error } = await supabase
        .from("marketing_contacts")
        .delete()
        .eq("id", contactId);

      if (error) throw error;
      toast.success("Contact deleted");
      fetchContacts();
    } catch (error: any) {
      console.error("Error deleting contact:", error);
      toast.error("Failed to delete contact");
    }
  };

  const handleResubscribe = async (contactId: string) => {
    try {
      const { error } = await supabase
        .from("marketing_contacts")
        .update({ is_subscribed: true, unsubscribed_at: null })
        .eq("id", contactId);

      if (error) throw error;
      toast.success("Contact resubscribed");
      fetchContacts();
    } catch (error: any) {
      console.error("Error resubscribing:", error);
      toast.error("Failed to resubscribe contact");
    }
  };

  const filteredContacts = contacts.filter((contact) => {
    const query = searchQuery.toLowerCase();
    return (
      contact.email.toLowerCase().includes(query) ||
      contact.name?.toLowerCase().includes(query) ||
      contact.company_name?.toLowerCase().includes(query) ||
      contact.tags?.some((tag) => tag.toLowerCase().includes(query))
    );
  });

  const subscribedCount = contacts.filter((c) => c.is_subscribed).length;
  const unsubscribedCount = contacts.filter((c) => !c.is_subscribed).length;

  if (loading) {
    return (
      <Card>
        <CardContent className="py-8 text-center">
          <p className="text-muted-foreground">Loading contacts...</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        <Card>
          <CardContent className="py-4 text-center">
            <Users className="h-6 w-6 mx-auto text-primary mb-1" />
            <p className="text-2xl font-bold">{contacts.length}</p>
            <p className="text-xs text-muted-foreground">Total Contacts</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="py-4 text-center">
            <Mail className="h-6 w-6 mx-auto text-green-600 mb-1" />
            <p className="text-2xl font-bold">{subscribedCount}</p>
            <p className="text-xs text-muted-foreground">Subscribed</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="py-4 text-center">
            <MailX className="h-6 w-6 mx-auto text-destructive mb-1" />
            <p className="text-2xl font-bold">{unsubscribedCount}</p>
            <p className="text-xs text-muted-foreground">Unsubscribed</p>
          </CardContent>
        </Card>
      </div>

      {/* Actions */}
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search contacts..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
          />
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setShowImportDialog(true)}>
            <Upload className="h-4 w-4 mr-2" />
            Import CSV
          </Button>
          <Dialog open={showAddDialog} onOpenChange={(open) => {
            setShowAddDialog(open);
            if (!open) {
              setEditingContact(null);
              setFormData({ email: "", name: "", company_name: "", notes: "", tags: "" });
            }
          }}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="h-4 w-4 mr-2" />
                Add Contact
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>{editingContact ? "Edit Contact" : "Add Contact"}</DialogTitle>
              </DialogHeader>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <Label htmlFor="email">Email *</Label>
                  <Input
                    id="email"
                    type="email"
                    required
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    placeholder="john@example.com"
                  />
                </div>
                <div>
                  <Label htmlFor="name">Name</Label>
                  <Input
                    id="name"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    placeholder="John Smith"
                  />
                </div>
                <div>
                  <Label htmlFor="company_name">Company</Label>
                  <Input
                    id="company_name"
                    value={formData.company_name}
                    onChange={(e) => setFormData({ ...formData, company_name: e.target.value })}
                    placeholder="Smith's Amusements"
                  />
                </div>
                <div>
                  <Label htmlFor="tags">Tags (comma-separated)</Label>
                  <Input
                    id="tags"
                    value={formData.tags}
                    onChange={(e) => setFormData({ ...formData, tags: e.target.value })}
                    placeholder="showman, uk, regular"
                  />
                </div>
                <div>
                  <Label htmlFor="notes">Notes</Label>
                  <Textarea
                    id="notes"
                    value={formData.notes}
                    onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                    placeholder="Any additional notes..."
                    rows={3}
                  />
                </div>
                <div className="flex gap-2 justify-end">
                  <Button type="button" variant="outline" onClick={() => setShowAddDialog(false)}>
                    Cancel
                  </Button>
                  <Button type="submit">
                    {editingContact ? "Update" : "Add"} Contact
                  </Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Contact List */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Contacts ({filteredContacts.length})</CardTitle>
        </CardHeader>
        <CardContent>
          {filteredContacts.length === 0 ? (
            <div className="text-center py-8">
              <Users className="h-12 w-12 mx-auto text-muted-foreground mb-2" />
              <p className="text-muted-foreground">
                {contacts.length === 0 
                  ? "No contacts yet. Add your first contact or import from CSV."
                  : "No contacts match your search."}
              </p>
            </div>
          ) : (
            <div className="divide-y">
              {filteredContacts.map((contact) => (
                <div
                  key={contact.id}
                  className={`py-3 flex flex-col sm:flex-row sm:items-center gap-2 ${
                    !contact.is_subscribed ? "opacity-60" : ""
                  }`}
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="font-medium truncate">
                        {contact.name || contact.email}
                      </p>
                      {!contact.is_subscribed && (
                        <Badge variant="destructive" className="text-xs">Unsubscribed</Badge>
                      )}
                    </div>
                    {contact.name && (
                      <p className="text-sm text-muted-foreground truncate">{contact.email}</p>
                    )}
                    {contact.company_name && (
                      <p className="text-sm text-muted-foreground truncate">{contact.company_name}</p>
                    )}
                    {contact.tags && contact.tags.length > 0 && (
                      <div className="flex flex-wrap gap-1 mt-1">
                        {contact.tags.map((tag) => (
                          <Badge key={tag} variant="secondary" className="text-xs">
                            {tag}
                          </Badge>
                        ))}
                      </div>
                    )}
                  </div>
                  <div className="flex gap-2 shrink-0">
                    {!contact.is_subscribed && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleResubscribe(contact.id)}
                      >
                        Resubscribe
                      </Button>
                    )}
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleEdit(contact)}
                    >
                      <Edit className="h-4 w-4" />
                    </Button>
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button variant="ghost" size="icon">
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Delete Contact</AlertDialogTitle>
                          <AlertDialogDescription>
                            Are you sure you want to delete this contact? This action cannot be undone.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancel</AlertDialogCancel>
                          <AlertDialogAction onClick={() => handleDelete(contact.id)}>
                            Delete
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <CSVImportDialog
        open={showImportDialog}
        onOpenChange={setShowImportDialog}
        onImportComplete={fetchContacts}
      />
    </div>
  );
};
