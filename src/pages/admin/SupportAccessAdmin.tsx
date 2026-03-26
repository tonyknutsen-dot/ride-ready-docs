import { AdminLayout } from '@/components/admin/AdminLayout';
import ActiveSupportGrants from '@/components/admin/ActiveSupportGrants';
import { Key } from 'lucide-react';

const SupportAccessAdmin = () => {
  return (
    <AdminLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-xl md:text-2xl font-bold flex items-center gap-2">
            <Key className="h-5 w-5 md:h-6 md:w-6 text-primary" />
            Support Access Grants
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Manage and view user-granted support access
          </p>
        </div>
        
        <ActiveSupportGrants />
      </div>
    </AdminLayout>
  );
};

export default SupportAccessAdmin;
