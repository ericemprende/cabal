-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "handle" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "avatar" TEXT NOT NULL DEFAULT '🐺',
    "bio" TEXT,
    "wallet" TEXT,
    "passwordHash" TEXT,
    "walletVerified" BOOLEAN NOT NULL DEFAULT false,
    "xHandle" TEXT,
    "xVerified" BOOLEAN NOT NULL DEFAULT false,
    "googleEmail" TEXT,
    "googleVerified" BOOLEAN NOT NULL DEFAULT false,
    "tgHandle" TEXT,
    "isDev" BOOLEAN NOT NULL DEFAULT false,
    "cabalScore" INTEGER NOT NULL DEFAULT 0,
    "callsWon" INTEGER NOT NULL DEFAULT 0,
    "callsTotal" INTEGER NOT NULL DEFAULT 0,
    "followers" INTEGER NOT NULL DEFAULT 0,
    "isCurrentUser" BOOLEAN NOT NULL DEFAULT false,
    "isAdmin" BOOLEAN NOT NULL DEFAULT false,
    "points" INTEGER NOT NULL DEFAULT 0,
    "lifetimePoints" INTEGER NOT NULL DEFAULT 0,
    "referralCode" TEXT,
    "referredById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Launch" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "ticker" TEXT,
    "emoji" TEXT NOT NULL DEFAULT '🚀',
    "image" TEXT,
    "banner" TEXT,
    "isPrivate" BOOLEAN NOT NULL DEFAULT false,
    "hidden" BOOLEAN NOT NULL DEFAULT false,
    "submitterRole" TEXT NOT NULL DEFAULT 'community',
    "contract" TEXT,
    "network" TEXT NOT NULL DEFAULT 'solana',
    "launchAt" TIMESTAMP(3) NOT NULL,
    "description" TEXT NOT NULL,
    "website" TEXT,
    "twitter" TEXT,
    "telegram" TEXT,
    "isLive" BOOLEAN NOT NULL DEFAULT false,
    "liveUrl" TEXT,
    "status" TEXT NOT NULL DEFAULT 'upcoming',
    "hype" INTEGER NOT NULL DEFAULT 0,
    "lpLocked" BOOLEAN NOT NULL DEFAULT false,
    "mintRevoked" BOOLEAN NOT NULL DEFAULT false,
    "top10Pct" DOUBLE PRECISION NOT NULL DEFAULT 25,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Launch_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Token" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "ticker" TEXT NOT NULL,
    "emoji" TEXT NOT NULL DEFAULT '🪙',
    "image" TEXT,
    "network" TEXT NOT NULL DEFAULT 'solana',
    "price" DOUBLE PRECISION NOT NULL DEFAULT 0.0001,
    "mc" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "change24h" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "volume24h" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "holders" INTEGER NOT NULL DEFAULT 0,
    "top10Pct" DOUBLE PRECISION NOT NULL DEFAULT 25,
    "contract" TEXT NOT NULL DEFAULT '',
    "devId" TEXT NOT NULL,
    "launchedAt" TIMESTAMP(3) NOT NULL,
    "athMc" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "isRug" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "Token_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Post" (
    "id" TEXT NOT NULL,
    "kind" TEXT NOT NULL DEFAULT 'comment',
    "content" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "launchId" TEXT,
    "tokenId" TEXT,
    "likes" INTEGER NOT NULL DEFAULT 0,
    "pnl" DOUBLE PRECISION,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Post_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Vote" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "target" TEXT NOT NULL,
    "targetId" TEXT NOT NULL,

    CONSTRAINT "Vote_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PointEvent" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "amount" INTEGER NOT NULL,
    "reason" TEXT NOT NULL,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PointEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Setting" (
    "key" TEXT NOT NULL,
    "value" TEXT NOT NULL,

    CONSTRAINT "Setting_pkey" PRIMARY KEY ("key")
);

-- CreateTable
CREATE TABLE "AffiliatePlatform" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "url" TEXT NOT NULL DEFAULT '',
    "links" TEXT NOT NULL DEFAULT '{}',
    "active" BOOLEAN NOT NULL DEFAULT false,
    "order" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AffiliatePlatform_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Follow" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "targetId" TEXT NOT NULL,

    CONSTRAINT "Follow_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WalletLink" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "network" TEXT NOT NULL,
    "address" TEXT NOT NULL,
    "label" TEXT NOT NULL DEFAULT '',
    "signature" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WalletLink_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DevClaim" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "network" TEXT NOT NULL,
    "contract" TEXT NOT NULL,
    "walletAddress" TEXT NOT NULL,
    "name" TEXT NOT NULL DEFAULT '',
    "symbol" TEXT NOT NULL DEFAULT '',
    "status" TEXT NOT NULL DEFAULT 'pending',
    "note" TEXT NOT NULL DEFAULT '',
    "stats" TEXT NOT NULL DEFAULT '{}',
    "source" TEXT NOT NULL DEFAULT 'dexscreener',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "verifiedAt" TIMESTAMP(3),

    CONSTRAINT "DevClaim_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProjectClaim" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "targetType" TEXT NOT NULL,
    "targetId" TEXT NOT NULL,
    "network" TEXT NOT NULL,
    "contract" TEXT NOT NULL,
    "wallet" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "method" TEXT NOT NULL DEFAULT 'manual',
    "note" TEXT NOT NULL DEFAULT '',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "verifiedAt" TIMESTAMP(3),

    CONSTRAINT "ProjectClaim_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_handle_key" ON "User"("handle");

-- CreateIndex
CREATE UNIQUE INDEX "User_referralCode_key" ON "User"("referralCode");

-- CreateIndex
CREATE INDEX "User_points_idx" ON "User"("points");

-- CreateIndex
CREATE INDEX "User_referredById_idx" ON "User"("referredById");

-- CreateIndex
CREATE INDEX "User_createdAt_idx" ON "User"("createdAt");

-- CreateIndex
CREATE INDEX "Launch_status_launchAt_idx" ON "Launch"("status", "launchAt");

-- CreateIndex
CREATE INDEX "Launch_createdById_idx" ON "Launch"("createdById");

-- CreateIndex
CREATE INDEX "Launch_contract_idx" ON "Launch"("contract");

-- CreateIndex
CREATE INDEX "Token_devId_idx" ON "Token"("devId");

-- CreateIndex
CREATE INDEX "Token_contract_idx" ON "Token"("contract");

-- CreateIndex
CREATE INDEX "Token_launchedAt_idx" ON "Token"("launchedAt");

-- CreateIndex
CREATE INDEX "Post_launchId_createdAt_idx" ON "Post"("launchId", "createdAt");

-- CreateIndex
CREATE INDEX "Post_tokenId_createdAt_idx" ON "Post"("tokenId", "createdAt");

-- CreateIndex
CREATE INDEX "Post_userId_createdAt_idx" ON "Post"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "Post_createdAt_idx" ON "Post"("createdAt");

-- CreateIndex
CREATE INDEX "Vote_target_targetId_idx" ON "Vote"("target", "targetId");

-- CreateIndex
CREATE UNIQUE INDEX "Vote_userId_target_targetId_key" ON "Vote"("userId", "target", "targetId");

-- CreateIndex
CREATE INDEX "PointEvent_userId_createdAt_idx" ON "PointEvent"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "PointEvent_createdAt_idx" ON "PointEvent"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "AffiliatePlatform_slug_key" ON "AffiliatePlatform"("slug");

-- CreateIndex
CREATE INDEX "Follow_targetId_idx" ON "Follow"("targetId");

-- CreateIndex
CREATE UNIQUE INDEX "Follow_userId_targetId_key" ON "Follow"("userId", "targetId");

-- CreateIndex
CREATE UNIQUE INDEX "WalletLink_userId_network_address_key" ON "WalletLink"("userId", "network", "address");

-- CreateIndex
CREATE INDEX "DevClaim_userId_idx" ON "DevClaim"("userId");

-- CreateIndex
CREATE INDEX "DevClaim_status_idx" ON "DevClaim"("status");

-- CreateIndex
CREATE UNIQUE INDEX "DevClaim_userId_network_contract_key" ON "DevClaim"("userId", "network", "contract");

-- CreateIndex
CREATE INDEX "ProjectClaim_targetType_targetId_idx" ON "ProjectClaim"("targetType", "targetId");

-- CreateIndex
CREATE INDEX "ProjectClaim_status_idx" ON "ProjectClaim"("status");

-- CreateIndex
CREATE UNIQUE INDEX "ProjectClaim_userId_targetType_targetId_key" ON "ProjectClaim"("userId", "targetType", "targetId");

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_referredById_fkey" FOREIGN KEY ("referredById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Launch" ADD CONSTRAINT "Launch_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Token" ADD CONSTRAINT "Token_devId_fkey" FOREIGN KEY ("devId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Post" ADD CONSTRAINT "Post_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Post" ADD CONSTRAINT "Post_launchId_fkey" FOREIGN KEY ("launchId") REFERENCES "Launch"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Post" ADD CONSTRAINT "Post_tokenId_fkey" FOREIGN KEY ("tokenId") REFERENCES "Token"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Vote" ADD CONSTRAINT "Vote_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PointEvent" ADD CONSTRAINT "PointEvent_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Follow" ADD CONSTRAINT "Follow_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Follow" ADD CONSTRAINT "Follow_targetId_fkey" FOREIGN KEY ("targetId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WalletLink" ADD CONSTRAINT "WalletLink_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DevClaim" ADD CONSTRAINT "DevClaim_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProjectClaim" ADD CONSTRAINT "ProjectClaim_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
