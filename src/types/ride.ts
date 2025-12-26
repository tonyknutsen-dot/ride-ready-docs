import { Tables } from '@/integrations/supabase/types';

export type Ride = Tables<'rides'> & {
  ride_categories: {
    name: string;
    description: string | null;
    category_group: string;
  };
};

export type RideCategory = Tables<'ride_categories'>;
