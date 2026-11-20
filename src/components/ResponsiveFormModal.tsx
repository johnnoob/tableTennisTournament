import * as React from 'react';
import { Dialog as DialogPrimitive } from '@base-ui/react/dialog';
import { X } from 'lucide-react';
import { useVisualViewport } from '@/hooks/use-visual-viewport';
import { cn } from '@/lib/utils';

export type ModalTone = 'default' | 'gold' | 'success' | 'danger';
export type ModalSize = 'sm' | 'md' | 'lg' | 'xl';

export interface ResponsiveFormModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  trigger?: React.ReactElement;
  title: string;
  description?: string;
  icon?: React.ReactNode;
  tone?: ModalTone;
  size?: ModalSize;
  onSubmit?: (e: React.FormEvent<HTMLFormElement>) => void;
  children: React.ReactNode;
  footer?: React.ReactNode;
}

const SIZE_CLASSES: Record<ModalSize, string> = {
  sm: 'md:max-w-sm',
  md: 'md:max-w-md',
  lg: 'md:max-w-lg',
  xl: 'md:max-w-xl',
};

const TONE_BADGE_CLASSES: Record<ModalTone, string> = {
  default: 'bg-sapphire-blue/10 text-sapphire-blue dark:bg-blue-500/15 dark:text-blue-400',
  gold: 'bg-amber-100 text-amber-600 dark:bg-amber-500/15 dark:text-amber-400',
  success: 'bg-emerald-100 text-emerald-600 dark:bg-emerald-500/15 dark:text-emerald-400',
  danger: 'bg-rose-100 text-rose-600 dark:bg-rose-500/15 dark:text-rose-400',
};

const TONE_TITLE_CLASSES: Record<ModalTone, string> = {
  default: 'text-foreground',
  gold: 'text-foreground',
  success: 'text-emerald-700 dark:text-emerald-400',
  danger: 'text-rose-700 dark:text-rose-400',
};

export function ResponsiveFormModal({
  open,
  onOpenChange,
  trigger,
  title,
  description,
  icon,
  tone = 'default',
  size = 'md',
  onSubmit,
  children,
  footer,
}: ResponsiveFormModalProps) {
  const viewport = useVisualViewport();
  const titleId = React.useId();
  const compactForKeyboard = viewport.isKeyboardOpen;

  const viewportStyle =
    open && viewport.height > 0
      ? {
          top: `${viewport.offsetTop}px`,
          height: `${viewport.height}px`,
        }
      : undefined;

  const bodyPaddingClass = compactForKeyboard
    ? 'px-5 md:px-6 py-3'
    : 'px-5 md:px-6 py-4';

  const footerClass = compactForKeyboard
    ? cn(
        'px-5 md:px-6 py-2.5 bg-surface-subtle/80 dark:bg-slate-950/40 flex flex-row items-center gap-2 [&>*]:w-auto [&>*:first-child]:shrink-0 [&>*:last-child]:flex-1 md:[&>*:last-child]:flex-initial',
        size === 'sm' ? 'md:justify-center md:[&>*]:flex-1' : 'md:justify-end'
      )
    : cn(
        'px-5 md:px-6 pt-3 pb-[max(1rem,env(safe-area-inset-bottom,0px))] md:py-4 bg-surface-subtle/70 dark:bg-slate-950/40 flex flex-col-reverse sm:flex-row sm:items-center gap-2',
        size === 'sm'
          ? 'sm:justify-center sm:[&>*]:flex-1 md:justify-center md:[&>*]:flex-1'
          : 'sm:justify-end md:justify-end'
      );

  const contentNodes = (
    <>
      <div className={cn('flex-1 min-h-0 min-w-0 overflow-y-auto overscroll-contain', bodyPaddingClass)}>
        {children}
      </div>
      {footer && <div className={cn('shrink-0 border-t border-border', footerClass)}>{footer}</div>}
    </>
  );

  return (
    <DialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
      {trigger && <DialogPrimitive.Trigger render={trigger} />}
      <DialogPrimitive.Portal>
        <DialogPrimitive.Backdrop className="fixed inset-0 z-100 bg-slate-950/45 backdrop-blur-sm data-open:animate-in data-open:fade-in-0 data-closed:animate-out data-closed:fade-out-0" />
        <DialogPrimitive.Viewport
          style={viewportStyle}
          className="fixed inset-x-0 top-0 h-dvh z-100 flex items-end md:items-center justify-center md:p-4"
        >
          <DialogPrimitive.Popup
            className={cn(
              'relative flex flex-col overflow-hidden bg-popover text-popover-foreground shadow-2xl dark:shadow-black/60 duration-200 data-open:animate-in data-open:fade-in-0 data-closed:animate-out data-closed:fade-out-0',
              'w-full rounded-t-[1.75rem] border-t border-x-0 border-b-0 border-border max-h-[calc(100%-0.5rem)]',
              'md:w-[calc(100%-2rem)] md:rounded-3xl md:border md:max-h-[calc(100%-1.5rem)]',
              SIZE_CLASSES[size]
            )}
          >
            <DialogPrimitive.Close
              aria-label="關閉視窗"
              className={cn(
                'absolute right-4 size-9 flex items-center justify-center rounded-xl text-muted-foreground transition-colors hover:text-foreground hover:bg-secondary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sapphire-blue/30 z-10',
                compactForKeyboard ? 'top-2.5' : 'top-4'
              )}
            >
              <X className="h-4 w-4" aria-hidden="true" />
              <span className="sr-only">關閉視窗</span>
            </DialogPrimitive.Close>

            <div
              className={cn(
                'px-5 md:px-6 pr-14 border-b border-border text-left shrink-0 transition-all',
                compactForKeyboard ? 'py-2.5' : 'py-4'
              )}
            >
              <div className="flex items-center gap-3">
                {icon && (
                  <div
                    className={cn(
                      'size-9 rounded-xl flex items-center justify-center shrink-0',
                      TONE_BADGE_CLASSES[tone]
                    )}
                    aria-hidden="true"
                  >
                    {icon}
                  </div>
                )}
                <div className="min-w-0 flex-1 space-y-0.5 text-left">
                  <DialogPrimitive.Title
                    id={titleId}
                    className={cn(
                      'text-base sm:text-lg font-display font-black leading-snug tracking-tight',
                      TONE_TITLE_CLASSES[tone]
                    )}
                  >
                    {title}
                  </DialogPrimitive.Title>
                  {description ? (
                    <DialogPrimitive.Description
                      className={cn(
                        'text-xs sm:text-sm text-muted-foreground font-medium leading-relaxed',
                        compactForKeyboard && 'sr-only'
                      )}
                    >
                      {description}
                    </DialogPrimitive.Description>
                  ) : (
                    <DialogPrimitive.Description className="sr-only">
                      {title}
                    </DialogPrimitive.Description>
                  )}
                </div>
              </div>
            </div>

            {onSubmit ? (
              <form
                onSubmit={onSubmit}
                aria-labelledby={titleId}
                className="flex flex-col flex-1 min-h-0 overflow-hidden"
              >
                {contentNodes}
              </form>
            ) : (
              <div className="flex flex-col flex-1 min-h-0 overflow-hidden">
                {contentNodes}
              </div>
            )}
          </DialogPrimitive.Popup>
        </DialogPrimitive.Viewport>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}
