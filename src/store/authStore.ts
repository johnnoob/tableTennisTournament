import { create } from 'zustand';

// 定義倉庫裡有哪些東西
interface AuthState {
    user: any;
    loading: boolean;
    fetchUser: () => Promise<void>;
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
            const res = await fetch("http://localhost:8000/api/users/me", {
                headers: { "Authorization": `Bearer ${token}` }
            });
            if (res.ok) {
                const data = await res.json();
                set({ user: data, loading: false }); // 把抓到的資料存進倉庫
            } else {
                localStorage.removeItem('auth_token');
                set({ loading: false });
            }
        } catch (err) {
            console.error("獲取身分失敗", err);
            set({ loading: false });
        }
    },

    // 登出動作
    logout: () => {
        localStorage.removeItem('auth_token');
        set({ user: null });
        window.location.href = '/login';
    }
}));