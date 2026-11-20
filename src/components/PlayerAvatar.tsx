import { useState } from 'react';
import { cn } from '@/lib/utils';

interface PlayerAvatarProps {
  src?: string | null;
  name?: string | null;
  className?: string;
  fallbackClassName?: string;
}

const isUsableAvatarSrc = (src?: string | null): src is string => {
  if (!src) return false;
  const trimmed = src.trim();
  if (!trimmed) return false;
  return !trimmed.startsWith('/api/placeholder');
};

export function PlayerAvatar({ src, name, className, fallbackClassName }: PlayerAvatarProps) {
  const [failedSrc, setFailedSrc] = useState<string | null>(null);

  const initial = (name || '?').trim().charAt(0).toUpperCase() || '?';
  const hasError = !!src && failedSrc === src;

  if (!isUsableAvatarSrc(src) || hasError) {
    return (
      <div
        aria-hidden={!name}
        className={cn(
          'bg-gradient-to-br from-sapphire-blue/15 to-primary-navy/10 dark:from-blue-500/25 dark:to-indigo-500/15 text-foreground font-display font-black flex items-center justify-center shrink-0 select-none',
          className,
          fallbackClassName
        )}
      >
        <span>{initial}</span>
      </div>
    );
  }

  return (
    <img
      src={src}
      alt={name || ''}
      referrerPolicy="no-referrer"
      loading="lazy"
      onError={() => setFailedSrc(src)}
      className={cn('object-cover shrink-0 bg-secondary', className)}
    />
  );
}
