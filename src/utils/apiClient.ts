import axios from 'axios';

// 🌟 無感刷新相關變數
let isRefreshing = false;
let failedQueue: any[] = [];

const processQueue = (error: any, token: string | null = null) => {
  failedQueue.forEach(prom => {
    if (error) {
      prom.reject(error);
    } else {
      prom.resolve(token);
    }
  });
  failedQueue = [];
};

const apiClient = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000/api',
  withCredentials: true, // 🌟 啟動 Cookie 憑證自動攜帶
});

// Response Interceptor: 攔截 401 Unauthorized 並執行自動刷新
apiClient.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;

    // 如果是 401 錯誤，且不是登入或刷新 API 本身，且尚未重試過
    if (
      error.response?.status === 401 && 
      !originalRequest._retry && 
      !originalRequest.url.includes('/auth/refresh') &&
      !originalRequest.url.includes('/auth/google/login')
    ) {
      
      // 如果已經在登入頁面，則不執行自動刷新邏輯，避免無窮重導向
      if (window.location.pathname === '/login') {
        return Promise.reject(error);
      }

      if (isRefreshing) {
        // 如果正在刷新中，將請求推進 Queue 等待
        return new Promise((resolve, reject) => {
          failedQueue.push({ resolve, reject });
        })
          .then(() => apiClient(originalRequest))
          .catch(err => Promise.reject(err));
      }

      originalRequest._retry = true;
      isRefreshing = true;

      try {
        // 🚀 執行換證
        await apiClient.post('/auth/refresh');
        
        isRefreshing = false;
        processQueue(null); // 通知 Queue 裡的所有請求可以重發了
        
        // 重發原本失敗的請求
        return apiClient(originalRequest);
      } catch (refreshError) {
        isRefreshing = false;
        processQueue(refreshError); // 換證失敗，通知 Queue 裡的請求也失敗
        
        // 真的完全過期或身分異常，導回登入頁
        if (window.location.pathname !== '/login') {
          window.location.href = '/login';
        }
        return Promise.reject(refreshError);
      }
    }

    return Promise.reject(error);
  }
);

export default apiClient;
