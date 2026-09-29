import { delay, http, HttpResponse } from 'msw';
import type { ImportLeadsRequest } from '@/types/lead';
import {
  calculateLeadBaseIndicators,
  findLeadById,
  importLeads,
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
  http.get('/api/leads/indicators', async () => {
    await delay(SIMULATED_NETWORK_DELAY_MS);
    return HttpResponse.json(calculateLeadBaseIndicators());
  }),

  http.get('/api/leads/filter-options', async () => {
    await delay(SIMULATED_NETWORK_DELAY_MS);
    return HttpResponse.json(listFilterOptions());
  }),

  http.post('/api/leads/import', async ({ request }) => {
    await delay(SIMULATED_NETWORK_DELAY_MS * 2);
    const importLeadsRequest = (await request.json()) as ImportLeadsRequest;
    const importResult = importLeads(importLeadsRequest);
    if (!importResult) return HttpResponse.json({ error: 'Funil ou etapa inválidos' }, { status: 400 });
    return HttpResponse.json(importResult, { status: 201 });
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
        stageId: searchParams.get('stageId') ?? '',
        source: searchParams.get('source') ?? '',
        assignment: searchParams.get('assignment') ?? '',
        contactStatus: searchParams.get('contactStatus') ?? '',
        page: readPositiveInteger(searchParams.get('page'), 1),
        pageSize: readPositiveInteger(searchParams.get('pageSize'), DEFAULT_PAGE_SIZE, MAXIMUM_PAGE_SIZE),
      }),
    );
  }),
];
