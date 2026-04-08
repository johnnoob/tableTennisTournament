import axios from 'axios';
import { toast } from 'sonner';

// 🌟 全域錯誤提示冷卻時間
let lastErrorToastTime = 0;
let lastErrorMessage = '';

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
          window.dispatchEvent(new CustomEvent('auth:unauthorized'));
        }
        return Promise.reject(refreshError);
      }
    }

    // Global Error Toasts: 攔截非 401 的錯誤並顯示提示
    if (error.response?.status !== 401) {
      let errorMessage = "網路連線異常，請檢查您的網路狀態";

      if (error.response) {
        const data = error.response.data;
        // 嘗試從 FastAPI 的 detail 欄位提取訊息
        if (data?.detail) {
          if (typeof data.detail === 'string') {
            errorMessage = data.detail;
          } else if (Array.isArray(data.detail)) {
            // FastAPI 驗證錯誤通常是陣列
            errorMessage = data.detail[0]?.msg || JSON.stringify(data.detail);
          }
        } else {
          // 根據 Status Code 給予預設提示
          switch (error.response.status) {
            case 400: errorMessage = "請求參數錯誤"; break;
            case 403: errorMessage = "無權限執行此操作"; break;
            case 404: errorMessage = "找不到要求的資源"; break;
            case 500: errorMessage = "伺服器發生異常，請稍後再試"; break;
            default: errorMessage = `發生錯誤 (${error.response.status})`; break;
          }
        }
      } else if (error.code === 'ECONNABORTED') {
        errorMessage = "請求超時，伺服器反應過慢";
      }

      // 🌟 簡單的防重複 Toast 邏輯：2秒內不重複顯示相同的錯誤訊息
      const now = Date.now();
      if (errorMessage !== lastErrorMessage || (now - lastErrorToastTime > 2000)) {
        toast.error(errorMessage);
        lastErrorMessage = errorMessage;
        lastErrorToastTime = now;
      }
    }

    return Promise.reject(error);
  }
);

export default apiClient;
