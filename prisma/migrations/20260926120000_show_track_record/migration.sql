-- Track record de trading público en el perfil, solo si el usuario lo activa.
ALTER TABLE "User" ADD COLUMN "showTrackRecord" BOOLEAN NOT NULL DEFAULT false;
