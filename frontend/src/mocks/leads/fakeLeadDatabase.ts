import type {
  CompleteProfilesIndicator,
  InvalidOrRejectedContactsIndicator,
  LeadAssignee,
  LeadContactStatus,
  LeadFilterOptions,
  LeadImportProgress,
  LeadListItem,
  LeadListPage,
  LeadPipeline,
  NewLeadsIndicator,
  TotalLeadsIndicator,
  UnassignedLeadsIndicator,
} from '@/types/lead';
import { UNASSIGNED_LEADS_FILTER } from '@/types/lead';
import {
  readLeadPhone,
  readLeadSpreadsheet,
  type LeadSpreadsheetReading,
  type LeadSpreadsheetRowToImport,
} from '@crm/shared';

const FAKE_LEAD_COUNT = 186;
const RANDOM_SEED = 20260928;
const MILLISECONDS_PER_DAY = 24 * 60 * 60 * 1000;
const NEW_LEAD_WINDOW_DAYS = 7;
const OLDEST_LEAD_AGE_DAYS = 120;

export interface LeadListQuery {
  search: string;
  stageId: string;
  source: string;
  assignment: string;
  contactStatus: string;
  page: number;
  pageSize: number;
}

const salesPipeline: LeadPipeline = {
  id: 'f3b1c2d4-0000-4000-8000-000000000001',
  name: 'Funil de Vendas',
  stages: [
    { id: 'a0000000-0000-4000-8000-000000000001', name: 'Novo lead', color: '#3b82f6', isWon: false, isLost: false },
    { id: 'a0000000-0000-4000-8000-000000000002', name: 'Em atendimento', color: '#f59e0b', isWon: false, isLost: false },
    { id: 'a0000000-0000-4000-8000-000000000003', name: 'Proposta', color: '#8b5cf6', isWon: false, isLost: false },
    { id: 'a0000000-0000-4000-8000-000000000004', name: 'Ganho', color: '#22c55e', isWon: true, isLost: false },
    { id: 'a0000000-0000-4000-8000-000000000005', name: 'Perdido', color: '#ef4444', isWon: false, isLost: true },
  ],
};

const salesTeam: LeadAssignee[] = [
  { id: 'b0000000-0000-4000-8000-000000000001', name: 'Ana Ribeiro' },
  { id: 'b0000000-0000-4000-8000-000000000002', name: 'Carlos Mendes' },
  { id: 'b0000000-0000-4000-8000-000000000003', name: 'Juliana Prado' },
  { id: 'b0000000-0000-4000-8000-000000000004', name: 'Rafael Costa' },
];

const firstNames = [
  'Lucas', 'Mariana', 'Pedro', 'Beatriz', 'Gabriel', 'Larissa', 'Mateus', 'Camila', 'Felipe', 'Fernanda',
  'Thiago', 'Patrícia', 'Bruno', 'Aline', 'Diego', 'Renata', 'Gustavo', 'Vanessa', 'Rodrigo', 'Tatiane',
];
const lastNames = [
  'Silva', 'Santos', 'Oliveira', 'Souza', 'Lima', 'Pereira', 'Ferreira', 'Almeida', 'Carvalho', 'Gomes',
  'Martins', 'Rocha', 'Barbosa', 'Nunes', 'Moreira',
];
const leadSources = ['Instagram', 'Facebook Ads', 'Google Ads', 'Site', 'Indicação', 'WhatsApp'];
const leadTags = ['quente', 'frio', 'retorno', 'orçamento', 'vip', 'evento'];
const areaCodes = ['11', '21', '31', '41', '47', '48', '51', '61', '71', '81', '85'];
const emailDomains = ['gmail.com', 'hotmail.com', 'outlook.com', 'yahoo.com.br'];

function createSeededRandom(seed: number) {
  let state = seed;
  return () => {
    state = (state + 0x6d2b79f5) | 0;
    let mixed = Math.imul(state ^ (state >>> 15), 1 | state);
    mixed = (mixed + Math.imul(mixed ^ (mixed >>> 7), 61 | mixed)) ^ mixed;
    return ((mixed ^ (mixed >>> 14)) >>> 0) / 4294967296;
  };
}

const random = createSeededRandom(RANDOM_SEED);

function pickOne<TItem>(items: TItem[]): TItem {
  return items[Math.floor(random() * items.length)] as TItem;
}

function happensWithChance(probability: number) {
  return random() < probability;
}

function slugForEmail(fullName: string) {
  return fullName
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/\s+/g, '.');
}

function randomContactStatus(): LeadContactStatus {
  const roll = random();
  if (roll < 0.86) return 'VALID';
  if (roll < 0.95) return 'INVALID';
  return 'SPAM';
}

function randomDigits(digitCount: number) {
  return String(Math.floor(random() * 10 ** digitCount)).padStart(digitCount, '0');
}

const foreignPhoneFactories = [
  () => `+1415555${randomDigits(4)}`,
  () => `+35191${randomDigits(7)}`,
  () => `+54911${randomDigits(8)}`,
];

function randomPhone() {
  if (happensWithChance(0.08)) return pickOne(foreignPhoneFactories)();
  return `+55${pickOne(areaCodes)}9${pickOne(['8', '9'])}${randomDigits(7)}`;
}

function countryOfPhone(internationalPhone: string) {
  const phoneReading = readLeadPhone(internationalPhone);
  return phoneReading.status === 'valid' ? (phoneReading.country ?? null) : null;
}

function randomPastDate(now: number, maximumAgeDays: number) {
  return new Date(now - random() * maximumAgeDays * MILLISECONDS_PER_DAY);
}

function createFakeLead(leadNumber: number, now: number): LeadListItem {
  const fullName = `${pickOne(firstNames)} ${pickOne(lastNames)}`;
  const phone = randomPhone();
  const stage = pickOne(salesPipeline.stages);
  const isRecentLead = leadNumber % 15 === 0;
  const createdAt = randomPastDate(now, isRecentLead ? NEW_LEAD_WINDOW_DAYS - 1 : OLDEST_LEAD_AGE_DAYS);
  const hasConversation = happensWithChance(0.7);
  const lastMessageAt = hasConversation
    ? new Date(createdAt.getTime() + random() * (now - createdAt.getTime())).toISOString()
    : null;

  return {
    id: `c0000000-0000-4000-8000-${String(leadNumber).padStart(12, '0')}`,
    name: fullName,
    phone,
    phoneCountry: countryOfPhone(phone),
    email: happensWithChance(0.72) ? `${slugForEmail(fullName)}${leadNumber}@${pickOne(emailDomains)}` : null,
    source: happensWithChance(0.9) ? pickOne(leadSources) : null,
    tags: happensWithChance(0.5) ? [pickOne(leadTags)] : [],
    value: happensWithChance(0.45) ? (Math.round(random() * 90 + 5) * 100).toFixed(2) : null,
    contactStatus: randomContactStatus(),
    pipeline: { id: salesPipeline.id, name: salesPipeline.name },
    stage,
    assignedTo: happensWithChance(0.74) ? pickOne(salesTeam) : null,
    unreadCount: hasConversation && happensWithChance(0.25) ? Math.ceil(random() * 6) : 0,
    lastMessageAt,
    enteredOn: createdAt.toISOString().slice(0, 10),
    createdAt: createdAt.toISOString(),
    updatedAt: (lastMessageAt ?? createdAt.toISOString()),
  };
}

function createFakeLeads() {
  const now = Date.now();
  return Array.from({ length: FAKE_LEAD_COUNT }, (_, index) => createFakeLead(index + 1, now));
}

let storedLeads: LeadListItem[] = createFakeLeads();

function removeAccentsAndCase(text: string) {
  return text.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase();
}

function splitIntoWords(text: string) {
  return removeAccentsAndCase(text).split(/[^\p{L}\p{N}]+/u).filter(Boolean);
}

function splitSearchTerm(searchTerm: string) {
  return removeAccentsAndCase(searchTerm)
    .split(/\s+/)
    .flatMap((searchedPiece) => (searchedPiece.includes('@') ? [searchedPiece] : splitIntoWords(searchedPiece)));
}

function matchesSearchTerm(lead: LeadListItem, searchTerm: string) {
  if (!searchTerm) return true;
  const phoneReading = readLeadPhone(searchTerm);
  if (phoneReading.status === 'valid') return lead.phone === phoneReading.internationalPhone;
  const leadWords = new Set([...splitIntoWords(lead.name), (lead.email ?? '').toLowerCase()]);
  const searchedWords = splitSearchTerm(searchTerm);
  return searchedWords.length > 0 && searchedWords.every((searchedWord) => leadWords.has(searchedWord));
}

function matchesAssignment(lead: LeadListItem, assignment: string) {
  if (!assignment) return true;
  if (assignment === UNASSIGNED_LEADS_FILTER) return lead.assignedTo === null;
  return lead.assignedTo?.id === assignment;
}

function isNewestFirst(firstLead: LeadListItem, secondLead: LeadListItem) {
  return new Date(secondLead.createdAt).getTime() - new Date(firstLead.createdAt).getTime();
}

export function listLeads(leadListQuery: LeadListQuery): LeadListPage {
  const matchingLeads = storedLeads
    .filter((lead) => matchesSearchTerm(lead, leadListQuery.search.trim()))
    .filter((lead) => !leadListQuery.stageId || lead.stage.id === leadListQuery.stageId)
    .filter((lead) => !leadListQuery.source || lead.source === leadListQuery.source)
    .filter((lead) => matchesAssignment(lead, leadListQuery.assignment))
    .filter((lead) => !leadListQuery.contactStatus || lead.contactStatus === leadListQuery.contactStatus)
    .sort(isNewestFirst);

  const firstLeadIndex = (leadListQuery.page - 1) * leadListQuery.pageSize;
  return {
    leads: matchingLeads.slice(firstLeadIndex, firstLeadIndex + leadListQuery.pageSize),
    totalMatchingLeads: matchingLeads.length,
    page: leadListQuery.page,
    pageSize: leadListQuery.pageSize,
  };
}

export function findLeadById(leadId: string) {
  return storedLeads.find((lead) => lead.id === leadId) ?? null;
}

function hasCompleteProfile(lead: LeadListItem) {
  return lead.name.trim() !== '' && lead.phone !== '' && lead.email !== null;
}

export function countTotalLeads(): TotalLeadsIndicator {
  return { totalLeads: storedLeads.length };
}

export function countNewLeadsInLastSevenDays(): NewLeadsIndicator {
  const newLeadThreshold = Date.now() - NEW_LEAD_WINDOW_DAYS * MILLISECONDS_PER_DAY;
  return {
    newLeadsInLastSevenDays: storedLeads.filter((lead) => new Date(lead.enteredOn).getTime() >= newLeadThreshold).length,
  };
}

function calculateShareOfBase(quantity: number) {
  return storedLeads.length === 0 ? 0 : quantity / storedLeads.length;
}

export function countUnassignedLeads(): UnassignedLeadsIndicator {
  const unassignedLeads = storedLeads.filter((lead) => lead.assignedTo === null).length;
  return { unassignedLeads, shareOfBase: calculateShareOfBase(unassignedLeads) };
}

export function countInvalidOrRejectedContacts(): InvalidOrRejectedContactsIndicator {
  const invalidOrRejectedContacts = storedLeads.filter((lead) => lead.contactStatus !== 'VALID').length;
  return { invalidOrRejectedContacts, shareOfBase: calculateShareOfBase(invalidOrRejectedContacts) };
}

export function countCompleteProfiles(): CompleteProfilesIndicator {
  const completeProfiles = storedLeads.filter(hasCompleteProfile).length;
  return { completeProfiles, shareOfBase: calculateShareOfBase(completeProfiles) };
}

export function listFilterOptions(): LeadFilterOptions {
  const sourcesInUse = new Set(storedLeads.map((lead) => lead.source).filter((source): source is string => source !== null));
  return {
    pipelines: [salesPipeline],
    sources: [...sourcesInUse].sort((first, second) => first.localeCompare(second, 'pt-BR')),
    assignees: salesTeam,
  };
}

const storedLeadImports = new Map<string, LeadImportProgress>();

function isAlreadyStored(rowToImport: LeadSpreadsheetRowToImport) {
  return storedLeads.some(
    (lead) => lead.phone === rowToImport.phone || (rowToImport.email !== null && lead.email === rowToImport.email),
  );
}

function toFakeLead(rowToImport: LeadSpreadsheetRowToImport, fakeLeadId: string, now: string): LeadListItem {
  const firstStage = salesPipeline.stages[0] as LeadPipeline['stages'][number];
  return {
    id: fakeLeadId,
    name: rowToImport.name,
    phone: rowToImport.phone,
    phoneCountry: rowToImport.phoneCountry,
    email: rowToImport.email,
    source: null,
    tags: [],
    value: null,
    contactStatus: 'VALID',
    pipeline: { id: salesPipeline.id, name: salesPipeline.name },
    stage: firstStage,
    assignedTo: null,
    unreadCount: 0,
    lastMessageAt: null,
    enteredOn: rowToImport.enteredOn ?? now.slice(0, 10),
    createdAt: now,
    updatedAt: now,
  };
}

export function importLeadSpreadsheet(csvText: string, maximumRows: number): LeadSpreadsheetReading & { importId?: string } {
  const spreadsheetReading = readLeadSpreadsheet(csvText, new Date(), { maximumRows });
  if (spreadsheetReading.status === 'unreadable') return spreadsheetReading;

  const { content } = spreadsheetReading;
  const now = new Date().toISOString();
  const rowsNotYetStored = content.rowsToImport.filter((rowToImport) => !isAlreadyStored(rowToImport));
  const fakeImportNumber = storedLeadImports.size + 1;
  const newLeads = rowsNotYetStored.map((rowToImport, rowIndex) =>
    toFakeLead(rowToImport, `d${String(fakeImportNumber).padStart(7, '0')}-0000-4000-8000-${String(rowIndex).padStart(12, '0')}`, now),
  );
  storedLeads = [...newLeads, ...storedLeads];

  const importId = `e0000000-0000-4000-8000-${String(fakeImportNumber).padStart(12, '0')}`;
  storedLeadImports.set(importId, {
    status: 'COMPLETED',
    totalRows: content.totalRows,
    invalidRows: content.invalidRows.length,
    duplicateRowsInFile: content.duplicateRows.length,
    rowsToImport: content.rowsToImport.length,
    importedLeads: newLeads.length,
    skippedExistingLeads: content.rowsToImport.length - newLeads.length,
    createdAt: now,
    finishedAt: now,
  });
  return { ...spreadsheetReading, importId };
}

export function findLeadImportProgress(importId: string) {
  return storedLeadImports.get(importId) ?? null;
}
