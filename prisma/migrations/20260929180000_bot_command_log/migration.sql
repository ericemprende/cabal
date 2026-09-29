-- Registro de comandos de los bots: uso, tiempos y errores con código de referencia.
CREATE TABLE "BotCommandLog" (
    "id" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "command" TEXT NOT NULL,
    "chatId" TEXT,
    "actorId" TEXT,
    "ms" INTEGER NOT NULL,
    "ok" BOOLEAN NOT NULL,
    "errorRef" TEXT,
    "error" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BotCommandLog_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "BotCommandLog_errorRef_key" ON "BotCommandLog"("errorRef");
CREATE INDEX "BotCommandLog_createdAt_idx" ON "BotCommandLog"("createdAt");
CREATE INDEX "BotCommandLog_provider_createdAt_idx" ON "BotCommandLog"("provider", "createdAt");
