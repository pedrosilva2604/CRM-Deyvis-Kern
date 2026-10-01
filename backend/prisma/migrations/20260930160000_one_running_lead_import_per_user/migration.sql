CREATE UNIQUE INDEX "LeadImport_one_running_per_requester"
ON "LeadImport"("requestedById")
WHERE "status" IN ('PENDING', 'PROCESSING');
