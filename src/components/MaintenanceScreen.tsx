import { Wrench } from 'lucide-react';

interface MaintenanceScreenProps {
  message?: string;
}

/**
 * Full-screen maintenance interstitial shown to non-admin users
 * when maintenance_mode is enabled in Platform Settings.
 */
export const MaintenanceScreen = ({ message }: MaintenanceScreenProps) => {
  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-6">
      <div className="text-center max-w-md space-y-4">
        <div className="mx-auto w-16 h-16 rounded-full bg-muted flex items-center justify-center">
          <Wrench className="h-8 w-8 text-muted-foreground" />
        </div>
        <h1 className="text-2xl font-bold text-foreground">
          We'll be back shortly
        </h1>
        <p className="text-muted-foreground leading-relaxed">
          {message || 'We are performing scheduled maintenance. Please check back soon.'}
        </p>
        <p className="text-xs text-muted-foreground/60 mt-6">
          If you need urgent assistance, please contact support.
        </p>
      </div>
    </div>
  );
};

export default MaintenanceScreen;
