import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Bell } from 'lucide-react';
import { Button } from '@/components/ui/button';
import NotificationCenter from '@/components/NotificationCenter';
import { useActionNeededCount } from '@/hooks/useActionNeededCount';

const Notifications = () => {
  const actionCount = useActionNeededCount();
  const navigate = useNavigate();

  return (
    <div className="container mx-auto py-5 pb-24 md:pb-8 max-w-2xl">
      {/* Back to dashboard */}
      <div className="mb-3">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => navigate('/overview')}
          className="gap-1.5 -ml-2 text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to dashboard
        </Button>
      </div>

      {/* Page Header */}
      <div className="mb-4">
        <div className="flex items-center gap-3">
          <div className="flex items-center justify-center w-10 h-10 rounded-2xl bg-primary/10">
            <Bell className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-foreground tracking-tight">
              Notifications
            </h1>
            <p className="text-[13px] text-muted-foreground">
              {actionCount > 0
                ? `${actionCount} unread alert${actionCount !== 1 ? 's' : ''}`
                : 'No unread alerts'}
            </p>
            <p className="text-[11px] text-muted-foreground/70">
              Reminder messages — one issue may generate multiple alerts
            </p>
          </div>
        </div>
      </div>

      <NotificationCenter />
    </div>
  );
};

export default Notifications;
