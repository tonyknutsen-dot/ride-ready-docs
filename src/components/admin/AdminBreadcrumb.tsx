import { Link, useLocation } from 'react-router-dom';
import { ChevronRight, Home } from 'lucide-react';
import { Breadcrumb, BreadcrumbItem, BreadcrumbLink, BreadcrumbList, BreadcrumbPage, BreadcrumbSeparator } from '@/components/ui/breadcrumb';

const routeLabels: Record<string, string> = {
  '/admin': 'Dashboard',
  '/admin/bug-reports': 'Bug Reports',
  '/admin/early-access': 'Early Access Signups',
  '/admin/check-items': 'Check Intake Queue',
  '/admin/check-library': 'Check Library',
  '/admin/ride-requests': 'Equipment Type Requests',
  '/admin/equipment-type-library': 'Equipment Type Library',
  '/admin/document-requests': 'Document Type Requests',
  '/admin/document-type-library': 'Document Type Library',
  '/admin/risk-items': 'Risk Library Intake',
  '/admin/support': 'Support Messages',
  '/admin/support-access': 'Support Access Grants',
  '/admin/users': 'User Management',
  '/admin/audit-logs': 'Audit Logs',
  '/admin/security': 'Rate Limits & Blocks',
  '/admin/payments': 'Payments & Billing',
  '/admin/feature-requests': 'Feature Requests',
};

export function AdminBreadcrumb() {
  const location = useLocation();
  const currentPath = location.pathname;
  
  if (currentPath === '/admin') {
    return null;
  }

  const currentLabel = routeLabels[currentPath] || currentPath.split('/').pop();

  return (
    <Breadcrumb className="mb-4">
      <BreadcrumbList>
        <BreadcrumbItem>
          <BreadcrumbLink asChild>
            <Link to="/admin" className="flex items-center gap-1 hover:text-primary">
              <Home className="h-3.5 w-3.5" />
              <span className="sr-only sm:not-sr-only">Admin</span>
            </Link>
          </BreadcrumbLink>
        </BreadcrumbItem>
        <BreadcrumbSeparator>
          <ChevronRight className="h-4 w-4" />
        </BreadcrumbSeparator>
        <BreadcrumbItem>
          <BreadcrumbPage>{currentLabel}</BreadcrumbPage>
        </BreadcrumbItem>
      </BreadcrumbList>
    </Breadcrumb>
  );
}
