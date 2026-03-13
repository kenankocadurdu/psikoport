-- WORM (Write-Once Read-Many) trigger for AuditLog table
-- Prevents UPDATE and DELETE operations to ensure immutable audit trail

CREATE OR REPLACE FUNCTION prevent_audit_log_modification()
RETURNS TRIGGER AS $$
BEGIN
  RAISE EXCEPTION 'audit_logs table is WORM (Write-Once Read-Many). UPDATE and DELETE operations are forbidden.';
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER audit_log_worm_trigger
  BEFORE UPDATE OR DELETE ON "AuditLog"
  FOR EACH ROW
  EXECUTE FUNCTION prevent_audit_log_modification();
