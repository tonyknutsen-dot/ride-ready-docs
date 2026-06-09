import { ReactNode } from 'react';
import { cn } from '@/lib/utils';

interface PageContainerProps {
  children: ReactNode;
  className?: string;
  /** Use a narrower max width for form-style pages */
  narrow?: boolean;
}

/**
 * Shared page shell — provides consistent horizontal padding, max width,
 * and bottom safe-area padding across the main app pages.
 *
 * Visual-only wrapper; does not change any functionality.
 */
const PageContainer = ({ children, className, narrow = false }: PageContainerProps) => {
  return (
    <div
      className={cn(
        'w-full mx-auto px-4 sm:px-6 lg:px-8 py-4 md:py-6 space-y-3',
        'pb-[calc(env(safe-area-inset-bottom)+5.5rem)] md:pb-8',
        narrow ? 'max-w-3xl' : 'max-w-7xl',
        className,
      )}
    >
      {children}
    </div>
  );
};

export default PageContainer;
