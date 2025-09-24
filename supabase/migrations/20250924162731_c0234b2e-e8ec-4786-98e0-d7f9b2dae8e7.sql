-- Create profiles table for additional user information
CREATE TABLE public.profiles (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  company_name TEXT,
  controller_name TEXT,
  address TEXT,
  showmen_name TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Create policies for profiles
CREATE POLICY "Users can view their own profile" 
ON public.profiles 
FOR SELECT 
USING (auth.uid() = user_id);

CREATE POLICY "Users can update their own profile" 
ON public.profiles 
FOR UPDATE 
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own profile" 
ON public.profiles 
FOR INSERT 
WITH CHECK (auth.uid() = user_id);

-- Create ride categories table
CREATE TABLE public.ride_categories (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  description TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Insert common ride categories
INSERT INTO public.ride_categories (name, description) VALUES
  ('Chair O Plane', 'Chair swing rides'),
  ('Square Slip', 'Square slip rides'),
  ('Dodgems', 'Bumper cars and dodgem rides'),
  ('Twist', 'Twist and spinning rides'),
  ('Mimic', 'Mimic rides'),
  ('Big Wheel', 'Ferris wheels and observation wheels'),
  ('Waltzers', 'Waltzer rides'),
  ('Carousel', 'Traditional carousel and merry-go-rounds'),
  ('Ghost Train', 'Dark rides and ghost trains'),
  ('Helter Skelter', 'Slide rides');

-- Enable RLS for ride categories (public read access)
ALTER TABLE public.ride_categories ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view ride categories" 
ON public.ride_categories 
FOR SELECT 
USING (true);

-- Create rides table
CREATE TABLE public.rides (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  category_id UUID NOT NULL REFERENCES public.ride_categories(id),
  ride_name TEXT NOT NULL,
  manufacturer TEXT,
  year_manufactured INTEGER,
  serial_number TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS for rides
ALTER TABLE public.rides ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage their own rides" 
ON public.rides 
FOR ALL 
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- Create technical bulletins table (linked to categories)
CREATE TABLE public.technical_bulletins (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  category_id UUID NOT NULL REFERENCES public.ride_categories(id),
  title TEXT NOT NULL,
  bulletin_number TEXT,
  content TEXT,
  issue_date DATE,
  priority TEXT CHECK (priority IN ('Low', 'Medium', 'High', 'Critical')),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS for technical bulletins
ALTER TABLE public.technical_bulletins ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view technical bulletins" 
ON public.technical_bulletins 
FOR SELECT 
USING (true);

-- Create function to update timestamps
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- Create triggers for automatic timestamp updates
CREATE TRIGGER update_profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_rides_updated_at
  BEFORE UPDATE ON public.rides
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Create function to handle new user profile creation
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (user_id)
  VALUES (new.id);
  RETURN new;
END;
$$;

-- Create trigger to automatically create profile when user signs up
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();