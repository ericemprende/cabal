-- Verificación de swaps antes de dar puntos: la cuenta que debe recibir la
-- comisión y la transacción que confirmó cada intención (única).
ALTER TABLE "SwapIntent" ADD COLUMN "feeAccount" TEXT;
ALTER TABLE "SwapIntent" ADD COLUMN "txSignature" TEXT;
CREATE UNIQUE INDEX "SwapIntent_txSignature_key" ON "SwapIntent"("txSignature");
