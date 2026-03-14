-- Rename column to match Prisma schema expectation (camelCase)
ALTER TABLE "PaymentSettings" RENAME COLUMN "supported_currencies" TO "supportedCurrencies";
