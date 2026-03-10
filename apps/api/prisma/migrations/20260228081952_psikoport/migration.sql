-- DropIndex
DROP INDEX "Client_complaintAreas_gin_idx";

-- DropIndex
DROP INDEX "Client_tags_gin_idx";

-- RenameIndex
ALTER INDEX "AvailabilitySlot_tenantId_psychologistId_dayOfWeek_startTime_ke" RENAME TO "AvailabilitySlot_tenantId_psychologistId_dayOfWeek_startTim_key";
