-- Chat del que nació una call (bot de Telegram/Discord). Null = publicada desde
-- la web, que es lo que vale para todo lo anterior a esta columna.
-- Habilita el leaderboard filtrado por comunidad y la regla de "first call":
-- si el token ya se llamó en ese chat, no se crea una call repetida.
ALTER TABLE "Post" ADD COLUMN     "chatLinkId" TEXT;

CREATE INDEX "Post_chatLinkId_kind_createdAt_idx" ON "Post"("chatLinkId", "kind", "createdAt");

CREATE INDEX "Post_chatLinkId_contract_idx" ON "Post"("chatLinkId", "contract");

-- Si se desvincula el chat, sus calls siguen existiendo en Cabal: solo pierden
-- la referencia al chat de origen.
ALTER TABLE "Post" ADD CONSTRAINT "Post_chatLinkId_fkey" FOREIGN KEY ("chatLinkId") REFERENCES "ChatLink"("id") ON DELETE SET NULL ON UPDATE CASCADE;
