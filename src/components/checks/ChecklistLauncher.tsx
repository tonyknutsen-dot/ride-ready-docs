import { Download, FileText, MoreVertical, PlayCircle, Settings } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { EmptyState } from '@/components/EmptyState';
import DefectReportDialog from '@/components/DefectReportDialog';
import DefectsList from '@/components/DefectsList';

interface ChecklistLauncherProps {
  rideId: string;
  rideName: string;
  frequency: string;
  frequencyLabel: string;
  templateName: string | null;
  itemCount: number;
  lastCompletedDate?: string | null;
  isStaff: boolean;
  defectRefreshKey: number;
  onBuildTemplate: () => void;
  onEditTemplate: () => void;
  onExportTemplate: () => void;
  onStartCheck: () => void;
  onDefectRefresh: () => void;
}

export function ChecklistLauncher({
  rideId,
  rideName,
  frequency,
  frequencyLabel,
  templateName,
  itemCount,
  lastCompletedDate,
  isStaff,
  defectRefreshKey,
  onBuildTemplate,
  onEditTemplate,
  onExportTemplate,
  onStartCheck,
  onDefectRefresh,
}: ChecklistLauncherProps) {
  if (!templateName) {
    if (isStaff) {
      return (
        <EmptyState
          icon={FileText}
          title="No Checklist Available"
          description={`No ${frequency === 'preopening' ? 'pre-opening' : frequency} checklist has been set up for this equipment yet. Please contact your controller.`}
        />
      );
    }

    return (
      <EmptyState
        icon={FileText}
        title="No Checklist Found"
        description={`Build your ${frequency === 'preopening' ? 'pre-opening' : frequency} checklist to start recording checks.`}
        actionLabel="Build Checklist"
        onAction={onBuildTemplate}
      />
    );
  }

  return (
    <div id="inspection-checklist-launcher" className="checksWrap -mx-4 px-4 pb-6 pt-2 space-y-3">
      <div className="space-y-3">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <h2 className="text-[15px] font-semibold text-foreground leading-tight truncate">
              {templateName}
            </h2>
            <p className="text-[11px] font-normal text-muted-foreground mt-0.5">Routine: {frequencyLabel}</p>
          </div>
          {!isStaff && (
            <Button variant="outline" size="sm" onClick={onEditTemplate} className="h-8 gap-1.5 text-[12px] shrink-0">
              <Settings className="h-3.5 w-3.5" />
              Edit Checklist
            </Button>
          )}
          {!isStaff && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0">
                  <MoreVertical className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={onEditTemplate}>
                  <Settings className="h-4 w-4 mr-2" />
                  Edit Checklist
                </DropdownMenuItem>
                <DropdownMenuItem onClick={onExportTemplate}>
                  <Download className="h-4 w-4 mr-2" />
                  Export PDF
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>

        <button className="t-btn-primary w-full py-3.5 text-sm" type="button" onClick={onStartCheck}>
          <PlayCircle className="h-4 w-4 shrink-0" />
          Start Check
        </button>

        <p className="text-[10px] text-center text-muted-foreground">
          {itemCount} items{lastCompletedDate ? ` • Last completed ${lastCompletedDate}` : ''}
        </p>
      </div>

      <div className="flex items-center justify-between">
        <p className="text-[11px] font-medium text-muted-foreground">Open defects</p>
        <DefectReportDialog
          rideId={rideId}
          rideName={rideName}
          checkFrequency={frequency}
          onDefectReported={onDefectRefresh}
          trigger={
            <button type="button" className="text-[11px] font-semibold text-primary hover:underline">
              + Raise
            </button>
          }
        />
      </div>
      <DefectsList
        key={defectRefreshKey}
        rideId={rideId}
        rideName={rideName}
        showResolved={false}
        onDefectUpdated={onDefectRefresh}
      />

      <div className="rounded-md border border-border bg-card p-3 text-sm text-muted-foreground">
        Saved check records are reviewed from the Check Records area after completion.
      </div>
    </div>
  );
}

export default ChecklistLauncher;