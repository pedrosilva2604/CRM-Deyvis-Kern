import type { IPipelineChangeAnnouncer } from '@/services/pipeline-change-announcer';

export class RecordingPipelineChangeAnnouncer implements IPipelineChangeAnnouncer {
  readonly announcedPipelineIds: string[] = [];

  async findAudience(): Promise<string[]> {
    return [];
  }

  async announceTo(_audience: string[], pipelineId: string): Promise<void> {
    this.announcedPipelineIds.push(pipelineId);
  }

  async announce(pipelineId: string): Promise<void> {
    this.announcedPipelineIds.push(pipelineId);
  }
}
