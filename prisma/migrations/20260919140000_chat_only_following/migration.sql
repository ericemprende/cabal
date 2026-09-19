-- Solo avisos (calls, tesis, lanzamientos) de cuentas que sigue quien vinculó el chat
ALTER TABLE "ChatLink" ADD COLUMN "onlyFollowing" BOOLEAN NOT NULL DEFAULT false;
