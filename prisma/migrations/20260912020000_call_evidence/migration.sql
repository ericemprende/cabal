-- Evidencia de las calls: precio, market cap y dex en el instante en que se
-- publicó la call (contract/network/entry*). Solo añade columnas: no borra
-- ni modifica datos existentes.

-- AlterTable
ALTER TABLE "Post" ADD COLUMN     "contract" TEXT,
ADD COLUMN     "entryDexId" TEXT,
ADD COLUMN     "entryMc" DOUBLE PRECISION,
ADD COLUMN     "entryPairUrl" TEXT,
ADD COLUMN     "entryPriceUsd" DOUBLE PRECISION,
ADD COLUMN     "network" TEXT;

-- CreateIndex
CREATE INDEX "Post_kind_contract_idx" ON "Post"("kind", "contract");

