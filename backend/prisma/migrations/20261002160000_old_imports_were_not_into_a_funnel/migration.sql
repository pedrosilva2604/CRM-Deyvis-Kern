UPDATE "LeadImport"
SET "pipelineId" = NULL, "stageId" = NULL
WHERE "pipelineId" IS NOT NULL
  AND "createdAt" < (
    SELECT "finished_at" AT TIME ZONE 'UTC'
    FROM "_prisma_migrations"
    WHERE "migration_name" = '20261002120000_private_pipelines_and_cards'
      AND "finished_at" IS NOT NULL
    ORDER BY "finished_at" DESC
    LIMIT 1
  );
