import { describe, expect, it } from 'vitest';
import { TimeZoneBusinessCalendar } from '@/infra/business-calendar';
import { FixedClock } from '@/testing/fixed-clock';
import { InMemoryLeadIndicatorsRepository } from '@/testing/in-memory-lead-indicators.repository';
import { LeadIndicatorsService } from './lead-indicators.service';

const clock = new FixedClock(new Date('2026-09-30T15:00:00.000Z'));

function createIndicatorsScenario() {
  const leads = new InMemoryLeadIndicatorsRepository();
  const indicators = new LeadIndicatorsService(leads, new TimeZoneBusinessCalendar(clock, 'America/Sao_Paulo'));
  return { indicators, leads };
}

describe('Indicadores da base de leads', () => {
  it('calcula no backend a fração da base sem responsável, arredondada em 4 casas', async () => {
    const { indicators, leads } = createIndicatorsScenario();
    leads.add(2);
    leads.add(1, { hasAssignee: false });

    expect(await indicators.getUnassignedLeads()).toEqual({ unassignedLeads: 1, shareOfBase: 0.3333 });
  });

  it('devolve fração zero quando a base está vazia, sem dividir por zero', async () => {
    const { indicators } = createIndicatorsScenario();

    expect(await indicators.getCompleteProfiles()).toEqual({ completeProfiles: 0, shareOfBase: 0 });
  });

  it('conta inválidos e spam juntos como contatos rejeitados', async () => {
    const { indicators, leads } = createIndicatorsScenario();
    leads.add(2);
    leads.add(1, { contactStatus: 'INVALID' });
    leads.add(1, { contactStatus: 'SPAM' });

    expect(await indicators.getInvalidOrRejectedContacts()).toEqual({ invalidOrRejectedContacts: 2, shareOfBase: 0.5 });
  });

  it('conta como novos os leads que entraram nos últimos 7 dias, incluindo hoje', async () => {
    const { indicators, leads } = createIndicatorsScenario();
    leads.add(1, { enteredOn: new Date('2026-09-30T00:00:00.000Z') });
    leads.add(1, { enteredOn: new Date('2026-09-24T00:00:00.000Z') });
    leads.add(1, { enteredOn: new Date('2026-09-23T00:00:00.000Z') });

    expect(await indicators.getNewLeadsInLastSevenDays()).toEqual({ newLeadsInLastSevenDays: 2 });
  });
});
