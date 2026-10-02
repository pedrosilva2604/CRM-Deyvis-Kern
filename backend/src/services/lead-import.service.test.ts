import { afterEach, describe, expect, it, vi } from 'vitest';
import { ConflictError, NotFoundError } from '@/errors/app-errors';
import { LEAD_IMPORT_ERRORS } from '@/errors/errors.constants';
import { TimeZoneBusinessCalendar } from '@/infra/business-calendar';
import { FixedClock } from '@/testing/fixed-clock';
import { InMemoryLeadImportQueue } from '@/testing/in-memory-lead-import.queue';
import { InMemoryLeadImportRepository } from '@/testing/in-memory-lead-import.repository';
import { InMemoryPipelineAccess } from '@/testing/in-memory-pipeline-access';
import { loggedAdmin, loggedSeller } from '@/testing/logged-users';
import { RecordingAuditService } from '@/testing/recording-audit.service';
import { LeadImportService } from './lead-import.service';

const clock = new FixedClock(new Date('2026-10-01T12:00:00.000Z'));

function createRetryScenario() {
  const leadImports = new InMemoryLeadImportRepository();
  const leadImportQueue = new InMemoryLeadImportQueue();
  const audit = new RecordingAuditService();
  const pipelines = new InMemoryPipelineAccess();
  const leadImportService = new LeadImportService(
    leadImports,
    pipelines,
    leadImportQueue,
    audit,
    new TimeZoneBusinessCalendar(clock, 'America/Sao_Paulo'),
    { maximumRows: 10_000 },
  );
  return { leadImportService, leadImports, leadImportQueue, audit, pipelines };
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe('Retomar uma importação interrompida', () => {
  it('volta a importação de quem enviou para a fila, guardando de onde parou', async () => {
    const { leadImportService, leadImports, leadImportQueue } = createRetryScenario();
    leadImports.add({ importId: 'interrompida', status: 'FAILED', requestedById: 'maria', processedRows: 750 });

    await leadImportService.retryLeadImport({ targetImportId: 'interrompida' }, loggedSeller('maria'));

    expect(leadImports.find('interrompida')).toMatchObject({ status: 'PENDING', processedRows: 750, finishedAt: null });
    expect(leadImportQueue.requeuedImportIds).toEqual(['interrompida']);
  });

  it('registra na auditoria quem pediu para retomar', async () => {
    const { leadImportService, leadImports, audit } = createRetryScenario();
    leadImports.add({ importId: 'interrompida', status: 'FAILED', requestedById: 'maria' });

    await leadImportService.retryLeadImport({ targetImportId: 'interrompida' }, loggedSeller('maria'));

    expect(audit.recordedAuditLogs).toEqual([
      { userId: 'maria', action: 'lead.import_retry_requested', entityId: 'interrompida' },
    ]);
  });

  it('deixa o ADMIN retomar a importação de outra pessoa', async () => {
    const { leadImportService, leadImports } = createRetryScenario();
    leadImports.add({ importId: 'da-maria', status: 'FAILED', requestedById: 'maria' });

    await leadImportService.retryLeadImport({ targetImportId: 'da-maria' }, loggedAdmin('ana-admin'));

    expect(leadImports.find('da-maria').status).toBe('PENDING');
  });

  it('não deixa outro vendedor nem saber que a importação existe', async () => {
    const { leadImportService, leadImports, leadImportQueue } = createRetryScenario();
    leadImports.add({ importId: 'da-maria', status: 'FAILED', requestedById: 'maria' });

    const retryByJoao = leadImportService.retryLeadImport({ targetImportId: 'da-maria' }, loggedSeller('joao'));

    await expect(retryByJoao).rejects.toBeInstanceOf(NotFoundError);
    expect(leadImports.find('da-maria').status).toBe('FAILED');
    expect(leadImportQueue.requeuedImportIds).toEqual([]);
  });

  it.each(['PENDING', 'PROCESSING', 'COMPLETED', 'EXPIRED'] as const)('recusa retomar uma importação %s', async (status) => {
    const { leadImportService, leadImports } = createRetryScenario();
    leadImports.add({ importId: 'importacao', status, requestedById: 'maria' });

    const retry = leadImportService.retryLeadImport({ targetImportId: 'importacao' }, loggedSeller('maria'));

    await expect(retry).rejects.toThrow(LEAD_IMPORT_ERRORS.NOT_RETRYABLE);
    expect(leadImports.find('importacao').status).toBe(status);
  });

  it('recusa quando quem enviou já tem outra importação em andamento', async () => {
    const { leadImportService, leadImports } = createRetryScenario();
    leadImports.add({ importId: 'interrompida', status: 'FAILED', requestedById: 'maria' });
    leadImports.add({ importId: 'rodando', status: 'PROCESSING', requestedById: 'maria' });

    const retry = leadImportService.retryLeadImport({ targetImportId: 'interrompida' }, loggedSeller('maria'));

    await expect(retry).rejects.toBeInstanceOf(ConflictError);
    await expect(retry).rejects.toThrow(LEAD_IMPORT_ERRORS.ALREADY_RUNNING);
  });

  it('o ADMIN que retoma a importação da Maria, ocupada com outra, recebe uma mensagem que fala da Maria', async () => {
    const { leadImportService, leadImports } = createRetryScenario();
    leadImports.add({ importId: 'interrompida', status: 'FAILED', requestedById: 'maria' });
    leadImports.add({ importId: 'rodando', status: 'PROCESSING', requestedById: 'maria' });

    const retryByAdmin = leadImportService.retryLeadImport({ targetImportId: 'interrompida' }, loggedAdmin('ana-admin'));

    await expect(retryByAdmin).rejects.toThrow(LEAD_IMPORT_ERRORS.REQUESTER_HAS_RUNNING_IMPORT);
  });

  it('com o Redis fora do ar, deixa a importação PENDING para o conciliador colocar na fila', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const { leadImportService, leadImports, leadImportQueue } = createRetryScenario();
    leadImports.add({ importId: 'interrompida', status: 'FAILED', requestedById: 'maria' });
    leadImportQueue.isRedisDown = true;

    await leadImportService.retryLeadImport({ targetImportId: 'interrompida' }, loggedSeller('maria'));

    expect(leadImports.find('interrompida').status).toBe('PENDING');
    expect(leadImportQueue.requeuedImportIds).toEqual([]);
  });
});
