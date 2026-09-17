-- Discord: servidor (guild) al que pertenece el canal vinculado. En Telegram el
-- chat ya es el grupo, así que queda a NULL. Permite contar comunidades y, más
-- adelante, dar métricas por servidor en el panel de administración.
ALTER TABLE "ChatLink" ADD COLUMN     "serverId" TEXT;

CREATE INDEX "ChatLink_provider_serverId_idx" ON "ChatLink"("provider", "serverId");
