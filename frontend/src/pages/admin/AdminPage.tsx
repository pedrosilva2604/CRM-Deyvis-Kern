import type { ComponentType } from 'react';
import { useSearchParams } from 'react-router';
import { ScrollText, Users } from 'lucide-react';
import { PageHeader } from '@/components/ui/PageHeader';
import { Tabs, type TabItem } from '@/components/ui/Tabs';
import { AuditLogsTab } from './AuditLogsTab';
import { UsersTab } from './users/UsersTab';

type AdminTab = 'usuarios' | 'logs';

const TAB_PARAM = 'aba';
const DEFAULT_TAB: AdminTab = 'usuarios';

const tabs: TabItem<AdminTab>[] = [
  { id: 'usuarios', label: 'Usuários', icon: Users },
  { id: 'logs', label: 'Logs', icon: ScrollText },
];

const tabContent: Record<AdminTab, ComponentType> = {
  usuarios: UsersTab,
  logs: AuditLogsTab,
};

function isAdminTab(value: string | null): value is AdminTab {
  return tabs.some((tab) => tab.id === value);
}

export function AdminPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const requested = searchParams.get(TAB_PARAM);
  const activeTab = isAdminTab(requested) ? requested : DEFAULT_TAB;
  const Content = tabContent[activeTab];

  return (
    <>
      <PageHeader title="Admin" description="Usuários e registros de atividade do CRM" />
      <Tabs items={tabs} active={activeTab} onChange={(tab) => setSearchParams({ [TAB_PARAM]: tab })} />
      <Content />
    </>
  );
}
