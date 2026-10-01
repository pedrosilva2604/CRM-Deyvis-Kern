-- CreateEnum
CREATE TYPE "NotificationType" AS ENUM ('LEAD_IMPORT_COMPLETED', 'LEAD_IMPORT_FAILED', 'LEAD_IMPORT_EXPIRING', 'LEAD_IMPORT_EXPIRED');

-- AlterEnum
ALTER TYPE "LeadImportStatus" ADD VALUE 'EXPIRED';

-- AlterTable
ALTER TABLE "LeadImport" ADD COLUMN     "expiryWarningSentAt" TIMESTAMP(3),
ADD COLUMN     "processedRows" INTEGER NOT NULL DEFAULT 0;

-- CreateTable
CREATE TABLE "Notification" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "type" "NotificationType" NOT NULL,
    "title" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "actionUrl" TEXT,
    "readAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Notification_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Notification_userId_readAt_createdAt_idx" ON "Notification"("userId", "readAt", "createdAt");

-- CreateIndex
CREATE INDEX "LeadImport_status_finishedAt_idx" ON "LeadImport"("status", "finishedAt");

-- AddForeignKey
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
