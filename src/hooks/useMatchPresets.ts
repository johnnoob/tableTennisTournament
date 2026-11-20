import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import apiClient from '@/utils/apiClient';
import type {
  MatchPreset,
  MatchPresetCreatePayload,
  MatchPresetUpdatePayload,
} from '@/types/api.types';

export const MATCH_PRESETS_QUERY_KEY = ['users', 'me', 'presets'] as const;
export const MAX_MATCH_PRESETS = 8;

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
