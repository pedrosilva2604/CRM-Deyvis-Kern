ALTER TABLE "User" ADD COLUMN "deletedAt" TIMESTAMP(3);

UPDATE "PipelineCard" AS card
SET "addedById" = pipeline."ownerId"
FROM "Pipeline" AS pipeline
WHERE card."pipelineId" = pipeline."id" AND card."addedById" IS NULL;

UPDATE "PipelineMember" AS member
SET "addedById" = pipeline."ownerId"
FROM "Pipeline" AS pipeline
WHERE member."pipelineId" = pipeline."id" AND member."addedById" IS NULL;

UPDATE "LeadImport"
SET "requestedById" = (
  SELECT "id" FROM "User" ORDER BY ("role" = 'ADMIN') DESC, "createdAt" ASC, "id" ASC LIMIT 1
)
WHERE "requestedById" IS NULL;

DELETE FROM "LeadImport" WHERE "requestedById" IS NULL;

ALTER TABLE "LeadImport" DROP CONSTRAINT "LeadImport_requestedById_fkey";
ALTER TABLE "PipelineCard" DROP CONSTRAINT "PipelineCard_addedById_fkey";
ALTER TABLE "PipelineMember" DROP CONSTRAINT "PipelineMember_addedById_fkey";

ALTER TABLE "LeadImport" ALTER COLUMN "requestedById" SET NOT NULL;
ALTER TABLE "PipelineCard" ALTER COLUMN "addedById" SET NOT NULL;
ALTER TABLE "PipelineMember" ALTER COLUMN "addedById" SET NOT NULL;

ALTER TABLE "PipelineMember" ADD CONSTRAINT "PipelineMember_addedById_fkey" FOREIGN KEY ("addedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "PipelineCard" ADD CONSTRAINT "PipelineCard_addedById_fkey" FOREIGN KEY ("addedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "LeadImport" ADD CONSTRAINT "LeadImport_requestedById_fkey" FOREIGN KEY ("requestedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
