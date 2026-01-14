import { ReactNode } from 'react';
import { Loader2, ArrowDown } from 'lucide-react';
import { usePullToRefresh } from '@/hooks/usePullToRefresh';
import { useIsMobile } from '@/hooks/use-mobile';
import { cn } from '@/lib/utils';

interface PullToRefreshProps {
  children: ReactNode;
  onRefresh: () => Promise<void>;
  className?: string;
  disabled?: boolean;
}

export function PullToRefresh({ 
  children, 
  onRefresh, 
  className,
  disabled = false 
}: PullToRefreshProps) {
  const isMobile = useIsMobile();
  
  const { 
    containerRef, 
    isPulling, 
    isRefreshing, 
    pullDistance, 
    progress 
  } = usePullToRefresh({
    onRefresh,
    threshold: 80,
    disabled: disabled || !isMobile
  });

  // Only show pull indicator on mobile
  if (!isMobile) {
    return <div className={className}>{children}</div>;
  }

  return (
    <div ref={containerRef} className={cn("relative", className)}>
      {/* Pull indicator */}
      <div 
        className={cn(
          "absolute left-1/2 -translate-x-1/2 z-50 flex items-center justify-center transition-opacity duration-200",
          (isPulling || isRefreshing) && pullDistance > 10 ? "opacity-100" : "opacity-0"
        )}
        style={{ 
          top: Math.max(pullDistance - 50, 8),
          transform: `translateX(-50%) rotate(${progress * 180}deg)`
        }}
      >
        <div className={cn(
          "w-10 h-10 rounded-full bg-background border-2 shadow-lg flex items-center justify-center transition-colors",
          progress >= 1 ? "border-primary bg-primary/10" : "border-border"
        )}>
          {isRefreshing ? (
            <Loader2 className="h-5 w-5 text-primary animate-spin" />
          ) : (
            <ArrowDown 
              className={cn(
                "h-5 w-5 transition-colors",
                progress >= 1 ? "text-primary" : "text-muted-foreground"
              )} 
            />
          )}
        </div>
      </div>

      {/* Content with pull transform */}
      <div 
        style={{ 
          transform: pullDistance > 0 ? `translateY(${pullDistance}px)` : 'none',
          transition: isPulling ? 'none' : 'transform 0.2s ease-out'
        }}
      >
        {children}
      </div>
    </div>
  );
}
