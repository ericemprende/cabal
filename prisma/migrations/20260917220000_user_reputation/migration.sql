-- Reputación de la comunidad sobre una persona: 👍 confío / 👎 no confío, con
-- reseña opcional. Complementa al fueguito del launch, que mide el proyecto y
-- no a quien lo publica.

CREATE TABLE "Reputation" (
    "id" TEXT NOT NULL,
    "targetId" TEXT NOT NULL,
    "authorId" TEXT NOT NULL,
    "value" INTEGER NOT NULL,
    "weight" INTEGER NOT NULL DEFAULT 1,
    "body" TEXT NOT NULL DEFAULT '',
    "hidden" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Reputation_pkey" PRIMARY KEY ("id")
);

-- Un voto por persona y valorado: revotar cambia el voto, no lo duplica.
CREATE UNIQUE INDEX "Reputation_authorId_targetId_key" ON "Reputation"("authorId", "targetId");
CREATE INDEX "Reputation_targetId_hidden_createdAt_idx" ON "Reputation"("targetId", "hidden", "createdAt");
CREATE INDEX "Reputation_authorId_idx" ON "Reputation"("authorId");

ALTER TABLE "Reputation" ADD CONSTRAINT "Reputation_targetId_fkey" FOREIGN KEY ("targetId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Reputation" ADD CONSTRAINT "Reputation_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Resumen ya calculado en el usuario, para enseñar la insignia en listas sin
-- recontar las valoraciones una por una. 50 = neutro, nadie empieza marcado.
ALTER TABLE "User" ADD COLUMN "repUp" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "User" ADD COLUMN "repDown" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "User" ADD COLUMN "repScore" INTEGER NOT NULL DEFAULT 50;

CREATE INDEX "User_repScore_idx" ON "User"("repScore");
