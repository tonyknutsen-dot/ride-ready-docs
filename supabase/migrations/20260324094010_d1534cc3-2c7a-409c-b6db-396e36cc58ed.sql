
-- 1. Add assigned_to column to support_messages
ALTER TABLE public.support_messages
  ADD COLUMN IF NOT EXISTS assigned_to uuid REFERENCES auth.users(id),
  ADD COLUMN IF NOT EXISTS last_activity_at timestamptz DEFAULT now();

-- Update existing rows to set last_activity_at from updated_at
UPDATE public.support_messages SET last_activity_at = COALESCE(responded_at, updated_at, created_at);

-- 2. Create support_message_replies table for threaded conversations
CREATE TABLE public.support_message_replies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id uuid NOT NULL REFERENCES public.support_messages(id) ON DELETE CASCADE,
  author_id uuid NOT NULL REFERENCES auth.users(id),
  body text NOT NULL,
  is_internal_note boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Index for fast thread lookups
CREATE INDEX idx_support_replies_message_id ON public.support_message_replies(message_id, created_at);

-- 3. Enable RLS
ALTER TABLE public.support_message_replies ENABLE ROW LEVEL SECURITY;

-- Admin-only policies for replies (admins can do everything)
CREATE POLICY "Admins can manage support replies"
  ON public.support_message_replies
  FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Users can read their own non-internal replies
CREATE POLICY "Users can read own thread replies"
  ON public.support_message_replies
  FOR SELECT
  TO authenticated
  USING (
    is_internal_note = false
    AND message_id IN (
      SELECT id FROM public.support_messages WHERE user_id = auth.uid()
    )
  );

-- Users can insert replies to their own threads
CREATE POLICY "Users can reply to own threads"
  ON public.support_message_replies
  FOR INSERT
  TO authenticated
  WITH CHECK (
    is_internal_note = false
    AND author_id = auth.uid()
    AND message_id IN (
      SELECT id FROM public.support_messages WHERE user_id = auth.uid()
    )
  );

-- 4. Trigger to auto-update last_activity_at on support_messages when a reply is added
CREATE OR REPLACE FUNCTION public.update_support_message_activity()
  RETURNS trigger
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO 'public'
AS $$
BEGIN
  UPDATE public.support_messages
  SET last_activity_at = NEW.created_at,
      updated_at = NEW.created_at
  WHERE id = NEW.message_id;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_support_reply_activity
  AFTER INSERT ON public.support_message_replies
  FOR EACH ROW
  EXECUTE FUNCTION public.update_support_message_activity();
