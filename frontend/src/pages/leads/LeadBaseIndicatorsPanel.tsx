import { AlertTriangle, Sparkles, UserRoundX, Users, UserCheck } from 'lucide-react';
import { StatCard } from '@/components/ui/StatCard';
import {
  useCompleteProfiles,
  useInvalidOrRejectedContacts,
  useNewLeadsInLastSevenDays,
  useTotalLeads,
  useUnassignedLeads,
} from '@/hooks/useLeads';
import { formatInteger, formatPercentage } from '@/lib/formatters';

const UNAVAILABLE_INDICATOR_VALUE = '—';
const UNAVAILABLE_INDICATOR_DESCRIPTION = 'Não foi possível carregar este indicador';

function formatIndicatorValue(quantity: number | undefined, isError: boolean) {
  return isError ? UNAVAILABLE_INDICATOR_VALUE : formatInteger(quantity ?? 0);
}

function describeShareOfBase(shareOfBase: number | undefined, detail: string) {
  if (shareOfBase === undefined) return detail;
  return `${formatPercentage(shareOfBase)} da base ${detail.toLowerCase()}`;
}

function TotalLeadsCard() {
  const { data, isPending, isError } = useTotalLeads();
  return (
    <StatCard
      label="Total de leads"
      icon={Users}
      tone="accent"
      loading={isPending}
      value={formatIndicatorValue(data?.totalLeads, isError)}
      description={isError ? UNAVAILABLE_INDICATOR_DESCRIPTION : 'Tamanho histórico da base'}
    />
  );
}

function NewLeadsCard() {
  const { data, isPending, isError } = useNewLeadsInLastSevenDays();
  return (
    <StatCard
      label="Novos (7 dias)"
      icon={Sparkles}
      tone="success"
      loading={isPending}
      value={formatIndicatorValue(data?.newLeadsInLastSevenDays, isError)}
      description={isError ? UNAVAILABLE_INDICATOR_DESCRIPTION : 'Ritmo de crescimento recente'}
    />
  );
}

function UnassignedLeadsCard() {
  const { data, isPending, isError } = useUnassignedLeads();
  const unassignedLeads = data?.unassignedLeads;
  return (
    <StatCard
      label="Sem responsável"
      icon={UserRoundX}
      tone="warning"
      loading={isPending}
      value={formatIndicatorValue(unassignedLeads, isError)}
      description={
        isError
          ? UNAVAILABLE_INDICATOR_DESCRIPTION
          : describeShareOfBase(data?.shareOfBase, 'Aguardando distribuição')
      }
    />
  );
}

function InvalidOrRejectedContactsCard() {
  const { data, isPending, isError } = useInvalidOrRejectedContacts();
  const invalidOrRejectedContacts = data?.invalidOrRejectedContacts;
  return (
    <StatCard
      label="Inválidos ou rejeitados"
      icon={AlertTriangle}
      tone="danger"
      loading={isPending}
      value={formatIndicatorValue(invalidOrRejectedContacts, isError)}
      description={
        isError
          ? UNAVAILABLE_INDICATOR_DESCRIPTION
          : describeShareOfBase(data?.shareOfBase, 'Com contato inválido ou spam')
      }
    />
  );
}

function CompleteProfilesCard() {
  const { data, isPending, isError } = useCompleteProfiles();
  const completeProfiles = data?.completeProfiles;
  return (
    <StatCard
      label="Cadastros completos"
      icon={UserCheck}
      tone="neutral"
      loading={isPending}
      value={formatIndicatorValue(completeProfiles, isError)}
      description={
        isError
          ? UNAVAILABLE_INDICATOR_DESCRIPTION
          : describeShareOfBase(data?.shareOfBase, 'Com nome, e-mail e telefone')
      }
    />
  );
}

export function LeadBaseIndicatorsPanel() {
  return (
    <section aria-label="Indicadores da base de leads" className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
      <TotalLeadsCard />
      <NewLeadsCard />
      <UnassignedLeadsCard />
      <InvalidOrRejectedContactsCard />
      <CompleteProfilesCard />
    </section>
  );
}
