import { create } from 'zustand';
import apiClient from '@/utils/apiClient';

// 定義倉庫裡有哪些東西
interface AuthState {
    user: any;
    loading: boolean;
    fetchUser: () => Promise<void>;
    updateUser: (partial: Record<string, any>) => void;
    logout: () => Promise<void>;
}

// 建立並匯出這個倉庫
export const useAuthStore = create<AuthState>((set) => ({
    user: null,
    loading: true,

    // 去後端抓使用者的動作
    fetchUser: async () => {
        // 🌟 不再檢查 localStorage，直接打 API 讓後端驗證 Cookie
        try {
            const res = await apiClient.get('/users/me');
            set({ user: res.data, loading: false }); // 把抓到的資料存進倉庫
        } catch (err) {
            // 如果 401，apiClient 的攔截器會處理導向
            set({ loading: false });
        }
    },

    // 本地更新使用者資料（儲存成功後呼叫）
    updateUser: (partial: Record<string, any>) => {
        set((state: AuthState) => ({
            user: state.user ? { ...state.user, ...partial } : state.user
        }));
    },

    // 登出動作
    logout: async () => {
        try {
            await apiClient.post('/auth/logout'); // 🌟 呼叫後端 API 清除 Cookie
        } catch (err) {
            console.error("登出失敗", err);
        }
        set({ user: null });
        window.location.href = '/login';
    }
}));