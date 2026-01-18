-- Create the encryption_keys table first
CREATE TABLE IF NOT EXISTS encryption_keys (
  id TEXT PRIMARY KEY DEFAULT 'default',
  key_value TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  rotated_at TIMESTAMPTZ
);

-- Enable RLS on encryption_keys (no policies = no direct access)
ALTER TABLE encryption_keys ENABLE ROW LEVEL SECURITY;

-- Generate and store a secure encryption key
INSERT INTO encryption_keys (id, key_value)
VALUES ('default', encode(gen_random_bytes(32), 'hex'))
ON CONFLICT (id) DO NOTHING;