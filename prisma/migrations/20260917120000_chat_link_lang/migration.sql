-- Idioma de los mensajes del bot en cada chat vinculado (es | en).
ALTER TABLE "ChatLink" ADD COLUMN     "lang" TEXT NOT NULL DEFAULT 'es';
