import CalendarView from '@/components/CalendarView';
import { useAuth } from '@/contexts/AuthContext';
import { FeatureGate } from '@/components/FeatureGate';

const Calendar = () => {
  const { user } = useAuth();

  if (!user) {
    return (
      <div className="container mx-auto py-6">
        <div className="text-center space-y-4">
          <h2 className="text-2xl font-bold">Please log in</h2>
          <p className="text-muted-foreground">You need to be logged in to view the calendar.</p>
        </div>
      </div>
    );
  }

  return (
    <FeatureGate requiredPlan="advanced" feature="Calendar View">
      <div className="container mx-auto py-6 pb-24 md:pb-6 space-y-6">
        <div className="space-y-2">
          <h1 className="text-3xl font-bold tracking-tight">Calendar</h1>
          <p className="text-muted-foreground">
            View all your upcoming inspections, maintenance, and document expiry dates
          </p>
        </div>
        
        <CalendarView />
      </div>
    </FeatureGate>
  );
};

export default Calendar;
