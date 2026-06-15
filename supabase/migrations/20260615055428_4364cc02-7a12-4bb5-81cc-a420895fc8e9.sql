
-- 1. Copy the current default key into Vault (only if not already there)
DO $$
DECLARE
  v_key text;
  v_existing uuid;
BEGIN
  SELECT id INTO v_existing FROM vault.secrets WHERE name = 'encryption_key_default';
  IF v_existing IS NULL THEN
    SELECT key_value INTO v_key FROM public.encryption_keys WHERE id = 'default';
    IF v_key IS NOT NULL THEN
      PERFORM vault.create_secret(v_key, 'encryption_key_default', 'AES key for encrypt_sensitive/decrypt_sensitive');
    END IF;
  END IF;
END $$;

-- 2. Rewrite encrypt_sensitive to prefer Vault, fall back to legacy table
CREATE OR REPLACE FUNCTION public.encrypt_sensitive(plaintext text)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'extensions', 'vault'
AS $function$
DECLARE
  encryption_key TEXT;
  key_bytes BYTEA;
BEGIN
  IF plaintext IS NULL OR plaintext = '' THEN
    RETURN plaintext;
  END IF;

  SELECT decrypted_secret INTO encryption_key
  FROM vault.decrypted_secrets
  WHERE name = 'encryption_key_default'
  LIMIT 1;

  IF encryption_key IS NULL THEN
    SELECT key_value INTO encryption_key FROM public.encryption_keys WHERE id = 'default';
  END IF;

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
$function$;

-- 3. Rewrite decrypt_sensitive to prefer Vault, fall back to legacy table
CREATE OR REPLACE FUNCTION public.decrypt_sensitive(ciphertext text)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'extensions', 'vault'
AS $function$
DECLARE
  encryption_key TEXT;
  key_bytes BYTEA;
  decrypted_bytes BYTEA;
BEGIN
  IF ciphertext IS NULL OR ciphertext = '' THEN
    RETURN ciphertext;
  END IF;

  SELECT decrypted_secret INTO encryption_key
  FROM vault.decrypted_secrets
  WHERE name = 'encryption_key_default'
  LIMIT 1;

  IF encryption_key IS NULL THEN
    SELECT key_value INTO encryption_key FROM public.encryption_keys WHERE id = 'default';
  END IF;

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
$function$;
