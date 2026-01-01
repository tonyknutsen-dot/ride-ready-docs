import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { AlertTriangle, Download, Loader2, CheckSquare, Wrench, Calendar, ClipboardList, FileWarning, Trash2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface DataCounts {
  checks: number;
  riskAssessments: number;
  maintenanceRecords: number;
  ndtReports: number;
  annualInspections: number;
  inspectionSchedules: number;
}

interface DowngradeConfirmationDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirmDowngrade: () => Promise<void>;
}

export function DowngradeConfirmationDialog({
  open,
  onOpenChange,
  onConfirmDowngrade,
}: DowngradeConfirmationDialogProps) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);
  const [downgrading, setDowngrading] = useState(false);
  const [dataCounts, setDataCounts] = useState<DataCounts | null>(null);
  const [hasExported, setHasExported] = useState(false);
  const [acknowledged, setAcknowledged] = useState(false);

  useEffect(() => {
    if (open && user) {
      fetchDataCounts();
      setHasExported(false);
      setAcknowledged(false);
    }
  }, [open, user]);

  const fetchDataCounts = async () => {
    if (!user) return;
    setLoading(true);

    try {
      const [checks, riskAssessments, maintenance, ndt, annual, schedules] = await Promise.all([
        supabase.from("checks").select("id", { count: "exact", head: true }).eq("user_id", user.id),
        supabase.from("risk_assessments").select("id", { count: "exact", head: true }).eq("user_id", user.id),
        supabase.from("maintenance_records").select("id", { count: "exact", head: true }).eq("user_id", user.id),
        supabase.from("ndt_reports").select("id", { count: "exact", head: true }).eq("user_id", user.id),
        supabase.from("annual_inspection_reports").select("id", { count: "exact", head: true }).eq("user_id", user.id),
        supabase.from("inspection_schedules").select("id", { count: "exact", head: true }).eq("user_id", user.id),
      ]);

      setDataCounts({
        checks: checks.count || 0,
        riskAssessments: riskAssessments.count || 0,
        maintenanceRecords: maintenance.count || 0,
        ndtReports: ndt.count || 0,
        annualInspections: annual.count || 0,
        inspectionSchedules: schedules.count || 0,
      });
    } catch (error) {
      console.error("Error fetching data counts:", error);
    } finally {
      setLoading(false);
    }
  };

  const totalRecords = dataCounts
    ? dataCounts.checks +
      dataCounts.riskAssessments +
      dataCounts.maintenanceRecords +
      dataCounts.ndtReports +
      dataCounts.annualInspections +
      dataCounts.inspectionSchedules
    : 0;

  const exportAllData = async () => {
    if (!user) return;
    setExporting(true);

    try {
      // Fetch all data
      const [checks, checkResults, riskAssessments, riskItems, maintenance, ndt, annual, schedules, templates] = await Promise.all([
        supabase.from("checks").select("*").eq("user_id", user.id),
        supabase.from("check_results").select("*, checks!inner(user_id)").eq("checks.user_id", user.id),
        supabase.from("risk_assessments").select("*").eq("user_id", user.id),
        supabase.from("risk_assessment_items").select("*, risk_assessments!inner(user_id)").eq("risk_assessments.user_id", user.id),
        supabase.from("maintenance_records").select("*").eq("user_id", user.id),
        supabase.from("ndt_reports").select("*").eq("user_id", user.id),
        supabase.from("annual_inspection_reports").select("*").eq("user_id", user.id),
        supabase.from("inspection_schedules").select("*").eq("user_id", user.id),
        supabase.from("daily_check_templates").select("*, daily_check_template_items(*)").eq("user_id", user.id),
      ]);

      const exportData = {
        exportedAt: new Date().toISOString(),
        userId: user.id,
        data: {
          checks: checks.data || [],
          checkResults: checkResults.data || [],
          riskAssessments: riskAssessments.data || [],
          riskAssessmentItems: riskItems.data || [],
          maintenanceRecords: maintenance.data || [],
          ndtReports: ndt.data || [],
          annualInspectionReports: annual.data || [],
          inspectionSchedules: schedules.data || [],
          checkTemplates: templates.data || [],
        },
      };

      // Create and download JSON file
      const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `operations-data-export-${new Date().toISOString().split("T")[0]}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      setHasExported(true);
      toast({
        title: "Data exported successfully",
        description: "Your operations data has been downloaded. Please keep this file safe.",
      });
    } catch (error) {
      console.error("Error exporting data:", error);
      toast({
        title: "Export failed",
        description: "There was an error exporting your data. Please try again.",
        variant: "destructive",
      });
    } finally {
      setExporting(false);
    }
  };

  const handleConfirmDowngrade = async () => {
    if (!acknowledged) return;
    setDowngrading(true);

    try {
      // Delete all operations data
      if (user) {
        await Promise.all([
          supabase.from("check_results").delete().in(
            "check_id",
            (await supabase.from("checks").select("id").eq("user_id", user.id)).data?.map((c) => c.id) || []
          ),
          supabase.from("checks").delete().eq("user_id", user.id),
          supabase.from("risk_assessment_items").delete().in(
            "risk_assessment_id",
            (await supabase.from("risk_assessments").select("id").eq("user_id", user.id)).data?.map((r) => r.id) || []
          ),
          supabase.from("risk_assessments").delete().eq("user_id", user.id),
          supabase.from("maintenance_records").delete().eq("user_id", user.id),
          supabase.from("ndt_reports").delete().eq("user_id", user.id),
          supabase.from("annual_inspection_reports").delete().eq("user_id", user.id),
          supabase.from("inspection_schedules").delete().eq("user_id", user.id),
          supabase.from("daily_check_template_items").delete().in(
            "template_id",
            (await supabase.from("daily_check_templates").select("id").eq("user_id", user.id)).data?.map((t) => t.id) || []
          ),
          supabase.from("daily_check_templates").delete().eq("user_id", user.id),
        ]);
      }

      await onConfirmDowngrade();
      onOpenChange(false);
    } catch (error) {
      console.error("Error during downgrade:", error);
      toast({
        title: "Downgrade failed",
        description: "There was an error processing your downgrade. Please try again.",
        variant: "destructive",
      });
    } finally {
      setDowngrading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-destructive">
            <AlertTriangle className="h-5 w-5" />
            Downgrade to Documents Plan
          </DialogTitle>
          <DialogDescription>
            This action will permanently delete your Operations & Maintenance data.
          </DialogDescription>
        </DialogHeader>

        <ScrollArea className="max-h-[60vh]">
          <div className="space-y-4 pr-4">
            {/* Critical Warning */}
            <Alert variant="destructive">
              <FileWarning className="h-4 w-4" />
              <AlertTitle>Data will be permanently deleted</AlertTitle>
              <AlertDescription>
                When you downgrade, all Operations & Maintenance data will be permanently removed from your account. This cannot be undone.
              </AlertDescription>
            </Alert>

            {/* Data Summary */}
            {loading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : dataCounts && totalRecords > 0 ? (
              <div className="space-y-3">
                <div className="font-medium text-sm">Data that will be deleted:</div>
                <div className="grid gap-2">
                  {dataCounts.checks > 0 && (
                    <div className="flex items-center justify-between text-sm p-2 bg-destructive/5 rounded border border-destructive/20">
                      <div className="flex items-center gap-2">
                        <CheckSquare className="h-4 w-4 text-destructive" />
                        <span>Safety Checks</span>
                      </div>
                      <Badge variant="destructive">{dataCounts.checks} records</Badge>
                    </div>
                  )}
                  {dataCounts.riskAssessments > 0 && (
                    <div className="flex items-center justify-between text-sm p-2 bg-destructive/5 rounded border border-destructive/20">
                      <div className="flex items-center gap-2">
                        <ClipboardList className="h-4 w-4 text-destructive" />
                        <span>Risk Assessments</span>
                      </div>
                      <Badge variant="destructive">{dataCounts.riskAssessments} records</Badge>
                    </div>
                  )}
                  {dataCounts.maintenanceRecords > 0 && (
                    <div className="flex items-center justify-between text-sm p-2 bg-destructive/5 rounded border border-destructive/20">
                      <div className="flex items-center gap-2">
                        <Wrench className="h-4 w-4 text-destructive" />
                        <span>Maintenance Records</span>
                      </div>
                      <Badge variant="destructive">{dataCounts.maintenanceRecords} records</Badge>
                    </div>
                  )}
                  {dataCounts.ndtReports > 0 && (
                    <div className="flex items-center justify-between text-sm p-2 bg-destructive/5 rounded border border-destructive/20">
                      <div className="flex items-center gap-2">
                        <FileWarning className="h-4 w-4 text-destructive" />
                        <span>NDT Reports</span>
                      </div>
                      <Badge variant="destructive">{dataCounts.ndtReports} records</Badge>
                    </div>
                  )}
                  {dataCounts.annualInspections > 0 && (
                    <div className="flex items-center justify-between text-sm p-2 bg-destructive/5 rounded border border-destructive/20">
                      <div className="flex items-center gap-2">
                        <Calendar className="h-4 w-4 text-destructive" />
                        <span>Annual Inspections</span>
                      </div>
                      <Badge variant="destructive">{dataCounts.annualInspections} records</Badge>
                    </div>
                  )}
                  {dataCounts.inspectionSchedules > 0 && (
                    <div className="flex items-center justify-between text-sm p-2 bg-destructive/5 rounded border border-destructive/20">
                      <div className="flex items-center gap-2">
                        <Calendar className="h-4 w-4 text-destructive" />
                        <span>Inspection Schedules</span>
                      </div>
                      <Badge variant="destructive">{dataCounts.inspectionSchedules} records</Badge>
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <div className="text-sm text-muted-foreground text-center py-4">
                You have no Operations & Maintenance data to delete.
              </div>
            )}

            <Separator />

            {/* Export Button */}
            {totalRecords > 0 && (
              <div className="space-y-3">
                <div className="text-sm font-medium">Step 1: Download your data</div>
                <Button
                  onClick={exportAllData}
                  disabled={exporting}
                  variant={hasExported ? "outline" : "default"}
                  className="w-full"
                >
                  {exporting ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <Download className="h-4 w-4 mr-2" />
                  )}
                  {hasExported ? "Download Again" : "Download All Operations Data"}
                </Button>
                {hasExported && (
                  <div className="flex items-center gap-2 text-sm text-green-600">
                    <CheckSquare className="h-4 w-4" />
                    Data exported successfully
                  </div>
                )}
              </div>
            )}

            <Separator />

            {/* Acknowledgment */}
            <div className="space-y-3">
              <div className="text-sm font-medium">
                {totalRecords > 0 ? "Step 2: Confirm deletion" : "Confirm downgrade"}
              </div>
              <div className="flex items-start gap-3 p-3 bg-muted/50 rounded-lg">
                <Checkbox
                  id="acknowledge"
                  checked={acknowledged}
                  onCheckedChange={(checked) => setAcknowledged(checked === true)}
                />
                <label htmlFor="acknowledge" className="text-sm leading-relaxed cursor-pointer">
                  {totalRecords > 0
                    ? "I understand that all my Operations & Maintenance data will be permanently deleted and cannot be recovered."
                    : "I understand that I will lose access to Operations & Maintenance features."}
                </label>
              </div>
            </div>
          </div>
        </ScrollArea>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={downgrading}>
            Cancel
          </Button>
          <Button
            variant="destructive"
            onClick={handleConfirmDowngrade}
            disabled={!acknowledged || downgrading || (totalRecords > 0 && !hasExported)}
          >
            {downgrading ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <Trash2 className="h-4 w-4 mr-2" />
            )}
            {totalRecords > 0 ? "Delete Data & Downgrade" : "Confirm Downgrade"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
