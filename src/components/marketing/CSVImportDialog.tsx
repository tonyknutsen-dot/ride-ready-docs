import { useState, useRef } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { toast } from "sonner";
import { Upload, FileText, Check, AlertCircle } from "lucide-react";

interface CSVImportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onImportComplete: () => void;
}

interface ParsedContact {
  email: string;
  name?: string;
  company_name?: string;
  tags?: string[];
}

export const CSVImportDialog = ({ open, onOpenChange, onImportComplete }: CSVImportDialogProps) => {
  const { user } = useAuth();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [parsedContacts, setParsedContacts] = useState<ParsedContact[]>([]);
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState<{ success: number; skipped: number } | null>(null);

  const parseCSV = (text: string): ParsedContact[] => {
    const lines = text.split("\n").filter(line => line.trim());
    if (lines.length === 0) return [];

    // Try to detect headers
    const firstLine = lines[0].toLowerCase();
    const hasHeaders = firstLine.includes("email") || firstLine.includes("name");
    const startIndex = hasHeaders ? 1 : 0;

    const contacts: ParsedContact[] = [];

    for (let i = startIndex; i < lines.length; i++) {
      const values = lines[i].split(",").map(v => v.trim().replace(/^["']|["']$/g, ""));
      
      if (values.length === 0 || !values[0]) continue;

      // Assume first column is email, second is name, third is company, fourth is tags
      const email = values[0]?.toLowerCase();
      if (!email || !email.includes("@")) continue;

      contacts.push({
        email,
        name: values[1] || undefined,
        company_name: values[2] || undefined,
        tags: values[3] ? values[3].split(";").map(t => t.trim()).filter(t => t) : undefined,
      });
    }

    return contacts;
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (!selectedFile) return;

    setFile(selectedFile);
    setImportResult(null);

    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result as string;
      const contacts = parseCSV(text);
      setParsedContacts(contacts);
    };
    reader.readAsText(selectedFile);
  };

  const handleImport = async () => {
    if (!user || parsedContacts.length === 0) return;

    setImporting(true);
    let success = 0;
    let skipped = 0;

    try {
      for (const contact of parsedContacts) {
        const { error } = await supabase
          .from("marketing_contacts")
          .insert({
            user_id: user.id,
            email: contact.email,
            name: contact.name || null,
            company_name: contact.company_name || null,
            tags: contact.tags || [],
          });

        if (error) {
          if (error.code === "23505") {
            skipped++;
          } else {
            console.error("Error inserting contact:", error);
            skipped++;
          }
        } else {
          success++;
        }
      }

      setImportResult({ success, skipped });
      
      if (success > 0) {
        toast.success(`Imported ${success} contacts${skipped > 0 ? `, ${skipped} skipped (duplicates)` : ""}`);
        onImportComplete();
      } else {
        toast.info("No new contacts imported (all were duplicates)");
      }
    } catch (error: any) {
      console.error("Import error:", error);
      toast.error("Failed to import contacts");
    } finally {
      setImporting(false);
    }
  };

  const handleClose = () => {
    setFile(null);
    setParsedContacts([]);
    setImportResult(null);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Import Contacts from CSV</DialogTitle>
          <DialogDescription>
            Upload a CSV file with columns: email, name, company, tags (separated by semicolon)
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {!file ? (
            <div
              className="border-2 border-dashed rounded-lg p-8 text-center cursor-pointer hover:border-primary transition-colors"
              onClick={() => fileInputRef.current?.click()}
            >
              <Upload className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
              <p className="text-sm text-muted-foreground">
                Click to upload or drag and drop
              </p>
              <p className="text-xs text-muted-foreground mt-1">CSV files only</p>
              <input
                ref={fileInputRef}
                type="file"
                accept=".csv"
                onChange={handleFileChange}
                className="hidden"
              />
            </div>
          ) : (
            <div className="space-y-4">
              <div className="flex items-center gap-3 p-3 bg-muted rounded-lg">
                <FileText className="h-8 w-8 text-primary" />
                <div className="flex-1 min-w-0">
                  <p className="font-medium truncate">{file.name}</p>
                  <p className="text-sm text-muted-foreground">
                    {parsedContacts.length} contacts found
                  </p>
                </div>
              </div>

              {parsedContacts.length > 0 && (
                <div className="max-h-48 overflow-y-auto border rounded-lg p-2 space-y-1">
                  {parsedContacts.slice(0, 10).map((contact, i) => (
                    <div key={i} className="text-sm py-1 px-2 bg-muted/50 rounded">
                      <span className="font-medium">{contact.email}</span>
                      {contact.name && <span className="text-muted-foreground"> - {contact.name}</span>}
                    </div>
                  ))}
                  {parsedContacts.length > 10 && (
                    <p className="text-sm text-muted-foreground text-center py-1">
                      ... and {parsedContacts.length - 10} more
                    </p>
                  )}
                </div>
              )}

              {importResult && (
                <div className="p-3 rounded-lg bg-muted flex items-center gap-2">
                  {importResult.success > 0 ? (
                    <Check className="h-5 w-5 text-green-600" />
                  ) : (
                    <AlertCircle className="h-5 w-5 text-amber-600" />
                  )}
                  <span className="text-sm">
                    {importResult.success} imported, {importResult.skipped} skipped
                  </span>
                </div>
              )}
            </div>
          )}

          <div className="flex gap-2 justify-end">
            <Button variant="outline" onClick={handleClose}>
              {importResult ? "Done" : "Cancel"}
            </Button>
            {file && !importResult && (
              <Button 
                onClick={handleImport} 
                disabled={importing || parsedContacts.length === 0}
              >
                {importing ? "Importing..." : `Import ${parsedContacts.length} Contacts`}
              </Button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
