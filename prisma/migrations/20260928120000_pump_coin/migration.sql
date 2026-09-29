-- Tokens creados en pump.fun desde Cabal (/lanzar).
CREATE TABLE "PumpCoin" (
    "mint" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "symbol" TEXT NOT NULL,
    "description" TEXT NOT NULL DEFAULT '',
    "image" TEXT NOT NULL,
    "twitter" TEXT,
    "telegram" TEXT,
    "website" TEXT,
    "creatorWallet" TEXT NOT NULL,
    "initialBuySol" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "signature" TEXT,
    "launchedAt" TIMESTAMP(3),
    "launchId" TEXT,
    "userId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "PumpCoin_pkey" PRIMARY KEY ("mint")
);
CREATE UNIQUE INDEX "PumpCoin_launchId_key" ON "PumpCoin"("launchId");
CREATE INDEX "PumpCoin_userId_createdAt_idx" ON "PumpCoin"("userId", "createdAt");
ALTER TABLE "PumpCoin" ADD CONSTRAINT "PumpCoin_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
