import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

interface PageHeaderProps {
  title: string;
  subtitle?: string;
  badge?: ReactNode;
  actions?: ReactNode;
  className?: string;
}

export function PageHeader({ title, subtitle, badge, actions, className }: PageHeaderProps) {
  return (
    <header
      className={cn(
        'flex flex-col md:flex-row md:items-center justify-between gap-4 sm:gap-5',
        className
      )}
    >
      <div className="flex items-stretch gap-3 sm:gap-4 min-w-0">
        <div
          aria-hidden="true"
          className="w-1 sm:w-1.5 bg-gradient-to-b from-sapphire-blue to-primary-navy dark:to-blue-400 rounded-full min-h-10 sm:min-h-12 shrink-0"
        />
        <div className="space-y-1 min-w-0">
          <h1 className="text-2xl sm:text-3xl md:text-4xl text-foreground font-display tracking-tight font-bold leading-tight">
            {title}
          </h1>
          {(badge || subtitle) && (
            <div className="flex flex-wrap items-center gap-2 sm:gap-3">
              {badge}
              {subtitle && (
                <p className="text-xs sm:text-sm text-muted-foreground font-sans font-medium">
                  {subtitle}
                </p>
              )}
            </div>
          )}
        </div>
      </div>

      {actions && (
        <div className="w-full md:w-auto shrink-0 flex items-center justify-start md:justify-end">
          {actions}
        </div>
      )}
    </header>
  );
}
