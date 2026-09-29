import clsx from 'clsx';
import type { LucideIcon } from 'lucide-react';

type StatCardTone = 'neutral' | 'accent' | 'warning' | 'danger' | 'success';

const iconTones: Record<StatCardTone, string> = {
  neutral: 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300',
  accent: 'bg-indigo-50 text-indigo-600 dark:bg-indigo-950/60 dark:text-indigo-300',
  warning: 'bg-amber-50 text-amber-600 dark:bg-amber-950/60 dark:text-amber-300',
  danger: 'bg-red-50 text-red-600 dark:bg-red-950/60 dark:text-red-300',
  success: 'bg-emerald-50 text-emerald-600 dark:bg-emerald-950/60 dark:text-emerald-300',
};

interface StatCardProps {
  label: string;
  value: string;
  description: string;
  icon: LucideIcon;
  tone?: StatCardTone;
  loading?: boolean;
}

export function StatCard({ label, value, description, icon: Icon, tone = 'neutral', loading }: StatCardProps) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
      <div className="flex items-start justify-between gap-3">
        <p className="text-sm font-medium text-slate-500 dark:text-slate-400">{label}</p>
        <span className={clsx('flex size-8 shrink-0 items-center justify-center rounded-lg', iconTones[tone])}>
          <Icon size={16} />
        </span>
      </div>
      {loading ? (
        <div className="mt-2 h-8 w-20 animate-pulse rounded-md bg-slate-100 dark:bg-slate-800" />
      ) : (
        <p className="mt-1 text-2xl font-semibold tabular-nums text-slate-900 dark:text-slate-100">{value}</p>
      )}
      <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">{description}</p>
    </div>
  );
}
