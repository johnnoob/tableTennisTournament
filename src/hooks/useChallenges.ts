import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import apiClient from '@/utils/apiClient';
import type {
  ChallengeItem,
  MyChallengesResponse,
  PublicChallengeItem,
} from '@/types/api.types';

interface ApiErrorShape {
  response?: {
    data?: {
      detail?: string;
    };
  };
  message?: string;
}

function getErrorDetail(err: unknown, fallback: string): string {
  const typed = err as ApiErrorShape;
  return typed?.response?.data?.detail || typed?.message || fallback;
}

function invalidateChallengeQueries(queryClient: ReturnType<typeof useQueryClient>) {
  queryClient.invalidateQueries({ queryKey: ['challenges', 'mine'] });
  queryClient.invalidateQueries({ queryKey: ['challenges', 'public'] });
  queryClient.invalidateQueries({ queryKey: ['notifications'] });
}

export function useMyChallenges(enabled: boolean) {
  return useQuery<MyChallengesResponse>({
    queryKey: ['challenges', 'mine'],
    queryFn: async () => {
      const res = await apiClient.get<MyChallengesResponse>('/challenges/mine');
      return res.data;
    },
    enabled,
    refetchInterval: 15000,
  });
}

export function usePublicChallenges() {
  return useQuery<PublicChallengeItem[]>({
    queryKey: ['challenges', 'public'],
    queryFn: async () => {
      const res = await apiClient.get<PublicChallengeItem[]>('/challenges/public');
      return res.data;
    },
    refetchInterval: 20000,
  });
}

export interface CreateChallengePayload {
  challenged_id: string;
  match_type: 'singles' | 'doubles';
  format: 'BO3' | 'BO5';
  challenger_partner_id?: string | null;
  challenged_partner_id?: string | null;
  proposed_at: string;
  location?: string | null;
  message?: string | null;
  is_public: boolean;
}

export function useCreateChallenge() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (payload: CreateChallengePayload) => {
      const res = await apiClient.post<ChallengeItem>('/challenges', payload, {
        skipGlobalErrorToast: true,
      });
      return res.data;
    },
    onSuccess: () => {
      invalidateChallengeQueries(queryClient);
      toast.success('⚔️ 已發出戰帖，對方上線即可接戰或協調時間！');
    },
    onError: (err: unknown) => {
      toast.error(getErrorDetail(err, '送出戰帖失敗，請稍後再試'));
    },
  });
}

export function useAcceptChallenge() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      challengeId,
      challengedPartnerId,
    }: {
      challengeId: string;
      challengedPartnerId?: string | null;
    }) => {
      const res = await apiClient.post<ChallengeItem>(
        `/challenges/${challengeId}/accept`,
        challengedPartnerId ? { challenged_partner_id: challengedPartnerId } : {},
        { skipGlobalErrorToast: true }
      );
      return res.data;
    },
    onSuccess: () => {
      invalidateChallengeQueries(queryClient);
      toast.success('✅ 已接下戰帖！約戰正式成立');
    },
    onError: (err: unknown) => {
      toast.error(getErrorDetail(err, '接受挑戰失敗，請稍後再試'));
    },
  });
}

export function useCounterChallenge() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      challengeId,
      proposed_at,
      location,
      message,
    }: {
      challengeId: string;
      proposed_at: string;
      location?: string | null;
      message?: string | null;
    }) => {
      const res = await apiClient.post<ChallengeItem>(
        `/challenges/${challengeId}/counter`,
        { proposed_at, location, message },
        { skipGlobalErrorToast: true }
      );
      return res.data;
    },
    onSuccess: () => {
      invalidateChallengeQueries(queryClient);
      toast.success('🕒 已送出新的約戰時間提案！');
    },
    onError: (err: unknown) => {
      toast.error(getErrorDetail(err, '改約時間失敗，請稍後再試'));
    },
  });
}

export function useDeclineChallenge() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      challengeId,
      reason,
    }: {
      challengeId: string;
      reason?: string | null;
    }) => {
      const res = await apiClient.post<ChallengeItem>(
        `/challenges/${challengeId}/decline`,
        reason ? { reason } : {},
        { skipGlobalErrorToast: true }
      );
      return res.data;
    },
    onSuccess: () => {
      invalidateChallengeQueries(queryClient);
      toast.info('已回覆婉拒此戰帖');
    },
    onError: (err: unknown) => {
      toast.error(getErrorDetail(err, '婉拒戰帖失敗，請稍後再試'));
    },
  });
}

export function useCancelChallenge() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (challengeId: string) => {
      const res = await apiClient.post<ChallengeItem>(
        `/challenges/${challengeId}/cancel`,
        {},
        { skipGlobalErrorToast: true }
      );
      return res.data;
    },
    onSuccess: () => {
      invalidateChallengeQueries(queryClient);
      toast.info('已取消此筆約戰');
    },
    onError: (err: unknown) => {
      toast.error(getErrorDetail(err, '取消約戰失敗，請稍後再試'));
    },
  });
}

export function useCompleteChallenge() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (challengeId: string) => {
      const res = await apiClient.post<ChallengeItem>(
        `/challenges/${challengeId}/complete`,
        {},
        { skipGlobalErrorToast: true }
      );
      return res.data;
    },
    onSuccess: () => {
      invalidateChallengeQueries(queryClient);
      toast.success('🏓 本次約戰已結束並歸檔！');
    },
    onError: (err: unknown) => {
      toast.error(getErrorDetail(err, '結束約戰失敗，請稍後再試'));
    },
  });
}
