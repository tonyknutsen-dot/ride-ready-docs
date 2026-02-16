import NotificationCenter from '@/components/NotificationCenter';
import PageHeader from '@/components/PageHeader';
import { useNavigate } from 'react-router-dom';

const Notifications = () => {
  const navigate = useNavigate();

  return (
    <div className="container mx-auto py-6 pb-24 md:pb-8 space-y-6">
      <PageHeader 
        title="Notifications" 
        onBack={() => navigate('/overview')}
      />
      <NotificationCenter />
    </div>
  );
};

export default Notifications;
