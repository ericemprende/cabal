-- Responder puntualmente a un mensaje del chat en vivo.
ALTER TABLE "ChatMessage" ADD COLUMN "replyToId" TEXT;

ALTER TABLE "ChatMessage" ADD CONSTRAINT "ChatMessage_replyToId_fkey" FOREIGN KEY ("replyToId") REFERENCES "ChatMessage"("id") ON DELETE SET NULL ON UPDATE CASCADE;
