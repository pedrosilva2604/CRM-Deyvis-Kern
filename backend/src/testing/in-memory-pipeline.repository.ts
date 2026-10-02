import type { LeadPipelineOption } from '@/models/lead.model';
import type { IPipelineRepository, StageLocation } from '@/repositories/pipeline.repository';

const DEFAULT_STAGE: StageLocation = { pipelineId: 'funil-padrao', stageId: 'primeira-etapa' };

export class InMemoryPipelineRepository implements IPipelineRepository {
  async findStageLocation(stageId: string): Promise<StageLocation | null> {
    return stageId === DEFAULT_STAGE.stageId ? DEFAULT_STAGE : null;
  }

  async findPipelinesWithStages(): Promise<LeadPipelineOption[]> {
    return [];
  }

  async findFirstStageOfFirstPipeline(): Promise<StageLocation | null> {
    return DEFAULT_STAGE;
  }
}
