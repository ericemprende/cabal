-- Avisos automáticos del sistema en el chat en vivo (recordatorio de donaciones)
ALTER TABLE "ChatMessage" ADD COLUMN "system" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "ChatMessage" ADD COLUMN "linkUrl" TEXT;
ALTER TABLE "ChatMessage" ADD COLUMN "linkLabel" TEXT;
