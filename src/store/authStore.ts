import { create } from 'zustand';
import apiClient from '@/utils/apiClient';

// 定義倉庫裡有哪些東西
interface AuthState {
    user: any;
    loading: boolean;
    fetchUser: () => Promise<void>;
    updateUser: (partial: Record<string, any>) => void;
    logout: () => void;
}

// 建立並匯出這個倉庫
export const useAuthStore = create<AuthState>((set) => ({
    user: null,
    loading: true,

    // 去後端抓使用者的動作
    fetchUser: async () => {
        const token = localStorage.getItem('auth_token');
        if (!token) {
            set({ loading: false }); // 沒 token 就直接結束 loading
            return;
        }

        try {
            const res = await apiClient.get('/users/me');
            set({ user: res.data, loading: false }); // 把抓到的資料存進倉庫
        } catch (err) {
            console.error("獲取身分失敗", err);
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
    logout: () => {
        localStorage.removeItem('auth_token');
        set({ user: null });
        window.location.href = '/login';
    }
}));