ALTER TABLE "LeadImport" ADD COLUMN "queuedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

UPDATE "LeadImport" SET "queuedAt" = "createdAt";

CREATE INDEX "LeadImport_status_queuedAt_idx" ON "LeadImport"("status", "queuedAt");
