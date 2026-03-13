-- Add supportedCurrencies to PaymentSettings
ALTER TABLE "PaymentSettings" ADD COLUMN "supported_currencies" TEXT[] NOT NULL DEFAULT ARRAY['TRY']::TEXT[];
