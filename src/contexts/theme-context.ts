import { createContext, useContext } from 'react';

export type ThemePreference = 'system' | 'light' | 'dark';
export type ResolvedTheme = 'light' | 'dark';

export const THEME_STORAGE_KEY = 'precision-arena-theme';

export interface ThemeContextValue {
  theme: ThemePreference;
  resolvedTheme: ResolvedTheme;
  systemTheme: ResolvedTheme;
  setTheme: (next: ThemePreference) => void;
  toggleTheme: () => void;
}

export const ThemeContext = createContext<ThemeContextValue | null>(null);

export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext);
  if (!ctx) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return ctx;
}
