import { useEffect, useId, useMemo, useRef, useState, type KeyboardEvent } from 'react';
import {
  ChevronDown,
  Clock,
  Flame,
  Search,
  Swords,
  Users,
  X,
} from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { PlayerAvatar } from '@/components/PlayerAvatar';
import { cn } from '@/lib/utils';
import {
  formatSignedDelta,
  getNormalizedDept,
  type ClubInspectorStats,
  type PersonalPivots,
  type PersonalSliceStats,
  type SelectedPlayerFilter,
} from '@/lib/matchInspector';

interface ComboboxOptionItem {
  key: string;
  group: 'recent' | 'rivals' | 'partners' | 'active';
  id: string;
  name: string;
  avatar?: string | null;
  department?: string | null;
  role: 'any' | 'rival' | 'partner';
  roleLabel?: '對手' | '搭檔';
  wins: number;
  losses: number;
  matches: number;
  winRate: number;
  netMmr: number;
}

export interface MatchHistorySearchComboboxProps {
  scope: 'mine' | 'all';
  searchQuery: string;
  selectedPlayer: SelectedPlayerFilter | null;
  personalPivots: PersonalPivots;
  clubStats: ClubInspectorStats;
  onSearchChange: (val: string) => void;
  onSelectPlayer: (player: SelectedPlayerFilter) => void;
  onClear: () => void;
}

export function MatchHistorySearchCombobox({
  scope,
  searchQuery,
  selectedPlayer,
  personalPivots,
  clubStats,
  onSearchChange,
  onSelectPlayer,
  onClear,
}: Readonly<MatchHistorySearchComboboxProps>) {
  const [isOpen, setIsOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const listboxId = useId();
  const inputId = useId();

  useEffect(() => {
    const handleOutsidePointerDown = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
        setActiveIndex(-1);
      }
    };
    document.addEventListener('mousedown', handleOutsidePointerDown);
    return () => document.removeEventListener('mousedown', handleOutsidePointerDown);
  }, []);

  const trimmedQuery = searchQuery.trim().toLowerCase();

  const groupedOptions = useMemo(() => {
    const matchesQuery = (name: string, dept?: string | null) => {
      if (!trimmedQuery) return true;
      return (
        name.toLowerCase().includes(trimmedQuery) ||
        (dept || '').toLowerCase().includes(trimmedQuery)
      );
    };

    if (scope === 'mine') {
      const recentItems: ComboboxOptionItem[] = personalPivots.recentPlayers
        .filter((p) => matchesQuery(p.name, p.department))
        .map((p) => ({
          key: `recent-${p.id}-${p.lastRole}`,
          group: 'recent',
          id: p.id,
          name: p.name,
          avatar: p.avatar,
          department: p.department,
          role: p.lastRole,
          roleLabel: p.lastRole === 'partner' ? '搭檔' : '對手',
          wins: p.wins,
          losses: p.losses,
          matches: p.matches,
          winRate: p.winRate,
          netMmr: p.netMmr,
        }));

      const recentRivalKeys = new Set(
        recentItems.filter((i) => i.role === 'rival').map((i) => i.id),
      );
      const recentPartnerKeys = new Set(
        recentItems.filter((i) => i.role === 'partner').map((i) => i.id),
      );

      const rivalItems: ComboboxOptionItem[] = personalPivots.topRivals
        .filter((p) => matchesQuery(p.name, p.department))
        .filter((p) => (trimmedQuery ? true : !recentRivalKeys.has(p.id)))
        .map((p) => ({
          key: `rival-${p.id}`,
          group: 'rivals',
          id: p.id,
          name: p.name,
          avatar: p.avatar,
          department: p.department,
          role: 'rival',
          wins: p.wins,
          losses: p.losses,
          matches: p.matches,
          winRate: p.winRate,
          netMmr: p.netMmr,
        }));

      const partnerItems: ComboboxOptionItem[] = personalPivots.topPartners
        .filter((p) => matchesQuery(p.name, p.department))
        .filter((p) => (trimmedQuery ? true : !recentPartnerKeys.has(p.id)))
        .map((p) => ({
          key: `partner-${p.id}`,
          group: 'partners',
          id: p.id,
          name: p.name,
          avatar: p.avatar,
          department: p.department,
          role: 'partner',
          wins: p.wins,
          losses: p.losses,
          matches: p.matches,
          winRate: p.winRate,
          netMmr: p.netMmr,
        }));

      return [
        {
          id: 'recent',
          label: '最近交手 / 同場',
          icon: Clock,
          iconClass: 'text-sapphire-blue',
          items: recentItems,
        },
        {
          id: 'rivals',
          label: '常打對手',
          icon: Swords,
          iconClass: 'text-smash-orange',
          items: rivalItems,
        },
        {
          id: 'partners',
          label: '雙打搭檔',
          icon: Users,
          iconClass: 'text-amber-500',
          items: partnerItems,
        },
      ].filter((g) => g.items.length > 0);
    }

    const recentClubItems: ComboboxOptionItem[] = clubStats.recentPlayers
      .filter((p) => matchesQuery(p.name, p.department))
      .map((p) => ({
        key: `club-recent-${p.id}`,
        group: 'recent',
        id: p.id,
        name: p.name,
        avatar: p.avatar,
        department: p.department,
        role: 'any',
        wins: p.wins,
        losses: p.losses,
        matches: p.matches,
        winRate: p.winRate,
        netMmr: p.netMmr,
      }));

    const recentIds = new Set(recentClubItems.map((i) => i.id));
    const activeItems: ComboboxOptionItem[] = clubStats.topActivePlayers
      .filter((p) => matchesQuery(p.name, p.department))
      .filter((p) => (trimmedQuery ? true : !recentIds.has(p.id)))
      .map((p) => ({
        key: `club-active-${p.id}`,
        group: 'active',
        id: p.id,
        name: p.name,
        avatar: p.avatar,
        department: p.department,
        role: 'any',
        wins: p.wins,
        losses: p.losses,
        matches: p.matches,
        winRate: p.winRate,
        netMmr: p.netMmr,
      }));

    return [
      {
        id: 'recent',
        label: '最近出賽球友',
        icon: Clock,
        iconClass: 'text-sapphire-blue',
        items: recentClubItems,
      },
      {
        id: 'active',
        label: '近期常打球友',
        icon: Flame,
        iconClass: 'text-smash-orange',
        items: activeItems,
      },
    ].filter((g) => g.items.length > 0);
  }, [scope, trimmedQuery, personalPivots, clubStats]);

  const flatOptions = useMemo(
    () => groupedOptions.flatMap((g) => g.items),
    [groupedOptions],
  );

  const hasPresetOptions = flatOptions.length > 0;
  const optionIndexByKey = useMemo(() => {
    const map = new Map<string, number>();
    flatOptions.forEach((opt, idx) => map.set(opt.key, idx));
    return map;
  }, [flatOptions]);

  const selectOption = (item: ComboboxOptionItem) => {
    onSelectPlayer({
      id: item.id,
      name: item.name,
      avatar: item.avatar,
      department: item.department,
      role: item.role,
    });
    setIsOpen(false);
    setActiveIndex(-1);
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (!isOpen) {
        setIsOpen(true);
        setActiveIndex(flatOptions.length > 0 ? 0 : -1);
      } else if (flatOptions.length > 0) {
        setActiveIndex((prev) => (prev + 1) % flatOptions.length);
      }
      return;
    }

    if (e.key === 'ArrowUp') {
      e.preventDefault();
      if (!isOpen) {
        setIsOpen(true);
        setActiveIndex(flatOptions.length > 0 ? flatOptions.length - 1 : -1);
      } else if (flatOptions.length > 0) {
        setActiveIndex((prev) => (prev <= 0 ? flatOptions.length - 1 : prev - 1));
      }
      return;
    }

    if (e.key === 'Enter') {
      if (e.nativeEvent.isComposing) return;
      if (isOpen && activeIndex >= 0 && flatOptions[activeIndex]) {
        e.preventDefault();
        selectOption(flatOptions[activeIndex]);
      } else {
        setIsOpen(false);
      }
      return;
    }

    if (e.key === 'Escape') {
      setIsOpen(false);
      setActiveIndex(-1);
      return;
    }

    if (e.key === 'Backspace' && searchQuery === '' && selectedPlayer) {
      e.preventDefault();
      onClear();
    }
  };

  const activeOption = activeIndex >= 0 ? flatOptions[activeIndex] : undefined;

  return (
    <div ref={containerRef} className="relative">
      <div
        className={cn(
          'flex items-center gap-2 min-h-[44px] w-full rounded-2xl border bg-background/80 px-3 transition-all',
          'border-input focus-within:border-sapphire-blue focus-within:ring-2 focus-within:ring-sapphire-blue/15',
        )}
      >
        <Search
          className="text-muted-foreground shrink-0 pointer-events-none"
          size={16}
          aria-hidden="true"
        />

        {selectedPlayer && (
          <span
            className={cn(
              'inline-flex items-center gap-1.5 pl-1 pr-1.5 py-0.5 rounded-xl border text-xs font-black shrink-0 max-w-[200px]',
              selectedPlayer.role === 'partner'
                ? 'bg-amber-500/12 border-amber-500/35 text-amber-800 dark:text-amber-200'
                : 'bg-sapphire-blue/10 border-sapphire-blue/30 text-sapphire-blue dark:bg-blue-500/15 dark:text-blue-200',
            )}
          >
            <PlayerAvatar
              src={selectedPlayer.avatar}
              name={selectedPlayer.name}
              className="size-5 rounded-md text-[10px]"
            />
            {selectedPlayer.role !== 'any' && (
              <span className="text-[10px] opacity-80 shrink-0">
                {selectedPlayer.role === 'partner' ? '搭檔' : '對手'}
              </span>
            )}
            <span className="truncate">{selectedPlayer.name}</span>
            <button
              type="button"
              aria-label={`移除已選選手 ${selectedPlayer.name}`}
              onClick={() => {
                onClear();
                inputRef.current?.focus();
              }}
              className="size-4 rounded-full hover:bg-black/10 dark:hover:bg-white/15 inline-flex items-center justify-center shrink-0"
            >
              <X size={11} aria-hidden="true" />
            </button>
          </span>
        )}

        <input
          ref={inputRef}
          id={inputId}
          type="search"
          role="combobox"
          aria-expanded={isOpen}
          aria-controls={listboxId}
          aria-autocomplete="list"
          aria-activedescendant={
            isOpen && activeOption ? `${listboxId}-${activeOption.key}` : undefined
          }
          aria-label={scope === 'mine' ? '搜尋或快選對手與搭檔' : '搜尋或快選參賽球友'}
          autoComplete="off"
          autoCorrect="off"
          autoCapitalize="none"
          spellCheck={false}
          enterKeyHint="search"
          value={searchQuery}
          onFocus={() => setIsOpen(true)}
          onChange={(e) => {
            onSearchChange(e.target.value);
            if (!isOpen) setIsOpen(true);
            setActiveIndex(-1);
          }}
          onKeyDown={handleKeyDown}
          placeholder={
            selectedPlayer
              ? '可繼續輸入關鍵字或按清單切換...'
              : scope === 'mine'
                ? '搜尋姓名／單位，或從清單選常打・最近交手...'
                : '搜尋姓名／單位，或從清單選最近活躍球友...'
          }
          className="flex-1 min-w-0 bg-transparent py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none [&::-webkit-search-cancel-button]:hidden"
        />

        <div className="flex items-center gap-1 shrink-0">
          {(searchQuery || selectedPlayer) && (
            <button
              type="button"
              aria-label="清除搜尋條件"
              onClick={() => {
                onClear();
                inputRef.current?.focus();
              }}
              className="size-8 inline-flex items-center justify-center rounded-lg text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors"
            >
              <X size={15} aria-hidden="true" />
            </button>
          )}
          <button
            type="button"
            aria-expanded={isOpen}
            aria-label="切換快選球友清單"
            title={isOpen ? '收合清單' : '快選最近／常打球友'}
            onClick={() => {
              setIsOpen((prev) => {
                const next = !prev;
                if (next) inputRef.current?.focus();
                return next;
              });
            }}
            className={cn(
              'size-8 inline-flex items-center justify-center rounded-lg transition-colors',
              isOpen
                ? 'bg-sapphire-blue/10 text-sapphire-blue dark:text-blue-300'
                : 'text-muted-foreground hover:text-foreground hover:bg-secondary',
            )}
          >
            <ChevronDown
              size={16}
              aria-hidden="true"
              className={cn('transition-transform duration-200', isOpen && 'rotate-180')}
            />
          </button>
        </div>
      </div>

      {isOpen && (
        <div
          id={listboxId}
          role="listbox"
          aria-label="快選球友清單"
          className="absolute left-0 right-0 top-[calc(100%+6px)] z-30 rounded-2xl border border-border bg-popover text-popover-foreground shadow-xl max-h-72 overflow-y-auto overscroll-contain p-2 space-y-2.5"
        >
          {hasPresetOptions ? (
            <>
              {groupedOptions.map((group) => {
                const GroupIcon = group.icon;
                return (
                  <div key={group.id} className="space-y-1">
                    <div className="px-2 py-1 flex items-center gap-1.5 text-[11px] font-black text-muted-foreground">
                      <GroupIcon size={12} className={group.iconClass} aria-hidden="true" />
                      <span>{group.label}</span>
                    </div>
                    <div className="space-y-0.5">
                      {group.items.map((item) => {
                        const idx = optionIndexByKey.get(item.key) ?? -1;
                        const isHighlighted = idx === activeIndex;
                        const isSelected = Boolean(
                          selectedPlayer &&
                            ((selectedPlayer.id && selectedPlayer.id === item.id) ||
                              selectedPlayer.name.toLowerCase() === item.name.toLowerCase()) &&
                            selectedPlayer.role === item.role,
                        );
                        const dept = getNormalizedDept(item.department);

                        return (
                          <button
                            key={item.key}
                            id={`${listboxId}-${item.key}`}
                            type="button"
                            role="option"
                            aria-selected={isSelected}
                            onMouseDown={(e) => e.preventDefault()}
                            onMouseEnter={() => setActiveIndex(idx)}
                            onClick={() => selectOption(item)}
                            className={cn(
                              'w-full flex items-center justify-between gap-2.5 px-2.5 py-2 rounded-xl text-left transition-colors',
                              isSelected
                                ? 'bg-sapphire-blue/12 text-sapphire-blue dark:bg-blue-500/20 dark:text-blue-200'
                                : isHighlighted
                                  ? 'bg-secondary text-foreground'
                                  : 'hover:bg-secondary/75 text-foreground',
                            )}
                          >
                            <div className="flex items-center gap-2.5 min-w-0 flex-1">
                              <PlayerAvatar
                                src={item.avatar}
                                name={item.name}
                                className="size-7 rounded-lg text-[11px] shrink-0"
                              />
                              <div className="min-w-0 flex-1 flex items-center gap-1.5 flex-wrap">
                                <span className="text-xs font-black truncate">{item.name}</span>
                                {item.roleLabel && (
                                  <span
                                    className={cn(
                                      'px-1.5 py-0.5 rounded-md text-[10px] font-black leading-none shrink-0',
                                      item.role === 'partner'
                                        ? 'bg-amber-500/12 text-amber-700 dark:text-amber-300'
                                        : 'bg-sapphire-blue/10 text-sapphire-blue dark:bg-blue-500/15 dark:text-blue-300',
                                    )}
                                  >
                                    {item.roleLabel}
                                  </span>
                                )}
                                {dept && (
                                  <span className="text-[11px] font-bold text-muted-foreground truncate">
                                    · {dept}
                                  </span>
                                )}
                              </div>
                            </div>

                            <div className="flex items-center gap-2 shrink-0 tabular-nums text-xs font-display font-black">
                              <span>
                                <span className="text-emerald-600 dark:text-emerald-400">
                                  {item.wins}勝
                                </span>{' '}
                                <span className="text-rose-500 dark:text-rose-400">
                                  {item.losses}敗
                                </span>
                              </span>
                              {item.group === 'partners' ? (
                                <span className="px-1.5 py-0.5 rounded-md bg-secondary text-[11px] text-foreground">
                                  {item.winRate}%
                                </span>
                              ) : item.group === 'active' || (item.group === 'recent' && scope === 'all') ? (
                                <span className="text-[11px] font-bold text-muted-foreground">
                                  {item.matches}場
                                </span>
                              ) : item.netMmr !== 0 ? (
                                <span
                                  className={cn(
                                    'text-[11px]',
                                    item.netMmr > 0
                                      ? 'text-emerald-600 dark:text-emerald-400'
                                      : 'text-rose-500 dark:text-rose-400',
                                  )}
                                >
                                  {formatSignedDelta(item.netMmr)}
                                </span>
                              ) : null}
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </>
          ) : (
            <div className="px-3 py-3 text-xs font-bold text-muted-foreground text-center">
              {trimmedQuery
                ? `未在常用清單找到「${searchQuery.trim()}」— 已即時過濾所有紀錄`
                : '尚無足夠對戰場次建立快選清單，可直接輸入姓名或單位搜尋'}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export interface MatchHistorySummaryBarProps {
  scope: 'mine' | 'all';
  isLoggedIn: boolean;
  isLoading: boolean;
  hasActiveFilters: boolean;
  statusFilter: 'all' | 'confirmed' | 'pending';
  matchTypeFilter: 'all' | 'singles' | 'doubles';
  personalSlice: PersonalSliceStats;
  clubStats: ClubInspectorStats;
  onToggleMatchType: (type: 'singles' | 'doubles') => void;
  onTogglePendingFilter: () => void;
  onInspectPlayer: (playerId: string) => void;
  onResetFilters: () => void;
}

export function MatchHistorySummaryBar({
  scope,
  isLoggedIn,
  isLoading,
  hasActiveFilters,
  statusFilter,
  matchTypeFilter,
  personalSlice,
  clubStats,
  onToggleMatchType,
  onTogglePendingFilter,
  onInspectPlayer,
  onResetFilters,
}: Readonly<MatchHistorySummaryBarProps>) {
  if (scope === 'mine' && !isLoggedIn) {
    return null;
  }

  if (isLoading) {
    return <Skeleton className="h-12 w-full rounded-2xl" />;
  }

  if (scope === 'mine') {
    const { total, wins, losses, winRate, netMmr, singles, doubles, recentForm, h2hContext } =
      personalSlice;

    return (
      <div className="arena-surface rounded-2xl px-3.5 sm:px-4 py-2.5 shadow-2xs flex flex-wrap items-center justify-between gap-2.5">
        <div className="min-w-0 flex items-center gap-2 sm:gap-3 flex-wrap">
          {h2hContext ? (
            <button
              type="button"
              onClick={() => h2hContext.player.id && onInspectPlayer(String(h2hContext.player.id))}
              disabled={!h2hContext.player.id}
              className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-sapphire-blue/10 hover:bg-sapphire-blue/15 text-sapphire-blue dark:bg-blue-500/15 dark:text-blue-300 text-xs font-black transition-colors"
            >
              <PlayerAvatar
                src={h2hContext.player.avatar}
                name={h2hContext.player.name}
                className="size-5 rounded-md text-[10px]"
              />
              <span>
                {h2hContext.role === 'rival' ? 'VS' : '搭檔'} {h2hContext.player.name}
              </span>
            </button>
          ) : (
            <span className="px-2.5 py-1 rounded-xl bg-secondary text-xs font-black text-foreground/85 tabular-nums whitespace-nowrap">
              {hasActiveFilters ? `篩選 ${total} 場` : `近 ${total} 場`}
            </span>
          )}

          {total > 0 ? (
            <>
              <div className="flex items-center gap-2 text-xs sm:text-sm font-display font-black tabular-nums whitespace-nowrap">
                <span>
                  <span className="text-emerald-600 dark:text-emerald-400">{wins}勝</span>{' '}
                  <span className="text-rose-500 dark:text-rose-400">{losses}敗</span>
                </span>
                <span className="text-xs text-muted-foreground font-sans font-bold">
                  ({winRate}%)
                </span>
                {netMmr !== 0 && (
                  <span
                    className={cn(
                      'px-2 py-0.5 rounded-lg text-xs font-black',
                      netMmr > 0
                        ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300'
                        : 'bg-rose-50 text-rose-600 dark:bg-rose-500/15 dark:text-rose-300',
                    )}
                  >
                    {formatSignedDelta(netMmr)} 分
                  </span>
                )}
              </div>

              {matchTypeFilter === 'all' && singles.total > 0 && doubles.total > 0 && (
                <div className="hidden md:flex items-center gap-1.5 text-[11px] font-bold text-muted-foreground">
                  <span className="text-border">|</span>
                  <button
                    type="button"
                    onClick={() => onToggleMatchType('singles')}
                    className="px-2 py-0.5 rounded-lg bg-surface-subtle hover:bg-secondary border border-border/70 transition-colors tabular-nums"
                  >
                    單 {singles.wins}-{singles.losses}
                  </button>
                  <button
                    type="button"
                    onClick={() => onToggleMatchType('doubles')}
                    className="px-2 py-0.5 rounded-lg bg-surface-subtle hover:bg-secondary border border-border/70 transition-colors tabular-nums"
                  >
                    雙 {doubles.wins}-{doubles.losses}
                  </button>
                </div>
              )}

              {recentForm.length > 0 && (
                <div className="hidden lg:flex items-center gap-1" aria-label="近期勝負走勢">
                  {recentForm.slice(0, 6).map((item) => (
                    <span
                      key={item.id}
                      title={item.tooltip}
                      className={cn(
                        'size-5 rounded-md flex items-center justify-center text-[10px] font-display font-black text-white select-none',
                        item.win ? 'bg-emerald-500' : 'bg-rose-500',
                      )}
                    >
                      {item.win ? '勝' : '敗'}
                    </span>
                  ))}
                </div>
              )}
            </>
          ) : (
            <span className="text-xs font-bold text-muted-foreground">尚無符合場次</span>
          )}
        </div>

        <div className="flex items-center gap-1.5 shrink-0 ml-auto">
          {h2hContext?.player.id && (
            <button
              type="button"
              onClick={() => onInspectPlayer(String(h2hContext.player.id))}
              className="h-7 px-2.5 rounded-lg border border-sapphire-blue/30 bg-sapphire-blue/8 hover:bg-sapphire-blue/15 text-[11px] font-black text-sapphire-blue dark:text-blue-300 transition-colors whitespace-nowrap"
            >
              選手檔案
            </button>
          )}
          {hasActiveFilters && (
            <button
              type="button"
              onClick={onResetFilters}
              className="h-7 px-2.5 rounded-lg border border-border bg-card hover:bg-secondary text-[11px] font-black text-muted-foreground hover:text-foreground transition-colors whitespace-nowrap"
            >
              重設
            </button>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="arena-surface rounded-2xl px-3.5 sm:px-4 py-2.5 shadow-2xs flex flex-wrap items-center justify-between gap-2">
      <div className="min-w-0 flex items-center gap-2 sm:gap-3 flex-wrap">
        <span className="px-2.5 py-1 rounded-xl bg-secondary text-xs font-black text-foreground/85 tabular-nums whitespace-nowrap">
          共 {clubStats.total} 場
        </span>
        <span className="text-xs font-bold text-muted-foreground tabular-nums whitespace-nowrap">
          單打 {clubStats.singlesCount} · 雙打 {clubStats.doublesCount} · {clubStats.activePlayersCount} 位參賽者
        </span>
        {clubStats.totalPendingInBase > 0 && (
          <button
            type="button"
            aria-pressed={statusFilter === 'pending'}
            onClick={onTogglePendingFilter}
            className={cn(
              'inline-flex items-center gap-1 px-2.5 py-0.5 rounded-lg text-[11px] font-black border transition-colors whitespace-nowrap',
              statusFilter === 'pending'
                ? 'bg-amber-600 text-white border-amber-600'
                : 'bg-amber-50 text-amber-700 border-amber-200/80 hover:bg-amber-100/80 dark:bg-amber-500/15 dark:text-amber-300 dark:border-amber-500/30',
            )}
          >
            <Clock size={11} aria-hidden="true" />
            待確認 {clubStats.totalPendingInBase}
          </button>
        )}
      </div>

      {hasActiveFilters && (
        <button
          type="button"
          onClick={onResetFilters}
          className="h-7 px-2.5 rounded-lg border border-border bg-card hover:bg-secondary text-[11px] font-black text-muted-foreground hover:text-foreground transition-colors whitespace-nowrap ml-auto"
        >
          重設
        </button>
      )}
    </div>
  );
}
