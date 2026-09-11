-- Avisos de lanzamientos por correo (perk Premium): preferencia por usuario
-- (notifyEmail) y una marca por launch y umbral (LaunchAlert) para no avisar
-- dos veces del mismo lanzamiento. Solo añade: no borra ni modifica datos.

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "notifyEmail" BOOLEAN NOT NULL DEFAULT true;

-- CreateTable
CREATE TABLE "LaunchAlert" (
    "id" TEXT NOT NULL,
    "launchId" TEXT NOT NULL,
    "threshold" INTEGER NOT NULL,
    "sentCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LaunchAlert_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "LaunchAlert_launchId_threshold_key" ON "LaunchAlert"("launchId", "threshold");

