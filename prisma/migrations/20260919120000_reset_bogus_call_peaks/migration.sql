-- Picos corruptos por velas malas de GeckoTerminal (p. ej. $JUPCAT en 7252x).
-- Se borran para que syncCallResults los recalcule con el filtro de velas;
-- esa misma pasada recalcula los totales del usuario.
UPDATE "Post"
SET "peakMultiple" = NULL, "resultCheckedAt" = NULL, "resultFinal" = false
WHERE "kind" = 'call' AND "peakMultiple" > 1000;
