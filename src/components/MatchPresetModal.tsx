import * as React from 'react';
import { useQuery } from '@tanstack/react-query';
import { toast } from 'sonner';
import {
  ArrowUpToLine,
  Pencil,
  Plus,
  Search,
  Sparkles,
  Star,
  Trash2,
  User,
  Users,
  X,
} from 'lucide-react';
import { ResponsiveFormModal } from '@/components/ResponsiveFormModal';
import { PlayerAvatar } from '@/components/PlayerAvatar';
import { Button } from '@/components/ui/button';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  MAX_MATCH_PRESETS,
  useCreateMatchPreset,
  useDeleteMatchPreset,
  useUpdateMatchPreset,
} from '@/hooks/useMatchPresets';
import { useAuth } from '@/hooks/useAuth';
import { cn } from '@/lib/utils';
import apiClient from '@/utils/apiClient';
import type { MatchPreset } from '@/types/api.types';

interface UserOption {
  id: string;
  name: string;
  department?: string;
  avatar?: string | null;
}

type MatchType = 'singles' | 'doubles';
type ActiveSlot = 'partner' | 'opp1' | 'opp2';

function findNextEmptySlot(
  nextPartner: string | null,
  nextOpp1: string | null,
  nextOpp2: string | null,
  type: MatchType
): ActiveSlot | null {
  if (type === 'singles') {
    return nextOpp1 ? null : 'opp1';
  }
  if (!nextPartner) return 'partner';
  if (!nextOpp1) return 'opp1';
  if (!nextOpp2) return 'opp2';
  return null;
}

function getPresetDisplayTitle(preset: MatchPreset): string {
  if (preset.label?.trim()) {
    return preset.label.trim();
  }
  if (preset.match_type === 'singles') {
    return preset.opponent1?.name || '單打對手';
  }
  const partnerName = preset.partner?.name || '搭檔';
  if (preset.opponent1 && preset.opponent2) {
    return `搭 ${partnerName} vs ${preset.opponent1.name} / ${preset.opponent2.name}`;
  }
  return `搭 ${partnerName} · 自選對手`;
}

export function MatchPresetEditorModal({
  open,
  onOpenChange,
  editingPreset = null,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  editingPreset?: MatchPreset | null;
}) {
  const { data: currentUser } = useAuth();
  const createMutation = useCreateMatchPreset();
  const updateMutation = useUpdateMatchPreset();
  const labelInputId = React.useId();
  const searchInputId = React.useId();

  const initialMatchType: MatchType = editingPreset?.match_type ?? 'singles';
  const initialPartner = editingPreset?.partner?.id ?? null;
  const initialOpp1 = editingPreset?.opponent1?.id ?? null;
  const initialOpp2 = editingPreset?.opponent2?.id ?? null;

  const [matchType, setMatchType] = React.useState<MatchType>(initialMatchType);
  const [label, setLabel] = React.useState(editingPreset?.label ?? '');
  const [partnerId, setPartnerId] = React.useState<string | null>(initialPartner);
  const [opp1Id, setOpp1Id] = React.useState<string | null>(initialOpp1);
  const [opp2Id, setOpp2Id] = React.useState<string | null>(initialOpp2);
  const [activeSlot, setActiveSlot] = React.useState<ActiveSlot | null>(() =>
    findNextEmptySlot(initialPartner, initialOpp1, initialOpp2, initialMatchType)
  );
  const [searchTerm, setSearchTerm] = React.useState('');

  const { data: players = [], isPending: isPlayersLoading } = useQuery({
    queryKey: ['users'],
    queryFn: async () => {
      const res = await apiClient.get<UserOption[]>('/users');
      return res.data;
    },
    enabled: open && Boolean(currentUser),
  });

  const playerMap = React.useMemo(() => {
    const map = new Map<string, UserOption>();
    players.forEach((p) => map.set(String(p.id), p));
    return map;
  }, [players]);

  const myId = currentUser?.id ? String(currentUser.id) : '';
  const filteredPlayers = React.useMemo(() => {
    const q = searchTerm.trim().toLowerCase();
    return players.filter((p) => {
      if (String(p.id) === myId) return false;
      if (!q) return true;
      return (
        p.name.toLowerCase().includes(q) ||
        Boolean(p.department && p.department.toLowerCase().includes(q))
      );
    });
  }, [players, myId, searchTerm]);

  const partnerPlayer = partnerId ? playerMap.get(String(partnerId)) || editingPreset?.partner || null : null;
  const opp1Player = opp1Id ? playerMap.get(String(opp1Id)) || editingPreset?.opponent1 || null : null;
  const opp2Player = opp2Id ? playerMap.get(String(opp2Id)) || editingPreset?.opponent2 || null : null;

  const hasHalfOpponents = matchType === 'doubles' && Boolean(opp1Id) !== Boolean(opp2Id);
  const isValid =
    matchType === 'singles'
      ? Boolean(opp1Id)
      : Boolean(partnerId) && ((!opp1Id && !opp2Id) || (Boolean(opp1Id) && Boolean(opp2Id)));

  const handleSelectPlayer = (rawId: string) => {
    const playerId = String(rawId);

    if (matchType === 'doubles' && partnerId === playerId) {
      setPartnerId(null);
      setActiveSlot('partner');
      return;
    }
    if (opp1Id === playerId) {
      setOpp1Id(null);
      setActiveSlot('opp1');
      return;
    }
    if (matchType === 'doubles' && opp2Id === playerId) {
      setOpp2Id(null);
      setActiveSlot('opp2');
      return;
    }

    if (matchType === 'singles') {
      setOpp1Id(playerId);
      setActiveSlot(null);
      return;
    }

    const target =
      activeSlot || findNextEmptySlot(partnerId, opp1Id, opp2Id, 'doubles') || 'opp2';

    let nextPartner = partnerId;
    let nextOpp1 = opp1Id;
    let nextOpp2 = opp2Id;

    if (target === 'partner') {
      nextPartner = playerId;
      setPartnerId(playerId);
    } else if (target === 'opp1') {
      nextOpp1 = playerId;
      setOpp1Id(playerId);
    } else {
      nextOpp2 = playerId;
      setOpp2Id(playerId);
    }

    setActiveSlot(findNextEmptySlot(nextPartner, nextOpp1, nextOpp2, 'doubles'));
  };

  const isSaving = createMutation.isPending || updateMutation.isPending;

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!isValid || isSaving) return;

    const cleanLabel = label.trim() || null;
    const payload = {
      match_type: matchType,
      label: cleanLabel,
      partner_id: matchType === 'doubles' ? partnerId : null,
      opponent1_id: opp1Id,
      opponent2_id: matchType === 'doubles' ? opp2Id : null,
    };

    if (editingPreset) {
      updateMutation.mutate(
        { id: editingPreset.id, payload },
        {
          onSuccess: () => {
            toast.success('已更新常用組合');
            onOpenChange(false);
          },
        }
      );
    } else {
      createMutation.mutate(payload, {
        onSuccess: () => {
          onOpenChange(false);
        },
      });
    }
  };

  return (
    <ResponsiveFormModal
      open={open}
      onOpenChange={onOpenChange}
      size="lg"
      tone="gold"
      icon={<Star size={18} />}
      title={editingPreset ? '編輯常用約戰組合' : '新增常用約戰組合'}
      description="設定常打的單打對手、固定雙打搭檔，或直接指定 4 人雙打局。"
      onSubmit={handleSubmit}
      footer={
        <>
          <Button
            type="button"
            variant="outline"
            disabled={isSaving}
            onClick={() => onOpenChange(false)}
            className="w-full sm:w-auto h-11 px-5 rounded-xl border-border text-muted-foreground font-bold hover:bg-secondary hover:text-foreground"
          >
            取消
          </Button>
          <Button
            type="submit"
            disabled={!isValid || isSaving}
            className="w-full sm:w-auto h-11 px-6 rounded-xl bg-primary hover:opacity-90 text-primary-foreground font-display font-black text-sm disabled:opacity-40"
          >
            {isSaving ? '儲存中...' : editingPreset ? '儲存變更' : '加入常用'}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <Tabs
          value={matchType}
          onValueChange={(val) => {
            const nextType = val as MatchType;
            setMatchType(nextType);
            if (nextType === 'singles') {
              setPartnerId(null);
              setOpp2Id(null);
              setActiveSlot(opp1Id ? null : 'opp1');
            } else {
              setActiveSlot(findNextEmptySlot(partnerId, opp1Id, opp2Id, 'doubles'));
            }
          }}
        >
          <TabsList className="grid w-full grid-cols-2 rounded-2xl p-1 h-11 bg-secondary border border-border">
            <TabsTrigger
              value="singles"
              className="rounded-xl text-sm font-black data-active:bg-card data-active:text-foreground data-active:shadow-xs"
            >
              單打 1v1
            </TabsTrigger>
            <TabsTrigger
              value="doubles"
              className="rounded-xl text-sm font-black data-active:bg-card data-active:text-foreground data-active:shadow-xs"
            >
              雙打 2v2
            </TabsTrigger>
          </TabsList>
        </Tabs>

        <div>
          <label htmlFor={labelInputId} className="arena-label text-muted-foreground">
            組合暱稱（選填，最多 32 字）
          </label>
          <input
            id={labelInputId}
            type="text"
            maxLength={32}
            placeholder={
              matchType === 'doubles'
                ? '例：午休固定團、黃金雙打（留空將自動以姓名組合顯示）'
                : '例：午餐宿敵切磋（留空將顯示對方姓名）'
            }
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            className="arena-input"
          />
        </div>

        <section className="bg-surface-subtle/80 border border-border rounded-2xl p-3.5 space-y-2.5">
          <div className="grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-2 sm:gap-4">
            <p className="text-xs font-black text-muted-foreground">我方</p>
            <span className="text-xs font-black text-muted-foreground">VS</span>
            <p className="text-xs font-black text-muted-foreground text-right">
              {matchType === 'doubles' ? '對手（兩位皆不選＝固定搭檔）' : '對手'}
            </p>
          </div>

          <div className="grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-2 sm:gap-4">
            <div className="flex flex-col gap-1.5 min-w-0">
              <div className="flex items-center gap-2 min-h-11 px-2.5 py-2 rounded-xl bg-card border border-border min-w-0">
                <PlayerAvatar
                  src={currentUser?.avatar_url || currentUser?.avatar}
                  name={currentUser?.name || 'Me'}
                  className="size-7 rounded-lg text-xs"
                />
                <span className="text-xs sm:text-sm font-black text-foreground truncate">
                  {currentUser?.name || '我'}
                </span>
              </div>

              {matchType === 'doubles' && (
                <PresetSlotButton
                  label="選搭檔 (必填)"
                  badgeText="搭檔"
                  badgeClass="bg-amber-100 text-amber-700 dark:bg-amber-500/20 dark:text-amber-300"
                  player={partnerPlayer}
                  isActive={activeSlot === 'partner'}
                  onFocus={() => setActiveSlot('partner')}
                  onClear={() => {
                    setPartnerId(null);
                    setActiveSlot('partner');
                  }}
                />
              )}
            </div>

            <div className="flex items-center justify-center px-1 shrink-0">
              <Sparkles size={16} className="text-olympic-gold" aria-hidden="true" />
            </div>

            <div className="flex flex-col gap-1.5 min-w-0">
              <PresetSlotButton
                label={matchType === 'singles' ? '選對手 (必填)' : '對手 1 (選填)'}
                badgeText="對手"
                badgeClass="bg-blue-100 text-sapphire-blue dark:bg-blue-500/20 dark:text-blue-300"
                player={opp1Player}
                isActive={activeSlot === 'opp1'}
                onFocus={() => setActiveSlot('opp1')}
                onClear={() => {
                  setOpp1Id(null);
                  setActiveSlot('opp1');
                }}
              />

              {matchType === 'doubles' && (
                <PresetSlotButton
                  label="對手 2 (選填)"
                  badgeText="對手"
                  badgeClass="bg-blue-100 text-sapphire-blue dark:bg-blue-500/20 dark:text-blue-300"
                  player={opp2Player}
                  isActive={activeSlot === 'opp2'}
                  onFocus={() => setActiveSlot('opp2')}
                  onClear={() => {
                    setOpp2Id(null);
                    setActiveSlot('opp2');
                  }}
                />
              )}
            </div>
          </div>

          {hasHalfOpponents && (
            <p className="text-xs font-bold text-amber-600 dark:text-amber-300 pt-1">
              請再選 1 位對手完成 4 人局，或清除對手改存為「固定搭檔」組合。
            </p>
          )}
        </section>

        <section className="space-y-2.5">
          <div className="relative">
            <label htmlFor={searchInputId} className="sr-only">
              搜尋同仁
            </label>
            <Search
              size={16}
              className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none"
              aria-hidden="true"
            />
            <input
              id={searchInputId}
              type="search"
              autoComplete="off"
              spellCheck={false}
              placeholder="搜尋同仁姓名或處室..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="arena-input pl-10 pr-10"
            />
            {searchTerm && (
              <button
                type="button"
                aria-label="清除搜尋"
                onClick={() => setSearchTerm('')}
                className="absolute right-1.5 top-1/2 -translate-y-1/2 size-8 flex items-center justify-center rounded-lg text-muted-foreground hover:text-foreground hover:bg-secondary"
              >
                <X size={15} aria-hidden="true" />
              </button>
            )}
          </div>

          <div className="max-h-44 overflow-y-auto pr-1 grid grid-cols-2 sm:grid-cols-3 gap-2">
            {isPlayersLoading ? (
              <div className="col-span-full py-6 text-center text-sm font-bold text-muted-foreground">
                讀取同仁名單中...
              </div>
            ) : filteredPlayers.length === 0 ? (
              <div className="col-span-full py-6 text-center text-sm font-bold text-muted-foreground border border-dashed border-border rounded-xl">
                找不到符合條件的同仁
              </div>
            ) : (
              filteredPlayers.map((player) => {
                const pid = String(player.id);
                const isPartner = matchType === 'doubles' && partnerId === pid;
                const isOpponent = opp1Id === pid || (matchType === 'doubles' && opp2Id === pid);

                return (
                  <button
                    key={pid}
                    type="button"
                    onClick={() => handleSelectPlayer(pid)}
                    className={cn(
                      'flex items-center gap-2 p-2.5 rounded-xl border text-left transition-all min-h-12',
                      isPartner
                        ? 'bg-amber-50 border-amber-400 ring-1 ring-amber-300 dark:bg-amber-500/15 dark:border-amber-400/70'
                        : isOpponent
                          ? 'bg-blue-50 border-sapphire-blue ring-1 ring-sapphire-blue/30 dark:bg-blue-500/15 dark:border-blue-400/70'
                          : 'bg-card border-border hover:border-slate-400/60 hover:bg-secondary/60'
                    )}
                  >
                    <PlayerAvatar
                      src={player.avatar}
                      name={player.name}
                      className="size-8 rounded-lg border border-border text-xs"
                    />
                    <div className="min-w-0 flex-1">
                      <p className="text-xs sm:text-sm font-bold text-foreground truncate">
                        {player.name}
                      </p>
                      <p className="text-xs text-muted-foreground truncate">
                        {player.department || '一般同仁'}
                      </p>
                    </div>
                    {(isPartner || isOpponent) && (
                      <span
                        className={cn(
                          'px-1.5 py-0.5 rounded-md text-xs font-black shrink-0',
                          isPartner ? 'bg-olympic-gold text-white' : 'bg-sapphire-blue text-white'
                        )}
                      >
                        {isPartner ? '搭檔' : '對手'}
                      </span>
                    )}
                  </button>
                );
              })
            )}
          </div>
        </section>
      </div>
    </ResponsiveFormModal>
  );
}

function PresetSlotButton({
  label,
  badgeText,
  badgeClass,
  player,
  isActive,
  onFocus,
  onClear,
}: {
  label: string;
  badgeText: string;
  badgeClass: string;
  player: { id: string; name: string; avatar?: string | null } | null;
  isActive: boolean;
  onFocus: () => void;
  onClear: () => void;
}) {
  if (player) {
    return (
      <div
        className={cn(
          'flex items-center gap-2 min-h-11 px-2.5 py-1.5 rounded-xl bg-card border transition-all min-w-0',
          isActive ? 'border-sapphire-blue ring-2 ring-sapphire-blue/25' : 'border-border'
        )}
      >
        <button
          type="button"
          onClick={onFocus}
          className="flex items-center gap-2 flex-1 min-w-0 text-left"
        >
          <PlayerAvatar src={player.avatar} name={player.name} className="size-7 rounded-lg text-xs" />
          <span className="text-xs sm:text-sm font-black text-foreground truncate">
            {player.name}
          </span>
        </button>
        <span className={cn('hidden sm:inline px-1.5 py-0.5 rounded-md text-xs font-bold shrink-0', badgeClass)}>
          {badgeText}
        </span>
        <button
          type="button"
          aria-label={`移除${player.name}`}
          onClick={onClear}
          className="size-7 flex items-center justify-center rounded-lg text-muted-foreground hover:text-rose-600 dark:hover:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-500/15 shrink-0"
        >
          <X size={14} aria-hidden="true" />
        </button>
      </div>
    );
  }

  return (
    <button
      type="button"
      onClick={onFocus}
      className={cn(
        'flex items-center justify-center gap-1.5 min-h-11 px-2.5 rounded-xl border border-dashed text-xs font-bold transition-all w-full',
        isActive
          ? 'border-sapphire-blue bg-blue-50/70 dark:bg-blue-500/15 text-sapphire-blue dark:text-blue-300 ring-2 ring-sapphire-blue/20'
          : 'border-input bg-card/70 text-muted-foreground hover:border-sapphire-blue/50 hover:text-foreground'
      )}
    >
      <User size={13} aria-hidden="true" />
      <span className="truncate">+ {label}</span>
    </button>
  );
}

export function MatchPresetManagerModal({
  open,
  onOpenChange,
  presets,
  onCreateNew,
  onEdit,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  presets: MatchPreset[];
  onCreateNew: () => void;
  onEdit: (preset: MatchPreset) => void;
}) {
  const updateMutation = useUpdateMatchPreset();
  const deleteMutation = useDeleteMatchPreset();

  const minSortOrder =
    presets.length > 0 ? Math.min(...presets.map((p) => p.sort_order)) : 0;

  const handlePinTop = (preset: MatchPreset) => {
    updateMutation.mutate(
      {
        id: preset.id,
        payload: { sort_order: minSortOrder - 1 },
      },
      {
        onSuccess: () => {
          toast.success('已將該組合置頂');
        },
      }
    );
  };

  return (
    <ResponsiveFormModal
      open={open}
      onOpenChange={onOpenChange}
      size="md"
      tone="default"
      icon={<Users size={18} />}
      title="管理常用約戰組合"
      description="置頂、修改暱稱與成員，或移除不再使用的組合（跨裝置雲端同步）。"
      footer={
        <>
          <Button
            type="button"
            variant="outline"
            disabled={presets.length >= MAX_MATCH_PRESETS}
            onClick={() => {
              onOpenChange(false);
              onCreateNew();
            }}
            className="w-full sm:w-auto h-11 px-5 rounded-xl border-border text-sapphire-blue font-black hover:bg-sapphire-blue/10 gap-1.5"
          >
            <Plus size={15} aria-hidden="true" />
            新增組合 ({presets.length}/{MAX_MATCH_PRESETS})
          </Button>
          <Button
            type="button"
            onClick={() => onOpenChange(false)}
            className="w-full sm:w-auto h-11 px-6 rounded-xl bg-primary hover:opacity-90 text-primary-foreground font-display font-black text-sm"
          >
            完成
          </Button>
        </>
      }
    >
      <div className="space-y-2.5">
        {presets.length === 0 ? (
          <div className="py-10 px-4 text-center rounded-2xl bg-surface-subtle/80 border border-dashed border-border space-y-2">
            <Star size={28} className="mx-auto text-muted-foreground/40" aria-hidden="true" />
            <p className="text-sm font-bold text-foreground">尚未建立自訂組合</p>
            <p className="text-xs text-muted-foreground">
              可在主頁點擊「新增」或在報分完成時點擊「存為常用」，把常打球友釘選在最前方。
            </p>
          </div>
        ) : (
          presets.map((preset, index) => {
            const isFullDoubles =
              preset.match_type === 'doubles' &&
              Boolean(preset.opponent1) &&
              Boolean(preset.opponent2);
            const autoLineupText =
              preset.match_type === 'singles'
                ? preset.opponent1?.name || ''
                : isFullDoubles
                  ? `搭 ${preset.partner?.name ?? ''} vs ${preset.opponent1?.name ?? ''} / ${preset.opponent2?.name ?? ''}`
                  : `搭 ${preset.partner?.name ?? ''} · 自選對手`;

            return (
              <div
                key={preset.id}
                className="flex items-center justify-between gap-3 p-3 rounded-2xl bg-card border border-border"
              >
                <div className="flex items-center gap-3 min-w-0 flex-1">
                  <div className="flex -space-x-2 shrink-0">
                    {preset.partner && (
                      <PlayerAvatar
                        src={preset.partner.avatar}
                        name={preset.partner.name}
                        className="size-9 rounded-xl border-2 border-card text-xs"
                      />
                    )}
                    {preset.opponent1 && (
                      <PlayerAvatar
                        src={preset.opponent1.avatar}
                        name={preset.opponent1.name}
                        className="size-9 rounded-xl border-2 border-card text-xs"
                      />
                    )}
                    {preset.opponent2 && (
                      <PlayerAvatar
                        src={preset.opponent2.avatar}
                        name={preset.opponent2.name}
                        className="size-9 rounded-xl border-2 border-card text-xs"
                      />
                    )}
                  </div>

                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span
                        className={cn(
                          'px-1.5 py-0.5 rounded-md text-[11px] font-black',
                          preset.match_type === 'singles'
                            ? 'bg-blue-100 text-sapphire-blue dark:bg-blue-500/15 dark:text-blue-300'
                            : 'bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300'
                        )}
                      >
                        {preset.match_type === 'singles'
                          ? '單打'
                          : isFullDoubles
                            ? '雙打 4 人'
                            : '雙打搭檔'}
                      </span>
                      <p className="text-sm font-black text-foreground truncate">
                        {getPresetDisplayTitle(preset)}
                      </p>
                    </div>
                    {preset.label && (
                      <p className="text-xs text-muted-foreground font-medium truncate mt-0.5">
                        {autoLineupText}
                      </p>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-1 shrink-0">
                  {index > 0 && (
                    <button
                      type="button"
                      title="置頂"
                      aria-label={`將 ${getPresetDisplayTitle(preset)} 置頂`}
                      disabled={updateMutation.isPending}
                      onClick={() => handlePinTop(preset)}
                      className="size-9 rounded-xl flex items-center justify-center text-muted-foreground hover:text-sapphire-blue hover:bg-sapphire-blue/10 transition-colors"
                    >
                      <ArrowUpToLine size={15} aria-hidden="true" />
                    </button>
                  )}
                  <button
                    type="button"
                    title="編輯"
                    aria-label={`編輯 ${getPresetDisplayTitle(preset)}`}
                    onClick={() => {
                      onOpenChange(false);
                      onEdit(preset);
                    }}
                    className="size-9 rounded-xl flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors"
                  >
                    <Pencil size={15} aria-hidden="true" />
                  </button>
                  <button
                    type="button"
                    title="刪除"
                    aria-label={`刪除 ${getPresetDisplayTitle(preset)}`}
                    disabled={deleteMutation.isPending}
                    onClick={() => deleteMutation.mutate(preset.id)}
                    className="size-9 rounded-xl flex items-center justify-center text-muted-foreground hover:text-rose-600 dark:hover:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-500/15 transition-colors"
                  >
                    <Trash2 size={15} aria-hidden="true" />
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>
    </ResponsiveFormModal>
  );
}
