import type { DashboardPlayer } from '@/types/api.types';
import { Card, CardContent } from '@/components/ui/card';
import { ShieldCheck, TrendingUp, Building2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Link } from 'react-router-dom';
import { getTierBadge } from '@/lib/ranking';
import { PlayerAvatar } from '@/components/PlayerAvatar';

interface RankingCardProps {
  player: DashboardPlayer;
  variant?: 'featured' | 'standard';
}

export function RankingCard({ player, variant = 'standard' }: Readonly<RankingCardProps>) {
  const isFeatured = variant === 'featured';

  const displayRating = player.global_mmr || player.rating;
  const displayRank = player.rank;
  const displayStats = player.stats;
  const tier = getTierBadge(displayRating);

  return (
    <Link to={`?inspect=${player.id}`} className="block group">
      <Card
        className={cn(
          'relative transition-all duration-300 overflow-visible',
          isFeatured
            ? 'rounded-2xl md:rounded-3xl arena-hero-surface text-white p-5 sm:p-6 mt-3 border border-slate-700/80 shadow-lg shadow-primary-navy/20'
            : 'rounded-2xl bg-card group-hover:bg-secondary/60 p-4 mt-3 border border-border shadow-xs'
        )}
      >
        {/* Rank Badge floating top left */}
        <div
          className={cn(
            'absolute -left-2 -top-2.5 sm:-left-3 sm:-top-3 flex items-center justify-center font-display font-black rounded-full shadow-lg z-20 border-4 border-surface-shell transform transition-transform group-hover:scale-105 tabular-nums',
            isFeatured ? 'size-12 sm:size-14 text-lg sm:text-xl bg-olympic-gold text-white' : 'size-10 sm:size-11 text-base sm:text-lg bg-sapphire-blue text-white'
          )}
        >
          {displayRank}
        </div>

        <CardContent className="p-0 flex flex-col pt-2 pl-5 sm:pl-6">
          <div className="flex items-center justify-between gap-3 w-full">
            <div className="flex items-center gap-3.5 sm:gap-4 min-w-0">
              <div className="relative shrink-0">
                <PlayerAvatar
                  src={player.avatar}
                  name={player.name}
                  className={cn(
                    'rounded-full transition-all group-hover:ring-2 group-hover:ring-offset-2',
                    isFeatured
                      ? 'size-14 sm:size-18 border-2 border-white/30 group-hover:ring-white shadow-lg text-xl'
                      : 'size-11 sm:size-12 border border-border group-hover:ring-sapphire-blue text-sm'
                  )}
                />
                {player.isVerified && (
                  <div
                    className={cn(
                      'absolute -bottom-1 -right-1 rounded-full p-1 shadow-md',
                      isFeatured ? 'bg-sapphire-blue text-white ring-2 ring-primary-navy' : 'bg-blue-100 text-primary-navy dark:bg-blue-500/20 dark:text-blue-300'
                    )}
                  >
                    <ShieldCheck size={12} aria-hidden="true" />
                  </div>
                )}
              </div>

              <div className="flex flex-col min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <h3
                    className={cn(
                      'font-display font-black truncate transition-colors',
                      isFeatured
                        ? 'text-lg sm:text-2xl text-white'
                        : 'text-sm sm:text-base text-foreground group-hover:text-sapphire-blue'
                    )}
                  >
                    {player.name}
                  </h3>
                  {isFeatured && (
                    <div
                      className={cn(
                        'inline-flex items-center gap-1 px-2 py-0.5 rounded-full border text-xs font-black shadow-xs',
                        tier.color
                      )}
                    >
                      {tier.icon} {tier.name}
                    </div>
                  )}
                </div>
                <div className="flex flex-col gap-0.5 mt-0.5">
                  <span className={cn('text-xs font-bold truncate', isFeatured ? 'text-slate-400' : 'text-muted-foreground')}>
                    @{player.username}
                  </span>
                  {isFeatured && player.department && (
                    <span className="text-xs text-slate-300/80 font-sans flex items-center gap-1.5 font-bold truncate">
                      <Building2 size={11} className="text-sapphire-blue shrink-0" aria-hidden="true" />
                      {player.department}
                    </span>
                  )}
                </div>
              </div>
            </div>

            <div className="text-right shrink-0">
              <div
                className={cn(
                  'font-display font-black tracking-tight tabular-nums leading-none',
                  isFeatured ? 'text-2xl sm:text-4xl text-white' : 'text-xl sm:text-2xl text-foreground'
                )}
              >
                {Math.round(displayRating)}
              </div>
              <p
                className={cn(
                  'text-xs uppercase tracking-wider font-sans font-black mt-1.5 flex items-center gap-1 justify-end',
                  isFeatured ? 'text-slate-300/80' : 'text-muted-foreground'
                )}
              >
                ELO
                <TrendingUp
                  size={11}
                  aria-hidden="true"
                  className={isFeatured ? 'text-olympic-gold' : 'text-sapphire-blue'}
                />
              </p>
            </div>
          </div>

          {/* Stats Row */}
          <div
            className={cn(
              'grid grid-cols-3 items-center gap-2 sm:gap-3 mt-5 sm:mt-6 pt-4 border-t',
              isFeatured ? 'border-white/10' : 'border-border'
            )}
          >
            <div className="space-y-0.5">
              <p className={cn('text-xs uppercase font-sans font-black tracking-wider', isFeatured ? 'text-slate-400' : 'text-muted-foreground')}>
                勝率
              </p>
              <p className={cn('font-display font-black text-base sm:text-xl tabular-nums', isFeatured ? 'text-white' : 'text-foreground')}>
                {String(displayStats.winRate).replace('%', '')}%
              </p>
            </div>
            <div className={cn('space-y-0.5 pl-3 sm:pl-4 border-l', isFeatured ? 'border-white/10' : 'border-border')}>
              <p className={cn('text-xs uppercase font-sans font-black tracking-wider', isFeatured ? 'text-slate-400' : 'text-muted-foreground')}>
                總場次
              </p>
              <p className={cn('font-display font-black text-base sm:text-xl tabular-nums', isFeatured ? 'text-white' : 'text-foreground')}>
                {(displayStats.wins || 0) + (displayStats.losses || 0)}
              </p>
            </div>
            <div className="text-right space-y-0.5">
              <p className={cn('text-xs uppercase font-sans font-black tracking-wider', isFeatured ? 'text-slate-400' : 'text-muted-foreground')}>
                戰績
              </p>
              <div className="flex items-center justify-end gap-1.5 text-xs sm:text-sm font-display font-black tabular-nums">
                <span className={isFeatured ? 'text-olympic-gold' : 'text-emerald-600 dark:text-emerald-400'}>
                  {displayStats.wins || 0}W
                </span>
                <span className={isFeatured ? 'text-slate-500' : 'text-muted-foreground/50'}>-</span>
                <span className={isFeatured ? 'text-slate-300' : 'text-rose-500 dark:text-rose-400'}>
                  {displayStats.losses || 0}L
                </span>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}
