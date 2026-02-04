import { UserCheck } from 'lucide-react';
import { useStaff } from '@/contexts/StaffContext';

const StaffAccountBanner = () => {
  const { isStaff, staffMembership } = useStaff();

  if (!isStaff || !staffMembership) return null;

  return (
    <div className="bg-gradient-to-r from-info/20 via-info/10 to-transparent border-b border-info/30 px-3 sm:px-4 py-2">
      <div className="flex items-center gap-2 text-xs sm:text-sm max-w-full">
        <UserCheck className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-info shrink-0" />
        <span className="text-info font-medium shrink-0">Staff</span>
        <span className="text-muted-foreground truncate min-w-0">
          — {staffMembership.organisationName}
        </span>
      </div>
    </div>
  );
};

export default StaffAccountBanner;
