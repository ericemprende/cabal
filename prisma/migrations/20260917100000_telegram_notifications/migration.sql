-- Campanita de launches y notificaciones por Telegram (Discord después).

CREATE TABLE "LaunchReminder" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "launchId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "LaunchReminder_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "LaunchReminder_userId_launchId_key" ON "LaunchReminder"("userId", "launchId");
CREATE INDEX "LaunchReminder_launchId_idx" ON "LaunchReminder"("launchId");
ALTER TABLE "LaunchReminder" ADD CONSTRAINT "LaunchReminder_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "LaunchReminder" ADD CONSTRAINT "LaunchReminder_launchId_fkey" FOREIGN KEY ("launchId") REFERENCES "Launch"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "ChatLink" (
    "id" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "chatId" TEXT NOT NULL,
    "chatType" TEXT NOT NULL,
    "title" TEXT,
    "userId" TEXT NOT NULL,
    "externalUserId" TEXT,
    "notifyLaunches" BOOLEAN NOT NULL DEFAULT true,
    "notifyReminders" BOOLEAN NOT NULL DEFAULT true,
    "notifyTheses" BOOLEAN NOT NULL DEFAULT false,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "lastError" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "ChatLink_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "ChatLink_provider_chatId_key" ON "ChatLink"("provider", "chatId");
CREATE INDEX "ChatLink_userId_idx" ON "ChatLink"("userId");
CREATE INDEX "ChatLink_provider_active_idx" ON "ChatLink"("provider", "active");
ALTER TABLE "ChatLink" ADD CONSTRAINT "ChatLink_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "ChatLinkCode" (
    "id" TEXT NOT NULL,
    "codeHash" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "consumedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ChatLinkCode_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "ChatLinkCode_codeHash_key" ON "ChatLinkCode"("codeHash");
CREATE INDEX "ChatLinkCode_userId_createdAt_idx" ON "ChatLinkCode"("userId", "createdAt");
ALTER TABLE "ChatLinkCode" ADD CONSTRAINT "ChatLinkCode_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "NotificationDispatch" (
    "key" TEXT NOT NULL,
    "sentCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "NotificationDispatch_pkey" PRIMARY KEY ("key")
);
CREATE INDEX "NotificationDispatch_createdAt_idx" ON "NotificationDispatch"("createdAt");
