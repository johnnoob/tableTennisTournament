import { useMemo, useState, type ReactNode } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import {
  Bell,
  CheckCheck,
  CheckCircle2,
  ChevronRight,
  Clock,
  Gavel,
  Loader2,
  RotateCcw,
  ShieldAlert,
  Sparkles,
  Trash2,
  Trophy,
} from 'lucide-react';
import { toast } from 'sonner';
import apiClient from '@/utils/apiClient';
import { useMediaQuery } from '@/hooks/use-media-query';
import type {
  NotificationItem,
  NotificationsResponse,
} from '@/hooks/useNotifications';
import { cn, formatLocalTime } from '@/lib/utils';
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

type NotificationFilter = 'all' | 'unread' | 'arbitration';

function formatRelativeNotificationTime(iso?: string | null): string {
  if (!iso) return '';
  const ts = new Date(iso).getTime();
  if (Number.isNaN(ts)) return '';
  const diffSec = Math.max(0, Math.floor((Date.now() - ts) / 1000));
  if (diffSec < 60) return '剛剛';
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin} 分鐘前`;
  const diffHours = Math.floor(diffMin / 60);
  if (diffHours < 24) return `${diffHours} 小時前`;
  const diffDays = Math.floor(diffHours / 24);
  if (diffDays < 7) return `${diffDays} 天前`;
  return formatLocalTime(iso, 'MM/dd HH:mm');
}

// Highlight scores (e.g. 2:1) and ELO/MMR deltas (e.g. +18.5 ELO, -12.0 ELO, 5.0 MMR)
const TOKEN_REGEX =
  /([+-]?\d+(?:\.\d+)?\s*(?:ELO|MMR)|\b[0-5]:[0-5]\b)/g;

function renderRichNotificationText(content: string): ReactNode {
  const parts = content.split(TOKEN_REGEX);
  if (parts.length <= 1) return content;

  return parts.map((part, idx) => {
    if (!part) return null;

    if (/^[0-5]:[0-5]$/.test(part)) {
      return (
        <span
          key={idx}
          className="inline-flex items-center px-1.5 py-0.5 mx-0.5 rounded-md bg-secondary border border-border/80 font-display font-black text-foreground tabular-nums text-[12px] leading-none align-baseline"
        >
          {part}
        </span>
      );
    }

    if (/(?:ELO|MMR)$/.test(part)) {
      const prevText = idx > 0 ? parts[idx - 1] : '';
      const isNegative =
        part.startsWith('-') ||
        prevText.endsWith('扣除 ') ||
        prevText.endsWith('扣除');
      const isPositive = part.startsWith('+');

      return (
        <span
          key={idx}
          className={cn(
            'inline-flex items-center px-1.5 py-0.5 mx-0.5 rounded-md font-display font-black tabular-nums text-[12px] leading-none align-baseline',
            isNegative
              ? 'bg-rose-100 text-rose-700 dark:bg-rose-500/20 dark:text-rose-300'
              : isPositive
                ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-300'
                : 'bg-sapphire-blue/10 text-sapphire-blue dark:bg-blue-500/20 dark:text-blue-300'
          )}
        >
          {part}
        </span>
      );
    }

    return <span key={idx}>{part}</span>;
  });
}

function getCategoryVisual(item: NotificationItem, isAdmin: boolean) {
  if (item.category === 'action_required') {
    return {
      icon: Clock,
      label: '待確認賽果',
      hint: item.match_status === 'confirmed' ? '已結算 · 查看紀錄' : '前往確認',
      borderClass: 'border-l-amber-400',
      iconBg: 'bg-amber-100/90 text-amber-700 dark:bg-amber-500/20 dark:text-amber-300',
      dotColor: 'bg-amber-500',
    };
  }
  if (item.category === 'disputed') {
    return {
      icon: ShieldAlert,
      label: '賽事申訴',
      hint: isAdmin ? '前往裁決台' : '查看狀態',
      borderClass: 'border-l-rose-500',
      iconBg: 'bg-rose-100/90 text-rose-600 dark:bg-rose-500/20 dark:text-rose-300',
      dotColor: 'bg-rose-500',
    };
  }
  if (item.category === 'season') {
    return {
      icon: Trophy,
      label: item.content.includes('錦標賽') ? '錦標賽動態' : '賽季結算',
      hint: item.content.includes('錦標賽') ? '前往賽事中心' : '查看排行榜',
      borderClass: 'border-l-olympic-gold',
      iconBg: 'bg-amber-100/90 text-amber-700 dark:bg-amber-500/20 dark:text-amber-300',
      dotColor: 'bg-amber-500',
    };
  }
  if (item.category === 'arbitration') {
    const isNegativeAction =
      item.type === 'match_rejected' ||
      item.content.includes('撤銷') ||
      item.content.includes('駁回') ||
      item.content.includes('扣除');
    return {
      icon: isNegativeAction ? RotateCcw : Gavel,
      label: isNegativeAction ? '異動／回滾' : '裁決與校準',
      hint: item.match_id ? '查看對戰紀錄' : '查看個人戰績',
      borderClass: isNegativeAction ? 'border-l-rose-400' : 'border-l-sapphire-blue',
      iconBg: isNegativeAction
        ? 'bg-rose-100/90 text-rose-600 dark:bg-rose-500/20 dark:text-rose-300'
        : 'bg-sapphire-blue/12 text-sapphire-blue dark:bg-blue-500/20 dark:text-blue-300',
      dotColor: isNegativeAction ? 'bg-rose-500' : 'bg-sapphire-blue',
    };
  }
  return {
    icon: CheckCircle2,
    label: '積分結算',
    hint: '查看對戰紀錄',
    borderClass: 'border-l-emerald-500',
    iconBg: 'bg-emerald-100/90 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-300',
    dotColor: 'bg-emerald-500',
  };
}

export function NotificationBellButton({
  variant,
  unreadCount,
  hasUrgent,
  onClick,
}: {
  variant: 'mobile' | 'rail' | 'sidebar';
  unreadCount: number;
  hasUrgent?: boolean;
  onClick: () => void;
}) {
  const displayBadge = unreadCount > 99 ? '99+' : String(unreadCount);

  if (variant === 'sidebar') {
    return (
      <button
        type="button"
        onClick={onClick}
        aria-label={unreadCount > 0 ? `通知中心，${unreadCount} 則未讀` : '通知中心'}
        className="w-full px-3.5 py-2.5 rounded-2xl border border-border bg-card hover:bg-secondary/80 transition-all flex items-center justify-between gap-2.5 text-left group shadow-xs"
      >
        <div className="flex items-center gap-2.5 min-w-0">
          <div
            className={cn(
              'size-8 rounded-xl flex items-center justify-center shrink-0 transition-colors',
              unreadCount > 0
                ? hasUrgent
                  ? 'bg-rose-500/12 text-rose-600 dark:text-rose-400'
                  : 'bg-sapphire-blue/12 text-sapphire-blue dark:text-blue-400'
                : 'bg-secondary text-muted-foreground group-hover:text-foreground'
            )}
          >
            <Bell size={16} aria-hidden="true" />
          </div>
          <span className="text-sm font-black text-foreground truncate">通知中心</span>
        </div>

        {unreadCount > 0 ? (
          <span
            className={cn(
              'px-2 py-0.5 rounded-full text-[11px] font-display font-black tabular-nums leading-tight shrink-0 text-white',
              hasUrgent ? 'bg-rose-500' : 'bg-sapphire-blue'
            )}
          >
            {displayBadge} 未讀
          </span>
        ) : (
          <span className="text-[11px] font-bold text-muted-foreground shrink-0">無未讀</span>
        )}
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={unreadCount > 0 ? `通知中心，${unreadCount} 則未讀` : '通知中心'}
      title="通知中心"
      className={cn(
        'relative flex items-center justify-center transition-colors shrink-0',
        variant === 'rail'
          ? 'size-11 rounded-2xl border border-border bg-card hover:bg-secondary text-foreground shadow-xs'
          : 'size-10 rounded-xl border border-border bg-secondary/80 hover:bg-secondary text-foreground'
      )}
    >
      <Bell size={variant === 'rail' ? 18 : 17} aria-hidden="true" />
      {unreadCount > 0 && (
        <span
          className={cn(
            'absolute -top-1.5 -right-1.5 min-w-[18px] h-[18px] px-1 rounded-full text-white text-[10px] font-display font-black leading-none flex items-center justify-center tabular-nums shadow-xs ring-2 ring-card',
            hasUrgent ? 'bg-rose-500' : 'bg-sapphire-blue'
          )}
        >
          {displayBadge}
        </span>
      )}
    </button>
  );
}

export function NotificationCenterSheet({
  open,
  onOpenChange,
  data,
  isLoading,
  isAdmin,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  data?: NotificationsResponse;
  isLoading: boolean;
  isAdmin: boolean;
}) {
  const isDesktop = useMediaQuery('(min-width: 768px)');
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [filter, setFilter] = useState<NotificationFilter>('all');

  const notifications = useMemo(() => data?.notifications ?? [], [data]);
  const unreadCount = data?.unread_count ?? 0;
  const readCount = useMemo(
    () => notifications.filter((n) => n.is_read).length,
    [notifications]
  );
  const arbitrationCount = useMemo(
    () =>
      notifications.filter(
        (n) => n.category === 'disputed' || n.category === 'arbitration'
      ).length,
    [notifications]
  );

  const filteredList = useMemo(() => {
    if (filter === 'unread') return notifications.filter((n) => !n.is_read);
    if (filter === 'arbitration') {
      return notifications.filter(
        (n) => n.category === 'disputed' || n.category === 'arbitration'
      );
    }
    return notifications;
  }, [notifications, filter]);

  const markReadMutation = useMutation({
    mutationFn: async (notificationId: string) => {
      await apiClient.patch(`/users/me/notifications/${notificationId}/read`, undefined, {
        skipGlobalErrorToast: true,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
    },
  });

  const markAllMutation = useMutation({
    mutationFn: async () => {
      const res = await apiClient.post<{ marked_count: number }>(
        '/users/me/notifications/read-all',
        undefined,
        { skipGlobalErrorToast: true }
      );
      return res.data;
    },
    onSuccess: (res) => {
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
      if (res.marked_count > 0) {
        toast.success(`已將 ${res.marked_count} 則通知標記為已讀`);
      }
    },
    onError: () => {
      toast.error('標記已讀失敗，請稍後再試');
    },
  });

  const clearReadMutation = useMutation({
    mutationFn: async () => {
      const res = await apiClient.delete<{ deleted_count: number }>(
        '/users/me/notifications/clear-read',
        { skipGlobalErrorToast: true }
      );
      return res.data;
    },
    onSuccess: (res) => {
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
      if (res.deleted_count > 0) {
        toast.success(`已清除 ${res.deleted_count} 則已讀通知`);
      }
    },
    onError: () => {
      toast.error('清除失敗，請稍後再試');
    },
  });

  const handleNotificationClick = (item: NotificationItem) => {
    if (!item.is_read) {
      markReadMutation.mutate(item.id);
    }

    onOpenChange(false);

    if (item.category === 'action_required') {
      navigate(item.match_status === 'confirmed' ? '/history' : '/');
      return;
    }
    if (item.category === 'disputed') {
      navigate(isAdmin ? '/admin?tab=matches&status=disputed' : '/history');
      return;
    }
    if (item.category === 'season') {
      navigate(item.content.includes('錦標賽') ? '/tournament' : '/leaderboard');
      return;
    }
    if (item.match_id) {
      navigate('/history');
      return;
    }
    navigate('/');
  };

  const renderPanelContent = () => (
    <div className="flex flex-col h-full min-h-0 overflow-hidden bg-popover">
      {/* Header Strip */}
      <div className={cn('px-5 pt-4 pb-3 border-b border-border bg-surface-subtle/50 shrink-0 space-y-3', isDesktop && 'pr-12')}>
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="size-9 rounded-xl bg-sapphire-blue/12 text-sapphire-blue dark:bg-blue-500/20 dark:text-blue-300 flex items-center justify-center shrink-0">
              <Bell size={18} aria-hidden="true" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <h2 className="text-base sm:text-lg font-display font-black text-foreground leading-tight">
                  通知中心
                </h2>
                {unreadCount > 0 && (
                  <span className="px-2 py-0.5 rounded-full bg-rose-500 text-white text-[11px] font-display font-black tabular-nums leading-none">
                    {unreadCount}
                  </span>
                )}
              </div>
              <p className="text-[11px] font-bold text-muted-foreground mt-0.5">
                即時掌握賽果確認、申訴與管理員裁決異動
              </p>
            </div>
          </div>
        </div>

        {/* Filter Segmented Control + Quick Batch Actions */}
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-1 p-1 rounded-xl bg-secondary/90 border border-border/80">
            {([
              { key: 'all', label: '全部', count: notifications.length },
              { key: 'unread', label: '未讀', count: unreadCount },
              { key: 'arbitration', label: '裁決與異動', count: arbitrationCount },
            ] as const).map((tab) => {
              const active = filter === tab.key;
              return (
                <button
                  key={tab.key}
                  type="button"
                  onClick={() => setFilter(tab.key)}
                  className={cn(
                    'min-h-8 px-2.5 py-1 rounded-lg text-xs font-black transition-all flex items-center gap-1.5 whitespace-nowrap',
                    active
                      ? 'bg-card text-foreground shadow-xs'
                      : 'text-muted-foreground hover:text-foreground'
                  )}
                >
                  <span>{tab.label}</span>
                  <span
                    className={cn(
                      'px-1.5 py-0.5 rounded-full text-[10px] font-display font-black tabular-nums leading-none',
                      active ? 'bg-primary text-primary-foreground' : 'bg-background/70 text-muted-foreground'
                    )}
                  >
                    {tab.count}
                  </span>
                </button>
              );
            })}
          </div>

          <div className="flex items-center gap-1.5 ml-auto">
            {unreadCount > 0 && (
              <button
                type="button"
                disabled={markAllMutation.isPending}
                onClick={() => markAllMutation.mutate()}
                className="h-8 px-2.5 rounded-lg text-xs font-black text-sapphire-blue dark:text-blue-300 hover:bg-sapphire-blue/10 transition-colors inline-flex items-center gap-1"
              >
                <CheckCheck size={14} aria-hidden="true" />
                全部已讀
              </button>
            )}
            {readCount > 0 && (
              <button
                type="button"
                disabled={clearReadMutation.isPending}
                onClick={() => clearReadMutation.mutate()}
                className="h-8 px-2.5 rounded-lg text-xs font-bold text-muted-foreground hover:text-rose-600 dark:hover:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-500/15 transition-colors inline-flex items-center gap-1"
              >
                <Trash2 size={13} aria-hidden="true" />
                清除已讀
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Scrollable Notifications Feed */}
      <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain">
        {isLoading ? (
          <div className="py-16 flex flex-col items-center justify-center gap-3">
            <Loader2 className="animate-spin text-sapphire-blue" size={28} />
            <p className="text-xs font-bold text-muted-foreground">載入最新通知中...</p>
          </div>
        ) : filteredList.length === 0 ? (
          <div className="py-16 px-6 text-center space-y-2.5">
            <div className="size-12 rounded-2xl bg-surface-subtle border border-border mx-auto flex items-center justify-center text-muted-foreground/60">
              <Sparkles size={22} aria-hidden="true" />
            </div>
            <p className="text-sm font-display font-black text-foreground">
              {filter === 'unread'
                ? '太棒了，沒有任何未讀通知'
                : filter === 'arbitration'
                  ? '目前沒有爭議申訴或裁決異動'
                  : '目前尚無通知紀錄'}
            </p>
            <p className="text-xs font-bold text-muted-foreground leading-relaxed">
              當有對手報分、比賽結算、賽季發獎或管理員裁決異動時，都會即時顯示在這裡。
            </p>
          </div>
        ) : (
          <div className="divide-y divide-border/70 pb-[max(0.75rem,env(safe-area-inset-bottom,0px))]">
            {filteredList.map((item) => {
              const visual = getCategoryVisual(item, isAdmin);
              const Icon = visual.icon;

              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => handleNotificationClick(item)}
                  className={cn(
                    'w-full text-left px-4 sm:px-5 py-3.5 border-l-[3px] flex items-start gap-3 transition-colors hover:bg-surface-subtle/60 active:bg-surface-subtle',
                    visual.borderClass,
                    !item.is_read && 'bg-sapphire-blue/[0.035] dark:bg-blue-500/[0.06]'
                  )}
                >
                  <div
                    className={cn(
                      'size-9 rounded-xl flex items-center justify-center shrink-0 mt-0.5',
                      visual.iconBg
                    )}
                  >
                    <Icon size={17} aria-hidden="true" />
                  </div>

                  <div className="min-w-0 flex-1 space-y-1.5">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-[11px] font-black text-muted-foreground tracking-wide">
                        {visual.label}
                      </span>
                      <div className="flex items-center gap-1.5 shrink-0">
                        <span
                          title={item.created_at ? formatLocalTime(item.created_at, 'yyyy/MM/dd HH:mm') : undefined}
                          className="text-[11px] font-bold text-muted-foreground tabular-nums"
                        >
                          {formatRelativeNotificationTime(item.created_at)}
                        </span>
                        {!item.is_read && (
                          <span
                            aria-label="未讀"
                            className={cn('size-2 rounded-full shrink-0', visual.dotColor)}
                          />
                        )}
                      </div>
                    </div>

                    <p
                      className={cn(
                        'text-xs sm:text-[13px] leading-relaxed break-words',
                        !item.is_read ? 'font-bold text-foreground' : 'font-medium text-foreground/85'
                      )}
                    >
                      {renderRichNotificationText(item.content)}
                    </p>

                    <div className="flex items-center justify-end pt-0.5">
                      <span className="inline-flex items-center gap-0.5 text-[11px] font-black text-sapphire-blue dark:text-blue-300">
                        {visual.hint}
                        <ChevronRight size={12} aria-hidden="true" />
                      </span>
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );

  if (isDesktop) {
    return (
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent className="w-[92vw] sm:max-w-[420px] p-0 border-none bg-popover lg:rounded-l-[2rem] overflow-hidden shadow-2xl flex flex-col">
          <SheetTitle className="sr-only">通知中心</SheetTitle>
          <SheetDescription className="sr-only">
            檢視待確認賽果、爭議申訴、管理員裁決與積分異動通知
          </SheetDescription>
          {renderPanelContent()}
        </SheetContent>
      </Sheet>
    );
  }

  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent className="p-0 border-none bg-popover rounded-t-[2rem] overflow-hidden shadow-2xl flex flex-col max-h-[88dvh]">
        <DrawerTitle className="sr-only">通知中心</DrawerTitle>
        <DrawerDescription className="sr-only">
          檢視待確認賽果、爭議申訴、管理員裁決與積分異動通知
        </DrawerDescription>
        {renderPanelContent()}
      </DrawerContent>
    </Drawer>
  );
}
