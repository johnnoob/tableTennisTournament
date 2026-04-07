import { useQuery } from '@tanstack/react-query';
import apiClient from '@/utils/apiClient';

/**
 * useAuth Hook
 * 
 * 負責從伺服器端獲取當前登入的使用者資訊。
 * 這是系統唯一的伺服器狀態來源，取代了原本 Zustand 的 fetchUser 邏輯。
 */
export function useAuth() {
  return useQuery({
    queryKey: ['authUser'],
    queryFn: async () => {
      try {
        const res = await apiClient.get('/users/me');
        return res.data;
      } catch (error: any) {
        // 如果是 401 錯誤，代表未登入，這裡回傳 null
        if (error.response?.status === 401) {
          return null;
        }
        throw error;
      }
    },
    // 每 15 秒背景自動同步一次使用者狀態 (如 LP, MMR 等)
    refetchInterval: 15000,
    // 5 秒內資料視為最新，避免頻繁導覽切換時重複請求
    staleTime: 5000,
    // 未登入或 API 失敗時，不自動重試多次，避免造成過多連線
    retry: false,
  });
}
