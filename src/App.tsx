import { useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, useLocation, useSearchParams } from 'react-router-dom';
import { Dashboard } from './pages/Dashboard';
import { MatchHistory } from './pages/MatchHistory';
import { Navigation } from './components/Navigation';
import { Login } from './pages/Login';

import { Tournament } from './pages/Tournament';
import { TournamentDetail } from './pages/TournamentDetail';
import { Leaderboard } from './pages/Leaderboard';
import { GlobalPlayerDrawer } from './components/GlobalPlayerDrawer';

import { useAuthStore } from '@/store/authStore';

function AppContent() {
  const [searchParams, setSearchParams] = useSearchParams();
  const location = useLocation();
  const isLoginPage = location.pathname === '/login';

  // 🌟 3. 從倉庫拿出 fetchUser 方法與 loading 狀態
  const { fetchUser, loading } = useAuthStore();

  // 🌟 4. 當整個網站第一次掛載時，執行身分驗證
  useEffect(() => {
    // 🌟 攔截 URL 中的 token 並存入 localStorage
    const token = searchParams.get('token');
    if (token) {
      localStorage.setItem('auth_token', token);
      // 清除 URL 參數，保持網址乾淨
      searchParams.delete('token');
      setSearchParams(searchParams, { replace: true });
    }
    fetchUser();
  }, [fetchUser, searchParams, setSearchParams]);

  // 🌟 5. 如果正在跟後端確認身分，顯示全域的載入畫面（防止畫面閃爍）
  if (loading) {
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

      {/* Main Content Area */}
      <main className="flex-1 w-full min-w-0 lg:ml-72 xl:ml-80 transition-all duration-300">
        <div className="min-h-screen bg-white lg:my-4 lg:mr-4 lg:rounded-[2.5rem] shadow-xl shadow-slate-200/50 overflow-hidden relative border border-slate-100/50">
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/history" element={<MatchHistory />} />
            <Route path="/tournament" element={<Tournament />} />
            <Route path="/tournament/:id" element={<TournamentDetail />} />
            <Route path="/leaderboard" element={<Leaderboard />} />
            {/* Fallback to login if needed or just 404, here we just keep existing routes */}
          </Routes>
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

