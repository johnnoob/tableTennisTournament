import { BrowserRouter as Router, Routes, Route, useLocation } from 'react-router-dom';
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
import { Toaster } from 'sonner';

import { ReportScore } from '@/components/ReportScore';
import { Button } from './components/ui/button';
import { Plus } from 'lucide-react';

function AppContent() {
  const location = useLocation();
  const isLoginPage = location.pathname === '/login';

  // 🌟 改用 React Query Hook 獲取使用者資料
  const { data: user, isLoading: loading } = useAuth();

  // 🌟 如果正在跟後端確認身分，顯示全域的載入畫面（防止畫面閃爍）
  if (loading && !isLoginPage) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="size-12 border-4 border-sapphire-blue/20 border-t-sapphire-blue rounded-full animate-spin" />
          <p className="font-black text-primary-navy tracking-widest uppercase text-sm">驗證身分中...</p>
        </div>
      </div>
    );
  }


  if (isLoginPage) {
    return (
      <Routes>
        <Route path="/login" element={<Login />} />
      </Routes>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 font-sans selection:bg-sapphire-blue/10 flex relative">

      {/* Navigation Layer (Contains Fixed Mobile & Desktop Navs) */}
      <Navigation />
      <GlobalPlayerDrawer />
      <Toaster richColors position="top-center" />

      {/* Main Content Area */}
      <main className="flex-1 w-full min-w-0 lg:ml-72 xl:ml-80 transition-all duration-300">
        <div className="min-h-screen bg-white lg:my-4 lg:mr-4 lg:rounded-[2.5rem] shadow-xl shadow-slate-200/50 relative border border-slate-100/50">
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/history" element={<MatchHistory />} />
            <Route path="/tournament" element={<Tournament />} />
            <Route path="/tournament/:id" element={<TournamentDetail />} />
            <Route path="/season/:id" element={<SeasonDetail />} />
            <Route path="/leaderboard" element={<Leaderboard />} />
            <Route path="/admin" element={<AdminDashboard />} />
            {/* Fallback to login if needed or just 404, here we just keep existing routes */}
          </Routes>
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

