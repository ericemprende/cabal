-- Resultado guardado de cada call: alimenta el ranking de Top Callers y las
-- estadísticas del perfil sin consultar DexScreener/GeckoTerminal en cada visita.
ALTER TABLE "Post" ADD COLUMN "peakMultiple" DOUBLE PRECISION;
ALTER TABLE "Post" ADD COLUMN "currentMultiple" DOUBLE PRECISION;
ALTER TABLE "Post" ADD COLUMN "resultSymbol" TEXT;
ALTER TABLE "Post" ADD COLUMN "resultImage" TEXT;
ALTER TABLE "Post" ADD COLUMN "resultCheckedAt" TIMESTAMP(3);
ALTER TABLE "Post" ADD COLUMN "resultFinal" BOOLEAN NOT NULL DEFAULT false;

CREATE INDEX "Post_kind_resultFinal_resultCheckedAt_idx" ON "Post"("kind", "resultFinal", "resultCheckedAt");
CREATE INDEX "Post_kind_createdAt_idx" ON "Post"("kind", "createdAt");
