-- CreateTable
CREATE TABLE "WaitlistEntry" (
    "id" TEXT NOT NULL,
    "xId" TEXT NOT NULL,
    "xHandle" TEXT NOT NULL,
    "xName" TEXT NOT NULL DEFAULT '',
    "xAvatar" TEXT,
    "xFollowers" INTEGER NOT NULL DEFAULT 0,
    "xVerified" BOOLEAN NOT NULL DEFAULT false,
    "xCreatedAt" TIMESTAMP(3),
    "userId" TEXT,
    "email" TEXT NOT NULL DEFAULT '',
    "telegram" TEXT NOT NULL DEFAULT '',
    "wallet" TEXT NOT NULL DEFAULT '',
    "country" TEXT NOT NULL DEFAULT '',
    "reason" TEXT NOT NULL DEFAULT '',
    "completed" BOOLEAN NOT NULL DEFAULT false,
    "completedAt" TIMESTAMP(3),
    "status" TEXT NOT NULL DEFAULT 'pending',
    "shared" BOOLEAN NOT NULL DEFAULT false,
    "sharedAt" TIMESTAMP(3),
    "referredBy" TEXT,
    "note" TEXT NOT NULL DEFAULT '',
    "ip" TEXT NOT NULL DEFAULT '',
    "userAgent" TEXT NOT NULL DEFAULT '',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "approvedAt" TIMESTAMP(3),

    CONSTRAINT "WaitlistEntry_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "WaitlistEntry_xId_key" ON "WaitlistEntry"("xId");

-- CreateIndex
CREATE UNIQUE INDEX "WaitlistEntry_userId_key" ON "WaitlistEntry"("userId");

-- CreateIndex
CREATE INDEX "WaitlistEntry_status_createdAt_idx" ON "WaitlistEntry"("status", "createdAt");

-- CreateIndex
CREATE INDEX "WaitlistEntry_createdAt_idx" ON "WaitlistEntry"("createdAt");

-- CreateIndex
CREATE INDEX "WaitlistEntry_xHandle_idx" ON "WaitlistEntry"("xHandle");

-- CreateIndex
CREATE INDEX "WaitlistEntry_completed_idx" ON "WaitlistEntry"("completed");
