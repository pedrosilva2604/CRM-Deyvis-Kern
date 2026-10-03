ALTER TABLE "Message" ADD COLUMN "contactName" TEXT,
ADD COLUMN "contactPhone" TEXT,
ADD COLUMN "deletedByContactAt" TIMESTAMP(3);

UPDATE "Message" AS message
SET "contactPhone" = lead."phone",
    "contactName" = lead."name"
FROM "Lead" AS lead
WHERE message."leadId" = lead."id";

ALTER TABLE "Message" ALTER COLUMN "contactPhone" SET NOT NULL;

CREATE INDEX "Message_contactPhone_createdAt_idx" ON "Message"("contactPhone", "createdAt");

UPDATE "AuditLog"
SET "details" = NULL
WHERE "entity" = 'Lead' AND "action" IN ('lead.create', 'lead.delete');
