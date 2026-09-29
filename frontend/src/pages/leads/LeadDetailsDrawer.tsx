import { useState, type ReactNode } from 'react';
import { useNavigate } from 'react-router';
import { Check, Copy, MessageCircle } from 'lucide-react';
import { Alert } from '@/components/ui/Alert';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Drawer } from '@/components/ui/Drawer';
import { useLeadDetails } from '@/hooks/useLeads';
import { formatCalendarDate, formatCurrencyInReais, formatDateTime, formatTimeAgo } from '@/lib/formatters';
import { describeCountry, formatPhoneForDisplay } from '@crm/shared';
import type { LeadContactStatus } from '@/types/lead';
import { CONTACT_STATUS_LABELS } from '@/types/lead';
import { LeadStageLabel } from './LeadStageLabel';

const COPY_CONFIRMATION_MS = 2000;

const contactStatusTone: Record<LeadContactStatus, 'success' | 'warning' | 'danger'> = {
  VALID: 'success',
  INVALID: 'warning',
  SPAM: 'danger',
};

function DetailsSection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="space-y-3">
      <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">{title}</h3>
      <dl className="space-y-2.5 text-sm">{children}</dl>
    </section>
  );
}

function DetailsRow({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="grid grid-cols-[8rem_1fr] gap-3">
      <dt className="text-slate-500 dark:text-slate-400">{label}</dt>
      <dd className="min-w-0 break-words text-slate-900 dark:text-slate-100">{children}</dd>
    </div>
  );
}

interface LeadDetailsDrawerProps {
  leadId: string;
  onClose: () => void;
}

export function LeadDetailsDrawer({ leadId, onClose }: LeadDetailsDrawerProps) {
  const navigate = useNavigate();
  const { data: lead, isPending, isError } = useLeadDetails(leadId);
  const [phoneWasCopied, setPhoneWasCopied] = useState(false);

  async function copyPhoneToClipboard(formattedPhone: string) {
    await navigator.clipboard.writeText(formattedPhone);
    setPhoneWasCopied(true);
    setTimeout(() => setPhoneWasCopied(false), COPY_CONFIRMATION_MS);
  }

  const openConversationButton = lead && (
    <Button className="w-full" onClick={() => navigate(`/chat/${lead.id}`)}>
      <MessageCircle size={16} />
      Abrir conversa
    </Button>
  );

  return (
    <Drawer
      title={lead?.name ?? 'Detalhes do lead'}
      description={lead ? `${lead.pipeline.name} · entrou ${formatTimeAgo(lead.createdAt)}` : undefined}
      onClose={onClose}
      footer={openConversationButton}
    >
      {isPending && <p className="text-sm text-slate-500 dark:text-slate-400">Carregando informações do lead...</p>}
      {isError && <Alert variant="error">Não foi possível carregar este lead. Ele pode ter sido removido.</Alert>}

      {lead && (
        <div className="space-y-7">
          <DetailsSection title="Contato">
            <DetailsRow label="Telefone">
              <span className="inline-flex items-center gap-2 tabular-nums">
                {formatPhoneForDisplay(lead.phone)}
                <button
                  type="button"
                  onClick={() => copyPhoneToClipboard(formatPhoneForDisplay(lead.phone))}
                  aria-label="Copiar telefone"
                  title="Copiar telefone"
                  className="rounded p-1 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-800 dark:hover:text-slate-200"
                >
                  {phoneWasCopied ? <Check size={14} className="text-emerald-600" /> : <Copy size={14} />}
                </button>
              </span>
            </DetailsRow>
            <DetailsRow label="País">{describeCountry(lead.phoneCountry)}</DetailsRow>
            <DetailsRow label="E-mail">{lead.email ?? <span className="text-slate-400">Não informado</span>}</DetailsRow>
            <DetailsRow label="Qualidade">
              <Badge tone={contactStatusTone[lead.contactStatus]}>{CONTACT_STATUS_LABELS[lead.contactStatus]}</Badge>
            </DetailsRow>
          </DetailsSection>

          <DetailsSection title="Negócio">
            <DetailsRow label="Etapa">
              <LeadStageLabel stage={lead.stage} />
            </DetailsRow>
            <DetailsRow label="Valor">
              {lead.value ? formatCurrencyInReais(lead.value) : <span className="text-slate-400">Não informado</span>}
            </DetailsRow>
            <DetailsRow label="Origem">{lead.source ?? <span className="text-slate-400">Não informada</span>}</DetailsRow>
            <DetailsRow label="Tags">
              {lead.tags.length > 0 ? (
                <span className="flex flex-wrap gap-1">
                  {lead.tags.map((tag) => (
                    <Badge key={tag} tone="neutral">
                      {tag}
                    </Badge>
                  ))}
                </span>
              ) : (
                <span className="text-slate-400">Sem tags</span>
              )}
            </DetailsRow>
          </DetailsSection>

          <DetailsSection title="Atendimento">
            <DetailsRow label="Responsável">
              {lead.assignedTo?.name ?? <Badge tone="warning">Sem responsável</Badge>}
            </DetailsRow>
            <DetailsRow label="Última mensagem">
              {lead.lastMessageAt ? formatDateTime(lead.lastMessageAt) : <span className="text-slate-400">Sem conversa</span>}
            </DetailsRow>
            <DetailsRow label="Não lidas">{lead.unreadCount}</DetailsRow>
          </DetailsSection>

          <DetailsSection title="Registro">
            <DetailsRow label="Entrou em">{formatCalendarDate(lead.enteredOn)}</DetailsRow>
            <DetailsRow label="Cadastrado em">{formatDateTime(lead.createdAt)}</DetailsRow>
            <DetailsRow label="Atualizado em">{formatDateTime(lead.updatedAt)}</DetailsRow>
          </DetailsSection>
        </div>
      )}
    </Drawer>
  );
}
