-- CreateEnum
CREATE TYPE "LeadImportStatus" AS ENUM ('PENDING', 'PROCESSING', 'COMPLETED', 'FAILED');

-- CreateTable
CREATE TABLE "LeadImport" (
    "id" UUID NOT NULL,
    "status" "LeadImportStatus" NOT NULL DEFAULT 'PENDING',
    "totalRows" INTEGER NOT NULL,
    "invalidRows" INTEGER NOT NULL,
    "duplicateRowsInFile" INTEGER NOT NULL,
    "rowsToImport" INTEGER NOT NULL,
    "importedLeads" INTEGER NOT NULL DEFAULT 0,
    "skippedExistingLeads" INTEGER NOT NULL DEFAULT 0,
    "pipelineId" UUID NOT NULL,
    "stageId" UUID NOT NULL,
    "requestedById" UUID,
    "failureReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "startedAt" TIMESTAMP(3),
    "finishedAt" TIMESTAMP(3),

    CONSTRAINT "LeadImport_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LeadImportRow" (
    "id" UUID NOT NULL,
    "leadImportId" UUID NOT NULL,
    "rowNumber" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "phoneCountry" TEXT,
    "email" TEXT,
    "enteredOn" DATE NOT NULL,

    CONSTRAINT "LeadImportRow_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "LeadImport_status_createdAt_idx" ON "LeadImport"("status", "createdAt");

-- CreateIndex
CREATE INDEX "LeadImport_requestedById_idx" ON "LeadImport"("requestedById");

-- CreateIndex
CREATE INDEX "LeadImportRow_leadImportId_rowNumber_idx" ON "LeadImportRow"("leadImportId", "rowNumber");

-- AddForeignKey
ALTER TABLE "LeadImport" ADD CONSTRAINT "LeadImport_pipelineId_fkey" FOREIGN KEY ("pipelineId") REFERENCES "Pipeline"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LeadImport" ADD CONSTRAINT "LeadImport_stageId_fkey" FOREIGN KEY ("stageId") REFERENCES "Stage"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LeadImport" ADD CONSTRAINT "LeadImport_requestedById_fkey" FOREIGN KEY ("requestedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LeadImportRow" ADD CONSTRAINT "LeadImportRow_leadImportId_fkey" FOREIGN KEY ("leadImportId") REFERENCES "LeadImport"("id") ON DELETE CASCADE ON UPDATE CASCADE;
