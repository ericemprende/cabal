-- "Me gusta" a los mensajes del chat en vivo
CREATE TABLE "ChatMessageLike" (
    "id" TEXT NOT NULL,
    "messageId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ChatMessageLike_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ChatMessageLike_messageId_userId_key" ON "ChatMessageLike"("messageId", "userId");

ALTER TABLE "ChatMessageLike" ADD CONSTRAINT "ChatMessageLike_messageId_fkey" FOREIGN KEY ("messageId") REFERENCES "ChatMessage"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ChatMessageLike" ADD CONSTRAINT "ChatMessageLike_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
