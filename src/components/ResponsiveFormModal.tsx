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
  default: 'bg-sapphire-blue/10 text-sapphire-blue',
  gold: 'bg-amber-100 text-amber-600',
  success: 'bg-emerald-100 text-emerald-600',
  danger: 'bg-rose-100 text-rose-600',
};

const TONE_TITLE_CLASSES: Record<ModalTone, string> = {
  default: 'text-primary-navy',
  gold: 'text-primary-navy',
  success: 'text-emerald-700',
  danger: 'text-rose-700',
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
    <div className="flex items-start gap-3">
      {icon && (
        <div
          className={cn(
            'size-9 rounded-xl flex items-center justify-center shrink-0 mt-0.5',
            TONE_BADGE_CLASSES[tone]
          )}
          aria-hidden="true"
        >
          {icon}
        </div>
      )}
      <div className="min-w-0 flex-1 space-y-1">
        <TitleComponent id={titleId} className={cn('text-lg font-display font-black leading-snug', TONE_TITLE_CLASSES[tone])}>
          {title}
        </TitleComponent>
        {description ? (
          <DescComponent className="text-xs sm:text-sm text-slate-500 font-medium leading-relaxed">
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
        {footer && <div className={cn('shrink-0 border-t border-slate-100', footerClass)}>{footer}</div>}
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
            'p-0 gap-0 overflow-hidden border border-slate-200/80 bg-white rounded-3xl flex flex-col max-h-[90dvh]',
            SIZE_CLASSES[size]
          )}
        >
          <DialogHeader className="px-6 pt-5 pb-3.5 pr-14 border-b border-slate-100 text-left shrink-0">
            {headerInner(DialogTitle, DialogDescription)}
          </DialogHeader>
          {renderShell('px-6 py-4', 'px-6 py-4 bg-slate-50/70 flex items-center justify-end gap-2.5')}
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      {trigger && <DrawerTrigger asChild>{trigger}</DrawerTrigger>}
      <DrawerContent className="p-0 flex flex-col max-h-[94dvh] overflow-hidden">
        <DrawerHeader className="px-5 pt-2.5 pb-3 border-b border-slate-100 text-left shrink-0">
          {headerInner(DrawerTitle, DrawerDescription)}
        </DrawerHeader>
        {renderShell(
          'px-5 py-4',
          'px-5 pt-3 pb-[max(1rem,env(safe-area-inset-bottom,0px))] bg-white flex flex-col-reverse sm:flex-row sm:justify-end gap-2'
        )}
      </DrawerContent>
    </Drawer>
  );
}
