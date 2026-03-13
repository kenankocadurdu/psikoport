-- Add per-client DEK fields for crypto-shredding support
ALTER TABLE "Client"
  ADD COLUMN "encrypted_client_dek" BYTEA,
  ADD COLUMN "client_dek_nonce"     BYTEA;
