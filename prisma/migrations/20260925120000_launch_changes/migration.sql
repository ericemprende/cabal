-- Historial de cambios de cada launch. Se siembra con la última edición que
-- ya estaba guardada en Launch.lastChangeNote.
CREATE TABLE "LaunchChange" (
    "id" TEXT NOT NULL,
    "launchId" TEXT NOT NULL,
    "userId" TEXT,
    "note" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "LaunchChange_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "LaunchChange_launchId_createdAt_idx" ON "LaunchChange"("launchId", "createdAt");
ALTER TABLE "LaunchChange" ADD CONSTRAINT "LaunchChange_launchId_fkey" FOREIGN KEY ("launchId") REFERENCES "Launch"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "LaunchChange" ADD CONSTRAINT "LaunchChange_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

INSERT INTO "LaunchChange" ("id", "launchId", "userId", "note", "createdAt")
SELECT 'seed_' || "id", "id", NULL, "lastChangeNote", "lastEditedAt"
FROM "Launch"
WHERE "lastChangeNote" IS NOT NULL AND "lastEditedAt" IS NOT NULL;
