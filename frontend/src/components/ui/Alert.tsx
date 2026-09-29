import type { ReactNode } from 'react';
import clsx from 'clsx';
import { AlertCircle, CheckCircle2, TriangleAlert, type LucideIcon } from 'lucide-react';

type AlertVariant = 'error' | 'success' | 'warning';

const icons: Record<AlertVariant, LucideIcon> = {
  error: AlertCircle,
  success: CheckCircle2,
  warning: TriangleAlert,
};

const styles: Record<AlertVariant, string> = {
  error: 'border-red-200 bg-red-50 text-red-700 dark:border-red-900 dark:bg-red-950/50 dark:text-red-300',
  success: 'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950/50 dark:text-emerald-300',
  warning: 'border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-900 dark:bg-amber-950/50 dark:text-amber-300',
};

interface AlertProps {
  variant: AlertVariant;
  children: ReactNode;
}

export function Alert({ variant, children }: AlertProps) {
  const Icon = icons[variant];
  return (
    <div
      role={variant === 'error' ? 'alert' : 'status'}
      className={clsx('flex items-start gap-2.5 rounded-lg border px-3.5 py-3 text-sm', styles[variant])}
    >
      <Icon size={18} className="mt-px shrink-0" />
      <div>{children}</div>
    </div>
  );
}
