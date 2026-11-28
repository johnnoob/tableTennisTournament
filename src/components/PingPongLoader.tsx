import { motion, useReducedMotion } from 'framer-motion';
import { cn } from '@/lib/utils';

export interface PingPongLoaderProps {
  label?: string;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

const SIZE_CLASS: Record<NonNullable<PingPongLoaderProps['size']>, string> = {
  sm: 'max-w-[230px] sm:max-w-[260px]',
  md: 'max-w-[300px] sm:max-w-[340px]',
  lg: 'max-w-[360px] sm:max-w-[440px]',
};

const PingPongLoader = ({
  label,
  size = 'lg',
  className,
}: Readonly<PingPongLoaderProps>) => {
  const prefersReduced = useReducedMotion();

  return (
    <motion.div
      role="status"
      aria-live="polite"
      initial={prefersReduced ? false : { opacity: 0, scale: 0.98 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.25 }}
      className={cn(
        'flex flex-col items-center justify-center gap-3 w-full select-none',
        className,
      )}
    >
      <div
        className={cn(
          'w-full rounded-[24px] sm:rounded-[28px] overflow-hidden shadow-sm dark:shadow-[0_16px_44px_rgba(0,0,0,0.45)] dark:ring-1 dark:ring-cyan-300/15',
          SIZE_CLASS[size],
        )}
      >
        <img
          src="/brand/loading.svg"
          alt={label ? `${label} — TT戰網載入中` : 'TT戰網熱身開球中'}
          width={600}
          height={420}
          loading="eager"
          decoding="async"
          draggable={false}
          className="block w-full h-auto select-none"
        />
      </div>

      {label && (
        <p className="text-xs font-bold text-muted-foreground tracking-wide text-center">
          {label}...
        </p>
      )}
      <span className="sr-only">{label || '熱身開球中，載入中'}</span>
    </motion.div>
  );
};

export default PingPongLoader;
