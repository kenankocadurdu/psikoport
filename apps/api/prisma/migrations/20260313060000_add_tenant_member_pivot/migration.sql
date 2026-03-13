-- Create TenantMember pivot table
CREATE TABLE "tenant_members" (
  "id"         TEXT         NOT NULL DEFAULT gen_random_uuid(),
  "user_id"    TEXT         NOT NULL,
  "tenant_id"  TEXT         NOT NULL,
  "role"       "UserRole"   NOT NULL DEFAULT 'PSYCHOLOGIST',
  "is_active"  BOOLEAN      NOT NULL DEFAULT true,
  "joined_at"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "tenant_members_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "tenant_members_user_id_tenant_id_key" UNIQUE ("user_id", "tenant_id"),
  CONSTRAINT "tenant_members_user_id_fkey"   FOREIGN KEY ("user_id")   REFERENCES "User"("id")   ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "tenant_members_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
