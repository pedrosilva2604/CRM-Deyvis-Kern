import { delay, http, HttpResponse } from 'msw';
import { env } from '@/config/env';
import {
  countCompleteProfiles,
  countInvalidOrRejectedContacts,
  countNewLeadsInLastSevenDays,
  countTotalLeads,
  countUnassignedLeads,
  findLeadById,
  findLeadImportProgress,
  importLeadSpreadsheet,
  listFilterOptions,
  listLeads,
} from './fakeLeadDatabase';

const SIMULATED_NETWORK_DELAY_MS = 350;
const DEFAULT_PAGE_SIZE = 20;
const MAXIMUM_PAGE_SIZE = 100;

function readPositiveInteger(rawValue: string | null, fallback: number, maximum = Number.MAX_SAFE_INTEGER) {
  const parsedValue = Number(rawValue);
  if (!Number.isInteger(parsedValue) || parsedValue < 1) return fallback;
  return Math.min(parsedValue, maximum);
}

export const leadsApiHandlers = [
  http.get('/api/leads/indicators/total-leads', async () => {
    await delay(SIMULATED_NETWORK_DELAY_MS);
    return HttpResponse.json(countTotalLeads());
  }),

  http.get('/api/leads/indicators/new-leads', async () => {
    await delay(SIMULATED_NETWORK_DELAY_MS);
    return HttpResponse.json(countNewLeadsInLastSevenDays());
  }),

  http.get('/api/leads/indicators/unassigned-leads', async () => {
    await delay(SIMULATED_NETWORK_DELAY_MS);
    return HttpResponse.json(countUnassignedLeads());
  }),

  http.get('/api/leads/indicators/invalid-or-rejected-contacts', async () => {
    await delay(SIMULATED_NETWORK_DELAY_MS);
    return HttpResponse.json(countInvalidOrRejectedContacts());
  }),

  http.get('/api/leads/indicators/complete-profiles', async () => {
    await delay(SIMULATED_NETWORK_DELAY_MS);
    return HttpResponse.json(countCompleteProfiles());
  }),

  http.get('/api/leads/filter-options', async () => {
    await delay(SIMULATED_NETWORK_DELAY_MS);
    return HttpResponse.json(listFilterOptions());
  }),

  http.post('/api/leads/imports', async ({ request }) => {
    await delay(SIMULATED_NETWORK_DELAY_MS * 2);
    const importReading = importLeadSpreadsheet(await request.text(), env.leadImportMaximumRows);
    if (importReading.status === 'unreadable') return HttpResponse.json({ error: importReading.reason }, { status: 400 });
    if (importReading.content.rowsToImport.length === 0) {
      return HttpResponse.json({ error: 'Nenhuma linha da planilha pode ser importada' }, { status: 400 });
    }
    return HttpResponse.json({ message: 'Importação recebida', importId: importReading.importId }, { status: 202 });
  }),

  http.get('/api/leads/imports/:importId', async ({ params }) => {
    await delay(SIMULATED_NETWORK_DELAY_MS);
    const leadImportProgress = findLeadImportProgress(String(params.importId));
    if (!leadImportProgress) return HttpResponse.json({ error: 'Importação não encontrada' }, { status: 404 });
    return HttpResponse.json(leadImportProgress);
  }),

  http.get('/api/leads/:leadId', async ({ params }) => {
    await delay(SIMULATED_NETWORK_DELAY_MS);
    const lead = findLeadById(String(params.leadId));
    if (!lead) return HttpResponse.json({ error: 'Lead não encontrado' }, { status: 404 });
    return HttpResponse.json(lead);
  }),

  http.get('/api/leads', async ({ request }) => {
    await delay(SIMULATED_NETWORK_DELAY_MS);
    const searchParams = new URL(request.url).searchParams;
    return HttpResponse.json(
      listLeads({
        search: searchParams.get('search') ?? '',
        source: searchParams.get('source') ?? '',
        assignment: searchParams.get('assignment') ?? '',
        contactStatus: searchParams.get('contactStatus') ?? '',
        page: readPositiveInteger(searchParams.get('page'), 1),
        pageSize: readPositiveInteger(searchParams.get('pageSize'), DEFAULT_PAGE_SIZE, MAXIMUM_PAGE_SIZE),
      }),
    );
  }),
];
