-- Respuestas a un post: el comentario guarda a qué post contestó, para poder
-- citarlo en el feed y en la actividad.
ALTER TABLE "Post" ADD COLUMN "parentId" TEXT;

CREATE INDEX "Post_parentId_createdAt_idx" ON "Post"("parentId", "createdAt");

ALTER TABLE "Post" ADD CONSTRAINT "Post_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "Post"("id") ON DELETE SET NULL ON UPDATE CASCADE;
