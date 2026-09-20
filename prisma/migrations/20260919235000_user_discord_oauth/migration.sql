-- Cuenta de Discord verificada con OAuth, como ya se hacía con X y Google.
-- discordId es el id numérico del usuario en Discord (snowflake, va como texto
-- porque no cabe en un Int): es lo que el bot necesita para preguntar si esa
-- persona está en un servidor, y con eso el contador de "N de M miembros ya
-- están en Cabal" deja de depender de haber conectado el bot por privado.
ALTER TABLE "User" ADD COLUMN "discordId" TEXT;
ALTER TABLE "User" ADD COLUMN "discordName" TEXT;
ALTER TABLE "User" ADD COLUMN "discordVerified" BOOLEAN NOT NULL DEFAULT false;

-- Único: una cuenta de Discord no puede verificar dos cuentas de Cabal, o los
-- puntos por verificar se cobrarían tantas veces como cuentas se creasen.
CREATE UNIQUE INDEX "User_discordId_key" ON "User"("discordId");
