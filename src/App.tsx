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
import { toast, Toaster } from 'sonner';

import { ReportScore } from '@/components/ReportScore';
import { Button } from './components/ui/button';
import { Plus } from 'lucide-react';
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
  const { data: user, isLoading: loading } = useAuth();

  // ──────────────────────────────────────────────
  // Login 頁面 — 滿版設計，不渲染 Navigation
  // ──────────────────────────────────────────────
  if (isLoginPage) {
    return (
      <Routes>
        <Route path="/login" element={<Login />} />
      </Routes>
    );
  }

  // ──────────────────────────────────────────────
  // App Shell — Navigation 永遠可見，Loading 僅影響主內容
  // ──────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-slate-50 font-sans selection:bg-sapphire-blue/10 flex relative">

      {/* Navigation Layer (Contains Fixed Mobile & Desktop Navs) */}
      <Navigation />
      <GlobalPlayerDrawer />
      <Toaster richColors position="top-center" />

      {/* Main Content Area */}
      <main className="flex-1 w-full min-w-0 lg:ml-72 xl:ml-80 transition-all duration-300">
        <div className="min-h-screen bg-white lg:my-4 lg:mr-4 lg:rounded-[2.5rem] shadow-xl shadow-slate-200/50 relative border border-slate-100/50">

          {/* 🌟 局部 Loading：身分驗證中，僅主內容區顯示桌球動畫 */}
          {loading ? (
            <div className="flex items-center justify-center min-h-screen">
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
      {/* 🌟全域懸浮報分按鈕 (Global Floating Action Button) */}
      {/* 判斷：必須是登入狀態，且不能在登入頁面，才會顯示 */}
      {user && !isLoginPage && (
        <div className="fixed bottom-24 right-6 lg:bottom-10 lg:right-12 z-[100] lg:hidden">
          <ReportScore
            trigger={
              <Button className="size-14 lg:size-16 rounded-full bg-sapphire-blue shadow-xl shadow-sapphire-blue/40 border-none group transition-all duration-300 hover:scale-110 active:scale-95">
                <Plus size={28} className="text-white transform group-hover:rotate-90 transition-transform duration-300" />
              </Button>
            }
          />
        </div>
      )}

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
