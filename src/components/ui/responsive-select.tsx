import * as React from 'react';
import { CheckIcon, ChevronDownIcon, SearchIcon, XIcon } from 'lucide-react';
import { useMediaQuery } from '@/hooks/use-media-query';
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerHeader,
  DrawerTitle,
} from '@/components/ui/drawer';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
} from '@/components/ui/select';
import { cn } from '@/lib/utils';

export interface ResponsiveSelectOption {
  value: string;
  label: string;
  prefix?: React.ReactNode;
  badge?: string | number;
  description?: string;
}

export interface ResponsiveSelectProps {
  value: string;
  onValueChange: (value: string) => void;
  options: ReadonlyArray<ResponsiveSelectOption>;
  title: string;
  description?: string;
  placeholder?: string;
  icon?: React.ReactNode;
  triggerClassName?: string;
  ariaLabel?: string;
}

export function ResponsiveSelect({
  value,
  onValueChange,
  options,
  title,
  description,
  placeholder = '請選擇',
  icon,
  triggerClassName,
  ariaLabel,
}: Readonly<ResponsiveSelectProps>) {
  const isDesktop = useMediaQuery('(min-width: 1024px)');
  const [open, setOpen] = React.useState(false);
  const [query, setQuery] = React.useState('');

  const selectedOption = options.find((opt) => opt.value === value);

  const handleOpenChange = (nextOpen: boolean) => {
    setOpen(nextOpen);
    if (nextOpen) {
      setQuery('');
    }
  };

  const filteredOptions = React.useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return options;
    return options.filter(
      (opt) =>
        opt.label.toLowerCase().includes(q) ||
        (opt.description && opt.description.toLowerCase().includes(q)),
    );
  }, [options, query]);

  const triggerDisplay = selectedOption ? (
    <span className="flex items-center gap-1.5 min-w-0 truncate">
      {selectedOption.prefix && (
        <span className="shrink-0 leading-none">{selectedOption.prefix}</span>
      )}
      <span className="truncate">{selectedOption.label}</span>
    </span>
  ) : (
    <span className="text-muted-foreground truncate">{placeholder}</span>
  );

  // Desktop: Anchored Popover Select
  if (isDesktop) {
    return (
      <Select
        value={value}
        onValueChange={(nextVal) => {
          if (nextVal) {
            onValueChange(nextVal);
          }
        }}
      >
        <SelectTrigger
          aria-label={ariaLabel || title}
          className={cn('w-full', triggerClassName)}
        >
          <div className="flex items-center gap-2 min-w-0 flex-1">
            {icon && <span className="shrink-0 flex items-center">{icon}</span>}
            {triggerDisplay}
          </div>
          {selectedOption?.badge !== undefined && (
            <span className="px-2 py-0.5 rounded-full bg-secondary text-muted-foreground text-[11px] font-display font-black tabular-nums shrink-0">
              {selectedOption.badge}
            </span>
          )}
        </SelectTrigger>

        <SelectContent>
          {options.map((opt) => (
            <SelectItem key={opt.value} value={opt.value}>
              <span className="flex items-center gap-2 min-w-0">
                {opt.prefix && (
                  <span className="shrink-0 leading-none">{opt.prefix}</span>
                )}
                <span className="truncate">{opt.label}</span>
              </span>
              {opt.badge !== undefined && (
                <span className="ml-2 px-2 py-0.5 rounded-full bg-secondary text-muted-foreground text-[11px] font-display font-black tabular-nums shrink-0">
                  {opt.badge}
                </span>
              )}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    );
  }

  // Mobile & Tablet (< 1024px): Thumb-Friendly Bottom Sheet Drawer Picker
  return (
    <>
      <button
        type="button"
        aria-label={ariaLabel || title}
        aria-expanded={open}
        aria-haspopup="dialog"
        onClick={() => handleOpenChange(true)}
        className={cn(
          'flex w-full min-h-11 h-11 items-center justify-between gap-2 rounded-xl border border-input bg-card px-3.5 py-2 text-sm font-bold text-foreground shadow-xs transition-colors hover:bg-secondary/50 active:scale-[0.99] focus-visible:outline-none focus-visible:border-sapphire-blue focus-visible:ring-2 focus-visible:ring-sapphire-blue/25',
          triggerClassName,
        )}
      >
        <div className="flex items-center gap-2 min-w-0 flex-1">
          {icon && <span className="shrink-0 flex items-center">{icon}</span>}
          {triggerDisplay}
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          {selectedOption?.badge !== undefined && (
            <span className="px-2 py-0.5 rounded-full bg-secondary text-muted-foreground text-[11px] font-display font-black tabular-nums">
              {selectedOption.badge}
            </span>
          )}
          <ChevronDownIcon
            className="size-4 text-muted-foreground shrink-0"
            aria-hidden="true"
          />
        </div>
      </button>

      <Drawer open={open} onOpenChange={handleOpenChange}>
        <DrawerContent>
          <DrawerHeader className="pb-2 text-left md:text-left">
            <DrawerTitle className="text-base font-display font-black text-foreground">
              {title}
            </DrawerTitle>
            {description && (
              <DrawerDescription className="text-xs font-bold text-muted-foreground">
                {description}
              </DrawerDescription>
            )}
          </DrawerHeader>

          {options.length > 6 && (
            <div className="px-4 pb-2">
              <div className="relative">
                <SearchIcon
                  size={15}
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none"
                  aria-hidden="true"
                />
                <input
                  type="text"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="快速搜尋選項..."
                  aria-label="搜尋選項"
                  className="w-full h-10 pl-9 pr-8 rounded-xl border border-input bg-surface-subtle text-base font-bold text-foreground placeholder:text-muted-foreground/70 focus:outline-none focus:ring-2 focus:ring-sapphire-blue/25 focus:border-sapphire-blue"
                />
                {query && (
                  <button
                    type="button"
                    aria-label="清除選項搜尋"
                    onClick={() => setQuery('')}
                    className="absolute right-1.5 top-1/2 -translate-y-1/2 size-7 rounded-lg flex items-center justify-center text-muted-foreground hover:text-foreground"
                  >
                    <XIcon size={14} aria-hidden="true" />
                  </button>
                )}
              </div>
            </div>
          )}

          <div className="px-4 pb-6 pt-1 max-h-[60dvh] overflow-y-auto overscroll-contain space-y-2">
            {filteredOptions.length > 0 ? (
              filteredOptions.map((opt) => {
                const isSelected = opt.value === value;
                return (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => {
                      onValueChange(opt.value);
                      setOpen(false);
                    }}
                    className={cn(
                      'w-full min-h-[52px] px-4 py-3 rounded-2xl border flex items-center justify-between gap-3 text-left transition-all active:scale-[0.99]',
                      isSelected
                        ? 'bg-sapphire-blue/[0.08] dark:bg-blue-500/18 border-sapphire-blue text-sapphire-blue dark:text-blue-200 shadow-2xs'
                        : 'bg-card hover:bg-secondary/60 border-border text-foreground',
                    )}
                  >
                    <div className="flex items-center gap-2.5 min-w-0 flex-1">
                      {opt.prefix && (
                        <span className="text-base leading-none shrink-0">
                          {opt.prefix}
                        </span>
                      )}
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-display font-black truncate">
                          {opt.label}
                        </p>
                        {opt.description && (
                          <p className="text-xs font-bold text-muted-foreground truncate mt-0.5">
                            {opt.description}
                          </p>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      {opt.badge !== undefined && (
                        <span
                          className={cn(
                            'px-2.5 py-0.5 rounded-full text-xs font-display font-black tabular-nums',
                            isSelected
                              ? 'bg-sapphire-blue/15 text-sapphire-blue dark:bg-blue-500/25 dark:text-blue-200'
                              : 'bg-secondary text-muted-foreground',
                          )}
                        >
                          {opt.badge}
                        </span>
                      )}
                      {isSelected && (
                        <span className="size-6 rounded-full bg-sapphire-blue text-white flex items-center justify-center shrink-0">
                          <CheckIcon size={14} strokeWidth={2.5} aria-hidden="true" />
                        </span>
                      )}
                    </div>
                  </button>
                );
              })
            ) : (
              <p className="py-8 text-center text-xs font-bold text-muted-foreground">
                找不到符合的選項
              </p>
            )}
          </div>
        </DrawerContent>
      </Drawer>
    </>
  );
}
