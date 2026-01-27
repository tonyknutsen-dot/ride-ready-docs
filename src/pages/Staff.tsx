import { ArrowLeft, Users } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useNavigate } from 'react-router-dom';
import { StaffManagement } from '@/components/StaffManagement';

const Staff = () => {
  const navigate = useNavigate();

  return (
    <div className="container mx-auto px-4 py-5 pb-28 md:pb-8 space-y-5 max-w-4xl">
      {/* Back Button */}
      <Button
        variant="ghost"
        size="sm"
        onClick={() => navigate('/overview')}
        className="w-fit gap-1.5 -ml-2 text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" />
        Back
      </Button>

      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-full bg-gradient-to-br from-primary/20 to-accent/20 flex items-center justify-center shrink-0 shadow-sm">
          <Users className="h-5 w-5 text-primary" />
        </div>
        <div>
          <h1 className="text-xl md:text-2xl font-bold">Staff Management</h1>
          <p className="text-sm text-muted-foreground">Invite and manage your team members</p>
        </div>
      </div>

      {/* Staff Management Component */}
      <StaffManagement />
    </div>
  );
};

export default Staff;
