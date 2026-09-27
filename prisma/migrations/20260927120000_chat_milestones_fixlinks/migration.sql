-- Avisos de resultado de las calls del chat (Nx, DEX pagado) y arreglo de enlaces de X.
ALTER TABLE "ChatLink" ADD COLUMN "notifyMilestones" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "ChatLink" ADD COLUMN "fixLinks" BOOLEAN NOT NULL DEFAULT true;
