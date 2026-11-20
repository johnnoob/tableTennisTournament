import * as React from 'react';
import { useMediaQuery } from '@/hooks/use-media-query';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerHeader,
  DrawerTitle,
  DrawerTrigger,
} from '@/components/ui/drawer';
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
  sm: 'max-w-sm',
  md: 'max-w-md',
  lg: 'max-w-lg',
  xl: 'max-w-xl',
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
  const isDesktop = useMediaQuery('(min-width: 1024px)');
  const titleId = React.useId();

  const headerInner = (TitleComponent: typeof DialogTitle | typeof DrawerTitle, DescComponent: typeof DialogDescription | typeof DrawerDescription) => (
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
        <TitleComponent id={titleId} className={cn('text-lg font-display font-black leading-snug', TONE_TITLE_CLASSES[tone])}>
          {title}
        </TitleComponent>
        {description ? (
          <DescComponent className="text-xs sm:text-sm text-muted-foreground font-medium leading-relaxed">
            {description}
          </DescComponent>
        ) : (
          <DescComponent className="sr-only">{title}</DescComponent>
        )}
      </div>
    </div>
  );

  const renderShell = (bodyPaddingClass: string, footerClass: string) => {
    const contentNodes = (
      <>
        <div className={cn('flex-1 overflow-y-auto overscroll-contain', bodyPaddingClass)}>{children}</div>
        {footer && <div className={cn('shrink-0 border-t border-border', footerClass)}>{footer}</div>}
      </>
    );

    if (onSubmit) {
      return (
        <form
          onSubmit={onSubmit}
          aria-labelledby={titleId}
          className="flex flex-col flex-1 min-h-0 overflow-hidden"
        >
          {contentNodes}
        </form>
      );
    }

    return <div className="flex flex-col flex-1 min-h-0 overflow-hidden">{contentNodes}</div>;
  };

  if (isDesktop) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        {trigger && <DialogTrigger render={trigger} />}
        <DialogContent
          className={cn(
            'p-0 gap-0 overflow-hidden border border-border bg-popover rounded-3xl flex flex-col max-h-[90dvh]',
            SIZE_CLASSES[size]
          )}
        >
          <DialogHeader className="px-6 py-4 pr-14 border-b border-border text-left shrink-0">
            {headerInner(DialogTitle, DialogDescription)}
          </DialogHeader>
          {renderShell(
            'px-6 py-4',
            cn(
              'px-6 py-4 bg-surface-subtle/70 dark:bg-slate-950/40 flex items-center gap-2.5',
              size === 'sm' ? 'justify-center [&>*]:flex-1' : 'justify-end'
            )
          )}
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      {trigger && <DrawerTrigger asChild>{trigger}</DrawerTrigger>}
      <DrawerContent className="p-0 flex flex-col max-h-[94dvh] overflow-hidden">
        <DrawerHeader className="px-5 pt-2.5 pb-3 border-b border-border text-left group-data-[vaul-drawer-direction=bottom]/drawer-content:text-left shrink-0">
          {headerInner(DrawerTitle, DrawerDescription)}
        </DrawerHeader>
        {renderShell(
          'px-5 py-4',
          cn(
            'px-5 pt-3 pb-[max(1rem,env(safe-area-inset-bottom,0px))] bg-popover flex flex-col-reverse sm:flex-row sm:items-center gap-2',
            size === 'sm' ? 'sm:justify-center sm:[&>*]:flex-1' : 'sm:justify-end'
          )
        )}
      </DrawerContent>
    </Drawer>
  );
}
