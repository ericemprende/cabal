-- Solo datos: copia la foto de X guardada en la lista de espera al avatar de
-- la cuenta Cabal, salvo que el usuario haya subido una foto propia.
UPDATE "User" u
SET "avatar" = w."xAvatar"
FROM "WaitlistEntry" w
WHERE w."userId" = u."id"
  AND w."xAvatar" LIKE 'https://pbs.twimg.com/%'
  AND u."avatar" NOT LIKE '/uploads/%';

-- Cuentas verificadas con X sin entrada enlazada: emparejar por @handle
UPDATE "User" u
SET "avatar" = w."xAvatar"
FROM "WaitlistEntry" w
WHERE w."userId" IS NULL
  AND u."xHandle" IS NOT NULL
  AND lower(w."xHandle") = lower(u."xHandle")
  AND w."xAvatar" LIKE 'https://pbs.twimg.com/%'
  AND u."avatar" NOT LIKE '/uploads/%'
  AND u."avatar" NOT LIKE 'https://%';
