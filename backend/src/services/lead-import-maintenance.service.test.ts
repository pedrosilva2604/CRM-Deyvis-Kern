import { describe, expect, it } from 'vitest';
import { FixedClock } from '@/testing/fixed-clock';
import { InMemoryLeadImportQueue } from '@/testing/in-memory-lead-import.queue';
import { InMemoryLeadImportRepository } from '@/testing/in-memory-lead-import.repository';
import { RecordingLeadImportNotifications } from '@/testing/recording-lead-import-notifications';
import { RecordingRealtimePublisher } from '@/testing/recording-realtime-publisher';
import { LeadImportMaintenanceService } from './lead-import-maintenance.service';
import { LeadImportProcessingService } from './lead-import-processing.service';

const clock = new FixedClock(new Date('2026-09-30T12:00:00.000Z'));

function createMaintenanceScenario() {
  const leadImports = new InMemoryLeadImportRepository();
  const leadImportQueue = new InMemoryLeadImportQueue();
  const notifications = new RecordingLeadImportNotifications();
  const processing = new LeadImportProcessingService(leadImports, notifications, new RecordingRealtimePublisher(), clock, {
    chunkSize: 500,
  });
  const maintenance = new LeadImportMaintenanceService(leadImports, leadImportQueue, processing, notifications, clock, {
    staleAfterMinutes: 10,
    failedRetentionDays: 7,
  });
  return { maintenance, leadImports, leadImportQueue, notifications };
}

describe('Conciliador: importações paradas', () => {
  it('recoloca na fila a importação PENDING parada há mais de 10 minutos que ficou sem job', async () => {
    const { maintenance, leadImports, leadImportQueue } = createMaintenanceScenario();
    leadImports.add({ importId: 'parada-sem-job', status: 'PENDING', createdAt: clock.minutesAgo(20) });

    const reconciliation = await maintenance.reconcileStuckLeadImports();

    expect(leadImportQueue.requeuedImportIds).toEqual(['parada-sem-job']);
    expect(reconciliation).toEqual({ requeuedImports: 1, importsMarkedAsFailed: 0 });
  });

  it('não mexe na importação PENDING que já está na fila', async () => {
    const { maintenance, leadImports, leadImportQueue } = createMaintenanceScenario();
    leadImports.add({ importId: 'parada-na-fila', status: 'PENDING', createdAt: clock.minutesAgo(20) });
    leadImportQueue.setJobState('parada-na-fila', 'scheduled');

    await maintenance.reconcileStuckLeadImports();

    expect(leadImportQueue.requeuedImportIds).toEqual([]);
  });

  it('não mexe na importação enviada há menos de 10 minutos', async () => {
    const { maintenance, leadImports, leadImportQueue } = createMaintenanceScenario();
    leadImports.add({ importId: 'recem-enviada', status: 'PENDING', createdAt: clock.minutesAgo(2) });

    await maintenance.reconcileStuckLeadImports();

    expect(leadImportQueue.requeuedImportIds).toEqual([]);
  });

  it('marca como FAILED e notifica a importação PROCESSING cujo job esgotou as tentativas', async () => {
    const { maintenance, leadImports, leadImportQueue, notifications } = createMaintenanceScenario();
    leadImports.add({ importId: 'banco-caiu-no-meio', status: 'PROCESSING', startedAt: clock.minutesAgo(30) });
    leadImportQueue.setJobState('banco-caiu-no-meio', 'failed');

    const reconciliation = await maintenance.reconcileStuckLeadImports();

    expect(leadImports.find('banco-caiu-no-meio').status).toBe('FAILED');
    expect(notifications.sentNotifications).toEqual([{ situation: 'failed', importId: 'banco-caiu-no-meio' }]);
    expect(leadImportQueue.requeuedImportIds).toEqual([]);
    expect(reconciliation).toEqual({ requeuedImports: 0, importsMarkedAsFailed: 1 });
  });

  it('recoloca na fila a importação PROCESSING que ficou sem job ativo', async () => {
    const { maintenance, leadImports, leadImportQueue } = createMaintenanceScenario();
    leadImports.add({ importId: 'worker-caiu', status: 'PROCESSING', startedAt: clock.minutesAgo(30) });

    await maintenance.reconcileStuckLeadImports();

    expect(leadImportQueue.requeuedImportIds).toEqual(['worker-caiu']);
  });

  it('não mexe na importação PROCESSING que ainda está rodando', async () => {
    const { maintenance, leadImports, leadImportQueue } = createMaintenanceScenario();
    leadImports.add({ importId: 'rodando', status: 'PROCESSING', startedAt: clock.minutesAgo(30) });
    leadImportQueue.setJobState('rodando', 'scheduled');

    await maintenance.reconcileStuckLeadImports();

    expect(leadImportQueue.requeuedImportIds).toEqual([]);
    expect(leadImports.find('rodando').status).toBe('PROCESSING');
  });
});

describe('Limpeza diária: importações que falharam', () => {
  const guardedRows = [{ name: 'Maria Silva', phone: '+5511987654321', phoneCountry: 'BR', email: null, enteredOn: clock.now() }];

  it('avisa uma vez só a importação que falhou há mais de 6 dias', async () => {
    const { maintenance, leadImports, notifications } = createMaintenanceScenario();
    leadImports.add({ importId: 'falhou-ha-6-dias-e-meio', status: 'FAILED', finishedAt: clock.daysAgo(6.5), rows: guardedRows });

    await maintenance.expireFailedLeadImports();
    await maintenance.expireFailedLeadImports();

    expect(notifications.sentNotifications).toEqual([{ situation: 'expiring', importId: 'falhou-ha-6-dias-e-meio' }]);
    expect(leadImports.find('falhou-ha-6-dias-e-meio').status).toBe('FAILED');
  });

  it('expira a importação que falhou há mais de 7 dias, apagando as linhas guardadas', async () => {
    const { maintenance, leadImports, notifications } = createMaintenanceScenario();
    leadImports.add({
      importId: 'falhou-ha-8-dias',
      status: 'FAILED',
      finishedAt: clock.daysAgo(8),
      expiryWarningSentAt: clock.daysAgo(1),
      rows: guardedRows,
    });

    const cleanup = await maintenance.expireFailedLeadImports();

    expect(leadImports.find('falhou-ha-8-dias')).toMatchObject({ status: 'EXPIRED', rows: [] });
    expect(notifications.sentNotifications).toEqual([{ situation: 'expired', importId: 'falhou-ha-8-dias' }]);
    expect(cleanup).toEqual({ expiredImports: 1, warnedImports: 0 });
  });

  it('não expira nem avisa importação que falhou há poucos dias', async () => {
    const { maintenance, leadImports, notifications } = createMaintenanceScenario();
    leadImports.add({ importId: 'falhou-ontem', status: 'FAILED', finishedAt: clock.daysAgo(1), rows: guardedRows });

    await maintenance.expireFailedLeadImports();

    expect(leadImports.find('falhou-ontem').status).toBe('FAILED');
    expect(notifications.sentNotifications).toEqual([]);
  });
});
