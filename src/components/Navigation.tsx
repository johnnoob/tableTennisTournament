import { useState, useEffect } from 'react';
import { NavLink } from 'react-router-dom';
import { LayoutDashboard, History, Trophy, Award, Crown, Plus, Shield } from 'lucide-react';
import { cn } from '@/lib/utils';
import { ReportScore } from './ReportScore';
import { Button } from './ui/button';

const navItems = [
  { icon: LayoutDashboard, label: 'Dashboard', path: '/' },
  { icon: History, label: 'Matches', path: '/history' },
  { icon: Trophy, label: 'Tournament', path: '/tournament' },
  { icon: Shield, label: 'Leaderboard', path: '/leaderboard' },
  { icon: Award, label: 'Hall of Fame', path: '/hof' },
];

export function Navigation() {
  const [isVisible, setIsVisible] = useState(true);
  const [lastScrollY, setLastScrollY] = useState(0);

  useEffect(() => {
    const handleScroll = () => {
      const currentScrollY = window.scrollY;
      // Hide on scroll down, show on scroll up
      // Add a small threshold (10px) to prevent flickering
      if (Math.abs(currentScrollY - lastScrollY) < 10) return;

      if (currentScrollY > lastScrollY && currentScrollY > 80) {
        setIsVisible(false); // Swiping up -> Hide
      } else {
        setIsVisible(true);  // Swiping down -> Show
      }
      setLastScrollY(currentScrollY);
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, [lastScrollY]);

  return (
    <>
      {/* Mobile Bottom Navigation (Glassmorphism & Interactive) */}
      <nav 
        className={cn(
          "fixed bottom-0 left-0 right-0 bg-white/70 backdrop-blur-2xl border-t border-slate-200/40 z-60 lg:hidden transition-transform duration-500 ease-in-out px-6",
          "h-[calc(4.5rem+env(safe-area-inset-bottom,0px))]",
          isVisible ? "translate-y-0" : "translate-y-[calc(100%+32px)]"
        )}
      >
        <div className="max-w-md mx-auto h-full flex items-center justify-between pb-[env(safe-area-inset-bottom,0px)]">
          {navItems.map((item) => (
            <NavLink
              key={item.path}
              to={item.path}
              className={({ isActive }) => cn(
                "flex flex-col items-center gap-1 transition-all duration-300 relative group",
                isActive ? "text-electric-blue" : "text-slate-500 hover:text-primary-slate/70"
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
            <Crown size={24} className="text-neon-orange" />
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
                 <Button className="w-full h-14 rounded-2xl bg-electric-blue hover:bg-slate-800 text-white font-display font-black text-sm tracking-widest shadow-xl shadow-electric-blue/20 transition-all border-none">
                    <Plus className="mr-2 h-5 w-5" />
                    申報比分
                 </Button>
               }
             />
          </div>
          <p className="text-xs text-slate-500 uppercase tracking-[0.2em] font-sans font-black ml-4 mb-4">Main Navigation</p>
          {navItems.map((item) => (
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

        {/* Footer info or user profile preview can go here */}
        <div className="mt-auto pt-8 border-t border-slate-200/30">
          <div className="bg-white/40 p-4 rounded-2xl border border-white/50 backdrop-blur-sm">
             <p className="text-xs text-slate-500 uppercase font-black tracking-widest text-center mb-1">Status</p>
             <p className="text-xs text-primary-navy font-bold text-center">Season 4 Active</p>
          </div>
        </div>

      </aside>
    </>
  );
}
