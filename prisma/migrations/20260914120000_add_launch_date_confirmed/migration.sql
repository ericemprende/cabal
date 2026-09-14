-- AlterTable: distingue fecha confirmada de fecha estimada por quien sube el proyecto
ALTER TABLE "Launch" ADD COLUMN "dateConfirmed" BOOLEAN NOT NULL DEFAULT true;
