import type { ReactNode } from 'react';
import clsx from 'clsx';
import { AlertCircle, CheckCircle2 } from 'lucide-react';

interface AlertProps {
  variant: 'error' | 'success';
  children: ReactNode;
}

export function Alert({ variant, children }: AlertProps) {
  const Icon = variant === 'error' ? AlertCircle : CheckCircle2;
  return (
    <div
      role={variant === 'error' ? 'alert' : 'status'}
      className={clsx(
        'flex items-start gap-2.5 rounded-lg border px-3.5 py-3 text-sm',
        variant === 'error'
          ? 'border-red-200 bg-red-50 text-red-700 dark:border-red-900 dark:bg-red-950/50 dark:text-red-300'
          : 'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950/50 dark:text-emerald-300',
      )}
    >
      <Icon size={18} className="mt-px shrink-0" />
      <div>{children}</div>
    </div>
  );
}
