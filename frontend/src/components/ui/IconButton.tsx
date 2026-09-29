import type { ButtonHTMLAttributes } from 'react';
import clsx from 'clsx';
import type { LucideIcon } from 'lucide-react';

interface IconButtonProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'children'> {
  icon: LucideIcon;
  label: string;
  tone?: 'default' | 'danger';
}

export function IconButton({ icon: Icon, label, tone = 'default', className, ...props }: IconButtonProps) {
  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      className={clsx(
        'rounded-md p-2 transition focus-visible:outline-none focus-visible:ring-2 disabled:cursor-not-allowed disabled:opacity-40',
        tone === 'danger'
          ? 'text-slate-400 hover:bg-red-50 hover:text-red-600 focus-visible:ring-red-300 dark:hover:bg-red-950/50 dark:hover:text-red-400'
          : 'text-slate-400 hover:bg-slate-100 hover:text-slate-700 focus-visible:ring-indigo-300 dark:hover:bg-slate-800 dark:hover:text-slate-200',
        className,
      )}
      {...props}
    >
      <Icon size={16} />
    </button>
  );
}
