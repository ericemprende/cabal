-- Lanzamientos programados en pump.fun (firmados con nonces duraderos).
ALTER TABLE "PumpCoin" ADD COLUMN "status" TEXT NOT NULL DEFAULT 'draft';
ALTER TABLE "PumpCoin" ADD COLUMN "scheduledAt" TIMESTAMP(3);
ALTER TABLE "PumpCoin" ADD COLUMN "nonceAccounts" TEXT[] DEFAULT ARRAY[]::TEXT[];
ALTER TABLE "PumpCoin" ADD COLUMN "signedTxs" TEXT[] DEFAULT ARRAY[]::TEXT[];
ALTER TABLE "PumpCoin" ADD COLUMN "feeSignature" TEXT;
ALTER TABLE "PumpCoin" ADD COLUMN "error" TEXT;
UPDATE "PumpCoin" SET "status" = 'launched' WHERE "launchedAt" IS NOT NULL;
CREATE INDEX "PumpCoin_status_scheduledAt_idx" ON "PumpCoin"("status", "scheduledAt");
