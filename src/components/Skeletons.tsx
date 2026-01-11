import { Skeleton } from '@/components/ui/skeleton';
import { Card, CardContent } from '@/components/ui/card';

interface CardSkeletonProps {
  rows?: number;
  showHeader?: boolean;
  showActions?: boolean;
}

export const CardSkeleton = ({
  rows = 3,
  showHeader = true,
  showActions = true,
}: CardSkeletonProps) => {
  return (
    <Card className="animate-pulse">
      <CardContent className="p-4 space-y-3">
        {showHeader && (
          <div className="flex items-center justify-between">
            <Skeleton className="h-5 w-32" />
            {showActions && <Skeleton className="h-8 w-20" />}
          </div>
        )}
        {Array.from({ length: rows }).map((_, i) => (
          <Skeleton key={i} className="h-4 w-full" />
        ))}
      </CardContent>
    </Card>
  );
};

interface ListSkeletonProps {
  count?: number;
  variant?: 'card' | 'row';
}

export const ListSkeleton = ({
  count = 3,
  variant = 'card',
}: ListSkeletonProps) => {
  if (variant === 'row') {
    return (
      <div className="space-y-2 animate-pulse">
        {Array.from({ length: count }).map((_, i) => (
          <div key={i} className="flex items-center gap-3 p-3 rounded-lg bg-muted/30">
            <Skeleton className="h-10 w-10 rounded-lg" />
            <div className="flex-1 space-y-2">
              <Skeleton className="h-4 w-3/4" />
              <Skeleton className="h-3 w-1/2" />
            </div>
            <Skeleton className="h-8 w-16" />
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="grid gap-4">
      {Array.from({ length: count }).map((_, i) => (
        <CardSkeleton key={i} />
      ))}
    </div>
  );
};

interface GridSkeletonProps {
  count?: number;
  columns?: 2 | 3 | 4;
}

export const GridSkeleton = ({
  count = 6,
  columns = 3,
}: GridSkeletonProps) => {
  const gridClass = {
    2: 'grid-cols-1 sm:grid-cols-2',
    3: 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3',
    4: 'grid-cols-2 md:grid-cols-4',
  }[columns];

  return (
    <div className={`grid ${gridClass} gap-4 animate-pulse`}>
      {Array.from({ length: count }).map((_, i) => (
        <Card key={i}>
          <CardContent className="p-4 space-y-3">
            <Skeleton className="h-32 w-full rounded-lg" />
            <Skeleton className="h-5 w-3/4" />
            <Skeleton className="h-4 w-1/2" />
          </CardContent>
        </Card>
      ))}
    </div>
  );
};

interface StatSkeletonProps {
  count?: number;
}

export const StatSkeleton = ({
  count = 4,
}: StatSkeletonProps) => {
  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 animate-pulse">
      {Array.from({ length: count }).map((_, i) => (
        <Card key={i}>
          <CardContent className="p-4 space-y-2">
            <Skeleton className="h-4 w-20" />
            <Skeleton className="h-8 w-16" />
          </CardContent>
        </Card>
      ))}
    </div>
  );
};
