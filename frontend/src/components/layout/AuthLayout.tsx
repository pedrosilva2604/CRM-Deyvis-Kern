import type { ReactNode } from 'react';
import { KanbanSquare, MessageCircle, Send } from 'lucide-react';
import { Brand } from '@/components/ui/Brand';
import { env } from '@/config/env';

interface AuthLayoutProps {
  title: string;
  subtitle?: string;
  children: ReactNode;
}

const highlights = [
  { icon: KanbanSquare, text: 'Funis em kanban para acompanhar cada lead' },
  { icon: MessageCircle, text: 'Conversas do WhatsApp em um só lugar' },
  { icon: Send, text: 'Disparos agendados com templates oficiais' },
];

export function AuthLayout({ title, subtitle, children }: AuthLayoutProps) {
  return (
    <div className="flex min-h-full">
      <aside className="relative hidden w-[44%] overflow-hidden bg-slate-950 p-12 text-white lg:flex lg:flex-col lg:justify-between">
        <div className="pointer-events-none absolute -left-32 -top-32 h-96 w-96 rounded-full bg-indigo-600/30 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-40 -right-20 h-96 w-96 rounded-full bg-violet-600/20 blur-3xl" />

        <Brand className="relative" />

        <div className="relative space-y-8">
          <h2 className="max-w-md text-3xl font-semibold leading-tight">
            Atendimento, funis e disparos no mesmo painel.
          </h2>
          <ul className="space-y-4">
            {highlights.map(({ icon: Icon, text }) => (
              <li key={text} className="flex items-center gap-3 text-slate-300">
                <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-white/10">
                  <Icon size={18} />
                </span>
                {text}
              </li>
            ))}
          </ul>
        </div>

        <p className="relative text-sm text-slate-500">
          © {new Date().getFullYear()} {env.appName}
        </p>
      </aside>

      <main className="flex flex-1 items-center justify-center bg-white px-6 py-12">
        <div className="w-full max-w-sm">
          <Brand className="mb-8 lg:hidden" />
          <h1 className="text-2xl font-semibold tracking-tight text-slate-900">{title}</h1>
          {subtitle && <p className="mt-1.5 text-sm text-slate-500">{subtitle}</p>}
          <div className="mt-8">{children}</div>
        </div>
      </main>
    </div>
  );
}
