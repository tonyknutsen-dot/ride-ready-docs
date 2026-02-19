import CalendarView from '@/components/CalendarView';
import { useAuth } from '@/contexts/AuthContext';
import StaffAccountBanner from '@/components/StaffAccountBanner';

const Calendar = () => {
  const { user } = useAuth();

  if (!user) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="text-center space-y-4">
          <h2 className="text-xl font-bold">Please log in</h2>
          <p className="text-sm text-muted-foreground">You need to be logged in to view the calendar.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-5 pb-28 md:pb-8 space-y-5">
      <StaffAccountBanner />
      <CalendarView />
    </div>
  );
};

export default Calendar;

