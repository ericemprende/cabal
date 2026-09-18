-- Verificación oficial de perfiles, launches y tokens, y solicitudes Premium.
ALTER TABLE "User" ADD COLUMN "verified" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "User" ADD COLUMN "verifiedVia" TEXT;
ALTER TABLE "Launch" ADD COLUMN "verified" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Launch" ADD COLUMN "verifiedVia" TEXT;
ALTER TABLE "Token" ADD COLUMN "verified" BOOLEAN NOT NULL DEFAULT false;

CREATE TABLE "VerificationRequest" (
    "id" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "launchId" TEXT,
    "note" TEXT NOT NULL DEFAULT '',
    "status" TEXT NOT NULL DEFAULT 'pending',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "reviewedAt" TIMESTAMP(3),
    CONSTRAINT "VerificationRequest_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "VerificationRequest_status_createdAt_idx" ON "VerificationRequest"("status", "createdAt");
CREATE INDEX "VerificationRequest_userId_idx" ON "VerificationRequest"("userId");
CREATE INDEX "VerificationRequest_launchId_idx" ON "VerificationRequest"("launchId");

ALTER TABLE "VerificationRequest" ADD CONSTRAINT "VerificationRequest_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "VerificationRequest" ADD CONSTRAINT "VerificationRequest_launchId_fkey" FOREIGN KEY ("launchId") REFERENCES "Launch"("id") ON DELETE CASCADE ON UPDATE CASCADE;
