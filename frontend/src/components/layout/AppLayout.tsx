import { NavLink, Outlet } from 'react-router';
import clsx from 'clsx';
import {
  LayoutDashboard,
  KanbanSquare,
  MessageCircle,
  Send,
  Workflow,
  ShieldCheck,
  LogOut,
  type LucideIcon,
} from 'lucide-react';
import { Brand } from '@/components/ui/Brand';
import { useLogout } from '@/hooks/useLogout';
import { useAuth } from '@/stores/auth';
import { ThemeToggle } from './ThemeToggle';

interface NavItem {
  to: string;
  label: string;
  icon: LucideIcon;
  adminOnly?: boolean;
}

const navItems: NavItem[] = [
  { to: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { to: '/kanban', label: 'Funis', icon: KanbanSquare },
  { to: '/chat', label: 'Chat', icon: MessageCircle },
  { to: '/disparos', label: 'Disparos', icon: Send },
  { to: '/automacoes', label: 'Automações', icon: Workflow },
  { to: '/admin', label: 'Admin', icon: ShieldCheck, adminOnly: true },
];

export function AppLayout() {
  const user = useAuth((s) => s.user);
  const { logout, loggingOut, error: logoutError } = useLogout();
  const items = navItems.filter((item) => !item.adminOnly || user?.role === 'ADMIN');

  return (
    <div className="flex h-full">
      <aside className="flex w-60 shrink-0 flex-col border-r border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
        <Brand className="px-5 py-5" />
        <nav className="flex-1 space-y-1 px-3">
          {items.map(({ to, label, icon: Icon }) => (
            <NavLink
              key={to}
              to={to}
              className={({ isActive }) =>
                clsx(
                  'flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium',
                  isActive
                    ? 'bg-slate-900 text-white dark:bg-indigo-600'
                    : 'text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800',
                )
              }
            >
              <Icon size={18} />
              {label}
            </NavLink>
          ))}
        </nav>
        <div className="border-t border-slate-200 p-3 dark:border-slate-800">
          <div className="px-3 pb-2 text-sm">
            <div className="font-medium">{user?.name}</div>
            <div className="text-xs text-slate-500 dark:text-slate-400">
              {user?.role === 'ADMIN' ? 'Administrador' : 'Atendente'}
            </div>
          </div>
          {logoutError && <p className="px-3 pb-2 text-xs text-red-600 dark:text-red-400">{logoutError}</p>}
          <div className="flex items-center gap-1">
            <button
              onClick={logout}
              disabled={loggingOut}
              className="flex flex-1 items-center gap-3 rounded-md px-3 py-2 text-sm text-slate-600 hover:bg-slate-100 disabled:opacity-60 dark:text-slate-300 dark:hover:bg-slate-800"
            >
              <LogOut size={18} />
              {loggingOut ? 'Saindo...' : 'Sair'}
            </button>
            <ThemeToggle />
          </div>
        </div>
      </aside>
      <main className="min-w-0 flex-1 overflow-auto">
        <Outlet />
      </main>
    </div>
  );
}
