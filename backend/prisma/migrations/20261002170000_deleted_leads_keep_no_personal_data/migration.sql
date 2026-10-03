ALTER TABLE "Lead" ADD COLUMN "deletedById" UUID,
ALTER COLUMN "phone" DROP NOT NULL;

ALTER TABLE "Lead" ADD CONSTRAINT "Lead_deletedById_fkey" FOREIGN KEY ("deletedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

DELETE FROM "PipelineCard"
WHERE "leadId" IN (SELECT "id" FROM "Lead" WHERE "deletedAt" IS NOT NULL);

UPDATE "Lead"
SET "name" = 'Lead excluído',
    "phone" = NULL,
    "phoneCountry" = NULL,
    "email" = NULL,
    "source" = NULL,
    "tags" = '{}',
    "value" = NULL,
    "assignedToId" = NULL
WHERE "deletedAt" IS NOT NULL;

ALTER TABLE "Lead" ADD CONSTRAINT "Lead_active_lead_has_phone" CHECK ("deletedAt" IS NOT NULL OR "phone" IS NOT NULL);

ALTER TABLE "LeadImport" DROP COLUMN "restoredLeads",
DROP COLUMN "skippedDeletedLeads";
