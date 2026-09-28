import { Moon, Sun } from 'lucide-react';
import { useThemeToggle } from '@/hooks/useTheme';

export function ThemeToggle() {
  const { theme, toggleTheme, saving } = useThemeToggle();
  const isDark = theme === 'DARK';
  const label = isDark ? 'Mudar para tema claro' : 'Mudar para tema escuro';

  return (
    <button
      type="button"
      onClick={toggleTheme}
      disabled={saving}
      aria-label={label}
      title={label}
      className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md text-slate-600 transition hover:bg-slate-100 disabled:opacity-60 dark:text-slate-300 dark:hover:bg-slate-800"
    >
      {isDark ? <Sun size={18} /> : <Moon size={18} />}
    </button>
  );
}
