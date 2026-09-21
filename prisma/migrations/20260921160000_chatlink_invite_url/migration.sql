-- Enlace público para unirse al clan, pegado por su dueño.
--
-- El botón "Unirme" de la tarjeta del clan necesita un enlace. En Telegram
-- casi siempre sale solo (el @usuario del grupo o su invite_link), pero en
-- Discord la API solo da uno si el servidor tiene URL personalizada, que pide
-- nivel 3 de boosts. Con esta columna el dueño puede pegar el suyo y el clan
-- deja de quedarse sin botón.

ALTER TABLE "ChatLink" ADD COLUMN "inviteUrl" TEXT;
