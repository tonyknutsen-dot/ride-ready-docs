import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Settings } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { Tables } from '@/integrations/supabase/types';
import RideDetail from '@/components/RideDetail';

type Ride = Tables<'rides'> & {
  ride_categories: {
    name: string;
    description: string | null;
    category_group: string;
  };
};

const RideDetailPage = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [ride, setRide] = useState<Ride | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user && id) {
      loadRide();
    }
  }, [user, id]);

  const loadRide = async () => {
    try {
      const { data, error } = await supabase
        .from('rides')
        .select(`
          *,
          ride_categories (
            name,
            description,
            category_group
          )
        `)
        .eq('id', id)
        .eq('user_id', user?.id)
        .single();

      if (error) throw error;
      setRide(data as Ride);
    } catch (error) {
      console.error('Error loading ride:', error);
      navigate('/rides');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="flex items-center justify-center py-12">
          <div className="text-center space-y-4">
            <Settings className="mx-auto h-10 w-10 text-primary animate-spin" />
            <p className="text-sm text-muted-foreground">Loading equipment details...</p>
          </div>
        </div>
      </div>
    );
  }

  if (!ride) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="text-center space-y-4">
          <p className="text-muted-foreground">Equipment not found</p>
          <Button onClick={() => navigate('/rides')} className="h-11">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Equipment
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-5 pb-28 md:pb-8">
      <RideDetail 
        ride={ride}
        onBack={() => navigate('/rides')}
        onUpdate={loadRide}
      />
    </div>
  );
};

export default RideDetailPage;
