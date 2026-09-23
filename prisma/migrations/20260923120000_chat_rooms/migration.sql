-- El chat pasa a tener una sala por idioma (es | en). El historial que ya
-- existe es en español, así que se queda entero en la sala "es".
ALTER TABLE "ChatMessage" ADD COLUMN "room" TEXT NOT NULL DEFAULT 'es';
CREATE INDEX "ChatMessage_room_createdAt_idx" ON "ChatMessage"("room", "createdAt");
