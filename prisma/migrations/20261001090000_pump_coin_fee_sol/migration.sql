-- SOL cobrados por lanzamiento, para /admin → Ingresos
ALTER TABLE "PumpCoin" ADD COLUMN "feeSol" DOUBLE PRECISION NOT NULL DEFAULT 0;

-- Los lanzamientos anteriores no guardaban la comisión: se rellena con la
-- vigente hoy en cada launchpad (0,025 SOL si nunca se cambió en /admin).
UPDATE "PumpCoin" c SET "feeSol" = COALESCE(
  (SELECT NULLIF(s."value", '')::double precision FROM "Setting" s WHERE s."key" = 'launch_fee_sol:' || c."platform"),
  CASE WHEN c."platform" = 'pump'
    THEN COALESCE((SELECT NULLIF(s."value", '')::double precision FROM "Setting" s WHERE s."key" = 'pump_launch_fee_sol'), 0.025)
    ELSE 0.025 END
)
WHERE c."launchedAt" IS NOT NULL OR c."feeSignature" IS NOT NULL;
