-- Create encryption function using extensions.pgcrypto
CREATE OR REPLACE FUNCTION encrypt_sensitive(plaintext TEXT)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  encryption_key TEXT;
  key_bytes BYTEA;
BEGIN
  IF plaintext IS NULL OR plaintext = '' THEN
    RETURN plaintext;
  END IF;
  
  SELECT key_value INTO encryption_key FROM public.encryption_keys WHERE id = 'default';
  
  IF encryption_key IS NULL THEN
    RAISE EXCEPTION 'Encryption key not found';
  END IF;
  
  key_bytes := decode(encryption_key, 'hex');
  
  RETURN encode(
    extensions.encrypt(
      convert_to(plaintext, 'UTF8'),
      key_bytes,
      'aes'
    ),
    'base64'
  );
END;
$$;

-- Create decryption function
CREATE OR REPLACE FUNCTION decrypt_sensitive(ciphertext TEXT)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  encryption_key TEXT;
  key_bytes BYTEA;
  decrypted_bytes BYTEA;
BEGIN
  IF ciphertext IS NULL OR ciphertext = '' THEN
    RETURN ciphertext;
  END IF;
  
  SELECT key_value INTO encryption_key FROM public.encryption_keys WHERE id = 'default';
  
  IF encryption_key IS NULL THEN
    RAISE EXCEPTION 'Encryption key not found';
  END IF;
  
  key_bytes := decode(encryption_key, 'hex');
  
  decrypted_bytes := extensions.decrypt(
    decode(ciphertext, 'base64'),
    key_bytes,
    'aes'
  );
  
  RETURN convert_from(decrypted_bytes, 'UTF8');
EXCEPTION
  WHEN OTHERS THEN
    RETURN ciphertext;
END;
$$;

-- Add encrypted columns to profiles
ALTER TABLE profiles 
  ADD COLUMN IF NOT EXISTS stripe_customer_id_encrypted TEXT,
  ADD COLUMN IF NOT EXISTS stripe_subscription_id_encrypted TEXT;

-- Migrate existing data to encrypted columns
UPDATE profiles 
SET 
  stripe_customer_id_encrypted = encrypt_sensitive(stripe_customer_id),
  stripe_subscription_id_encrypted = encrypt_sensitive(stripe_subscription_id)
WHERE (stripe_customer_id IS NOT NULL OR stripe_subscription_id IS NOT NULL)
  AND stripe_customer_id_encrypted IS NULL;

-- Create trigger function for auto-encryption
CREATE OR REPLACE FUNCTION encrypt_stripe_fields()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.stripe_customer_id IS DISTINCT FROM OLD.stripe_customer_id THEN
    NEW.stripe_customer_id_encrypted := encrypt_sensitive(NEW.stripe_customer_id);
  END IF;
  
  IF NEW.stripe_subscription_id IS DISTINCT FROM OLD.stripe_subscription_id THEN
    NEW.stripe_subscription_id_encrypted := encrypt_sensitive(NEW.stripe_subscription_id);
  END IF;
  
  RETURN NEW;
END;
$$;

-- Create trigger
DROP TRIGGER IF EXISTS encrypt_stripe_fields_trigger ON profiles;
CREATE TRIGGER encrypt_stripe_fields_trigger
  BEFORE INSERT OR UPDATE ON profiles
  FOR EACH ROW
  EXECUTE FUNCTION encrypt_stripe_fields();

-- Add documentation
COMMENT ON COLUMN profiles.stripe_customer_id_encrypted IS 'AES-256 encrypted Stripe customer ID';
COMMENT ON COLUMN profiles.stripe_subscription_id_encrypted IS 'AES-256 encrypted Stripe subscription ID';