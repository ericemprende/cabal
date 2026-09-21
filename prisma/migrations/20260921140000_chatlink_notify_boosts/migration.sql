-- Avisar en Telegram y Discord cuando alguien mete munición fuerte en un
-- proyecto. Por defecto encendido: es un aviso poco frecuente (solo disparos
-- grandes) y de los que mueven a la comunidad.

ALTER TABLE "ChatLink" ADD COLUMN "notifyBoosts" BOOLEAN NOT NULL DEFAULT true;
