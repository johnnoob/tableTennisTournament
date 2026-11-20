import { Monitor, Moon, Sun } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useTheme, type ThemePreference } from '@/contexts/theme-context';

interface ThemeToggleProps {
  variant?: 'segmented' | 'icon' | 'cards';
  className?: string;
}

const OPTIONS: Array<{ value: ThemePreference; label: string; shortLabel: string; icon: typeof Sun }> = [
  { value: 'light', label: '淺色模式', shortLabel: '淺色', icon: Sun },
  { value: 'system', label: '跟隨裝置', shortLabel: '系統', icon: Monitor },
  { value: 'dark', label: '深色模式', shortLabel: '深色', icon: Moon },
];

export function ThemeToggle({ variant = 'segmented', className }: ThemeToggleProps) {
  const { theme, resolvedTheme, systemTheme, setTheme, toggleTheme } = useTheme();

  if (variant === 'icon') {
    const isDark = resolvedTheme === 'dark';
    return (
      <button
        type="button"
        onClick={toggleTheme}
        aria-label={isDark ? '切換為淺色模式' : '切換為深色模式'}
        title={isDark ? '切換為淺色模式' : '切換為深色模式'}
        className={cn(
          'size-10 rounded-xl border border-border bg-secondary/80 hover:bg-secondary text-foreground flex items-center justify-center transition-all active:scale-95 shrink-0',
          className
        )}
      >
        {isDark ? (
          <Sun size={18} className="text-amber-400 transition-transform duration-300" aria-hidden="true" />
        ) : (
          <Moon size={18} className="text-slate-600 transition-transform duration-300" aria-hidden="true" />
        )}
      </button>
    );
  }

  if (variant === 'cards') {
    return (
      <div className={cn('space-y-2', className)}>
        <div className="grid grid-cols-3 gap-2" role="radiogroup" aria-label="外觀主題">
          {OPTIONS.map(({ value, label, icon: Icon }) => {
            const active = theme === value;
            return (
              <button
                key={value}
                type="button"
                role="radio"
                aria-checked={active}
                onClick={() => setTheme(value)}
                className={cn(
                  'min-h-11 px-2.5 py-2 rounded-xl border text-xs font-black transition-all flex items-center justify-center gap-1.5',
                  active
                    ? 'bg-sapphire-blue text-white border-sapphire-blue shadow-xs'
                    : 'bg-card text-muted-foreground border-border hover:border-slate-400/60 hover:text-foreground hover:bg-secondary/60'
                )}
              >
                <Icon size={14} aria-hidden="true" />
                <span>{label}</span>
              </button>
            );
          })}
        </div>
        <p className="text-xs font-medium text-muted-foreground">
          目前裝置偵測：{systemTheme === 'dark' ? '深色' : '淺色'}外觀
        </p>
      </div>
    );
  }

  return (
    <div
      role="radiogroup"
      aria-label="外觀主題切換"
      className={cn(
        'grid grid-cols-3 gap-1 p-1 rounded-2xl bg-secondary/90 border border-border',
        className
      )}
    >
      {OPTIONS.map(({ value, shortLabel, label, icon: Icon }) => {
        const active = theme === value;
        return (
          <button
            key={value}
            type="button"
            role="radio"
            aria-checked={active}
            aria-label={label}
            title={label}
            onClick={() => setTheme(value)}
            className={cn(
              'h-8 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5',
              active
                ? 'bg-card text-foreground shadow-xs border border-border/60'
                : 'text-muted-foreground hover:text-foreground'
            )}
          >
            <Icon size={13} aria-hidden="true" className={cn(active && value === 'light' && 'text-amber-500', active && value === 'dark' && 'text-blue-400')} />
            <span>{shortLabel}</span>
          </button>
        );
      })}
    </div>
  );
}
