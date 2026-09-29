import type { ButtonHTMLAttributes } from 'react';
import { Link, type LinkProps } from 'react-router';
import clsx from 'clsx';
import type { LucideIcon } from 'lucide-react';

type IconButtonTone = 'default' | 'danger' | 'accent';

const toneClasses: Record<IconButtonTone, string> = {
  default:
    'text-slate-400 hover:bg-slate-100 hover:text-slate-700 focus-visible:ring-indigo-300 dark:hover:bg-slate-800 dark:hover:text-slate-200',
  danger:
    'text-slate-400 hover:bg-red-50 hover:text-red-600 focus-visible:ring-red-300 dark:hover:bg-red-950/50 dark:hover:text-red-400',
  accent:
    'text-indigo-500 hover:bg-indigo-50 hover:text-indigo-700 focus-visible:ring-indigo-300 dark:text-indigo-400 dark:hover:bg-indigo-950/50 dark:hover:text-indigo-300',
};

function iconButtonClasses(tone: IconButtonTone, className?: string) {
  return clsx(
    'inline-flex rounded-md p-2 transition focus-visible:outline-none focus-visible:ring-2 disabled:cursor-not-allowed disabled:opacity-40',
    toneClasses[tone],
    className,
  );
}

interface IconButtonProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'children'> {
  icon: LucideIcon;
  label: string;
  tone?: IconButtonTone;
}

export function IconButton({ icon: Icon, label, tone = 'default', className, ...props }: IconButtonProps) {
  return (
    <button type="button" title={label} aria-label={label} className={iconButtonClasses(tone, className)} {...props}>
      <Icon size={16} />
    </button>
  );
}

interface IconLinkProps extends Omit<LinkProps, 'children'> {
  icon: LucideIcon;
  label: string;
  tone?: IconButtonTone;
}

export function IconLink({ icon: Icon, label, tone = 'default', className, ...props }: IconLinkProps) {
  return (
    <Link title={label} aria-label={label} className={iconButtonClasses(tone, className)} {...props}>
      <Icon size={16} />
    </Link>
  );
}
