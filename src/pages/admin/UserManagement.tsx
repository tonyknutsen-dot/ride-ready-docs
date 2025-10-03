import { AdminLayout } from '@/components/admin/AdminLayout';
import { Card, CardContent } from '@/components/ui/card';

export default function UserManagement() {
  return (
    <AdminLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold">User Management</h1>
          <p className="text-muted-foreground mt-2">Manage user accounts and roles</p>
        </div>

        <Card>
          <CardContent className="py-8 text-center text-muted-foreground">
            User management coming soon
          </CardContent>
        </Card>
      </div>
    </AdminLayout>
  );
}
