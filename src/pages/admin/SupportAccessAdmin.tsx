import { AdminLayout } from '@/components/admin/AdminLayout';
import ActiveSupportGrants from '@/components/admin/ActiveSupportGrants';

const SupportAccessAdmin = () => {
  return (
    <AdminLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold">Support Access Grants</h1>
          <p className="text-muted-foreground">
            Manage and view user-granted support access
          </p>
        </div>
        
        <ActiveSupportGrants />
      </div>
    </AdminLayout>
  );
};

export default SupportAccessAdmin;
