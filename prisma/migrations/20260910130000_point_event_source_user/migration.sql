-- AlterTable
ALTER TABLE "PointEvent" ADD COLUMN "sourceUserId" TEXT;

-- CreateIndex
CREATE INDEX "PointEvent_userId_reason_sourceUserId_idx" ON "PointEvent"("userId", "reason", "sourceUserId");
