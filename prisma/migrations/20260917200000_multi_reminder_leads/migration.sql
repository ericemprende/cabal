-- La antelación pasa de ser una a ser varias: quien quiera aviso a 1 hora y
-- otro a 5 minutos los recibe los dos. Se conserva lo que cada uno tuviera.
ALTER TABLE "User" ADD COLUMN     "reminderLeads" INTEGER[] NOT NULL DEFAULT ARRAY[60];
UPDATE "User" SET "reminderLeads" = ARRAY["reminderLeadMin"];
ALTER TABLE "User" DROP COLUMN "reminderLeadMin";

ALTER TABLE "ChatLink" ADD COLUMN     "reminderLeads" INTEGER[] NOT NULL DEFAULT ARRAY[60];
UPDATE "ChatLink" SET "reminderLeads" = ARRAY["reminderLeadMin"];
ALTER TABLE "ChatLink" DROP COLUMN "reminderLeadMin";

-- Difundir a este chat las calls nuevas publicadas en Cabal (el sentido
-- web → bot). Apagado por defecto: un grupo que hoy solo recibe lanzamientos
-- no debe empezar a recibir calls sin que nadie lo pida.
ALTER TABLE "ChatLink" ADD COLUMN     "notifyCalls" BOOLEAN NOT NULL DEFAULT false;
