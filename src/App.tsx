import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { Dashboard } from './pages/Dashboard';
import { MatchHistory } from './pages/MatchHistory';
import { Navigation } from './components/Navigation';

import { Tournament } from './pages/Tournament';
import { TournamentDetail } from './pages/TournamentDetail';
import { HallOfFame } from './pages/HallOfFame';

function App() {
  return (
    <Router>
      <div className="min-h-screen bg-slate-50 font-sans selection:bg-electric-blue/10 flex relative">
        
        {/* Navigation Layer (Contains Fixed Mobile & Desktop Navs) */}
        <Navigation />

        {/* Main Content Area */}
        <main className="flex-1 w-full min-w-0 lg:ml-72 xl:ml-80 transition-all duration-300">
          <div className="min-h-screen bg-white lg:my-4 lg:mr-4 lg:rounded-[2.5rem] shadow-xl shadow-slate-200/50 overflow-hidden relative border border-slate-100/50">
            <Routes>
              <Route path="/" element={<Dashboard />} />
              <Route path="/history" element={<MatchHistory />} />
              <Route path="/tournament" element={<Tournament />} />
              <Route path="/tournament/:id" element={<TournamentDetail />} />
              <Route path="/hof" element={<HallOfFame />} />
            </Routes>
          </div>
        </main>

      </div>
    </Router>
  );
}

export default App;
