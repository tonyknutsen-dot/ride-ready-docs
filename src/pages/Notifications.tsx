import NotificationCenter from '@/components/NotificationCenter';
import { useNavigate } from 'react-router-dom';
import { Bell } from 'lucide-react';
import { useUnreadNotifications } from '@/hooks/useUnreadNotifications';

const Notifications = () => {
  const navigate = useNavigate();
  const unreadCount = useUnreadNotifications();

  return (
    <div className="container mx-auto py-6 pb-24 md:pb-8 max-w-3xl">
      {/* Page Header */}
      <div className="mb-6">
        <div className="flex items-center gap-3">
          <Bell className="h-6 w-6 text-[#0F172A]" />
          <h1 className="text-[22px] font-semibold text-[#0F172A]">
            Notifications
          </h1>
          {unreadCount > 0 && (
            <span className="inline-flex items-center justify-center h-[22px] min-w-[22px] px-1.5 rounded-full bg-[#DC2626] text-white text-xs font-bold">
              {unreadCount > 9 ? '9+' : unreadCount}
            </span>
          )}
        </div>
        <p className="text-sm text-[#64748B] mt-1">
          Compliance alerts, reminders, and system updates
        </p>
      </div>

      <NotificationCenter />
    </div>
  );
};

export default Notifications;
