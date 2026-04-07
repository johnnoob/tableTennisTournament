import { create } from 'zustand';
import apiClient from '@/utils/apiClient';

/**
 * AuthStore - 心跳與純 UI 客戶端狀態
 * 
 * 經過 React Query 重構後，所有伺服器狀態（User Profile）已轉移至 useAuth()。
 * 這裡僅保留：
 * 1. 登出邏輯 (需要清除元件狀態與 Cookie)
 */

interface AuthState {
  logout: () => Promise<void>;
}

export const useAuthStore = create<AuthState>(() => ({
  /**
   * 登出方法
   * 呼叫後端 API 清除 Session Cookie，並導向登入頁面
   */
  logout: async () => {
    try {
      await apiClient.post('/auth/logout');
    } catch (error) {
      console.error('Logout error:', error);
    } finally {
      // 無論 API 成功與否，前端都進行跳轉
      window.location.href = '/login';
    }
  },
}));