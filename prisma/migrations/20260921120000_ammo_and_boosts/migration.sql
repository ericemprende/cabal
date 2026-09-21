-- Munición (balas) y boosts: una bala es un minuto de proyecto destacado en el
-- Radar. El saldo vive en User.ammo y cada movimiento queda en AmmoEntry.

ALTER TABLE "User" ADD COLUMN "ammo" INTEGER NOT NULL DEFAULT 0;

CREATE TABLE "AmmoEntry" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "amount" INTEGER NOT NULL,
    "reason" TEXT NOT NULL,
    "packKey" TEXT,
    "paymentId" TEXT,
    "subscriptionId" TEXT,
    "boostId" TEXT,
    "note" TEXT NOT NULL DEFAULT '',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AmmoEntry_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "AmmoEntry_paymentId_key" ON "AmmoEntry"("paymentId");
CREATE UNIQUE INDEX "AmmoEntry_subscriptionId_key" ON "AmmoEntry"("subscriptionId");
CREATE INDEX "AmmoEntry_userId_createdAt_idx" ON "AmmoEntry"("userId", "createdAt");

ALTER TABLE "AmmoEntry" ADD CONSTRAINT "AmmoEntry_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "Boost" (
    "id" TEXT NOT NULL,
    "targetType" TEXT NOT NULL,
    "targetId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "bullets" INTEGER NOT NULL,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "endsAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Boost_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "Boost_targetType_targetId_endsAt_idx" ON "Boost"("targetType", "targetId", "endsAt");
CREATE INDEX "Boost_endsAt_idx" ON "Boost"("endsAt");
CREATE INDEX "Boost_userId_createdAt_idx" ON "Boost"("userId", "createdAt");

ALTER TABLE "Boost" ADD CONSTRAINT "Boost_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
