-- Borrado de cuenta (App Store 5.1.1): se anonimiza en vez de borrar filas.
ALTER TABLE "User" ADD COLUMN "deletedAt" TIMESTAMP(3);
