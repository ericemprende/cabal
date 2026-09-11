-- Tokens que salen del Radar: el dev pasa a ser opcional (un token publicado
-- por un scout no tiene dev hasta que alguien lo reclama y se verifica) y el
-- token queda enlazado al launch del que salió. Solo añade y relaja: no borra
-- ni modifica datos existentes.

-- DropForeignKey
ALTER TABLE "Token" DROP CONSTRAINT "Token_devId_fkey";

-- AlterTable
ALTER TABLE "Token" ADD COLUMN     "launchId" TEXT,
ALTER COLUMN "devId" DROP NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "Token_launchId_key" ON "Token"("launchId");

-- AddForeignKey
ALTER TABLE "Token" ADD CONSTRAINT "Token_devId_fkey" FOREIGN KEY ("devId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Token" ADD CONSTRAINT "Token_launchId_fkey" FOREIGN KEY ("launchId") REFERENCES "Launch"("id") ON DELETE SET NULL ON UPDATE CASCADE;

