import clsx from 'clsx';
import type { LucideIcon } from 'lucide-react';

export interface TabItem<T extends string> {
  id: T;
  label: string;
  icon: LucideIcon;
}

interface TabsProps<T extends string> {
  items: TabItem<T>[];
  active: T;
  onChange: (id: T) => void;
}

export function Tabs<T extends string>({ items, active, onChange }: TabsProps<T>) {
  return (
    <div role="tablist" className="flex gap-1 border-b border-slate-200 bg-white px-6 dark:border-slate-800 dark:bg-slate-900">
      {items.map(({ id, label, icon: Icon }) => (
        <button
          key={id}
          role="tab"
          aria-selected={active === id}
          onClick={() => onChange(id)}
          className={clsx(
            '-mb-px flex items-center gap-2 border-b-2 px-3 py-3 text-sm font-medium transition',
            active === id
              ? 'border-indigo-600 text-indigo-600 dark:border-indigo-400 dark:text-indigo-400'
              : 'border-transparent text-slate-500 hover:border-slate-300 hover:text-slate-700 dark:text-slate-400 dark:hover:border-slate-600 dark:hover:text-slate-200',
          )}
        >
          <Icon size={16} />
          {label}
        </button>
      ))}
    </div>
  );
}
