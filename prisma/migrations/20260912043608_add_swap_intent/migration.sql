-- CreateTable
CREATE TABLE "SwapIntent" (
    "id" TEXT NOT NULL,
    "network" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "walletAddress" TEXT NOT NULL,
    "mint" TEXT NOT NULL,
    "amountUsd" DOUBLE PRECISION NOT NULL,
    "feeUsd" DOUBLE PRECISION NOT NULL,
    "consumed" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SwapIntent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "SwapIntent_walletAddress_createdAt_idx" ON "SwapIntent"("walletAddress", "createdAt");
