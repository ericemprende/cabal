-- CreateTable
CREATE TABLE "SwapFeeConfig" (
    "id" TEXT NOT NULL,
    "network" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT false,
    "feeBps" INTEGER NOT NULL DEFAULT 37,
    "smallTradeUsd" DOUBLE PRECISION NOT NULL DEFAULT 10,
    "smallTradeFeeBps" INTEGER NOT NULL DEFAULT 5,
    "referralAccount" TEXT NOT NULL DEFAULT '',
    "feeWallet" TEXT NOT NULL DEFAULT '',
    "note" TEXT NOT NULL DEFAULT '',
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SwapFeeConfig_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "SwapFeeConfig_network_key" ON "SwapFeeConfig"("network");
