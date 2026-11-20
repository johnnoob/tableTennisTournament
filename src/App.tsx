import { useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, useLocation, useNavigate } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { Dashboard } from '@/pages/Dashboard';
import { MatchHistory } from '@/pages/MatchHistory';
import { Navigation } from '@/components/Navigation';
import { Login } from '@/pages/Login';

import { Tournament } from '@/pages/Tournament';
import { TournamentDetail } from '@/pages/TournamentDetail';
import { SeasonDetail } from '@/pages/SeasonDetail';
import { Leaderboard } from '@/pages/Leaderboard';
import { AdminDashboard } from '@/pages/AdminDashboard';
import { GlobalPlayerDrawer } from './components/GlobalPlayerDrawer';

import { useAuth } from '@/hooks/useAuth';
import { useTheme } from '@/contexts/theme-context';
import { toast, Toaster } from 'sonner';

import PingPongLoader from '@/components/PingPongLoader';

function AppContent() {
  const location = useLocation();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const isLoginPage = location.pathname === '/login';

  // 監聽全局 401 事件 (auth:unauthorized)
  useEffect(() => {
    const handleUnauthorized = () => {
      queryClient.clear();
      navigate('/login');
    };

    window.addEventListener('auth:unauthorized', handleUnauthorized);
    return () => {
      window.removeEventListener('auth:unauthorized', handleUnauthorized);
    };
  }, [navigate, queryClient]);

  // 監聽全局 API 錯誤事件 (api:error)，由 UI 層負責渲染 toast
  useEffect(() => {
    const handleApiError = (e: Event) => {
      toast.error((e as CustomEvent<string>).detail);
    };

    window.addEventListener('api:error', handleApiError);
    return () => {
      window.removeEventListener('api:error', handleApiError);
    };
  }, []);

  // 🌟 改用 React Query Hook 獲取使用者資料
  const { isLoading: loading } = useAuth();
  const { resolvedTheme } = useTheme();

  // ──────────────────────────────────────────────
  // Login 頁面 — 滿版設計，不渲染 Navigation
  // ──────────────────────────────────────────────
  if (isLoginPage) {
    return (
      <>
        <Toaster richColors position="top-center" theme={resolvedTheme} />
        <Routes>
          <Route path="/login" element={<Login />} />
        </Routes>
      </>
    );
  }

  // ──────────────────────────────────────────────
  // App Shell — Navigation 永遠可見，Loading 僅影響主內容
  // ──────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-background font-sans selection:bg-sapphire-blue/15 flex relative">

      {/* Navigation Layer (Contains Fixed Mobile & Desktop Navs) */}
      <Navigation />
      <GlobalPlayerDrawer />
      <Toaster richColors position="top-center" theme={resolvedTheme} />

      {/* Main Content Area */}
      <main className="flex-1 w-full min-w-0 pt-16 lg:pt-0 lg:ml-64 transition-all duration-300">
        <div className="min-h-[calc(100dvh-4rem)] lg:min-h-[calc(100dvh-2rem)] bg-surface-shell lg:my-4 lg:mr-4 lg:rounded-[2rem] lg:shadow-sm dark:lg:shadow-black/40 relative lg:border lg:border-border overflow-x-clip">

          {/* 🌟 局部 Loading：身分驗證中，僅主內容區顯示桌球動畫 */}
          {loading ? (
            <div className="flex items-center justify-center min-h-[calc(100dvh-6rem)]">
              <PingPongLoader />
            </div>
          ) : (
            <Routes>
              <Route path="/" element={<Dashboard />} />
              <Route path="/history" element={<MatchHistory />} />
              <Route path="/tournament" element={<Tournament />} />
              <Route path="/tournament/:id" element={<TournamentDetail />} />
              <Route path="/season/:id" element={<SeasonDetail />} />
              <Route path="/leaderboard" element={<Leaderboard />} />
              <Route path="/admin" element={<AdminDashboard />} />
              {/* Catch-all: 任何未知路由（例如 /hof）都導向首頁，防止空白畫面 */}
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          )}

        </div>
      </main>
    </div>
  );
}

function App() {
  return (
    <Router>
      <AppContent />
    </Router>
  );
}

export default App;
