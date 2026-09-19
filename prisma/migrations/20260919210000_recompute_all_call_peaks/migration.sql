-- El pico de las calls se calculaba con velas de GeckoTerminal que (1) en pools
-- contra otra memecoin venían con el precio del OTRO token (p. ej. $OOF en 546958x)
-- y (2) incluían el máximo de la hora anterior a la call. Se borran todos los
-- picos para que syncCallResults los recalcule desde el minuto exacto de la call;
-- esa pasada también recalcula los totales y el ranking de cada usuario.
UPDATE "Post"
SET "peakMultiple" = NULL, "resultCheckedAt" = NULL, "resultFinal" = false
WHERE "kind" = 'call';
