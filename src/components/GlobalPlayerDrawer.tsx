import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useSearchParams } from 'react-router-dom';
import { TrendingUp, Swords, Zap, X, Plus } from 'lucide-react';
import { cn, formatLocalTime } from '@/lib/utils';
import { getTierBadge } from '@/lib/ranking';
import { Sheet, SheetContent } from '@/components/ui/sheet';
import { Drawer, DrawerContent } from '@/components/ui/drawer';
import { StatsChart } from '@/components/StatsChart';
import { Button } from '@/components/ui/button';
import { PlayerAvatar } from '@/components/PlayerAvatar';
import { ReportScore } from '@/components/ReportScore';
import { useMediaQuery } from '@/hooks/use-media-query';
import { useAuth } from '@/hooks/useAuth';
import apiClient from '@/utils/apiClient';
import type { ChartDataPoint, H2HBucket, H2HResponse } from '@/types/api.types';

interface PlayerPartnerItem {
  id: string;
  name: string;
  avatar?: string | null;
  winRate: number;
}

interface PlayerProfileData {
  id: string;
  name: string;
  department?: string | null;
  avatar?: string | null;
  rating: number;
  stats: {
    winRate: number;
    wins: number;
    losses: number;
  };
  racketConfig: {
    forehand: string;
    backhand: string;
  };
  goldenPartner: PlayerPartnerItem[];
  nemesis: PlayerPartnerItem[];
  chart_data: ChartDataPoint[];
}

type H2HTab = 'singles_vs' | 'doubles_vs' | 'doubles_with';

export function GlobalPlayerDrawer() {
  const [searchParams, setSearchParams] = useSearchParams();
  const inspectingId = searchParams.get('inspect');
  const isDesktop = useMediaQuery('(min-width: 768px)');
  const { data: currentUser } = useAuth();

  const [quickReportTarget, setQuickReportTarget] = useState<{ id: string; key: number } | null>(null);

  const isViewingSelf = Boolean(currentUser?.id && inspectingId && String(currentUser.id) === String(inspectingId));

  const { data: player, isPending: isLoading } = useQuery({
    queryKey: ['users', 'profile', inspectingId],
    queryFn: async () => {
      const res = await apiClient.get<PlayerProfileData>(`/users/${inspectingId}/profile`);
      return res.data;
    },
    enabled: !!inspectingId,
  });

  const { data: h2hData, isPending: isH2HLoading } = useQuery({
    queryKey: ['users', 'h2h', inspectingId],
    queryFn: async () => {
      const res = await apiClient.get<H2HResponse>(`/users/${inspectingId}/h2h`);
      return res.data;
    },
    enabled: Boolean(inspectingId && currentUser && !isViewingSelf),
  });

  const closeDrawer = () => {
    const newParams = new URLSearchParams(searchParams);
    newParams.delete('inspect');
    setSearchParams(newParams);
  };

  const handleQuickReport = () => {
    if (!inspectingId) return;
    const targetId = inspectingId;
    closeDrawer();
    setTimeout(() => {
      setQuickReportTarget({ id: targetId, key: Date.now() });
    }, 150);
  };

  const renderDrawerBody = () => {
    if (isLoading || !player) {
      return (
        <div className="flex-1 flex flex-col items-center justify-center p-10 space-y-4">
          <div className="size-10 border-4 border-border border-t-sapphire-blue rounded-full animate-spin" />
          <p className="text-muted-foreground font-bold uppercase tracking-widest text-sm">讀取玩家檔案中...</p>
        </div>
      );
    }

    const tier = getTierBadge(player.rating);
    const canQuickReport = Boolean(currentUser && !isViewingSelf);

    return (
      <div className="flex flex-col flex-1 min-h-0 overflow-hidden">
        <div className="arena-hero-surface p-5 md:p-6 text-foreground border-b border-blue-200/70 dark:border-slate-700/80 relative shrink-0">
          {isDesktop && (
            <button
              type="button"
              aria-label="關閉玩家資料"
              onClick={closeDrawer}
              className="absolute top-4 right-4 z-50 size-9 flex items-center justify-center rounded-full bg-secondary/90 hover:bg-secondary dark:bg-white/10 dark:hover:bg-white/20 transition-colors"
            >
              <X className="size-5 text-foreground" aria-hidden="true" />
            </button>
          )}
          <div className="relative z-10 text-left">
            <div className="flex items-center gap-4">
              <PlayerAvatar
                src={player.avatar}
                name={player.name}
                className="size-14 md:size-18 rounded-2xl border-2 border-blue-200/80 dark:border-white/20 shadow-lg text-xl"
              />
              <div className="min-w-0 pr-6">
                <h3 className="text-lg md:text-2xl font-display font-black tracking-wide text-foreground leading-tight truncate">
                  {player.name}
                </h3>
                <p className="text-muted-foreground font-bold text-xs mt-0.5 truncate">
                  {player.department || '未設定單位'}
                </p>
                <div
                  className={cn(
                    'mt-2 inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full border text-xs font-black',
                    tier.color
                  )}
                >
                  {tier.icon}
                  {tier.name}
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto overscroll-contain touch-pan-y p-5 md:p-6 space-y-6 bg-surface-shell">
          {/* 基本數據 */}
          <div className="grid grid-cols-3 gap-2.5 sm:gap-3">
            <div className="p-3 rounded-2xl bg-card border border-border flex flex-col items-center text-center shadow-xs">
              <TrendingUp size={16} className="text-emerald-500 dark:text-emerald-400 mb-1" aria-hidden="true" />
              <span className="text-lg md:text-xl font-display font-black text-foreground tabular-nums">
                {player.stats.winRate}%
              </span>
              <span className="text-xs font-black text-muted-foreground uppercase tracking-wider mt-0.5">生涯勝率</span>
            </div>
            <div className="p-3 rounded-2xl bg-card border border-border flex flex-col items-center text-center shadow-xs">
              <Swords size={16} className="text-sapphire-blue mb-1" aria-hidden="true" />
              <span className="text-lg md:text-xl font-display font-black text-foreground tabular-nums">
                {player.stats.wins + player.stats.losses}
              </span>
              <span className="text-xs font-black text-muted-foreground uppercase tracking-wider mt-0.5">總出賽數</span>
            </div>
            <div className="p-3 rounded-2xl bg-card border border-border flex flex-col items-center text-center shadow-xs">
              <Zap size={16} className="text-olympic-gold mb-1" aria-hidden="true" />
              <span className="text-lg md:text-xl font-display font-black text-foreground tabular-nums">
                {Math.round(player.rating)}
              </span>
              <span className="text-xs font-black text-muted-foreground uppercase tracking-wider mt-0.5">目前積分</span>
            </div>
          </div>

          {/* 你與對方的交手紀錄（單打 / 雙打對陣 / 同隊搭檔） */}
          {canQuickReport && (
            <H2HComparisonCard
              key={inspectingId || 'h2h'}
              targetName={player.name}
              data={h2hData}
              isLoading={isH2HLoading}
            />
          )}

          {/* 戰術裝備配置 */}
          <div className="space-y-2.5">
            <h4 className="text-xs font-black text-muted-foreground uppercase tracking-wider ml-1">戰術裝備配置</h4>
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-card border border-border rounded-2xl p-3.5 shadow-xs">
                <p className="text-xs font-black text-muted-foreground uppercase tracking-wider mb-1">正手 (Forehand)</p>
                <p className="text-xs md:text-sm font-black text-foreground truncate">
                  {player.racketConfig.forehand}
                </p>
              </div>
              <div className="bg-card border border-border rounded-2xl p-3.5 shadow-xs">
                <p className="text-xs font-black text-muted-foreground uppercase tracking-wider mb-1">反手 (Backhand)</p>
                <p className="text-xs md:text-sm font-black text-foreground truncate">
                  {player.racketConfig.backhand}
                </p>
              </div>
            </div>
          </div>

          {/* 進階戰情洞察 (搭檔與天敵) */}
          <div className="space-y-4">
            {player.goldenPartner && player.goldenPartner.length > 0 && (
              <div className="space-y-2">
                <p className="text-xs font-black text-amber-600 dark:text-amber-400 uppercase tracking-wider ml-1">最佳雙打搭檔</p>
                <div className="grid gap-2">
                  {player.goldenPartner.map((p) => (
                    <div
                      key={p.id}
                      className="bg-amber-50/70 dark:bg-amber-500/12 border border-amber-200/70 dark:border-amber-500/30 rounded-2xl p-3 flex items-center justify-between"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <PlayerAvatar
                          src={p.avatar}
                          name={p.name}
                          className="size-9 rounded-xl border border-amber-200 dark:border-amber-500/30 text-xs"
                        />
                        <span className="text-sm font-black text-foreground truncate">{p.name}</span>
                      </div>
                      <span className="text-base font-display font-black text-amber-600 dark:text-amber-400 tabular-nums shrink-0">
                        {p.winRate}% <span className="text-xs font-sans text-amber-500 dark:text-amber-300">勝率</span>
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {player.nemesis && player.nemesis.length > 0 && (
              <div className="space-y-2">
                <p className="text-xs font-black text-rose-600 dark:text-rose-400 uppercase tracking-wider ml-1">宿命天敵</p>
                <div className="grid gap-2">
                  {player.nemesis.map((p) => (
                    <div
                      key={p.id}
                      className="bg-rose-50/70 dark:bg-rose-500/12 border border-rose-200/70 dark:border-rose-500/30 rounded-2xl p-3 flex items-center justify-between"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <PlayerAvatar
                          src={p.avatar}
                          name={p.name}
                          className="size-9 rounded-xl border border-rose-200 dark:border-rose-500/30 text-xs"
                        />
                        <span className="text-sm font-black text-foreground truncate">{p.name}</span>
                      </div>
                      <span className="text-base font-display font-black text-rose-600 dark:text-rose-400 tabular-nums shrink-0">
                        {p.winRate}% <span className="text-xs font-sans text-rose-400 dark:text-rose-300">勝率</span>
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* 實力波動趨勢 */}
          <div className="space-y-2.5">
            <h4 className="text-xs font-black text-muted-foreground uppercase tracking-wider ml-1">近期實力波動趨勢</h4>
            <div className="w-full bg-card rounded-2xl p-3 md:p-4 border border-border shadow-xs">
              <StatsChart data={player.chart_data} showCard={false} showHeader={false} height={isDesktop ? 180 : 150} />
            </div>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="p-4 md:p-5 pb-[max(1rem,env(safe-area-inset-bottom,0px))] border-t border-border bg-popover shrink-0 flex items-center gap-2.5">
          {canQuickReport && (
            <Button
              type="button"
              onClick={handleQuickReport}
              className="flex-1 h-11 rounded-xl bg-sapphire-blue hover:bg-blue-700 text-white font-display font-black text-sm gap-1.5 shadow-sm"
            >
              <Plus size={16} aria-hidden="true" />
              跟 {player.name} 報分
            </Button>
          )}
          <Button
            type="button"
            variant={canQuickReport ? 'outline' : 'default'}
            onClick={closeDrawer}
            className={cn(
              'h-11 rounded-xl font-black text-sm',
              canQuickReport
                ? 'px-5 border-border text-muted-foreground hover:bg-secondary hover:text-foreground'
                : 'w-full bg-primary hover:opacity-90 text-primary-foreground'
            )}
          >
            關閉檔案
          </Button>
        </div>
      </div>
    );
  };

  return (
    <>
      {inspectingId && (
        isDesktop ? (
          <Sheet open={!!inspectingId} onOpenChange={(open) => !open && closeDrawer()}>
            <SheetContent className="w-[92vw] sm:max-w-md p-0 border-none bg-popover lg:rounded-l-[2rem] overflow-hidden shadow-2xl flex flex-col">
              {renderDrawerBody()}
            </SheetContent>
          </Sheet>
        ) : (
          <Drawer open={!!inspectingId} onOpenChange={(open) => !open && closeDrawer()}>
            <DrawerContent className="p-0 border-none bg-popover rounded-t-[2rem] overflow-hidden shadow-2xl flex flex-col max-h-[92dvh]">
              {renderDrawerBody()}
            </DrawerContent>
          </Drawer>
        )
      )}

      {quickReportTarget && (
        <ReportScore
          key={quickReportTarget.key}
          open={Boolean(quickReportTarget)}
          onOpenChange={(nextOpen) => {
            if (!nextOpen) setQuickReportTarget(null);
          }}
          initialOpponentId={quickReportTarget.id}
        />
      )}
    </>
  );
}

function H2HComparisonCard({
  targetName,
  data,
  isLoading,
}: {
  targetName: string;
  data?: H2HResponse;
  isLoading: boolean;
}) {
  const [selectedTab, setSelectedTab] = useState<H2HTab | null>(null);

  if (isLoading) {
    return (
      <div className="bg-card border border-border rounded-2xl p-4 space-y-3 animate-pulse">
        <div className="h-4 w-36 bg-secondary rounded" />
        <div className="h-10 bg-secondary rounded-xl" />
        <div className="h-16 bg-secondary rounded-xl" />
      </div>
    );
  }

  if (!data || data.is_self) return null;

  const defaultTab: H2HTab =
    data.singles_vs.matches > 0
      ? 'singles_vs'
      : data.doubles_vs.matches > 0
        ? 'doubles_vs'
        : data.doubles_with.matches > 0
          ? 'doubles_with'
          : 'singles_vs';

  const activeTab = selectedTab ?? defaultTab;
  const bucket: H2HBucket = data[activeTab];

  const tabs: Array<{ id: H2HTab; label: string; count: number }> = [
    { id: 'singles_vs', label: '單打對決', count: data.singles_vs.matches },
    { id: 'doubles_vs', label: '雙打對陣', count: data.doubles_vs.matches },
    { id: 'doubles_with', label: '同隊搭檔', count: data.doubles_with.matches },
  ];

  const isPartnerTab = activeTab === 'doubles_with';

  return (
    <section aria-label="交手紀錄對比" className="bg-card border border-border rounded-2xl p-4 space-y-3.5 shadow-xs">
      <div className="flex items-center justify-between gap-2">
        <h4 className="text-xs font-black text-foreground tracking-wide">
          你與 {targetName} 的對戰紀錄
        </h4>
        <span className="text-xs font-bold text-muted-foreground tabular-nums">
          共 {data.total_matches} 場
        </span>
      </div>

      {/* 單打對決 / 雙打對陣 / 同隊搭檔 三分頁 */}
      <div role="tablist" className="grid grid-cols-3 gap-1 p-1 rounded-xl bg-secondary border border-border">
        {tabs.map((tab) => {
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              role="tab"
              aria-selected={isActive}
              onClick={() => setSelectedTab(tab.id)}
              className={cn(
                'py-1.5 px-1 rounded-lg text-xs font-black transition-all flex items-center justify-center gap-1 whitespace-nowrap',
                isActive
                  ? 'bg-card text-foreground shadow-xs'
                  : 'text-muted-foreground hover:text-foreground'
              )}
            >
              <span>{tab.label}</span>
              <span
                className={cn(
                  'tabular-nums text-xs',
                  isActive ? 'text-sapphire-blue' : 'text-muted-foreground/70'
                )}
              >
                {tab.count}
              </span>
            </button>
          );
        })}
      </div>

      {bucket.matches === 0 ? (
        <div className="py-5 text-center rounded-xl bg-surface-subtle border border-dashed border-border">
          <p className="text-xs font-bold text-muted-foreground">
            {data.total_matches === 0
              ? '尚未同場交手過，點下方立即約戰！'
              : isPartnerTab
                ? '尚未以隊友身分同隊出賽過'
                : '尚無此項目對戰紀錄'}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {/* 勝敗與淨積分條 */}
          <div className="bg-surface-subtle/80 border border-border rounded-xl p-3 space-y-2">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-baseline gap-2">
                <span className="text-lg font-display font-black text-foreground tabular-nums">
                  <span className="text-emerald-600 dark:text-emerald-400">{bucket.wins}W</span>
                  <span className="text-muted-foreground/45 mx-1">-</span>
                  <span className="text-rose-500 dark:text-rose-400">{bucket.losses}L</span>
                </span>
                <span className="text-xs font-black text-muted-foreground tabular-nums">
                  {isPartnerTab ? '搭檔勝率' : '對戰勝率'} {bucket.win_rate}%
                </span>
              </div>
              <span
                className={cn(
                  'text-sm font-display font-black tabular-nums',
                  bucket.net_mmr >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'
                )}
              >
                {bucket.net_mmr > 0 ? `+${bucket.net_mmr}` : bucket.net_mmr} ELO
              </span>
            </div>

            <div className="h-2 w-full bg-slate-200 dark:bg-slate-800 rounded-full overflow-hidden flex">
              <div
                className="h-full bg-emerald-500 transition-all duration-500"
                style={{ width: `${bucket.win_rate}%` }}
              />
              <div
                className="h-full bg-rose-400 transition-all duration-500"
                style={{ width: `${100 - bucket.win_rate}%` }}
              />
            </div>
          </div>

          {/* 最近 3 場明細 */}
          {bucket.recent.length > 0 && (
            <div className="space-y-1.5">
              {bucket.recent.map((m) => (
                <div
                  key={m.id}
                  className="flex items-center justify-between gap-2 px-3 py-2 rounded-xl bg-surface-subtle/60 border border-border text-xs"
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <span
                      className={cn(
                        'px-1.5 py-0.5 rounded-md font-black shrink-0',
                        m.is_winner
                          ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-300'
                          : 'bg-rose-100 text-rose-700 dark:bg-rose-500/20 dark:text-rose-300'
                      )}
                    >
                      {m.is_winner ? '勝' : '敗'}
                    </span>
                    <span className="font-bold text-muted-foreground tabular-nums">
                      {formatLocalTime(m.date, 'MM/dd')}
                    </span>
                  </div>
                  <span className="font-display font-black text-sm text-foreground tabular-nums">
                    {m.my_score} : {m.opp_score}
                  </span>
                  <span
                    className={cn(
                      'font-display font-black tabular-nums w-14 text-right',
                      m.mmr_delta >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-500 dark:text-rose-400'
                    )}
                  >
                    {m.mmr_delta > 0 ? `+${m.mmr_delta}` : m.mmr_delta}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </section>
  );
}
