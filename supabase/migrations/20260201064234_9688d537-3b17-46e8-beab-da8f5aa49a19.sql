-- Create document_shares table for tracking shared document packages
CREATE TABLE public.document_shares (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  share_token TEXT NOT NULL UNIQUE,
  recipient_email TEXT NOT NULL,
  recipient_name TEXT,
  message TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT (now() + interval '7 days'),
  accessed_at TIMESTAMP WITH TIME ZONE,
  access_count INTEGER NOT NULL DEFAULT 0,
  is_revoked BOOLEAN NOT NULL DEFAULT false
);

-- Create document_share_items table for individual documents in a share
CREATE TABLE public.document_share_items (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  share_id UUID NOT NULL REFERENCES public.document_shares(id) ON DELETE CASCADE,
  document_id UUID REFERENCES public.documents(id) ON DELETE SET NULL,
  file_path TEXT NOT NULL,
  document_name TEXT NOT NULL,
  document_type TEXT NOT NULL,
  ride_name TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create indexes for performance
CREATE INDEX idx_document_shares_token ON public.document_shares(share_token);
CREATE INDEX idx_document_shares_user_id ON public.document_shares(user_id);
CREATE INDEX idx_document_shares_expires_at ON public.document_shares(expires_at);
CREATE INDEX idx_document_share_items_share_id ON public.document_share_items(share_id);

-- Enable RLS
ALTER TABLE public.document_shares ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.document_share_items ENABLE ROW LEVEL SECURITY;

-- RLS policies for document_shares
CREATE POLICY "Deny anonymous access to document_shares"
  ON public.document_shares
  FOR ALL
  USING (auth.role() = 'authenticated');

CREATE POLICY "Users can manage their own shares"
  ON public.document_shares
  FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Service role can manage all shares"
  ON public.document_shares
  FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

-- RLS policies for document_share_items
CREATE POLICY "Deny anonymous access to document_share_items"
  ON public.document_share_items
  FOR ALL
  USING (auth.role() = 'authenticated');

CREATE POLICY "Users can manage items for their shares"
  ON public.document_share_items
  FOR ALL
  USING (share_id IN (SELECT id FROM public.document_shares WHERE user_id = auth.uid()))
  WITH CHECK (share_id IN (SELECT id FROM public.document_shares WHERE user_id = auth.uid()));

CREATE POLICY "Service role can manage all share items"
  ON public.document_share_items
  FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');