-- Precio/MC del token en el instante exacto de la call
ALTER TABLE "Post" ADD COLUMN "entryPriceUsd" DOUBLE PRECISION;
ALTER TABLE "Post" ADD COLUMN "entryMc" DOUBLE PRECISION;
