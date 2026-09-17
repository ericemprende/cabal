-- Antelación configurable del aviso de lanzamiento. Hasta ahora era fija en 60
-- minutos, así que ese es el valor por defecto y nada cambia para quien no lo
-- toque. El del usuario manda en su campanita (chat privado y correo); el del
-- chat, en el aviso que se difunde a un grupo, canal o servidor.
ALTER TABLE "User" ADD COLUMN     "reminderLeadMin" INTEGER NOT NULL DEFAULT 60;

ALTER TABLE "ChatLink" ADD COLUMN     "reminderLeadMin" INTEGER NOT NULL DEFAULT 60;
