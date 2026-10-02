import { REALTIME_EVENTS, type IRealtimePublisher } from '@/infra/realtime-events';
import type { IPipelineRepository } from '@/repositories/pipeline.repository';

export interface IPipelineChangeAnnouncer {
  findAudience(pipelineId: string): Promise<string[]>;
  announceTo(audience: string[], pipelineId: string): Promise<void>;
  announce(pipelineId: string): Promise<void>;
}

export class PipelineChangeAnnouncer implements IPipelineChangeAnnouncer {
  constructor(
    private readonly pipelineRepository: Pick<IPipelineRepository, 'findPeopleWithAccess'>,
    private readonly realtimePublisher: IRealtimePublisher,
  ) {}

  async findAudience(pipelineId: string): Promise<string[]> {
    return await this.pipelineRepository.findPeopleWithAccess(pipelineId);
  }

  async announceTo(audience: string[], pipelineId: string): Promise<void> {
    await Promise.all(
      audience.map((personId) => this.realtimePublisher.publishToUser(personId, REALTIME_EVENTS.PIPELINE_CHANGED, { pipelineId })),
    );
  }

  async announce(pipelineId: string): Promise<void> {
    await this.announceTo(await this.findAudience(pipelineId), pipelineId);
  }
}
