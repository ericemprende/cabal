-- Voto en contra ("popó") de un proyecto, con motivo obligatorio.
--
-- El fueguito solo deja decir "me gusta". Quien ve algo raro en un proyecto no
-- tenía dónde decirlo salvo comentando, y eso no se ve en la tarjeta. Ahora hay
-- un voto en contra al lado del hype, pero con peaje: hay que escribir por qué,
-- y ese porqué se publica como comentario firmado en el hilo del proyecto, para
-- que el dev y la comunidad puedan responder. Si le convencen, se retracta: el
-- voto se va y el comentario queda marcado como retractado.
--
-- Vote.kind: hype y fud son excluyentes (el unique [userId, target, targetId]
-- ya lo garantiza), así que votar en contra retira el hype que hubiera.

ALTER TABLE "Launch" ADD COLUMN "fud" INTEGER NOT NULL DEFAULT 0;

ALTER TABLE "Vote" ADD COLUMN "kind" TEXT NOT NULL DEFAULT 'hype';
ALTER TABLE "Vote" ADD COLUMN "reasonPostId" TEXT;

ALTER TABLE "Post" ADD COLUMN "retracted" BOOLEAN NOT NULL DEFAULT false;
