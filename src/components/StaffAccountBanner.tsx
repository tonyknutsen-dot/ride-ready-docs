import { UserCheck } from 'lucide-react';
import { useStaff } from '@/contexts/StaffContext';

const StaffAccountBanner = () => {
  const { isStaff, staffMembership } = useStaff();

  if (!isStaff || !staffMembership) return null;

  return (
    <div className="bg-gradient-to-r from-info/20 via-info/10 to-transparent border-b border-info/30 px-4 py-2">
      <div className="container mx-auto flex items-center gap-2 text-sm">
        <UserCheck className="h-4 w-4 text-info shrink-0" />
        <span className="text-info font-medium">Staff Account</span>
        <span className="text-muted-foreground hidden sm:inline">
          — Viewing data for {staffMembership.organisationName}
        </span>
      </div>
    </div>
  );
};

export default StaffAccountBanner;
