import type { LeadPipelineOption } from '@/models/lead.model';
import type { DatabaseClient } from '@/repositories/database-client';

export interface StageLocation {
  stageId: string;
  pipelineId: string;
}

export interface IPipelineRepository {
  findStageLocation(stageId: string): Promise<StageLocation | null>;
  findPipelinesWithStages(): Promise<LeadPipelineOption[]>;
  findFirstStageOfFirstPipeline(): Promise<StageLocation | null>;
}

export class PipelineRepository implements IPipelineRepository {
  constructor(private readonly prisma: DatabaseClient) {}

  async findStageLocation(stageId: string): Promise<StageLocation | null> {
    const stage = await this.prisma.stage.findUnique({ where: { id: stageId }, select: { id: true, pipelineId: true } });
    return stage ? { stageId: stage.id, pipelineId: stage.pipelineId } : null;
  }

  async findPipelinesWithStages(): Promise<LeadPipelineOption[]> {
    return await this.prisma.pipeline.findMany({
      orderBy: { position: 'asc' },
      select: {
        id: true,
        name: true,
        stages: {
          orderBy: { position: 'asc' },
          select: { id: true, name: true, color: true, isWon: true, isLost: true },
        },
      },
    });
  }

  async findFirstStageOfFirstPipeline(): Promise<StageLocation | null> {
    const firstStage = await this.prisma.stage.findFirst({
      orderBy: [{ pipeline: { position: 'asc' } }, { position: 'asc' }],
      select: { id: true, pipelineId: true },
    });
    return firstStage ? { stageId: firstStage.id, pipelineId: firstStage.pipelineId } : null;
  }
}
