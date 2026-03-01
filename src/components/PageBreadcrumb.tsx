import { Link } from 'react-router-dom';
import { ChevronRight, Home } from 'lucide-react';
import { useIsMobile } from '@/hooks/use-mobile';
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from '@/components/ui/breadcrumb';

export interface BreadcrumbNavItem {
  label: string;
  href?: string;
}

interface PageBreadcrumbProps {
  items: BreadcrumbNavItem[];
  showHome?: boolean;
  className?: string;
  hideOnMobile?: boolean;
}

const PageBreadcrumb = ({ items, showHome = false, className, hideOnMobile = true }: PageBreadcrumbProps) => {
  const isMobile = useIsMobile();
  if (items.length === 0) return null;
  if (hideOnMobile && isMobile) return null;

  return (
    <Breadcrumb className={`mb-4 ${className || ''}`}>
      <BreadcrumbList className="text-sm">
        {showHome && (
          <>
            <BreadcrumbItem>
              {isMobile ? (
                <span className="flex items-center gap-1.5 text-muted-foreground">
                  <Home className="h-3.5 w-3.5" />
                  <span className="sr-only">Home</span>
                </span>
              ) : (
                <BreadcrumbLink asChild>
                  <Link 
                    to="/overview" 
                    className="flex items-center gap-1.5 text-muted-foreground hover:text-primary transition-colors"
                  >
                    <Home className="h-3.5 w-3.5" />
                    <span className="sr-only">Home</span>
                  </Link>
                </BreadcrumbLink>
              )}
            </BreadcrumbItem>
            <BreadcrumbSeparator>
              <ChevronRight className="h-3.5 w-3.5 text-muted-foreground/50" />
            </BreadcrumbSeparator>
          </>
        )}
        
        {items.map((item, index) => {
          const isLast = index === items.length - 1;
          
          return (
            <span key={index} className="contents">
              <BreadcrumbItem>
                {!isLast && item.href && !isMobile ? (
                  <BreadcrumbLink asChild>
                    <Link 
                      to={item.href}
                      className="text-muted-foreground hover:text-primary transition-colors font-medium"
                    >
                      {item.label}
                    </Link>
                  </BreadcrumbLink>
                ) : !isLast ? (
                  <span className="text-muted-foreground font-medium">{item.label}</span>
                ) : (
                  <BreadcrumbPage className="font-semibold text-foreground">
                    {item.label}
                  </BreadcrumbPage>
                )}
              </BreadcrumbItem>
              {!isLast && (
                <BreadcrumbSeparator>
                  <ChevronRight className="h-3.5 w-3.5 text-muted-foreground/50" />
                </BreadcrumbSeparator>
              )}
            </span>
          );
        })}
      </BreadcrumbList>
    </Breadcrumb>
  );
};

export default PageBreadcrumb;
