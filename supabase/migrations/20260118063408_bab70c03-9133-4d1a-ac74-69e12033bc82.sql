-- Add expires_at column to user_roles for tester expiry
ALTER TABLE public.user_roles 
ADD COLUMN expires_at TIMESTAMP WITH TIME ZONE DEFAULT NULL;

-- Add index for efficient expiry queries
CREATE INDEX idx_user_roles_expires_at ON public.user_roles(expires_at) WHERE expires_at IS NOT NULL;

-- Add comment explaining the column
COMMENT ON COLUMN public.user_roles.expires_at IS 'Optional expiry date for roles, primarily used for tester role auto-expiration';