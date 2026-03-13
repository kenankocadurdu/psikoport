-- Add R&D partner fields to Tenant
ALTER TABLE "Tenant"
  ADD COLUMN "is_rnd_partner"        BOOLEAN      NOT NULL DEFAULT false,
  ADD COLUMN "rnd_partner_expires_at" TIMESTAMP(3);
