import { Skeleton } from '@/components/ui/skeleton';

interface LoadingStateProps {
  variant?: 'default' | 'compact';
  message?: string;
}

export const LoadingState = ({
  variant = 'default',
  message = 'Loading...',
}: LoadingStateProps) => {
  const isCompact = variant === 'compact';

  return (
    <div className={`flex flex-col items-center justify-center text-center animate-fade-in ${
      isCompact ? 'py-8 px-4' : 'py-16 px-6'
    }`}>
      {/* Icon skeleton */}
      <div className={`rounded-2xl bg-muted/50 flex items-center justify-center mb-4 ${
        isCompact ? 'p-3' : 'p-5'
      }`}>
        <Skeleton className={`rounded-lg ${isCompact ? 'h-8 w-8' : 'h-12 w-12'}`} />
      </div>
      
      {/* Title skeleton */}
      <Skeleton className={`mb-2 ${isCompact ? 'h-5 w-32' : 'h-6 w-40'}`} />
      
      {/* Description skeleton */}
      <Skeleton className={`max-w-sm ${isCompact ? 'h-4 w-48' : 'h-5 w-56'}`} />
      
      {/* Loading message */}
      <p className={`text-muted-foreground mt-4 ${isCompact ? 'text-xs' : 'text-sm'}`}>
        {message}
      </p>
    </div>
  );
};
