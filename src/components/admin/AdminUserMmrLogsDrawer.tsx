import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  Clock,
  History,
  Loader2,
  RefreshCw,
  Scale,
  Swords,
  TrendingDown,
  TrendingUp,
} from 'lucide-react';
import { adminApi } from '@/lib/admin';
import { useMediaQuery } from '@/hooks/use-media-query';
import type { AdminUserItem } from '@/types/admin';
import { cn, formatLocalTime } from '@/lib/utils';
import { PlayerAvatar } from '@/components/PlayerAvatar';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetTitle,
} from '@/components/ui/sheet';
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerTitle,
} from '@/components/ui/drawer';

type EventFilter = 'all' | 'admin_adjust' | 'decay' | 'soft_reset';

function getEventBadge(eventType: string) {
  if (eventType === 'admin_adjust') {
    return {
      label: '管理員校準',
      icon: Scale,
      className: 'bg-amber-100 text-amber-800 dark:bg-amber-500/20 dark:text-amber-300',
    };
  }
  if (eventType === 'decay') {
    return {
      label: '惰性衰退',
      icon: Clock,
      className: 'bg-rose-100 text-rose-700 dark:bg-rose-500/20 dark:text-rose-300',
    };
  }
  if (eventType === 'soft_reset') {
    return {
      label: '季末重置',
      icon: RefreshCw,
      className: 'bg-sapphire-blue/12 text-sapphire-blue dark:bg-blue-500/20 dark:text-blue-300',
    };
  }
  return {
    label: '對戰結算',
    icon: Swords,
    className: 'bg-secondary text-muted-foreground',
  };
}

export function AdminUserMmrLogsDrawer({
  user,
  onClose,
}: {
  user: AdminUserItem | null;
  onClose: () => void;
}) {
  const isDesktop = useMediaQuery('(min-width: 768px)');
  const [includeMatches, setIncludeMatches] = useState(false);
  const [eventFilter, setEventFilter] = useState<EventFilter>('all');

  const { data, isLoading } = useQuery({
    queryKey: ['admin', 'user-mmr-logs', user?.id, includeMatches],
    queryFn: () => adminApi.getUserMmrLogs(user!.id, includeMatches),
    enabled: Boolean(user),
  });

  const filteredLogs = useMemo(() => {
    const raw = data?.logs ?? [];
    if (eventFilter === 'all') return raw;
    return raw.filter((item) => item.event_type === eventFilter);
  }, [data, eventFilter]);

  const handleOpenChange = (open: boolean) => {
    if (!open) {
      onClose();
    }
  };

  const content = user ? (
    <div className="flex flex-col h-full min-h-0 overflow-hidden bg-popover">
      {/* Header */}
      <div className={cn('px-5 pt-4 pb-3 border-b border-border bg-surface-subtle/50 shrink-0 space-y-3', isDesktop && 'pr-12')}>
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <PlayerAvatar
              src={user.avatar_url}
              name={user.name}
              className="size-10 rounded-xl border border-border text-sm shrink-0"
            />
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <h2 className="text-base sm:text-lg font-display font-black text-foreground truncate">
                  {user.name}
                </h2>
                <span className="px-2 py-0.5 rounded-lg bg-card border border-border text-xs font-display font-black tabular-nums shrink-0">
                  {Math.round(user.global_mmr)} ELO
                </span>
              </div>
              <p className="text-xs font-bold text-muted-foreground truncate mt-0.5">
                {user.department || '未設定單位'} · 歷史 ELO 異動日誌
              </p>
            </div>
          </div>
        </div>

        {/* Filter Controls */}
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex flex-nowrap overflow-x-auto no-scrollbar gap-1 p-1 rounded-xl bg-secondary/90 border border-border/80">
            {([
              { key: 'all', label: '全部' },
              { key: 'admin_adjust', label: '校準' },
              { key: 'decay', label: '衰退' },
              { key: 'soft_reset', label: '季末' },
            ] as const).map((tab) => (
              <button
                key={tab.key}
                type="button"
                onClick={() => setEventFilter(tab.key)}
                className={cn(
                  'min-h-7 px-2.5 py-1 rounded-lg text-xs font-black transition-all whitespace-nowrap',
                  eventFilter === tab.key
                    ? 'bg-card text-foreground shadow-xs'
                    : 'text-muted-foreground hover:text-foreground',
                )}
              >
                {tab.label}
              </button>
            ))}
          </div>

          <button
            type="button"
            aria-pressed={includeMatches}
            onClick={() => setIncludeMatches((v) => !v)}
            className={cn(
              'h-8 px-2.5 rounded-xl border text-xs font-black transition-colors whitespace-nowrap',
              includeMatches
                ? 'bg-sapphire-blue/12 border-sapphire-blue text-sapphire-blue dark:text-blue-300'
                : 'bg-card border-border text-muted-foreground hover:text-foreground',
            )}
          >
            {includeMatches ? '✓ 已含一般對戰' : '顯示一般對戰'}
          </button>
        </div>
      </div>

      {/* Body */}
      <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain p-4 space-y-2.5">
        {isLoading ? (
          <div className="py-14 flex flex-col items-center justify-center gap-2.5">
            <Loader2 className="animate-spin text-sapphire-blue" size={26} />
            <p className="text-xs font-bold text-muted-foreground">讀取異動歷程中...</p>
          </div>
        ) : filteredLogs.length === 0 ? (
          <div className="py-14 px-6 text-center space-y-2 rounded-2xl border border-dashed border-border">
            <History size={28} className="mx-auto text-muted-foreground/45" aria-hidden="true" />
            <p className="text-sm font-display font-black text-foreground">查無符合條件的異動紀錄</p>
            <p className="text-xs font-bold text-muted-foreground">
              該成員目前尚無管理員校準、惰性衰退或季末軟重置紀錄；如需查看一般對戰曲線可開啟「顯示一般對戰」。
            </p>
          </div>
        ) : (
          filteredLogs.map((item) => {
            const badge = getEventBadge(item.event_type);
            const Icon = badge.icon;
            const delta = item.delta ?? 0;

            return (
              <div
                key={item.id}
                className="rounded-2xl border border-border bg-card p-3.5 space-y-2 shadow-2xs"
              >
                <div className="flex items-center justify-between gap-2">
                  <span
                    className={cn(
                      'inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-[11px] font-black leading-none',
                      badge.className,
                    )}
                  >
                    <Icon size={11} aria-hidden="true" />
                    {badge.label}
                  </span>

                  <span className="text-[11px] font-bold text-muted-foreground tabular-nums">
                    {item.recorded_at ? formatLocalTime(item.recorded_at, 'yyyy/MM/dd HH:mm') : ''}
                  </span>
                </div>

                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-1.5 font-display font-black text-sm sm:text-base tabular-nums">
                    {item.old_mmr !== null && item.old_mmr !== undefined && (
                      <>
                        <span className="text-muted-foreground">{Math.round(item.old_mmr)}</span>
                        <span className="text-muted-foreground/45">→</span>
                      </>
                    )}
                    <span className="text-foreground">{Math.round(item.new_mmr)} ELO</span>
                  </div>

                  {item.delta !== null && item.delta !== undefined && (
                    <span
                      className={cn(
                        'inline-flex items-center gap-0.5 px-2 py-0.5 rounded-lg text-xs font-display font-black tabular-nums',
                        delta > 0
                          ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-300'
                          : delta < 0
                            ? 'bg-rose-100 text-rose-700 dark:bg-rose-500/20 dark:text-rose-300'
                            : 'bg-secondary text-muted-foreground',
                      )}
                    >
                      {delta > 0 ? (
                        <TrendingUp size={12} aria-hidden="true" />
                      ) : delta < 0 ? (
                        <TrendingDown size={12} aria-hidden="true" />
                      ) : null}
                      {delta > 0 ? `+${delta}` : delta}
                    </span>
                  )}
                </div>

                {(item.actor_name || item.reason) && (
                  <p className="text-xs font-medium text-muted-foreground leading-relaxed break-words">
                    {item.actor_name && (
                      <strong className="text-foreground font-black mr-1.5">{item.actor_name}：</strong>
                    )}
                    {item.reason || '無附加說明'}
                  </p>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  ) : null;

  if (isDesktop) {
    return (
      <Sheet open={Boolean(user)} onOpenChange={handleOpenChange}>
        <SheetContent className="w-[92vw] sm:max-w-[440px] p-0 border-none bg-popover lg:rounded-l-[2rem] overflow-hidden shadow-2xl flex flex-col">
          <SheetTitle className="sr-only">成員 ELO 異動日誌</SheetTitle>
          <SheetDescription className="sr-only">檢視歷史管理員校準、惰性衰退與季末軟重置清單</SheetDescription>
          {content}
        </SheetContent>
      </Sheet>
    );
  }

  return (
    <Drawer open={Boolean(user)} onOpenChange={handleOpenChange}>
      <DrawerContent className="p-0 border-none bg-popover rounded-t-[2rem] overflow-hidden shadow-2xl flex flex-col max-h-[86dvh]">
        <DrawerTitle className="sr-only">成員 ELO 異動日誌</DrawerTitle>
        <DrawerDescription className="sr-only">檢視歷史管理員校準、惰性衰退與季末軟重置清單</DrawerDescription>
        {content}
      </DrawerContent>
    </Drawer>
  );
}
