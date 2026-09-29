import { AlertTriangle, Sparkles, UserRoundX, Users, UserCheck } from 'lucide-react';
import { Alert } from '@/components/ui/Alert';
import { StatCard } from '@/components/ui/StatCard';
import { useLeadBaseIndicators } from '@/hooks/useLeads';
import { formatInteger, formatShareOfTotal } from '@/lib/formatters';

export function LeadBaseIndicatorsPanel() {
  const { data: indicators, isPending, isError } = useLeadBaseIndicators();

  if (isError) return <Alert variant="error">Não foi possível carregar os indicadores da base de leads.</Alert>;

  const totalLeads = indicators?.totalLeads ?? 0;
  const shareOfBase = (quantity: number) => `${formatShareOfTotal(quantity, totalLeads)} da base`;

  return (
    <section aria-label="Indicadores da base de leads" className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
      <StatCard
        label="Total de leads"
        icon={Users}
        tone="accent"
        loading={isPending}
        value={formatInteger(totalLeads)}
        description="Tamanho histórico da base"
      />
      <StatCard
        label="Novos (7 dias)"
        icon={Sparkles}
        tone="success"
        loading={isPending}
        value={formatInteger(indicators?.newLeadsInLastSevenDays ?? 0)}
        description="Ritmo de crescimento recente"
      />
      <StatCard
        label="Sem responsável"
        icon={UserRoundX}
        tone="warning"
        loading={isPending}
        value={formatInteger(indicators?.unassignedLeads ?? 0)}
        description={indicators ? `${shareOfBase(indicators.unassignedLeads)} aguardando distribuição` : 'Aguardando distribuição'}
      />
      <StatCard
        label="Inválidos ou rejeitados"
        icon={AlertTriangle}
        tone="danger"
        loading={isPending}
        value={formatInteger(indicators?.invalidOrRejectedContacts ?? 0)}
        description={indicators ? `${shareOfBase(indicators.invalidOrRejectedContacts)}: contato inválido ou spam` : 'Contato inválido ou spam'}
      />
      <StatCard
        label="Cadastros completos"
        icon={UserCheck}
        tone="neutral"
        loading={isPending}
        value={formatInteger(indicators?.completeProfiles ?? 0)}
        description={indicators ? `${shareOfBase(indicators.completeProfiles)} com nome, e-mail e telefone` : 'Nome, e-mail e telefone'}
      />
    </section>
  );
}
