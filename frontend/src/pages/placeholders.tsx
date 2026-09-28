import { useParams } from 'react-router';
import { ComingSoon } from '@/components/ui/ComingSoon';
import { PageHeader } from '@/components/ui/PageHeader';

export function DashboardPage() {
  return (
    <>
      <PageHeader title="Dashboard" description="Vendas e tráfego" />
      <ComingSoon>Em breve: indicadores de vendas, conversão por funil e métricas de tráfego.</ComingSoon>
    </>
  );
}

export function KanbanPage() {
  return (
    <>
      <PageHeader title="Funis" description="Gerencie seus leads por etapa" />
      <ComingSoon>Em breve: kanban com arrastar e soltar; clicar no lead abre o chat.</ComingSoon>
    </>
  );
}

export function ChatPage() {
  const { leadId } = useParams();
  return (
    <>
      <PageHeader title="Chat" description="Conversas do WhatsApp" />
      <ComingSoon>{leadId ? `Conversa do lead ${leadId}` : 'Em breve: conversas recentes na lateral e chat completo.'}</ComingSoon>
    </>
  );
}

export function CampaignsPage() {
  return (
    <>
      <PageHeader title="Disparos" description="Campanhas pela API oficial com templates" />
      <ComingSoon>Em breve: escolha do número, template, funil, leads por lote, intervalo e agendamento.</ComingSoon>
    </>
  );
}

export function AutomationsPage() {
  return (
    <>
      <PageHeader title="Automações" />
      <ComingSoon>Em breve.</ComingSoon>
    </>
  );
}
