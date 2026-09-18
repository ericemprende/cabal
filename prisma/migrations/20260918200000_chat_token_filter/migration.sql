-- Filtro por token de un chat: si tiene entradas, solo le llegan avisos de esos tokens
ALTER TABLE "ChatLink" ADD COLUMN "tokenFilter" TEXT[] DEFAULT ARRAY[]::TEXT[];
