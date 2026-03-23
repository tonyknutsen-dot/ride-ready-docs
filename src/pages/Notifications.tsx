import NotificationCenter from '@/components/NotificationCenter';
import { Bell } from 'lucide-react';
import { useActionNeededCount } from '@/hooks/useActionNeededCount';

const Notifications = () => {
  const actionCount = useActionNeededCount();

  return (
    <div className="container mx-auto py-5 pb-24 md:pb-8 max-w-2xl">
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
                ? `${actionCount} item${actionCount !== 1 ? 's' : ''} need${actionCount === 1 ? 's' : ''} attention`
                : 'All clear'}
            </p>
          </div>
        </div>
      </div>

      <NotificationCenter />
    </div>
  );
};

export default Notifications;
