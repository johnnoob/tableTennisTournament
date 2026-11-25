import { useMemo, useState } from 'react';
import { useInfiniteQuery } from '@tanstack/react-query';
import {
  Download,
  Gavel,
  History,
  Loader2,
  Search,
  Settings,
  Shield,
  Trophy,
  Users,
  X,
} from 'lucide-react';
import { adminApi } from '@/lib/admin';
import { downloadCsv } from '@/lib/csv';
import type { AdminAuditLogItem } from '@/types/admin';
import { cn, formatLocalTime } from '@/lib/utils';
import { Button } from '@/components/ui/button';

type AuditCategoryFilter = 'all' | 'members' | 'matches' | 'seasons' | 'system';

const CATEGORY_TABS: Array<{ key: AuditCategoryFilter; label: string }> = [
  { key: 'all', label: '全部紀錄' },
  { key: 'members', label: '成員與積分' },
  { key: 'matches', label: '賽事裁決' },
  { key: 'seasons', label: '賽季與獎品' },
  { key: 'system', label: '系統規則' },
];

const ACTION_LABELS: Record<string, string> = {
  'mmr.adjust': '積分校準',
  'user.update': '成員異動',
  'user.batch_department': '批次設單位',
  'match.create': '代為補登',
  'match.edit_score': '改分重算',
  'match.force_confirm': '強制裁決',
  'match.batch_confirm': '批次結算',
  'match.void': '撤銷／駁回',
  'season.create': '開啟賽季',
  'season.update': '編輯賽季',
  'season.rollover': '賽季結算',
  'prize.create': '新增獎品',
  'prize.update': '更新獎品',
  'prize.delete': '刪除獎品',
  'prize.copy': '複製獎品',
  'tournament.create': '新增錦標賽',
  'tournament.status': '賽事狀態',
  'tournament.delete': '刪除錦標賽',
  'config.update': '規則修改',
  'system.run_cron': '執行排程',
  'system.trigger_decay': '觸發衰退',
};

function getCategoryStyle(category: string) {
  switch (category) {
    case 'members':
      return {
        icon: Users,
        border: 'border-l-sapphire-blue',
        badge: 'bg-sapphire-blue/12 text-sapphire-blue dark:bg-blue-500/20 dark:text-blue-300',
      };
    case 'matches':
      return {
        icon: Gavel,
        border: 'border-l-rose-500',
        badge: 'bg-rose-100 text-rose-700 dark:bg-rose-500/20 dark:text-rose-300',
      };
    case 'seasons':
      return {
        icon: Trophy,
        border: 'border-l-amber-500',
        badge: 'bg-amber-100 text-amber-800 dark:bg-amber-500/20 dark:text-amber-300',
      };
    default:
      return {
        icon: Settings,
        border: 'border-l-emerald-500',
        badge: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-300',
      };
  }
}

export function AdminAuditLogPanel() {
  const [category, setCategory] = useState<AuditCategoryFilter>('all');
  const [search, setSearch] = useState('');

  const {
    data,
    isLoading,
    isFetchingNextPage,
    hasNextPage,
    fetchNextPage,
  } = useInfiniteQuery({
    queryKey: ['admin', 'audit-logs', category, search.trim()],
    initialPageParam: 0,
    queryFn: ({ pageParam }) =>
      adminApi.getAuditLogs({
        category,
        search: search.trim(),
        offset: pageParam,
        limit: 25,
      }),
    getNextPageParam: (lastPage, allPages) => {
      if (!lastPage.has_more) return undefined;
      return allPages.reduce((sum, page) => sum + page.logs.length, 0);
    },
  });

  const logs = useMemo<AdminAuditLogItem[]>(() => {
    if (!data?.pages) return [];
    const seen = new Set<string>();
    const combined: AdminAuditLogItem[] = [];
    for (const page of data.pages) {
      for (const item of page.logs) {
        if (!seen.has(item.id)) {
          seen.add(item.id);
          combined.push(item);
        }
      }
    }
    return combined;
  }, [data]);

  const totalCount = data?.pages[0]?.total ?? 0;

  const handleExportCsv = () => {
    if (logs.length === 0) return;
    downloadCsv(
      `admin_audit_logs_${category}_${new Date().toISOString().slice(0, 10)}.csv`,
      ['時間', '操作管理員', '分類', '動作代碼', '目標ID', '操作摘要'],
      logs.map((l) => [
        l.created_at ? formatLocalTime(l.created_at, 'yyyy-MM-dd HH:mm:ss') : '',
        l.actor_name,
        l.category,
        ACTION_LABELS[l.action] || l.action,
        l.target_id || '',
        l.summary,
      ]),
    );
  };

  return (
    <section className="rounded-2xl border border-border bg-card shadow-xs overflow-hidden">
      {/* Header */}
      <div className="p-4 sm:p-5 border-b border-border bg-surface-subtle/40 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2.5">
          <div className="flex items-center gap-2.5">
            <div className="size-9 rounded-xl bg-sapphire-blue/12 text-sapphire-blue dark:bg-blue-500/20 dark:text-blue-300 flex items-center justify-center shrink-0">
              <History size={18} aria-hidden="true" />
            </div>
            <div>
              <h3 className="text-base sm:text-lg font-display font-bold text-foreground leading-tight">
                管理員操作稽核紀錄
              </h3>
              <p className="text-xs font-medium text-muted-foreground mt-0.5">
                集中追蹤誰在何時調整積分、裁決賽事、變更賽季與修改系統參數（共 {totalCount} 筆）
              </p>
            </div>
          </div>

          <Button
            type="button"
            variant="outline"
            disabled={logs.length === 0}
            onClick={handleExportCsv}
            className="min-h-9 py-1.5 px-3 rounded-xl border-border bg-card hover:bg-secondary text-xs font-semibold gap-1.5 shrink-0 ml-auto"
          >
            <Download size={13} aria-hidden="true" />
            <span>匯出已載入 CSV</span>
          </Button>
        </div>

        {/* Category Filter Tabs + Search */}
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-2.5">
          <div className="flex flex-nowrap overflow-x-auto no-scrollbar gap-1 p-1 rounded-xl bg-secondary/90 border border-border/80 w-full lg:w-fit">
            {CATEGORY_TABS.map((tab) => {
              const active = category === tab.key;
              return (
                <button
                  key={tab.key}
                  type="button"
                  aria-pressed={active}
                  onClick={() => setCategory(tab.key)}
                  className={cn(
                    'min-h-8 px-3 py-1 rounded-lg text-xs font-semibold transition-all whitespace-nowrap shrink-0',
                    active
                      ? 'bg-card text-foreground shadow-xs'
                      : 'text-muted-foreground hover:text-foreground',
                  )}
                >
                  {tab.label}
                </button>
              );
            })}
          </div>

          <div className="relative w-full lg:w-72 shrink-0">
            <Search
              size={15}
              className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none"
              aria-hidden="true"
            />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="搜尋管理員、摘要或目標 ID..."
              aria-label="搜尋操作稽核紀錄"
              className="arena-input pl-9 pr-8 min-h-9 py-1.5 text-xs"
            />
            {search && (
              <button
                type="button"
                aria-label="清除搜尋"
                onClick={() => setSearch('')}
                className="absolute right-1.5 top-1/2 -translate-y-1/2 size-7 rounded-lg flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-secondary"
              >
                <X size={13} aria-hidden="true" />
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Feed Body */}
      {isLoading ? (
        <div className="py-12 flex flex-col items-center justify-center gap-2">
          <Loader2 className="animate-spin text-sapphire-blue" size={24} />
          <p className="text-xs font-medium text-muted-foreground">載入操作稽核紀錄中...</p>
        </div>
      ) : logs.length === 0 ? (
        <div className="p-10 text-center space-y-2">
          <Shield size={28} className="mx-auto text-muted-foreground/40" aria-hidden="true" />
          <p className="text-sm font-display font-bold text-foreground">目前尚無符合條件的稽核紀錄</p>
          <p className="text-xs font-medium text-muted-foreground">
            日後凡是積分校準、賽事裁決、賽季異動與規則參數修改，都會自動留存於此。
          </p>
        </div>
      ) : (
        <>
          <div className="divide-y divide-border/70">
            {logs.map((log) => {
              const style = getCategoryStyle(log.category);
              const Icon = style.icon;
              const actionLabel = ACTION_LABELS[log.action] || log.action;

              return (
                <div
                  key={log.id}
                  className={cn(
                    'border-l-[3px] px-4 sm:px-5 py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2 hover:bg-surface-subtle/35 transition-colors',
                    style.border,
                  )}
                >
                  <div className="flex items-start gap-2.5 min-w-0">
                    <span
                      className={cn(
                        'size-7 rounded-lg flex items-center justify-center shrink-0 mt-0.5',
                        style.badge,
                      )}
                    >
                      <Icon size={13} aria-hidden="true" />
                    </span>

                    <div className="min-w-0 space-y-1">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className={cn('px-2 py-0.5 rounded-md text-xs font-semibold leading-none', style.badge)}>
                          {actionLabel}
                        </span>
                        <span className="text-xs font-semibold text-foreground">
                          {log.actor_name}
                        </span>
                        {log.target_id && (
                          <span className="text-xs font-display font-medium text-muted-foreground tabular-nums bg-secondary px-1.5 py-0.5 rounded">
                            #{log.target_id.slice(0, 8)}
                          </span>
                        )}
                      </div>
                      <p className="text-xs sm:text-sm font-medium text-foreground/90 leading-relaxed break-words">
                        {log.summary}
                      </p>
                    </div>
                  </div>

                  <span
                    title={log.created_at ? formatLocalTime(log.created_at, 'yyyy/MM/dd HH:mm:ss') : undefined}
                    className="text-xs font-medium text-muted-foreground tabular-nums shrink-0 pl-9 sm:pl-0"
                  >
                    {log.created_at ? formatLocalTime(log.created_at, 'MM/dd HH:mm') : ''}
                  </span>
                </div>
              );
            })}
          </div>

          {hasNextPage && (
            <div className="px-4 py-3 border-t border-border bg-surface-subtle/35 flex justify-center">
              <Button
                type="button"
                variant="outline"
                disabled={isFetchingNextPage}
                onClick={() => fetchNextPage()}
                className="min-h-9 py-1.5 px-5 rounded-xl text-xs font-semibold gap-1.5"
              >
                {isFetchingNextPage && <Loader2 size={13} className="animate-spin" aria-hidden="true" />}
                <span>{isFetchingNextPage ? '載入中...' : '載入更多稽核紀錄'}</span>
              </Button>
            </div>
          )}
        </>
      )}
    </section>
  );
}
