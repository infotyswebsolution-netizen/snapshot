-- Supabase Vault setup for POS token encryption [I-6]
-- Uses pgsodium (built into Supabase) for AES-256-GCM encryption

-- Create the encryption key for POS tokens
-- In production: run this once and note the key_id returned
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM vault.secrets WHERE name = 'pos_token_key'
  ) THEN
    PERFORM vault.create_secret(
      'pos-token-encryption-key',
      'pos_token_key',
      'AES-256 key for encrypting POS OAuth tokens'
    );
  END IF;
END $$;

-- Encrypt a plaintext token using vault
CREATE OR REPLACE FUNCTION vault_encrypt_token(plaintext_token TEXT)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_key_id UUID;
  v_encrypted TEXT;
BEGIN
  SELECT id INTO v_key_id FROM vault.secrets WHERE name = 'pos_token_key' LIMIT 1;

  IF v_key_id IS NULL THEN
    RAISE EXCEPTION 'Encryption key not found. Run vault setup migration first.';
  END IF;

  SELECT encode(
    pgsodium.crypto_aead_det_encrypt(
      convert_to(plaintext_token, 'utf8'),
      convert_to('snapstock-pos-token', 'utf8'),
      pgsodium.derive_key(v_key_id::uuid, 64, 'token-encryption')
    ),
    'base64'
  ) INTO v_encrypted;

  RETURN v_encrypted;
END;
$$;

-- Decrypt an encrypted token
CREATE OR REPLACE FUNCTION vault_decrypt_token(encrypted_token TEXT)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_key_id UUID;
  v_decrypted TEXT;
BEGIN
  SELECT id INTO v_key_id FROM vault.secrets WHERE name = 'pos_token_key' LIMIT 1;

  IF v_key_id IS NULL THEN
    RAISE EXCEPTION 'Encryption key not found.';
  END IF;

  SELECT convert_from(
    pgsodium.crypto_aead_det_decrypt(
      decode(encrypted_token, 'base64'),
      convert_to('snapstock-pos-token', 'utf8'),
      pgsodium.derive_key(v_key_id::uuid, 64, 'token-encryption')
    ),
    'utf8'
  ) INTO v_decrypted;

  RETURN v_decrypted;
END;
$$;

-- Grant execute only to service role and authenticated users via SECURITY DEFINER
REVOKE ALL ON FUNCTION vault_encrypt_token(TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION vault_decrypt_token(TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION vault_encrypt_token(TEXT) TO service_role;
GRANT EXECUTE ON FUNCTION vault_decrypt_token(TEXT) TO service_role;
