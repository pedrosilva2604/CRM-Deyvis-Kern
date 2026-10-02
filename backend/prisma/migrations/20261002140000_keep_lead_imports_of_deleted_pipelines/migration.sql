ALTER TABLE "LeadImport" DROP CONSTRAINT "LeadImport_pipelineId_fkey";

ALTER TABLE "LeadImport" DROP CONSTRAINT "LeadImport_stageId_fkey";

ALTER TABLE "LeadImport" ADD CONSTRAINT "LeadImport_pipelineId_fkey" FOREIGN KEY ("pipelineId") REFERENCES "Pipeline"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "LeadImport" ADD CONSTRAINT "LeadImport_stageId_fkey" FOREIGN KEY ("stageId") REFERENCES "Stage"("id") ON DELETE SET NULL ON UPDATE CASCADE;
