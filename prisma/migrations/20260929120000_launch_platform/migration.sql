-- Plataforma del lanzamiento (pump, bonk…): el formulario de /lanzar es uno para todas.
ALTER TABLE "PumpCoin" ADD COLUMN "platform" TEXT NOT NULL DEFAULT 'pump';
