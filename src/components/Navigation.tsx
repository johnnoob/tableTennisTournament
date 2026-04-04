import { NavLink } from 'react-router-dom';
import { LayoutDashboard, History, Trophy, Crown, Plus, Shield, Settings, LayoutGrid } from 'lucide-react';
import { cn } from '@/lib/utils';
import { ReportScore } from './ReportScore';
import { Button } from './ui/button';
import { UserProfileSettings } from './UserProfileSettings';
import { useAuthStore } from '@/store/authStore';

const navItems = [
  { icon: LayoutDashboard, label: 'Dashboard', path: '/' },
  { icon: History, label: 'Matches', path: '/history' },
  { icon: Trophy, label: 'Tournament', path: '/tournament' },
  { icon: LayoutGrid, label: 'Leaderboard', path: '/leaderboard' },
];

export function Navigation() {
  const { user } = useAuthStore();
  const isAdmin = user?.role === 'admin';

  const displayedNavItems = isAdmin 
    ? [...navItems, { icon: Shield, label: 'Admin', path: '/admin' }]
    : navItems;

  return (
    <>
      {/* Mobile Bottom Navigation (Glassmorphism & Interactive) */}
      <nav
        className={cn(
          "fixed bottom-0 left-0 right-0 bg-white/70 backdrop-blur-2xl border-t border-slate-200/40 z-60 lg:hidden px-6",
          "h-[calc(4.5rem+env(safe-area-inset-bottom,0px))]"
        )}
      >
        <div className="max-w-md mx-auto h-full flex items-center justify-between pb-[env(safe-area-inset-bottom,0px)]">
          {displayedNavItems.map((item) => (
            <NavLink
              key={item.path}
              to={item.path}
              className={({ isActive }) => cn(
                "flex flex-col items-center gap-1 transition-all duration-300 relative group",
                isActive ? "text-sapphire-blue" : "text-slate-500 hover:text-primary-slate/70"
              )}
            >
              <item.icon size={20} className="transition-all duration-300" />
              <span className="text-[10px] font-sans font-black uppercase tracking-wider">
                {item.label}
              </span>
            </NavLink>
          ))}
        </div>
      </nav>

      {/* Desktop Sidebar (Pure Glassmorphism) */}
      <aside className="hidden lg:flex flex-col w-72 xl:w-80 h-screen p-8 fixed top-0 left-0 bg-[#f8fafc]/50 backdrop-blur-2xl z-50 shadow-xl shadow-slate-200/20">

        {/* Brand Logo */}
        <div className="flex items-center gap-3 mb-16 group cursor-default">
          <div className="size-12 rounded-2xl bg-primary-navy shadow-xl shadow-primary-navy/20 flex items-center justify-center transform group-hover:rotate-6 transition-transform">
            <Crown size={24} className="text-olympic-gold" />
          </div>
          <div>
            <h2 className="text-primary-navy font-display font-black text-xl leading-tight">Precision</h2>
            <p className="text-xs text-slate-500 uppercase tracking-[0.3em] font-sans font-bold">Arena Club</p>
          </div>
        </div>

        {/* Desktop Menu */}
        <div className="flex-1 space-y-3">
          <div className="mb-6 px-4">
            <ReportScore
              trigger={
                <Button className="w-full h-14 rounded-2xl bg-sapphire-blue hover:bg-slate-800 text-white font-display font-black text-sm tracking-widest shadow-xl shadow-sapphire-blue/20 transition-all border-none">
                  <Plus className="mr-2 h-5 w-5" />
                  申報比分
                </Button>
              }
            />
          </div>
          <p className="text-xs text-slate-500 uppercase tracking-[0.2em] font-sans font-black ml-4 mb-4">Main Navigation</p>
          {displayedNavItems.map((item) => (
            <NavLink
              key={item.path}
              to={item.path}
              className={({ isActive }) => cn(
                "flex items-center gap-4 px-6 py-4 rounded-2xl transition-all duration-500 overflow-hidden relative group",
                isActive
                  ? "bg-white shadow-xl shadow-primary-navy/5 text-primary-navy"
                  : "text-primary-slate/50 hover:bg-white/40 hover:text-primary-navy"
              )}
            >
              <item.icon size={22} className={cn(
                "transition-transform duration-500 group-hover:scale-110",
              )} />
              <span className="font-sans font-bold text-sm tracking-wide">
                {item.label}
              </span>

            </NavLink>
          ))}
        </div>

        {/* User Profile Trigger (Desktop) */}
        <div className="mt-auto pt-6 border-t border-slate-200/50">
          <UserProfileSettings
            trigger={
              <button className="w-full bg-white/60 hover:bg-white p-3 rounded-2xl border border-slate-200/50 backdrop-blur-sm transition-all flex items-center gap-3 text-left group shadow-sm hover:shadow-md">
                <div className="size-10 rounded-xl overflow-hidden border border-slate-200 shrink-0 relative group-hover:border-sapphire-blue transition-colors">
                  <img src={user.avatar_url || user.avatar || '/api/placeholder/40/40'} alt={user.name} className="size-full object-cover" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-black text-primary-navy truncate group-hover:text-sapphire-blue transition-colors">{user.name}</p>
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest truncate">{user.department || '設定單位...'}</p>
                </div>
                <Settings size={18} className="text-slate-400 group-hover:text-sapphire-blue transition-colors shrink-0 mr-1 group-hover:rotate-90 duration-500" />
              </button>
            }
          />
        </div>

      </aside>
    </>
  );
}

