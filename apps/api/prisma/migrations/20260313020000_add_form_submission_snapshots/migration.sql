-- AlterTable
ALTER TABLE "FormSubmission"
  ADD COLUMN "scoring_config_snapshot" JSONB,
  ADD COLUMN "schema_snapshot"         JSONB;
