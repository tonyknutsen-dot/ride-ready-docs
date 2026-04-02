import { useState, useRef } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { toast } from "sonner";
import { Upload, FileText, Check, AlertCircle, AlertTriangle } from "lucide-react";
import { useAuditLog } from "@/hooks/useAuditLog";

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
  rowNumber: number;
}

interface ValidationError {
  row: number;
  message: string;
}

interface ColumnMapping {
  email: number;
  name: number;
  company_name: number;
  tags: number;
}

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

const KNOWN_HEADERS: Record<string, keyof ColumnMapping> = {
  email: "email",
  "e-mail": "email",
  "email address": "email",
  name: "name",
  "full name": "name",
  "contact name": "name",
  company: "company_name",
  "company name": "company_name",
  "company_name": "company_name",
  organisation: "company_name",
  organization: "company_name",
  tags: "tags",
  tag: "tags",
  categories: "tags",
  category: "tags",
};

function detectColumnMapping(headerRow: string[]): { mapping: ColumnMapping | null; errors: string[] } {
  const errors: string[] = [];
  const mapping: Partial<ColumnMapping> = {};

  for (let i = 0; i < headerRow.length; i++) {
    const normalized = headerRow[i].toLowerCase().trim().replace(/[^a-z_ -]/g, "");
    const field = KNOWN_HEADERS[normalized];
    if (field && mapping[field] === undefined) {
      mapping[field] = i;
    }
  }

  if (mapping.email === undefined) {
    errors.push("Required column 'email' not found. Expected headers: email, e-mail, or email address.");
    return { mapping: null, errors };
  }

  // Report unknown headers
  const mappedIndices = new Set(Object.values(mapping));
  const unmapped = headerRow.filter((_, i) => !mappedIndices.has(i)).map(h => h.trim()).filter(Boolean);
  if (unmapped.length > 0) {
    errors.push(`Unrecognised columns ignored: ${unmapped.join(", ")}`);
  }

  return {
    mapping: {
      email: mapping.email,
      name: mapping.name ?? -1,
      company_name: mapping.company_name ?? -1,
      tags: mapping.tags ?? -1,
    },
    errors,
  };
}

export const CSVImportDialog = ({ open, onOpenChange, onImportComplete }: CSVImportDialogProps) => {
  const { user } = useAuth();
  const { logEvent } = useAuditLog();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [parsedContacts, setParsedContacts] = useState<ParsedContact[]>([]);
  const [validationErrors, setValidationErrors] = useState<ValidationError[]>([]);
  const [headerWarnings, setHeaderWarnings] = useState<string[]>([]);
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState<{ created: number; skipped: number; failed: number } | null>(null);

  const parseCSV = (text: string): { contacts: ParsedContact[]; errors: ValidationError[]; warnings: string[] } => {
    const lines = text.split(/\r?\n/).filter(line => line.trim());
    if (lines.length === 0) return { contacts: [], errors: [{ row: 0, message: "File is empty" }], warnings: [] };

    // Parse first line as headers
    const headerCells = lines[0].split(",").map(v => v.trim().replace(/^["']|["']$/g, ""));
    const firstLineLower = headerCells.map(h => h.toLowerCase());

    // Check if first line looks like headers
    const hasHeaders = firstLineLower.some(h => Object.keys(KNOWN_HEADERS).includes(h.replace(/[^a-z_ -]/g, "")));

    if (!hasHeaders) {
      return {
        contacts: [],
        errors: [{ row: 1, message: "No recognisable column headers found. First row must contain headers including at least 'email'." }],
        warnings: [],
      };
    }

    const { mapping, errors: headerErrors } = detectColumnMapping(headerCells);
    if (!mapping) {
      return { contacts: [], errors: headerErrors.map(msg => ({ row: 1, message: msg })), warnings: [] };
    }

    const contacts: ParsedContact[] = [];
    const errors: ValidationError[] = [];
    const seenEmails = new Set<string>();

    for (let i = 1; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) continue;

      const values = line.split(",").map(v => v.trim().replace(/^["']|["']$/g, ""));
      const rowNum = i + 1;

      const rawEmail = values[mapping.email]?.toLowerCase().trim() || "";

      if (!rawEmail) {
        errors.push({ row: rowNum, message: "Missing email" });
        continue;
      }

      if (!EMAIL_REGEX.test(rawEmail)) {
        errors.push({ row: rowNum, message: `Invalid email format: ${rawEmail}` });
        continue;
      }

      if (seenEmails.has(rawEmail)) {
        errors.push({ row: rowNum, message: `Duplicate email in file: ${rawEmail}` });
        continue;
      }

      seenEmails.add(rawEmail);

      contacts.push({
        email: rawEmail,
        name: mapping.name >= 0 ? values[mapping.name] || undefined : undefined,
        company_name: mapping.company_name >= 0 ? values[mapping.company_name] || undefined : undefined,
        tags: mapping.tags >= 0 && values[mapping.tags]
          ? values[mapping.tags].split(";").map(t => t.trim()).filter(Boolean)
          : undefined,
        rowNumber: rowNum,
      });
    }

    return { contacts, errors, warnings: headerErrors };
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (!selectedFile) return;

    setFile(selectedFile);
    setImportResult(null);

    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result as string;
      const { contacts, errors, warnings } = parseCSV(text);
      setParsedContacts(contacts);
      setValidationErrors(errors);
      setHeaderWarnings(warnings);
    };
    reader.readAsText(selectedFile);
  };

  const handleImport = async () => {
    if (!user || parsedContacts.length === 0) return;

    setImporting(true);
    let created = 0;
    let skipped = 0;
    let failed = 0;

    try {
      // Batch insert in chunks of 50
      const BATCH_SIZE = 50;
      for (let i = 0; i < parsedContacts.length; i += BATCH_SIZE) {
        const batch = parsedContacts.slice(i, i + BATCH_SIZE);
        const rows = batch.map(c => ({
          user_id: user.id,
          email: c.email,
          name: c.name || null,
          company_name: c.company_name || null,
          tags: c.tags || [],
        }));

        // Use upsert with onConflict to skip duplicates cleanly
        const { data, error } = await supabase
          .from("marketing_contacts")
          .upsert(rows, { onConflict: "user_id,email", ignoreDuplicates: true })
          .select("id");

        if (error) {
          console.error("Batch insert error:", error);
          failed += batch.length;
        } else {
          const insertedCount = data?.length || 0;
          created += insertedCount;
          skipped += batch.length - insertedCount;
        }
      }

      setImportResult({ created, skipped, failed });

      // Audit log the import
      logEvent("create", "marketing_contact", undefined, {
        action: "csv_import",
        filename: file?.name || "unknown",
        rows_attempted: parsedContacts.length,
        rows_created: created,
        rows_skipped_duplicate: skipped,
        rows_failed: failed,
        validation_errors: validationErrors.length,
      }, {
        contextHint: "CSV bulk import",
      });

      if (created > 0) {
        toast.success(`Imported ${created} contacts${skipped > 0 ? `, ${skipped} skipped (duplicates)` : ""}`);
        onImportComplete();
      } else if (skipped > 0) {
        toast.info("No new contacts imported — all were duplicates");
      } else {
        toast.error("Import failed — no contacts were created");
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
    setValidationErrors([]);
    setHeaderWarnings([]);
    setImportResult(null);
    onOpenChange(false);
  };

  const hasBlockingErrors = parsedContacts.length === 0 && validationErrors.length > 0;

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-md max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Import Contacts from CSV</DialogTitle>
          <DialogDescription>
            CSV must include an <strong>email</strong> column header. Optional: name, company, tags (semicolon-separated).
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {!file ? (
            <div
              className="border-2 border-dashed rounded-lg p-8 text-center cursor-pointer hover:border-primary transition-colors"
              onClick={() => fileInputRef.current?.click()}
            >
              <Upload className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
              <p className="text-sm text-muted-foreground">Click to upload CSV</p>
              <input
                ref={fileInputRef}
                type="file"
                accept=".csv"
                onChange={handleFileChange}
                className="hidden"
              />
            </div>
          ) : (
            <div className="space-y-3">
              {/* File info */}
              <div className="flex items-center gap-3 p-3 bg-muted rounded-lg">
                <FileText className="h-6 w-6 text-primary shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="font-medium truncate text-sm">{file.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {parsedContacts.length} valid contact{parsedContacts.length !== 1 ? "s" : ""} found
                  </p>
                </div>
              </div>

              {/* Header warnings */}
              {headerWarnings.length > 0 && (
                <div className="p-2.5 rounded-lg bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800">
                  {headerWarnings.map((w, i) => (
                    <p key={i} className="text-xs text-amber-700 dark:text-amber-400 flex items-start gap-1.5">
                      <AlertTriangle className="h-3.5 w-3.5 shrink-0 mt-0.5" />
                      {w}
                    </p>
                  ))}
                </div>
              )}

              {/* Validation errors */}
              {validationErrors.length > 0 && (
                <div className="p-2.5 rounded-lg bg-destructive/10 border border-destructive/20">
                  <p className="text-xs font-medium text-destructive mb-1.5">
                    {validationErrors.length} row{validationErrors.length !== 1 ? "s" : ""} skipped:
                  </p>
                  <div className="max-h-28 overflow-y-auto space-y-0.5">
                    {validationErrors.slice(0, 20).map((err, i) => (
                      <p key={i} className="text-[11px] text-destructive/80">
                        Row {err.row}: {err.message}
                      </p>
                    ))}
                    {validationErrors.length > 20 && (
                      <p className="text-[11px] text-destructive/60">
                        …and {validationErrors.length - 20} more
                      </p>
                    )}
                  </div>
                </div>
              )}

              {/* Preview valid rows */}
              {parsedContacts.length > 0 && (
                <div className="max-h-36 overflow-y-auto border rounded-lg p-2 space-y-0.5">
                  {parsedContacts.slice(0, 8).map((contact, i) => (
                    <div key={i} className="text-xs py-1 px-2 bg-muted/50 rounded">
                      <span className="font-medium">{contact.email}</span>
                      {contact.name && <span className="text-muted-foreground"> — {contact.name}</span>}
                    </div>
                  ))}
                  {parsedContacts.length > 8 && (
                    <p className="text-[11px] text-muted-foreground text-center py-1">
                      +{parsedContacts.length - 8} more
                    </p>
                  )}
                </div>
              )}

              {/* Import result */}
              {importResult && (
                <div className="p-3 rounded-lg bg-muted flex items-start gap-2">
                  {importResult.created > 0 ? (
                    <Check className="h-4 w-4 text-green-600 shrink-0 mt-0.5" />
                  ) : (
                    <AlertCircle className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
                  )}
                  <div className="text-xs space-y-0.5">
                    <p><span className="font-medium">{importResult.created}</span> imported</p>
                    {importResult.skipped > 0 && <p><span className="font-medium">{importResult.skipped}</span> skipped (duplicates)</p>}
                    {importResult.failed > 0 && <p className="text-destructive"><span className="font-medium">{importResult.failed}</span> failed</p>}
                  </div>
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
                disabled={importing || hasBlockingErrors || parsedContacts.length === 0}
              >
                {importing ? "Importing..." : `Import ${parsedContacts.length} Contact${parsedContacts.length !== 1 ? "s" : ""}`}
              </Button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};