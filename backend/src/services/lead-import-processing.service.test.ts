import { describe, expect, it } from 'vitest';
import type { LeadImportCounters, LeadImportRowToProcess } from '@/models/lead-import.model';
import { FixedClock } from '@/testing/fixed-clock';
import { InMemoryLeadImportRepository } from '@/testing/in-memory-lead-import.repository';
import { RecordingLeadImportNotifications } from '@/testing/recording-lead-import-notifications';
import { RecordingRealtimePublisher } from '@/testing/recording-realtime-publisher';
import { LeadImportProcessingService } from './lead-import-processing.service';

const clock = new FixedClock(new Date('2026-09-30T12:00:00.000Z'));
const CHUNK_SIZE = 2;

function rowWithPhone(phone: string): LeadImportRowToProcess {
  return { name: `Lead ${phone}`, phone, phoneCountry: 'BR', email: null, enteredOn: clock.now() };
}

function createProcessingScenario() {
  const leadImports = new InMemoryLeadImportRepository();
  const notifications = new RecordingLeadImportNotifications();
  const realtimePublisher = new RecordingRealtimePublisher();
  const processing = new LeadImportProcessingService(leadImports, notifications, realtimePublisher, clock, {
    chunkSize: CHUNK_SIZE,
  });
  const reportedProgress: LeadImportCounters[] = [];
  const reportProgress = async (counters: LeadImportCounters) => {
    reportedProgress.push(counters);
  };
  return { processing, leadImports, notifications, realtimePublisher, reportedProgress, reportProgress };
}

describe('Processamento da importação', () => {
  it('importa todas as linhas, conclui e apaga as linhas guardadas', async () => {
    const { processing, leadImports, reportProgress } = createProcessingScenario();
    leadImports.add({ importId: 'importacao', rows: ['+5511900000001', '+5511900000002', '+5511900000003'].map(rowWithPhone) });

    const outcome = await processing.processLeadImport('importacao', reportProgress);

    expect(outcome).toEqual({
      outcome: 'completed',
      counters: { rowsToImport: 3, processedRows: 3, importedLeads: 3, skippedExistingLeads: 0 },
    });
    expect(leadImports.find('importacao')).toMatchObject({ status: 'COMPLETED', rows: [] });
  });

  it('grava em pedaços do tamanho configurado, cada pedaço ordenado pelo telefone (evita deadlock)', async () => {
    const { processing, leadImports, reportProgress } = createProcessingScenario();
    leadImports.add({
      importId: 'importacao',
      rows: ['+5511900000005', '+5511900000001', '+5511900000004', '+5511900000002', '+5511900000003'].map(rowWithPhone),
    });

    await processing.processLeadImport('importacao', reportProgress);

    expect(leadImports.phonesOfEachReceivedChunk).toEqual([
      ['+5511900000001', '+5511900000005'],
      ['+5511900000002', '+5511900000004'],
      ['+5511900000003'],
    ]);
  });

  it('conta como "já existia" o lead cujo telefone já está no CRM', async () => {
    const { processing, leadImports, reportProgress } = createProcessingScenario();
    leadImports.phonesAlreadyInCrm.add('+5511900000002');
    leadImports.add({ importId: 'importacao', rows: ['+5511900000001', '+5511900000002'].map(rowWithPhone) });

    await processing.processLeadImport('importacao', reportProgress);

    expect(leadImports.find('importacao')).toMatchObject({ importedLeads: 1, skippedExistingLeads: 1 });
  });

  it('informa o progresso a cada pedaço, para a tela e em tempo real para quem enviou', async () => {
    const { processing, leadImports, realtimePublisher, reportedProgress, reportProgress } = createProcessingScenario();
    leadImports.add({
      importId: 'importacao',
      requestedById: 'maria',
      rows: ['+5511900000001', '+5511900000002', '+5511900000003'].map(rowWithPhone),
    });

    await processing.processLeadImport('importacao', reportProgress);

    expect(reportedProgress.map((counters) => counters.processedRows)).toEqual([2, 3]);
    expect(realtimePublisher.publishedEvents.map((event) => [event.userId, event.eventName, event.payload.processedRows])).toEqual([
      ['maria', 'lead-import:progress', 2],
      ['maria', 'lead-import:progress', 3],
    ]);
  });

  it('retoma de onde parou, sem reprocessar as linhas já gravadas', async () => {
    const { processing, leadImports, reportedProgress, reportProgress } = createProcessingScenario();
    leadImports.add({
      importId: 'interrompida',
      status: 'PROCESSING',
      processedRows: 2,
      importedLeads: 2,
      rows: ['+5511900000001', '+5511900000002', '+5511900000003', '+5511900000004'].map(rowWithPhone),
    });

    await processing.processLeadImport('interrompida', reportProgress);

    expect(reportedProgress.map((counters) => counters.processedRows)).toEqual([4]);
    expect(leadImports.find('interrompida')).toMatchObject({ status: 'COMPLETED', importedLeads: 4 });
  });

  it('notifica quem enviou quando a importação termina', async () => {
    const { processing, leadImports, notifications, reportProgress } = createProcessingScenario();
    leadImports.add({ importId: 'importacao', rows: [rowWithPhone('+5511900000001')] });

    await processing.processLeadImport('importacao', reportProgress);

    expect(notifications.sentNotifications).toEqual([{ situation: 'completed', importId: 'importacao' }]);
  });

  it('descarta o job de uma importação que já terminou, sem notificar de novo', async () => {
    const { processing, leadImports, notifications, reportProgress } = createProcessingScenario();
    leadImports.add({ importId: 'ja-concluida', status: 'COMPLETED' });

    const outcome = await processing.processLeadImport('ja-concluida', reportProgress);

    expect(outcome).toEqual({ outcome: 'discarded' });
    expect(notifications.sentNotifications).toEqual([]);
  });

  it('marca como FAILED e notifica uma vez só, mesmo se chamado duas vezes', async () => {
    const { processing, leadImports, notifications } = createProcessingScenario();
    leadImports.add({ importId: 'importacao', status: 'PROCESSING' });

    await processing.markLeadImportAsFailed('importacao', 'banco fora do ar');
    await processing.markLeadImportAsFailed('importacao', 'banco fora do ar');

    expect(leadImports.find('importacao').status).toBe('FAILED');
    expect(notifications.sentNotifications).toEqual([{ situation: 'failed', importId: 'importacao' }]);
  });
});
