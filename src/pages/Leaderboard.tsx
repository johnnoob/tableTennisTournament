import { useState, useMemo, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useSearchParams } from 'react-router-dom';
import { Search, Timer, Crown, History, X, Users } from 'lucide-react';
import { getTierBadge } from '@/lib/ranking';
import { cn } from '@/lib/utils';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { motion, AnimatePresence } from 'framer-motion';
import { fadeInUp, pageVariants } from '@/lib/animations';
import { LeaderboardSkeleton } from '@/components/LeaderboardSkeleton';
import { PageHeader } from '@/components/PageHeader';
import { PlayerAvatar } from '@/components/PlayerAvatar';
import { useAuth } from '@/hooks/useAuth';
import apiClient from '@/utils/apiClient';
import type { LeaderboardResponse, RawLeaderboardItem, SeasonSummary } from '@/types/api.types';

export function Leaderboard() {
  const [searchTerm, setSearchTerm] = useState('');
  const [searchParams, setSearchParams] = useSearchParams();
  const { data: currentUser } = useAuth();

  const urlSeasonId = searchParams.get('season_id');
  const [selectedSeason, setSelectedSeason] = useState<string>(urlSeasonId || '');

  const { data: seasons = [], isPending: isSeasonsLoading } = useQuery<SeasonSummary[]>({
    queryKey: ['seasons', 'list'],
    queryFn: async () => {
      const res = await apiClient.get<SeasonSummary[]>('/seasons');
      return res.data;
    },
  });

  useEffect(() => {
    if (!selectedSeason && seasons.length > 0) {
      setSelectedSeason(seasons[0].id);
    }
  }, [seasons, selectedSeason]);

  const { data: leaderboardData, isPending: isLeaderboardLoading } = useQuery<LeaderboardResponse>({
    queryKey: ['leaderboard', selectedSeason],
    queryFn: async () => {
      const url = `/leaderboard?season_id=${encodeURIComponent(selectedSeason)}`;
      const res = await apiClient.get<LeaderboardResponse>(url);
      return res.data;
    },
    enabled: !!selectedSeason,
    refetchInterval: 10000,
  });

  const realLeaderboard = useMemo(
    () => leaderboardData?.leaderboard ?? [],
    [leaderboardData]
  );
  const seasonName = leaderboardData?.season_name || '讀取中...';
  const isLoading = isSeasonsLoading || isLeaderboardLoading;

  const currentSeasonObj = seasons.find((s) => s.id === selectedSeason);
  const isSeasonEnded = currentSeasonObj?.status === 'completed';
  const isAllTime = selectedSeason === 'all-time';

  const openInspect = (playerId: string) => {
    const newParams = new URLSearchParams(searchParams);
    newParams.set('inspect', playerId);
    setSearchParams(newParams);
  };

  const sortedPlayers = useMemo(() => {
    const q = searchTerm.trim().toLowerCase();
    if (!q) return realLeaderboard;
    return realLeaderboard.filter(
      (p) =>
        p.player_name.toLowerCase().includes(q) ||
        (p.department && p.department.toLowerCase().includes(q))
    );
  }, [realLeaderboard, searchTerm]);

  const podiumPlayers = useMemo(() => {
    return sortedPlayers.filter((p) => p.rank !== '-').slice(0, 3);
  }, [sortedPlayers]);

  const rankedCount = useMemo(() => {
    return realLeaderboard.filter((p) => p.rank !== '-').length;
  }, [realLeaderboard]);

  const showPodium = !searchTerm.trim() && podiumPlayers.length > 0;

  const seasonStatusBadge = (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg font-black text-xs uppercase tracking-wider',
        isAllTime
          ? 'bg-purple-100 text-purple-700'
          : isSeasonEnded
            ? 'bg-amber-100 text-amber-700'
            : 'bg-emerald-100 text-emerald-700'
      )}
    >
      {isAllTime ? <Crown size={13} aria-hidden="true" /> : <Timer size={13} aria-hidden="true" />}
      {seasonName}
    </span>
  );

  const countAction = (
    <div className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl bg-slate-50 border border-slate-200/80 text-xs font-bold text-slate-600">
      <Users size={14} className="text-sapphire-blue" aria-hidden="true" />
      <span>
        已上榜 <strong className="font-display font-black text-primary-navy tabular-nums">{rankedCount}</strong> / {realLeaderboard.length} 人
      </span>
    </div>
  );

  return (
    <AnimatePresence mode="wait">
      {isLoading ? (
        <motion.div
          key="skeleton"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.25 }}
        >
          <LeaderboardSkeleton />
        </motion.div>
      ) : (
        <motion.div
          key="content"
          variants={pageVariants}
          initial="initial"
          animate="animate"
          exit="exit"
          className="arena-page"
        >
          <motion.div variants={fadeInUp}>
            <PageHeader
              title={isAllTime ? '歷史殿堂總榜' : '賽季積分榜'}
              subtitle="Precision Arena · Single-Track Elo"
              badge={seasonStatusBadge}
              actions={countAction}
            />
          </motion.div>

          {/* 篩選與搜尋列 */}
          <motion.div
            variants={fadeInUp}
            className="arena-surface p-3 sm:p-4 flex flex-col sm:flex-row items-stretch sm:items-center gap-3"
          >
            <Select
              value={selectedSeason}
              onValueChange={(val) => {
                if (val) {
                  setSelectedSeason(val);
                  const newParams = new URLSearchParams(searchParams);
                  if (val === 'all-time') {
                    newParams.delete('season_id');
                  } else {
                    newParams.set('season_id', val);
                  }
                  setSearchParams(newParams);
                }
              }}
            >
              <SelectTrigger className="w-full sm:w-64 h-11 bg-white border-slate-200 rounded-xl font-bold text-primary-navy shadow-xs">
                <div className="flex items-center gap-2 truncate">
                  <History size={16} className="text-slate-400 shrink-0" aria-hidden="true" />
                  <SelectValue placeholder="選擇賽季" />
                </div>
              </SelectTrigger>
              <SelectContent>
                {seasons.map((s) => (
                  <SelectItem key={s.id} value={s.id} className="font-bold">
                    {s.status === 'active' ? '🟢 ' : '🏆 '} {s.name}
                  </SelectItem>
                ))}
                <SelectItem value="all-time" className="font-bold">
                  👑 All-Time 歷史總榜
                </SelectItem>
              </SelectContent>
            </Select>

            <div className="relative flex-1">
              <Search
                className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none"
                size={17}
                aria-hidden="true"
              />
              <input
                type="text"
                aria-label="搜尋同仁姓名或單位"
                placeholder="搜尋同仁姓名或單位..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full h-11 pl-10 pr-10 rounded-xl border border-slate-200 bg-white text-base sm:text-sm focus:outline-none focus:ring-2 focus:ring-sapphire-blue/20 focus:border-sapphire-blue transition-all font-bold text-primary-navy placeholder:text-slate-400 shadow-xs"
              />
              {searchTerm && (
                <button
                  type="button"
                  aria-label="清除搜尋"
                  onClick={() => setSearchTerm('')}
                  className="absolute right-2 top-1/2 -translate-y-1/2 size-8 flex items-center justify-center rounded-lg text-slate-400 hover:text-primary-navy hover:bg-slate-100 transition-colors"
                >
                  <X size={15} aria-hidden="true" />
                </button>
              )}
            </div>
          </motion.div>

          {/* Top 3 榮譽頒獎台 */}
          {showPodium && (
            <motion.section
              variants={fadeInUp}
              aria-label="前三名領先榜"
              className="arena-surface px-3 sm:px-6 pt-5 pb-0 overflow-hidden"
            >
              <div className="flex items-center justify-between mb-4 sm:mb-6">
                <p className="text-xs font-black uppercase tracking-[0.2em] text-slate-500">
                  {isAllTime ? '歷史積分殿堂 Top 3' : isSeasonEnded ? '賽季最終頒獎台' : '目前領先前三名'}
                </p>
                <span className="text-xs font-bold text-slate-400 hidden sm:inline">
                  點擊選手查看完整戰績
                </span>
              </div>

              <div className="grid grid-cols-3 items-end gap-2 sm:gap-5 max-w-3xl mx-auto pt-4 sm:pt-6">
                {/* 第 2 名 */}
                <PodiumSlot
                  place={2}
                  player={podiumPlayers[1]}
                  onSelect={openInspect}
                />

                {/* 第 1 名 */}
                <PodiumSlot
                  place={1}
                  player={podiumPlayers[0]}
                  onSelect={openInspect}
                />

                {/* 第 3 名 */}
                <PodiumSlot
                  place={3}
                  player={podiumPlayers[2]}
                  onSelect={openInspect}
                />
              </div>
            </motion.section>
          )}

          {/* 積分數據表（桌面表格 + 容器寬度 <640px 自動轉卡片） */}
          <motion.div variants={fadeInUp}>
            <div
              tabIndex={0}
              role="region"
              aria-labelledby="leaderboard-table-caption"
              className="leaderboard-table-wrapper arena-card overflow-x-auto"
            >
              <table className="leaderboard-table w-full text-left">
                <caption id="leaderboard-table-caption" className="sr-only">
                  {seasonName} 積分排行榜
                </caption>
                <thead>
                  <tr className="border-b border-slate-200/80">
                    <th
                      scope="col"
                      className="sticky top-0 py-3.5 px-4 text-xs font-black text-slate-500 uppercase tracking-wider w-20 text-center bg-slate-50/95 backdrop-blur-md z-10"
                    >
                      名次
                    </th>
                    <th
                      scope="col"
                      className="sticky top-0 py-3.5 px-4 text-xs font-black text-slate-500 uppercase tracking-wider bg-slate-50/95 backdrop-blur-md z-10"
                    >
                      選手
                    </th>
                    <th
                      scope="col"
                      className="sticky top-0 py-3.5 px-4 text-xs font-black text-slate-500 uppercase tracking-wider bg-slate-50/95 backdrop-blur-md z-10"
                    >
                      段位與勝率
                    </th>
                    <th
                      scope="col"
                      className="lb-col-record sticky top-0 py-3.5 px-4 text-xs font-black text-slate-500 uppercase tracking-wider text-center bg-slate-50/95 backdrop-blur-md z-10"
                    >
                      戰績
                    </th>
                    <th
                      scope="col"
                      className="lb-col-form sticky top-0 py-3.5 px-4 text-xs font-black text-slate-500 uppercase tracking-wider text-center bg-slate-50/95 backdrop-blur-md z-10"
                    >
                      近 5 場
                    </th>
                    <th
                      scope="col"
                      className="sticky top-0 py-3.5 px-4 text-xs font-black text-primary-navy uppercase tracking-wider text-right bg-slate-50/95 backdrop-blur-md z-10"
                    >
                      積分 (ELO)
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {sortedPlayers.map((player) => {
                    const rank = player.rank;
                    const tier = getTierBadge(player.global_mmr);
                    const isTop1 = rank === 1;
                    const isMe = currentUser?.id === player.player_id;
                    const trendStr = String(player.trend ?? '0');
                    const isPositiveTrend = trendStr.startsWith('+');

                    return (
                      <tr
                        key={player.player_id}
                        onClick={() => openInspect(player.player_id)}
                        className={cn(
                          'group hover:bg-slate-50/80 transition-colors cursor-pointer',
                          isTop1 && 'lb-row-top1 bg-amber-50/35',
                          isMe && 'lb-row-me bg-sapphire-blue/[0.04]'
                        )}
                      >
                        <td className="lb-cell-rank py-3.5 px-4 w-20 text-center">
                          <div className="flex flex-col items-center justify-center gap-0.5">
                            {rank === 1 || rank === 2 || rank === 3 ? (
                              <span
                                className={cn(
                                  'size-8 rounded-full flex items-center justify-center font-display font-black text-sm tabular-nums border',
                                  rank === 1
                                    ? 'bg-amber-100 text-amber-700 border-amber-300'
                                    : rank === 2
                                      ? 'bg-slate-200/80 text-slate-700 border-slate-300'
                                      : 'bg-orange-100 text-orange-700 border-orange-300'
                                )}
                              >
                                {rank}
                              </span>
                            ) : (
                              <span className="font-display font-black text-lg text-slate-400 tabular-nums leading-none">
                                {rank}
                              </span>
                            )}
                            {trendStr !== '0' && (
                              <span
                                className={cn(
                                  'text-xs font-black tabular-nums',
                                  isPositiveTrend ? 'text-emerald-600' : 'text-rose-500'
                                )}
                              >
                                {isPositiveTrend ? '▲' : '▼'} {trendStr.replace(/[+-]/, '')}
                              </span>
                            )}
                          </div>
                        </td>

                        <th scope="row" className="lb-cell-player py-3.5 px-4 font-normal text-left">
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              openInspect(player.player_id);
                            }}
                            className="flex items-center gap-3 text-left w-full min-w-0 rounded-xl focus-visible:outline-2 focus-visible:outline-sapphire-blue"
                          >
                            <PlayerAvatar
                              src={player.avatar_url}
                              name={player.player_name}
                              className="size-10 md:size-11 rounded-xl md:rounded-2xl border border-slate-200/80 shadow-xs text-sm group-hover:scale-105 transition-transform"
                            />
                            <div className="min-w-0 flex-1">
                              <div className="flex items-center gap-2 min-w-0">
                                <span className="font-sans font-black text-primary-navy text-sm md:text-base truncate group-hover:text-sapphire-blue transition-colors">
                                  {player.player_name}
                                </span>
                                {isMe && (
                                  <span className="px-1.5 py-0.5 rounded-md bg-sapphire-blue text-white text-xs font-black uppercase tracking-wider shrink-0">
                                    YOU
                                  </span>
                                )}
                              </div>
                              <p className="text-xs text-slate-400 font-bold truncate">
                                {player.department || '一般同仁'}
                              </p>
                            </div>
                          </button>
                        </th>

                        <td className="lb-cell-tier py-3.5 px-4">
                          <div className="flex flex-wrap sm:flex-col items-center sm:items-start gap-x-2.5 gap-y-1">
                            <div
                              className={cn(
                                'inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full border w-fit',
                                tier.color
                              )}
                            >
                              {tier.icon}
                              <span className="text-xs font-black whitespace-nowrap">{tier.name}</span>
                            </div>
                            <span className="text-xs font-bold text-slate-400 tabular-nums whitespace-nowrap">
                              勝率 {player.win_rate}
                            </span>
                          </div>
                        </td>

                        <td className="lb-cell-record lb-col-record py-3.5 px-4 text-center" data-label="戰績">
                          <div className="flex items-center sm:flex-col justify-center gap-1.5 sm:gap-0.5">
                            <div className="flex items-center gap-1 text-xs sm:text-sm font-black tabular-nums whitespace-nowrap">
                              <span className="text-emerald-600">{player.wins}W</span>
                              <span className="text-slate-300">-</span>
                              <span className="text-rose-500">{player.losses}L</span>
                            </div>
                            <span className="hidden sm:inline text-xs font-bold text-slate-400 tabular-nums">
                              共 {player.matches_played} 場
                            </span>
                          </div>
                        </td>

                        <td className="lb-cell-form lb-col-form py-3.5 px-4 text-center" data-label="近 5 場">
                          <div className="flex items-center justify-center gap-1.5">
                            {player.recent_form && player.recent_form.length > 0 ? (
                              player.recent_form.map((result: string, idx: number) => (
                                <span
                                  key={idx}
                                  className={cn(
                                    'size-2.5 rounded-full shrink-0',
                                    result === 'W' ? 'bg-emerald-500' : 'bg-rose-500'
                                  )}
                                  title={result === 'W' ? '勝' : '敗'}
                                  aria-label={result === 'W' ? '勝' : '敗'}
                                />
                              ))
                            ) : (
                              <span className="text-xs font-bold text-slate-300">尚無紀錄</span>
                            )}
                          </div>
                        </td>

                        <td className="lb-cell-rating py-3.5 px-4 text-right">
                          <div className="flex flex-col items-end">
                            <span
                              className={cn(
                                'font-display font-black text-xl sm:text-2xl tracking-tight tabular-nums leading-none',
                                isTop1 ? 'text-amber-600' : 'text-primary-navy'
                              )}
                            >
                              {Math.round(player.global_mmr)}
                            </span>
                            <span className="text-xs font-black text-slate-400 uppercase tracking-wider mt-1">
                              ELO
                            </span>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>

              {sortedPlayers.length === 0 && (
                <div className="py-16 px-4 text-center flex flex-col items-center justify-center">
                  <Search size={36} className="mb-3 text-slate-200" aria-hidden="true" />
                  <p className="text-slate-500 font-bold text-sm">
                    {searchTerm ? `找不到符合「${searchTerm}」的選手` : '目前尚無積分榜資料'}
                  </p>
                </div>
              )}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

interface PodiumSlotProps {
  place: 1 | 2 | 3;
  player?: RawLeaderboardItem;
  onSelect: (id: string) => void;
}

function PodiumSlot({ place, player, onSelect }: PodiumSlotProps) {
  const styles = {
    1: {
      avatarSize: 'size-16 sm:size-22 text-xl sm:text-2xl',
      ring: 'border-amber-400',
      badgeBg: 'bg-olympic-gold text-white',
      pedestal: 'h-24 sm:h-32 bg-gradient-to-t from-amber-200/80 to-amber-50 border-t-4 border-amber-400',
      numeral: 'I',
      numeralColor: 'text-amber-500/40 text-3xl sm:text-4xl',
      nameColor: 'text-amber-700',
    },
    2: {
      avatarSize: 'size-13 sm:size-18 text-base sm:text-xl',
      ring: 'border-slate-300',
      badgeBg: 'bg-slate-600 text-white',
      pedestal: 'h-18 sm:h-24 bg-gradient-to-t from-slate-200/80 to-slate-50 border-t-4 border-slate-300',
      numeral: 'II',
      numeralColor: 'text-slate-400/50 text-2xl sm:text-3xl',
      nameColor: 'text-primary-navy',
    },
    3: {
      avatarSize: 'size-13 sm:size-18 text-base sm:text-xl',
      ring: 'border-orange-300',
      badgeBg: 'bg-orange-500 text-white',
      pedestal: 'h-14 sm:h-20 bg-gradient-to-t from-orange-100/80 to-orange-50/40 border-t-4 border-orange-300',
      numeral: 'III',
      numeralColor: 'text-orange-700/30 text-xl sm:text-2xl',
      nameColor: 'text-primary-navy',
    },
  }[place];

  if (!player) {
    return (
      <div className="flex flex-col items-center">
        <div className={cn('rounded-full border-2 border-dashed border-slate-200 flex items-center justify-center bg-white/60 mb-3', styles.avatarSize)}>
          <span className="text-slate-300 font-display font-black">?</span>
        </div>
        <p className="text-xs font-bold text-slate-300 mb-3">虛位以待</p>
        <div className={cn('w-full rounded-t-2xl flex justify-center pt-3', styles.pedestal)}>
          <span className={cn('font-display font-black', styles.numeralColor)}>{styles.numeral}</span>
        </div>
      </div>
    );
  }

  return (
    <button
      type="button"
      onClick={() => onSelect(player.player_id)}
      className="group flex flex-col items-center w-full text-center focus-visible:outline-2 focus-visible:outline-sapphire-blue rounded-2xl"
    >
      <div className="relative mb-3 transition-transform duration-300 group-hover:-translate-y-1">
        {place === 1 && (
          <Crown
            size={24}
            aria-hidden="true"
            className="absolute -top-6 left-1/2 -translate-x-1/2 text-olympic-gold drop-shadow-xs"
          />
        )}
        <PlayerAvatar
          src={player.avatar_url}
          name={player.player_name}
          className={cn('rounded-full border-4 shadow-md', styles.avatarSize, styles.ring)}
        />
        <span
          className={cn(
            'absolute -bottom-2 left-1/2 -translate-x-1/2 size-6 sm:size-7 rounded-full flex items-center justify-center font-display font-black text-xs border-2 border-white shadow-sm',
            styles.badgeBg
          )}
        >
          {place}
        </span>
      </div>

      <p className={cn('font-sans font-black text-xs sm:text-sm md:text-base truncate w-full px-1 group-hover:text-sapphire-blue transition-colors', styles.nameColor)}>
        {player.player_name}
      </p>
      <p className="font-display font-black text-sm sm:text-base text-primary-navy tabular-nums mt-0.5">
        {Math.round(player.global_mmr)}
        <span className="text-xs font-sans font-bold text-slate-400 ml-1">ELO</span>
      </p>

      <div className={cn('w-full rounded-t-2xl mt-3 flex justify-center pt-3 transition-all', styles.pedestal)}>
        <span className={cn('font-display font-black', styles.numeralColor)}>{styles.numeral}</span>
      </div>
    </button>
  );
}
