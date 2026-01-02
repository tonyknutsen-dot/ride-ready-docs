-- Create marketing_contacts table
CREATE TABLE public.marketing_contacts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  email TEXT NOT NULL,
  name TEXT,
  company_name TEXT,
  notes TEXT,
  tags TEXT[] DEFAULT '{}',
  is_subscribed BOOLEAN NOT NULL DEFAULT true,
  unsubscribe_token UUID DEFAULT gen_random_uuid(),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  unsubscribed_at TIMESTAMP WITH TIME ZONE,
  UNIQUE(user_id, email)
);

-- Create email_campaigns table
CREATE TABLE public.email_campaigns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  name TEXT NOT NULL,
  subject TEXT NOT NULL,
  html_content TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'draft',
  recipient_count INTEGER DEFAULT 0,
  sent_count INTEGER DEFAULT 0,
  scheduled_for TIMESTAMP WITH TIME ZONE,
  sent_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create campaign_recipients table
CREATE TABLE public.campaign_recipients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id UUID NOT NULL REFERENCES public.email_campaigns(id) ON DELETE CASCADE,
  contact_id UUID NOT NULL REFERENCES public.marketing_contacts(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'pending',
  sent_at TIMESTAMP WITH TIME ZONE,
  error_message TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(campaign_id, contact_id)
);

-- Enable RLS
ALTER TABLE public.marketing_contacts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.email_campaigns ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.campaign_recipients ENABLE ROW LEVEL SECURITY;

-- RLS policies for marketing_contacts
CREATE POLICY "Users can manage their own marketing contacts"
ON public.marketing_contacts
FOR ALL
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- RLS policies for email_campaigns
CREATE POLICY "Users can manage their own email campaigns"
ON public.email_campaigns
FOR ALL
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- RLS policies for campaign_recipients (access through campaign ownership)
CREATE POLICY "Users can manage recipients for their campaigns"
ON public.campaign_recipients
FOR ALL
USING (
  campaign_id IN (
    SELECT id FROM public.email_campaigns WHERE user_id = auth.uid()
  )
);

-- Create indexes for performance
CREATE INDEX idx_marketing_contacts_user_id ON public.marketing_contacts(user_id);
CREATE INDEX idx_marketing_contacts_email ON public.marketing_contacts(email);
CREATE INDEX idx_marketing_contacts_subscribed ON public.marketing_contacts(user_id, is_subscribed);
CREATE INDEX idx_email_campaigns_user_id ON public.email_campaigns(user_id);
CREATE INDEX idx_email_campaigns_status ON public.email_campaigns(user_id, status);
CREATE INDEX idx_campaign_recipients_campaign ON public.campaign_recipients(campaign_id);
CREATE INDEX idx_campaign_recipients_status ON public.campaign_recipients(campaign_id, status);

-- Trigger for updated_at
CREATE TRIGGER update_marketing_contacts_updated_at
BEFORE UPDATE ON public.marketing_contacts
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_email_campaigns_updated_at
BEFORE UPDATE ON public.email_campaigns
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();