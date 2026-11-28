import { motion, useReducedMotion } from 'framer-motion';
import { cn } from '@/lib/utils';

export interface PingPongLoaderProps {
  label?: string;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

const SIZE_CLASS: Record<NonNullable<PingPongLoaderProps['size']>, string> = {
  sm: 'max-w-[220px] sm:max-w-[245px]',
  md: 'max-w-[270px] sm:max-w-[310px]',
  lg: 'max-w-[320px] sm:max-w-[390px]',
};

const PingPongLoader = ({
  label = '熱身開球中',
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
      <div className={cn('relative w-full', SIZE_CLASS[size])}>
        <div
          aria-hidden="true"
          className="hidden dark:block pointer-events-none absolute inset-x-10 bottom-1 h-14 rounded-full bg-gradient-to-r from-sapphire-blue/20 via-tita-teal/25 to-sapphire-blue/20 blur-2xl"
        />
        <img
          src="/brand/loading.svg"
          alt={`${label} — TT戰網桌球載入動畫`}
          width={496}
          height={200}
          loading="eager"
          decoding="async"
          draggable={false}
          className="relative z-10 block w-full h-auto select-none"
        />
      </div>

      <div className="w-full max-w-[180px] sm:max-w-[210px] h-1.5 rounded-full bg-sapphire-blue/12 dark:bg-white/10 overflow-hidden">
        <div className="h-full w-2/5 rounded-full bg-gradient-to-r from-sapphire-blue via-[#198cd8] to-tita-teal tita-progress-runner" />
      </div>

      <p className="text-xs sm:text-[13px] font-display font-bold tracking-[0.14em] text-foreground/85 inline-flex items-center gap-1.5">
        <span>{label}</span>
        <span className="inline-flex items-center gap-1" aria-hidden="true">
          <span
            className="size-1 rounded-full bg-sapphire-blue animate-pulse"
            style={{ animationDelay: '0ms' }}
          />
          <span
            className="size-1 rounded-full bg-[#198cd8] animate-pulse"
            style={{ animationDelay: '180ms' }}
          />
          <span
            className="size-1 rounded-full bg-tita-teal animate-pulse"
            style={{ animationDelay: '360ms' }}
          />
        </span>
      </p>
      <span className="sr-only">{label}，載入中</span>
    </motion.div>
  );
};

export default PingPongLoader;
