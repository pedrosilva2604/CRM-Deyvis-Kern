import clsx from 'clsx';
import { MessageCircle, PanelRightOpen } from 'lucide-react';
import { Badge } from '@/components/ui/Badge';
import { IconButton, IconLink } from '@/components/ui/IconButton';
import { formatCurrencyInReais, formatTimeAgo } from '@/lib/formatters';
import { describeCountry, formatPhoneForDisplay, isHomeCountry } from '@crm/shared';
import type { LeadListItem } from '@/types/lead';
import { CONTACT_STATUS_LABELS } from '@/types/lead';

interface LeadsTableProps {
  leads: LeadListItem[];
  isRefreshing: boolean;
  onOpenLeadDetails: (leadId: string) => void;
}

export function LeadsTable({ leads, isRefreshing, onOpenLeadDetails }: LeadsTableProps) {
  return (
    <div className={clsx('overflow-x-auto transition-opacity', isRefreshing && 'opacity-60')}>
      <table className="w-full text-left text-sm">
        <thead className="border-b border-slate-200 bg-slate-50 text-xs font-medium uppercase tracking-wide text-slate-500 dark:border-slate-800 dark:bg-slate-900/60 dark:text-slate-400">
          <tr>
            <th scope="col" className="px-5 py-3">Lead</th>
            <th scope="col" className="px-5 py-3">Origem</th>
            <th scope="col" className="px-5 py-3">Responsável</th>
            <th scope="col" className="px-5 py-3">Valor</th>
            <th scope="col" className="px-5 py-3">Última mensagem</th>
            <th scope="col" className="px-5 py-3 text-right">
              <span className="sr-only">Ações</span>
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
          {leads.map((lead) => (
            <tr key={lead.id} className="transition hover:bg-slate-50/70 dark:hover:bg-slate-800/40">
              <td className="px-5 py-3">
                <button
                  type="button"
                  onClick={() => onOpenLeadDetails(lead.id)}
                  className="block max-w-64 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-300 rounded"
                >
                  <span className="flex items-center gap-2">
                    <span className="truncate font-medium text-slate-900 hover:text-indigo-600 dark:text-slate-100 dark:hover:text-indigo-400">
                      {lead.name}
                    </span>
                    {lead.contactStatus !== 'VALID' && (
                      <Badge tone={lead.contactStatus === 'SPAM' ? 'danger' : 'warning'}>
                        {CONTACT_STATUS_LABELS[lead.contactStatus]}
                      </Badge>
                    )}
                  </span>
                  <span className="flex items-center gap-2 text-slate-500 tabular-nums dark:text-slate-400">
                    {formatPhoneForDisplay(lead.phone)}
                    {!isHomeCountry(lead.phoneCountry) && <Badge tone="accent">{describeCountry(lead.phoneCountry)}</Badge>}
                  </span>
                </button>
              </td>
              <td className="px-5 py-3 text-slate-600 dark:text-slate-300">{lead.source ?? '—'}</td>
              <td className="px-5 py-3">
                {lead.assignedTo ? (
                  <span className="whitespace-nowrap text-slate-600 dark:text-slate-300">{lead.assignedTo.name}</span>
                ) : (
                  <Badge tone="warning">Sem responsável</Badge>
                )}
              </td>
              <td className="whitespace-nowrap px-5 py-3 tabular-nums text-slate-600 dark:text-slate-300">
                {lead.value ? formatCurrencyInReais(lead.value) : '—'}
              </td>
              <td className="whitespace-nowrap px-5 py-3 text-slate-500 dark:text-slate-400">
                {lead.lastMessageAt ? formatTimeAgo(lead.lastMessageAt) : 'Sem conversa'}
                {lead.unreadCount > 0 && (
                  <span className="ml-2 inline-flex min-w-5 justify-center rounded-full bg-indigo-600 px-1.5 text-xs font-semibold text-white">
                    {lead.unreadCount}
                  </span>
                )}
              </td>
              <td className="px-5 py-3">
                <div className="flex justify-end gap-0.5">
                  <IconLink
                    to={`/chat/${lead.id}`}
                    icon={MessageCircle}
                    tone="accent"
                    label={`Abrir conversa com ${lead.name}`}
                  />
                  <IconButton
                    icon={PanelRightOpen}
                    label={`Ver detalhes de ${lead.name}`}
                    onClick={() => onOpenLeadDetails(lead.id)}
                  />
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
