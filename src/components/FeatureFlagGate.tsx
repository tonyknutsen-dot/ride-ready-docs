import { ReactNode } from 'react';
import { usePlatformSettings } from '@/hooks/usePlatformSettings';
import { AlertTriangle } from 'lucide-react';

interface FeatureFlagGateProps {
  flagKey: string;
  children: ReactNode;
  /** Message shown when disabled. Defaults to generic wording. */
  disabledMessage?: string;
  /** If true, render nothing instead of a disabled message */
  hideWhenDisabled?: boolean;
}

/**
 * Renders children only when the given platform setting flag is enabled ('true').
 * Shows a disabled message otherwise.
 */
export const FeatureFlagGate = ({
  flagKey,
  children,
  disabledMessage,
  hideWhenDisabled = false,
}: FeatureFlagGateProps) => {
  const { isOn, isLoading } = usePlatformSettings();

  // While loading, render nothing to avoid flash
  if (isLoading) return null;

  if (!isOn(flagKey)) {
    if (hideWhenDisabled) return null;
    return (
      <div className="flex flex-col items-center justify-center py-20 px-4 text-center">
        <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center mb-4">
          <AlertTriangle className="h-6 w-6 text-muted-foreground" />
        </div>
        <h2 className="text-lg font-semibold mb-1">Feature Disabled</h2>
        <p className="text-sm text-muted-foreground max-w-md">
          {disabledMessage || 'This feature is currently disabled in Platform Settings.'}
        </p>
      </div>
    );
  }

  return <>{children}</>;
};

export default FeatureFlagGate;
