import { useMemo } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import apiClient from '@/utils/apiClient';
import type {
  MatchFeedItem,
  MatchHistoryResponse,
  MatchPreset,
  MatchPresetCreatePayload,
  MatchPresetPlayer,
  MatchPresetUpdatePayload,
  PartnersResponse,
  RivalsResponse,
} from '@/types/api.types';

export const MATCH_PRESETS_QUERY_KEY = ['users', 'me', 'presets'] as const;
export const MY_QUICK_MATCHES_QUERY_KEY = ['users', 'me', 'matches', 'quick-suggest'] as const;
export const MAX_MATCH_PRESETS = 8;

const EMPTY_RIVALS: RivalsResponse = { nemesis: [], minions: [] };
const EMPTY_PARTNERS: PartnersResponse = { golden_partners: [], worst_partners: [] };
const EMPTY_FEED: MatchFeedItem[] = [];

export interface QuickMatchCardItem {
  key: string;
  signature: string;
  isCustom: boolean;
  label?: string | null;
  matchType: 'singles' | 'doubles';
  partner: MatchPresetPlayer | null;
  opponent1: MatchPresetPlayer | null;
  opponent2: MatchPresetPlayer | null;
  matchCount?: number;
}

interface ErrorDetailShape {
  response?: {
    data?: {
      detail?: string;
    };
  };
  message?: string;
}

function getApiErrorMessage(error: unknown, fallback: string): string {
  const err = error as ErrorDetailShape;
  if (typeof err?.response?.data?.detail === 'string' && err.response.data.detail) {
    return err.response.data.detail;
  }
  if (typeof err?.message === 'string' && err.message) {
    return err.message;
  }
  return fallback;
}

export function getMatchupSignature({
  matchType,
  partnerId,
  opponent1Id,
  opponent2Id,
}: {
  matchType: 'singles' | 'doubles';
  partnerId?: string | null;
  opponent1Id?: string | null;
  opponent2Id?: string | null;
}): string {
  if (matchType === 'singles') {
    return `singles:${opponent1Id ? String(opponent1Id) : ''}`;
  }
  const cleanPartner = partnerId ? String(partnerId) : '';
  if (opponent1Id && opponent2Id) {
    const sortedOpps = [String(opponent1Id), String(opponent2Id)].sort().join('+');
    return `doubles:${cleanPartner}:${sortedOpps}`;
  }
  return `doubles:${cleanPartner}:open`;
}

export function getPresetSignature(preset: MatchPreset): string {
  return getMatchupSignature({
    matchType: preset.match_type,
    partnerId: preset.partner?.id ?? null,
    opponent1Id: preset.opponent1?.id ?? null,
    opponent2Id: preset.opponent2?.id ?? null,
  });
}

export function formatQuickMatchLabel(item: QuickMatchCardItem): string {
  if (item.label?.trim()) {
    return item.label.trim();
  }
  if (item.matchType === 'singles') {
    return item.opponent1?.name || '單打對手';
  }
  const partnerName = item.partner?.name || '搭檔';
  if (item.opponent1 && item.opponent2) {
    return `搭 ${partnerName} vs ${item.opponent1.name}/${item.opponent2.name}`;
  }
  return `搭 ${partnerName} · 自選對手`;
}

export function useMatchPresets(enabled: boolean) {
  return useQuery<MatchPreset[]>({
    queryKey: MATCH_PRESETS_QUERY_KEY,
    queryFn: async () => {
      const res = await apiClient.get<MatchPreset[]>('/users/me/presets');
      return res.data;
    },
    enabled,
  });
}

export function useQuickMatchItems({
  enabled,
  userId,
  rivals = EMPTY_RIVALS,
  partners = EMPTY_PARTNERS,
  recentFeed = EMPTY_FEED,
}: {
  enabled: boolean;
  userId?: string | null;
  rivals?: RivalsResponse;
  partners?: PartnersResponse;
  recentFeed?: MatchFeedItem[];
}) {
  const { data: customPresets = [] } = useMatchPresets(enabled);

  const { data: myRecentMatchesData } = useQuery<MatchHistoryResponse>({
    queryKey: MY_QUICK_MATCHES_QUERY_KEY,
    queryFn: async () => {
      const res = await apiClient.get<MatchHistoryResponse>('/users/me/matches?limit=30');
      return res.data;
    },
    enabled,
    staleTime: 30000,
  });

  const myId = userId ? String(userId) : '';

  const items = useMemo<QuickMatchCardItem[]>(() => {
    if (!myId) return [];
    const seenSignatures = new Set<string>();
    const customItems: QuickMatchCardItem[] = [];

    // 1. 使用者自訂組合優先置頂
    customPresets.forEach((preset) => {
      const sig = getPresetSignature(preset);
      seenSignatures.add(sig);
      customItems.push({
        key: `custom-${preset.id}`,
        signature: sig,
        isCustom: true,
        label: preset.label,
        matchType: preset.match_type,
        partner: preset.partner ?? null,
        opponent1: preset.opponent1 ?? null,
        opponent2: preset.opponent2 ?? null,
      });
    });

    // 2. 從個人最近 30 場歷史戰績統計常打雙打 4 人組合與常打單打對手
    const doublesMap = new Map<
      string,
      {
        partner: MatchPresetPlayer;
        opponent1: MatchPresetPlayer;
        opponent2: MatchPresetPlayer;
        count: number;
      }
    >();
    const singlesMap = new Map<
      string,
      {
        opponent: MatchPresetPlayer;
        count: number;
      }
    >();

    const personalMatches = myRecentMatchesData?.matches ?? [];
    personalMatches.forEach((match) => {
      if (match.status === 'disputed') return;
      const p1List = match.player1 || [];
      const oppList = match.opponent || [];
      const amInPlayer1 = p1List.some((p) => String(p.id) === myId);
      const amInOpponent = oppList.some((p) => String(p.id) === myId);
      if (!amInPlayer1 && !amInOpponent) return;

      const myTeam = amInPlayer1 ? p1List : oppList;
      const enemyTeam = amInPlayer1 ? oppList : p1List;

      if (match.type === 'doubles' && enemyTeam.length >= 2) {
        const myPartner = myTeam.find((p) => String(p.id) !== myId);
        if (!myPartner || !enemyTeam[0] || !enemyTeam[1]) return;

        const sortedOpps = [enemyTeam[0], enemyTeam[1]].sort((a, b) =>
          String(a.id).localeCompare(String(b.id))
        );
        const sig = getMatchupSignature({
          matchType: 'doubles',
          partnerId: String(myPartner.id),
          opponent1Id: String(sortedOpps[0].id),
          opponent2Id: String(sortedOpps[1].id),
        });
        const existing = doublesMap.get(sig);
        if (existing) {
          existing.count += 1;
        } else {
          doublesMap.set(sig, {
            partner: { id: String(myPartner.id), name: myPartner.name, avatar: myPartner.avatar },
            opponent1: {
              id: String(sortedOpps[0].id),
              name: sortedOpps[0].name,
              avatar: sortedOpps[0].avatar,
            },
            opponent2: {
              id: String(sortedOpps[1].id),
              name: sortedOpps[1].name,
              avatar: sortedOpps[1].avatar,
            },
            count: 1,
          });
        }
      } else if (match.type === 'singles' && enemyTeam[0]) {
        const enemy = enemyTeam[0];
        const enemyId = String(enemy.id);
        if (enemyId === myId) return;
        const sig = getMatchupSignature({ matchType: 'singles', opponent1Id: enemyId });
        const existing = singlesMap.get(sig);
        if (existing) {
          existing.count += 1;
        } else {
          singlesMap.set(sig, {
            opponent: { id: enemyId, name: enemy.name, avatar: enemy.avatar },
            count: 1,
          });
        }
      }
    });

    const autoDoubles: QuickMatchCardItem[] = [];
    Array.from(doublesMap.entries())
      .sort((a, b) => b[1].count - a[1].count)
      .forEach(([sig, val]) => {
        if (seenSignatures.has(sig) || autoDoubles.length >= 4) return;
        seenSignatures.add(sig);
        autoDoubles.push({
          key: `auto-${sig}`,
          signature: sig,
          isCustom: false,
          matchType: 'doubles',
          partner: val.partner,
          opponent1: val.opponent1,
          opponent2: val.opponent2,
          matchCount: val.count,
        });
      });

    // 若雙打 4 人固定局不足，從黃金搭檔補入「固定搭檔」卡片
    if (autoDoubles.length < 2) {
      partners.golden_partners.forEach((p) => {
        const partnerId = String(p.id);
        if (partnerId === myId || autoDoubles.length >= 2) return;
        const sig = getMatchupSignature({ matchType: 'doubles', partnerId });
        if (seenSignatures.has(sig)) return;
        seenSignatures.add(sig);
        autoDoubles.push({
          key: `auto-${sig}`,
          signature: sig,
          isCustom: false,
          matchType: 'doubles',
          partner: { id: partnerId, name: p.name, avatar: p.avatar },
          opponent1: null,
          opponent2: null,
          matchCount: p.matches,
        });
      });
    }

    const autoSingles: QuickMatchCardItem[] = [];
    Array.from(singlesMap.entries())
      .sort((a, b) => b[1].count - a[1].count)
      .forEach(([sig, val]) => {
        if (seenSignatures.has(sig) || autoSingles.length >= 6) return;
        seenSignatures.add(sig);
        autoSingles.push({
          key: `auto-${sig}`,
          signature: sig,
          isCustom: false,
          matchType: 'singles',
          partner: null,
          opponent1: val.opponent,
          opponent2: null,
          matchCount: val.count,
        });
      });

    if (autoSingles.length < 4) {
      const addFallbackSingle = (
        id?: string,
        name?: string,
        avatar?: string | null,
        count?: number
      ) => {
        if (!id || !name || autoSingles.length >= 6) return;
        const cleanId = String(id);
        if (cleanId === myId) return;
        const sig = getMatchupSignature({ matchType: 'singles', opponent1Id: cleanId });
        if (seenSignatures.has(sig)) return;
        seenSignatures.add(sig);
        autoSingles.push({
          key: `auto-${sig}`,
          signature: sig,
          isCustom: false,
          matchType: 'singles',
          partner: null,
          opponent1: { id: cleanId, name, avatar },
          opponent2: null,
          matchCount: count,
        });
      };

      rivals.nemesis.forEach((p) => addFallbackSingle(p.id, p.name, p.avatar, p.matches));
      rivals.minions.forEach((p) => addFallbackSingle(p.id, p.name, p.avatar, p.matches));
      recentFeed.forEach((match) => {
        [...(match.player1 || []), ...(match.opponent || [])].forEach((p) =>
          addFallbackSingle(p.id, p.name, p.avatar)
        );
      });
    }

    const autoMerged: QuickMatchCardItem[] = [];
    const maxLen = Math.max(autoDoubles.length, autoSingles.length);
    for (let i = 0; i < maxLen && autoMerged.length < 8; i++) {
      if (i < autoSingles.length && autoMerged.length < 8) autoMerged.push(autoSingles[i]);
      if (i < autoDoubles.length && autoMerged.length < 8) autoMerged.push(autoDoubles[i]);
    }

    return [...customItems, ...autoMerged];
  }, [myId, customPresets, myRecentMatchesData, partners, rivals, recentFeed]);

  return { items, customPresets };
}

export function useCreateMatchPreset() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (payload: MatchPresetCreatePayload) => {
      const res = await apiClient.post<MatchPreset>('/users/me/presets', payload);
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: MATCH_PRESETS_QUERY_KEY });
      toast.success('已加入常用約戰組合');
    },
    onError: (error: unknown) => {
      toast.error(getApiErrorMessage(error, '加入常用組合失敗'));
    },
  });
}

export function useUpdateMatchPreset() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      id,
      payload,
    }: {
      id: string;
      payload: MatchPresetUpdatePayload;
    }) => {
      const res = await apiClient.patch<MatchPreset>(`/users/me/presets/${id}`, payload);
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: MATCH_PRESETS_QUERY_KEY });
    },
    onError: (error: unknown) => {
      toast.error(getApiErrorMessage(error, '更新常用組合失敗'));
    },
  });
}

export function useDeleteMatchPreset() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      await apiClient.delete(`/users/me/presets/${id}`);
      return id;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: MATCH_PRESETS_QUERY_KEY });
      toast.success('已刪除常用組合');
    },
    onError: (error: unknown) => {
      toast.error(getApiErrorMessage(error, '刪除常用組合失敗'));
    },
  });
}
