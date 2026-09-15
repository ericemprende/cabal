-- AlterTable: registra la última edición real del launch para mostrarla en Actividad
ALTER TABLE "Launch" ADD COLUMN "lastEditedAt" TIMESTAMP(3);
ALTER TABLE "Launch" ADD COLUMN "lastChangeNote" TEXT;
