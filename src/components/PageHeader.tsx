import { ReactNode } from 'react';
import { cn } from '@/lib/utils';

interface PageHeaderProps {
  icon?: ReactNode;
  iconBgClass?: string;
  title: string;
  subtitle?: string;
  actions?: ReactNode;
  className?: string;
}

const PageHeader = ({ 
  icon, 
  iconBgClass = 'from-primary/20 to-primary/10', 
  title, 
  subtitle, 
  actions,
  className 
}: PageHeaderProps) => {
  return (
    <div className={cn("flex flex-col gap-4", className)}>
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
            <h1 className="text-xl font-bold tracking-tight">{title}</h1>
            {subtitle && (
              <p className="text-sm text-muted-foreground">{subtitle}</p>
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
