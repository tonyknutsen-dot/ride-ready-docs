import { LucideIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface EmptyStateProps {
  icon: LucideIcon;
  title: string;
  description: string;
  actionLabel?: string;
  onAction?: () => void;
  secondaryActionLabel?: string;
  onSecondaryAction?: () => void;
  variant?: 'default' | 'compact';
}

export const EmptyState = ({
  icon: Icon,
  title,
  description,
  actionLabel,
  onAction,
  secondaryActionLabel,
  onSecondaryAction,
  variant = 'default',
}: EmptyStateProps) => {
  const isCompact = variant === 'compact';

  return (
    <div className={`flex flex-col items-center justify-center text-center animate-fade-in ${
      isCompact ? 'py-8 px-4' : 'py-16 px-6'
    }`}>
      <div className={`rounded-2xl bg-muted/50 flex items-center justify-center mb-4 ${
        isCompact ? 'p-3' : 'p-5'
      }`}>
        <Icon className={`text-muted-foreground ${isCompact ? 'h-8 w-8' : 'h-12 w-12'}`} />
      </div>
      
      <h3 className={`font-semibold text-foreground mb-2 ${
        isCompact ? 'text-base' : 'text-xl'
      }`}>
        {title}
      </h3>
      
      <p className={`text-muted-foreground max-w-sm mb-6 ${
        isCompact ? 'text-sm' : 'text-base'
      }`}>
        {description}
      </p>

      {(actionLabel || secondaryActionLabel) && (
        <div className="flex flex-col sm:flex-row gap-3">
          {actionLabel && onAction && (
            <Button 
              onClick={onAction}
              size={isCompact ? 'default' : 'lg'}
              className="min-h-[48px] px-6 active:scale-95 transition-transform"
            >
              {actionLabel}
            </Button>
          )}
          {secondaryActionLabel && onSecondaryAction && (
            <Button 
              variant="outline"
              onClick={onSecondaryAction}
              size={isCompact ? 'default' : 'lg'}
              className="min-h-[48px] px-6 active:scale-95 transition-transform"
            >
              {secondaryActionLabel}
            </Button>
          )}
        </div>
      )}
    </div>
  );
};