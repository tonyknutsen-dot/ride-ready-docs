-- Create tester sessions table for time tracking
CREATE TABLE public.tester_sessions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  session_start TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  session_end TIMESTAMP WITH TIME ZONE,
  duration_minutes INTEGER,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.tester_sessions ENABLE ROW LEVEL SECURITY;

-- Testers can manage their own sessions
CREATE POLICY "Testers can insert their own sessions"
  ON public.tester_sessions
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Testers can update their own sessions"
  ON public.tester_sessions
  FOR UPDATE
  USING (auth.uid() = user_id);

-- Admins can view all sessions
CREATE POLICY "Admins can view all tester sessions"
  ON public.tester_sessions
  FOR SELECT
  USING (has_role(auth.uid(), 'admin') OR auth.uid() = user_id);

-- Create indexes for efficient queries
CREATE INDEX idx_tester_sessions_user_id ON public.tester_sessions(user_id);
CREATE INDEX idx_tester_sessions_start ON public.tester_sessions(session_start DESC);