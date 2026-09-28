import clsx from 'clsx';
import { env } from '@/config/env';

export function Brand({ className }: { className?: string }) {
  return (
    <div className={clsx('flex items-center gap-2.5 text-lg font-semibold', className)}>
      <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-indigo-600 text-white">
        {env.appName.charAt(0).toUpperCase()}
      </span>
      {env.appName}
    </div>
  );
}
