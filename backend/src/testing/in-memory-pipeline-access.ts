import type { PipelineAccess, PipelineAccessLevel, StageRecord } from '@/models/pipeline.model';
import type { IPipelineRepository, PipelineViewer } from '@/repositories/pipeline.repository';

export class InMemoryPipelineAccess implements Pick<IPipelineRepository, 'findPipelineAccess' | 'findStage'> {
  private readonly accessByPipelineAndUser = new Map<string, PipelineAccessLevel>();
  private readonly stages = new Map<string, StageRecord>();

  grant(pipelineId: string, userId: string, level: PipelineAccessLevel): void {
    this.accessByPipelineAndUser.set(`${pipelineId}:${userId}`, level);
  }

  addStage(stageId: string, pipelineId: string): void {
    this.stages.set(stageId, { id: stageId, pipelineId, isWon: false, isLost: false });
  }

  async findPipelineAccess(pipelineId: string, { userId, isAdmin }: PipelineViewer): Promise<PipelineAccess | null> {
    if (isAdmin) return { pipelineId, ownerId: 'dono-do-funil', level: 'admin' };
    const level = this.accessByPipelineAndUser.get(`${pipelineId}:${userId}`);
    return level ? { pipelineId, ownerId: 'dono-do-funil', level } : null;
  }

  async findStage(stageId: string): Promise<StageRecord | null> {
    return this.stages.get(stageId) ?? null;
  }
}
