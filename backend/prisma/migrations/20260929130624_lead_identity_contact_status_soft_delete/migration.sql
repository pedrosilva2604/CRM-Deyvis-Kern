-- CreateEnum
CREATE TYPE "LeadContactStatus" AS ENUM ('VALID', 'INVALID', 'SPAM');

-- DropIndex
DROP INDEX "Lead_phone_pipelineId_key";

-- AlterTable
ALTER TABLE "Lead" ADD COLUMN     "contactStatus" "LeadContactStatus" NOT NULL DEFAULT 'VALID',
ADD COLUMN     "deletedAt" TIMESTAMP(3),
ADD COLUMN     "enteredOn" DATE NOT NULL,
ADD COLUMN     "phoneCountry" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "Lead_phone_key" ON "Lead"("phone");

-- CreateIndex
CREATE UNIQUE INDEX "Lead_email_key" ON "Lead"("email");

-- CreateIndex
CREATE INDEX "Lead_assignedToId_idx" ON "Lead"("assignedToId");

-- CreateIndex
CREATE INDEX "Lead_contactStatus_idx" ON "Lead"("contactStatus");

-- CreateIndex
CREATE INDEX "Lead_source_idx" ON "Lead"("source");

-- CreateIndex
CREATE INDEX "Lead_enteredOn_idx" ON "Lead"("enteredOn");

-- CreateIndex
CREATE INDEX "Lead_deletedAt_createdAt_idx" ON "Lead"("deletedAt", "createdAt");
