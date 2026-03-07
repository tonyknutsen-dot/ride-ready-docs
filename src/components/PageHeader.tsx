import { ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

/**
 * Standardised page header for all operational modules.
 *
 * Visual spec (locked):
 *  - Icon circle: 40×40 (w-10 h-10), rounded-full, gradient bg
 *  - Icon inside circle: 20×20 (h-5 w-5) — pass via `icon` prop
 *  - Title: text-lg (18px) font-bold tracking-tight
 *  - Subtitle: text-[13px] text-muted-foreground
 *  - Gap icon↔text: gap-3 (12px)
 *  - Spacing below header: controlled by parent (space-y-3)
 */

interface PageHeaderProps {
  icon?: ReactNode;
  iconBgClass?: string;
  title: string;
  subtitle?: string;
  actions?: ReactNode;
  className?: string;
  showBackButton?: boolean;
  backTo?: string;
  onBack?: () => void;
}

const PageHeader = ({ 
  icon, 
  iconBgClass = 'from-primary/20 to-primary/10', 
  title, 
  subtitle, 
  actions,
  className,
  showBackButton = false,
  backTo,
  onBack
}: PageHeaderProps) => {
  const navigate = useNavigate();

  const handleBack = () => {
    if (onBack) {
      onBack();
    } else if (backTo) {
      navigate(backTo);
    } else {
      navigate('/overview');
    }
  };

  return (
    <div className={cn("flex flex-col gap-3", className)}>
      {showBackButton && (
        <Button
          variant="ghost"
          size="sm"
          onClick={handleBack}
          className="w-fit gap-1.5 -ml-2 text-muted-foreground hover:text-foreground h-8 text-[13px]"
        >
          <ArrowLeft className="h-4 w-4" />
          Back
        </Button>
      )}
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-center gap-3">
          {icon && (
            <div className={cn(
              "w-10 h-10 rounded-full bg-gradient-to-br flex items-center justify-center shadow-sm shrink-0",
              iconBgClass
            )}>
              {icon}
            </div>
          )}
          <div className="space-y-0.5">
            <h1 className="text-lg font-bold tracking-tight">{title}</h1>
            {subtitle && (
              <p className="text-[13px] text-muted-foreground leading-snug">{subtitle}</p>
            )}
          </div>
        </div>
        {actions && (
          <div className="shrink-0">
            {actions}
          </div>
        )}
      </div>
    </div>
  );
};

export default PageHeader;
