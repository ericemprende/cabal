-- La whitelist deja de requerir aprobación manual: se liberan las pendientes
-- y las nuevas entradas nacen aprobadas.
UPDATE "WaitlistEntry" SET "status" = 'approved', "approvedAt" = CURRENT_TIMESTAMP WHERE "status" = 'pending';
ALTER TABLE "WaitlistEntry" ALTER COLUMN "status" SET DEFAULT 'approved';
