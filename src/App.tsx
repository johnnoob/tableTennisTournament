import { BrowserRouter as Router, Routes, Route, useLocation } from 'react-router-dom';
import { Dashboard } from './pages/Dashboard';
import { MatchHistory } from './pages/MatchHistory';
import { Navigation } from './components/Navigation';
import { Login } from './pages/Login';

import { Tournament } from './pages/Tournament';
import { TournamentDetail } from './pages/TournamentDetail';
import { Leaderboard } from './pages/Leaderboard';
import { GlobalPlayerDrawer } from './components/GlobalPlayerDrawer';

function AppContent() {
  const location = useLocation();
  const isLoginPage = location.pathname === '/login';

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

