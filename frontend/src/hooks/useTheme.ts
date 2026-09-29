import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { useAuth, type Theme } from '@/stores/auth';

const DARK_CLASS = 'dark';
const DEFAULT_THEME: Theme = 'LIGHT';

function oppositeOf(theme: Theme): Theme {
  return theme === 'DARK' ? 'LIGHT' : 'DARK';
}

export function useApplyTheme() {
  const theme = useAuth((s) => s.user?.theme ?? DEFAULT_THEME);

  useEffect(() => {
    document.documentElement.classList.toggle(DARK_CLASS, theme === 'DARK');
  }, [theme]);
}

export function useThemeToggle() {
  const theme = useAuth((s) => s.user?.theme ?? DEFAULT_THEME);
  const setTheme = useAuth((s) => s.setTheme);
  const [saving, setSaving] = useState(false);

  async function toggleTheme() {
    const next = oppositeOf(theme);
    setTheme(next);
    setSaving(true);
    try {
      await api.patch('/profile/theme', { theme: next });
    } catch {
      setTheme(theme);
    } finally {
      setSaving(false);
    }
  }

  return { theme, toggleTheme, saving };
}
