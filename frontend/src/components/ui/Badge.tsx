import type { ReactNode } from 'react';
import clsx from 'clsx';

type BadgeTone = 'success' | 'neutral' | 'accent' | 'warning' | 'danger';

const tones: Record<BadgeTone, string> = {
  success: 'bg-emerald-50 text-emerald-700 ring-emerald-600/20 dark:bg-emerald-950/60 dark:text-emerald-300 dark:ring-emerald-500/30',
  neutral: 'bg-slate-100 text-slate-600 ring-slate-500/20 dark:bg-slate-800 dark:text-slate-300 dark:ring-slate-500/30',
  accent: 'bg-indigo-50 text-indigo-700 ring-indigo-600/20 dark:bg-indigo-950/60 dark:text-indigo-300 dark:ring-indigo-500/30',
  warning: 'bg-amber-50 text-amber-800 ring-amber-600/20 dark:bg-amber-950/60 dark:text-amber-300 dark:ring-amber-500/30',
  danger: 'bg-red-50 text-red-700 ring-red-600/20 dark:bg-red-950/60 dark:text-red-300 dark:ring-red-500/30',
};

export function Badge({ tone, children }: { tone: BadgeTone; children: ReactNode }) {
  return (
    <span className={clsx('inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset', tones[tone])}>
      {children}
    </span>
  );
}
