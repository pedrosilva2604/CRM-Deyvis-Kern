ALTER TABLE "Pipeline" ADD COLUMN "ownerId" UUID;

UPDATE "Pipeline"
SET "ownerId" = (
  SELECT "id" FROM "User"
  ORDER BY ("role" = 'ADMIN') DESC, "createdAt" ASC
  LIMIT 1
)
WHERE "ownerId" IS NULL;

CREATE TABLE "PipelineMember" (
    "id" UUID NOT NULL,
    "pipelineId" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "addedById" UUID,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PipelineMember_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "PipelineMember_userId_idx" ON "PipelineMember"("userId");

CREATE UNIQUE INDEX "PipelineMember_pipelineId_userId_key" ON "PipelineMember"("pipelineId", "userId");

ALTER TABLE "PipelineMember" ADD CONSTRAINT "PipelineMember_pipelineId_fkey" FOREIGN KEY ("pipelineId") REFERENCES "Pipeline"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "PipelineMember" ADD CONSTRAINT "PipelineMember_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "PipelineMember" ADD CONSTRAINT "PipelineMember_addedById_fkey" FOREIGN KEY ("addedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE "PipelineCard" (
    "id" UUID NOT NULL,
    "pipelineId" UUID NOT NULL,
    "stageId" UUID NOT NULL,
    "leadId" UUID NOT NULL,
    "position" DOUBLE PRECISION NOT NULL,
    "wonValue" DECIMAL(12,2),
    "closingNote" TEXT,
    "closedAt" TIMESTAMP(3),
    "addedById" UUID,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PipelineCard_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "PipelineCard_stageId_position_idx" ON "PipelineCard"("stageId", "position");

CREATE INDEX "PipelineCard_leadId_idx" ON "PipelineCard"("leadId");

CREATE UNIQUE INDEX "PipelineCard_pipelineId_leadId_key" ON "PipelineCard"("pipelineId", "leadId");

ALTER TABLE "PipelineCard" ADD CONSTRAINT "PipelineCard_pipelineId_fkey" FOREIGN KEY ("pipelineId") REFERENCES "Pipeline"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "PipelineCard" ADD CONSTRAINT "PipelineCard_stageId_fkey" FOREIGN KEY ("stageId") REFERENCES "Stage"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "PipelineCard" ADD CONSTRAINT "PipelineCard_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "Lead"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "PipelineCard" ADD CONSTRAINT "PipelineCard_addedById_fkey" FOREIGN KEY ("addedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

INSERT INTO "PipelineCard" ("id", "pipelineId", "stageId", "leadId", "position", "createdAt", "updatedAt")
SELECT
  gen_random_uuid(),
  "pipelineId",
  "stageId",
  "id",
  1024 * ROW_NUMBER() OVER (PARTITION BY "stageId" ORDER BY "createdAt" DESC, "id" ASC),
  "createdAt",
  CURRENT_TIMESTAMP
FROM "Lead";

WITH "UsersWithoutPipeline" AS (
  SELECT "User"."id", "User"."name" FROM "User"
  WHERE NOT EXISTS (SELECT 1 FROM "Pipeline" WHERE "Pipeline"."ownerId" = "User"."id")
),
"CreatedPipelines" AS (
  INSERT INTO "Pipeline" ("id", "name", "position", "ownerId", "createdAt", "updatedAt")
  SELECT gen_random_uuid(), 'Funil de ' || "name", 0, "id", CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
  FROM "UsersWithoutPipeline"
  RETURNING "id"
)
INSERT INTO "Stage" ("id", "pipelineId", "name", "color", "position", "isWon", "isLost")
SELECT gen_random_uuid(), "CreatedPipelines"."id", "DefaultStage"."name", "DefaultStage"."color", "DefaultStage"."position", "DefaultStage"."isWon", "DefaultStage"."isLost"
FROM "CreatedPipelines"
CROSS JOIN (
  VALUES
    ('Novo lead', '#3b82f6', 0, false, false),
    ('Em atendimento', '#f59e0b', 1, false, false),
    ('Proposta', '#8b5cf6', 2, false, false),
    ('Ganho', '#22c55e', 3, true, false),
    ('Perdido', '#ef4444', 4, false, true)
) AS "DefaultStage"("name", "color", "position", "isWon", "isLost");

ALTER TABLE "Lead" DROP CONSTRAINT "Lead_pipelineId_fkey";

ALTER TABLE "Lead" DROP CONSTRAINT "Lead_stageId_fkey";

DROP INDEX "Lead_stageId_idx";

ALTER TABLE "Lead" DROP COLUMN "pipelineId",
DROP COLUMN "position",
DROP COLUMN "stageId";

DELETE FROM "PipelineCard" WHERE "pipelineId" IN (SELECT "id" FROM "Pipeline" WHERE "ownerId" IS NULL);

DELETE FROM "Pipeline" WHERE "ownerId" IS NULL;

ALTER TABLE "Pipeline" ALTER COLUMN "ownerId" SET NOT NULL;

CREATE INDEX "Pipeline_ownerId_idx" ON "Pipeline"("ownerId");

ALTER TABLE "Pipeline" ADD CONSTRAINT "Pipeline_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "LeadImport" ADD COLUMN "addedToPipelineLeads" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN "alreadyInPipelineLeads" INTEGER NOT NULL DEFAULT 0,
ALTER COLUMN "pipelineId" DROP NOT NULL,
ALTER COLUMN "stageId" DROP NOT NULL;
