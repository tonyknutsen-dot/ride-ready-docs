import { Info } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { APP_NAME, APP_VERSION, formatVersionDate, getLastUpdateDate } from "@/config/appVersion";

interface AboutAppDialogProps {
  trigger?: React.ReactNode;
}

const AboutAppDialog = ({ trigger }: AboutAppDialogProps) => {
  return (
    <Dialog>
      <DialogTrigger asChild>
        {trigger || (
          <Button variant="ghost" size="sm" className="gap-2">
            <Info className="h-4 w-4" />
            About
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Info className="h-5 w-5 text-primary" />
            App Information
          </DialogTitle>
          <DialogDescription>
            Version details for testing and bug reporting
          </DialogDescription>
        </DialogHeader>
        
        <div className="space-y-4">
          {/* App Info */}
          <div className="p-4 rounded-lg bg-secondary/50 border border-border space-y-3">
            <div className="flex justify-between items-center">
              <span className="text-sm text-muted-foreground">App Name</span>
              <span className="text-sm font-medium">{APP_NAME}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm text-muted-foreground">Version</span>
              <span className="text-sm font-mono font-bold text-primary">{APP_VERSION}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm text-muted-foreground">Last Update</span>
              <span className="text-sm">{formatVersionDate(getLastUpdateDate())}</span>
            </div>
          </div>

          {/* Tester Note */}
          <p className="text-xs text-muted-foreground text-center">
            When reporting issues, please include the version number: <span className="font-mono font-bold">{APP_VERSION}</span>
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default AboutAppDialog;
