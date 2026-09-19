-- Última vez que el usuario se dejó ver con su sesión abierta, para el panel de admin.
ALTER TABLE "User" ADD COLUMN "lastSeenAt" TIMESTAMP(3);

CREATE INDEX "User_lastSeenAt_idx" ON "User"("lastSeenAt");
