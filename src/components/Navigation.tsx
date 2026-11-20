import { NavLink } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { LayoutDashboard, History, Trophy, Crown, Plus, Shield, Settings, LayoutGrid, LogIn } from 'lucide-react';
import { cn } from '@/lib/utils';
import { ReportScore } from './ReportScore';
import { Button } from './ui/button';
import { UserProfileSettings } from './UserProfileSettings';
import { PlayerAvatar } from './PlayerAvatar';
import { ThemeToggle } from './ThemeToggle';
import { useAuth } from '@/hooks/useAuth';
import apiClient from '@/utils/apiClient';

interface NavPendingMatch {
  id: string;
  opponent?: Array<{ id: string }>;
}

const navItems = [
  { icon: LayoutDashboard, label: '戰情室', path: '/' },
  { icon: History, label: '對戰紀錄', path: '/history' },
  { icon: Trophy, label: '賽事中心', path: '/tournament' },
  { icon: LayoutGrid, label: '積分榜', path: '/leaderboard' },
];

interface NavItemConfig {
  icon: typeof LayoutDashboard;
  label: string;
  path: string;
}

function MobileBottomNavLink({
  item,
  pendingActionCount,
}: {
  item: NavItemConfig;
  pendingActionCount: number;
}) {
  return (
    <NavLink
      to={item.path}
      end={item.path === '/'}
      className={({ isActive }) =>
        cn(
          'min-h-12 flex flex-col items-center justify-center gap-1 rounded-xl px-1 py-1.5 relative transition-colors',
          isActive
            ? 'bg-sapphire-blue/12 text-sapphire-blue dark:bg-sapphire-blue/20 dark:text-blue-400 font-black'
            : 'text-muted-foreground hover:text-foreground font-bold'
        )
      }
    >
      {({ isActive }) => (
        <>
          {isActive && (
            <span
              aria-hidden="true"
              className="absolute top-0 left-1/2 -translate-x-1/2 h-0.5 w-7 rounded-full bg-sapphire-blue"
            />
          )}
          <div className="relative">
            <item.icon size={19} aria-hidden="true" className="shrink-0" />
            {item.path === '/' && pendingActionCount > 0 && (
              <span
                aria-label={`${pendingActionCount} 筆待確認賽果`}
                className="absolute -top-2 -right-3 min-w-4.5 px-1 py-0.5 rounded-full bg-rose-500 text-white text-xs leading-none font-black flex items-center justify-center shadow-xs tabular-nums"
              >
                {pendingActionCount > 9 ? '9+' : pendingActionCount}
              </span>
            )}
          </div>
          <span className="text-[11px] font-sans leading-tight truncate max-w-full">
            {item.label}
          </span>
        </>
      )}
    </NavLink>
  );
}

export function Navigation() {
  const { data: user } = useAuth();
  const isAdmin = user?.role === 'admin';

  const { data: pendingMatches = [] } = useQuery({
    queryKey: ['matches', 'pending'],
    queryFn: async () => {
      const res = await apiClient.get<NavPendingMatch[]>('/matches/pending');
      return res.data;
    },
    enabled: !!user,
    refetchInterval: 10000,
  });

  const pendingActionCount = pendingMatches.filter((m) =>
    m.opponent?.some((p) => String(p.id) === String(user?.id))
  ).length;

  const displayedNavItems = isAdmin
    ? [...navItems, { icon: Shield, label: '管理後台', path: '/admin' }]
    : navItems;

  return (
    <>
      {/* Mobile Top App Bar */}
      <header className="fixed top-0 inset-x-0 z-50 lg:hidden bg-card/85 dark:bg-[#0b1120]/85 backdrop-blur-xl border-b border-border pt-[env(safe-area-inset-top,0px)]">
        <div className="h-16 px-4 flex items-center justify-between gap-3">
          <NavLink to="/" className="flex items-center gap-2.5 min-w-0">
            <div className="size-9 rounded-xl bg-primary-navy text-olympic-gold flex items-center justify-center shadow-sm border border-white/10 shrink-0">
              <Crown size={18} aria-hidden="true" />
            </div>
            <div className="min-w-0">
              <p className="text-foreground font-display font-black text-base leading-none tracking-tight truncate">
                Precision
              </p>
              <p className="text-xs text-muted-foreground uppercase tracking-[0.22em] font-sans font-bold mt-0.5 truncate">
                Arena Club
              </p>
            </div>
          </NavLink>

          <div className="flex items-center gap-2 shrink-0">
            {isAdmin && (
              <NavLink
                to="/admin"
                aria-label="管理後台"
                title="管理後台"
                className={({ isActive }) =>
                  cn(
                    'size-10 rounded-xl border flex items-center justify-center transition-all shrink-0',
                    isActive
                      ? 'bg-sapphire-blue/15 text-sapphire-blue border-sapphire-blue/40 dark:bg-sapphire-blue/25 dark:text-blue-300'
                      : 'border-border bg-secondary/80 hover:bg-secondary text-foreground'
                  )
                }
              >
                <Shield size={17} aria-hidden="true" />
              </NavLink>
            )}

            <ThemeToggle variant="icon" />

            {user ? (
              <UserProfileSettings
                trigger={
                  <button
                    type="button"
                    aria-label="個人設定"
                    className="flex items-center gap-2 rounded-full pl-1 pr-2.5 py-1 bg-secondary border border-border hover:border-sapphire-blue/40 transition-colors min-h-11"
                  >
                    <PlayerAvatar
                      src={user.avatar_url || user.avatar}
                      name={user.name}
                      className="size-8 rounded-full border border-card shadow-xs text-xs"
                    />
                    <span className="text-xs font-bold text-foreground max-w-[84px] truncate">
                      {user.name}
                    </span>
                    <Settings size={14} className="text-muted-foreground shrink-0" aria-hidden="true" />
                  </button>
                }
              />
            ) : (
              <NavLink
                to="/login"
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-primary text-primary-foreground text-xs font-bold tracking-wider hover:opacity-90 transition-opacity min-h-11"
              >
                <LogIn size={14} aria-hidden="true" />
                <span>登入</span>
              </NavLink>
            )}
          </div>
        </div>
      </header>

      {/* Mobile Bottom Navigation (5-Slot Center Report CTA) */}
      <nav
        aria-label="主導覽"
        className="fixed bottom-0 inset-x-0 bg-card/90 dark:bg-[#0b1120]/90 backdrop-blur-xl border-t border-border z-50 lg:hidden px-2 pb-[max(0.4rem,env(safe-area-inset-bottom,0px))] pt-1.5"
      >
        <div className="max-w-lg mx-auto grid grid-cols-5 items-end gap-1">
          <MobileBottomNavLink item={navItems[0]} pendingActionCount={pendingActionCount} />
          <MobileBottomNavLink item={navItems[1]} pendingActionCount={pendingActionCount} />

          {/* Center Slot: Primary Report Score CTA */}
          <div className="flex items-center justify-center">
            {user ? (
              <ReportScore
                trigger={
                  <button
                    type="button"
                    aria-label="申報比分"
                    className="flex flex-col items-center justify-center gap-0.5 w-full pb-1 group"
                  >
                    <span className="-mt-4 size-12 rounded-2xl bg-gradient-to-br from-smash-orange to-orange-600 text-white shadow-lg shadow-smash-orange/30 border-2 border-card flex items-center justify-center group-hover:scale-105 group-active:scale-95 transition-transform">
                      <Plus size={22} strokeWidth={2.75} aria-hidden="true" />
                    </span>
                    <span className="text-[11px] font-sans font-black text-smash-orange leading-tight">
                      報分
                    </span>
                  </button>
                }
              />
            ) : (
              <NavLink
                to="/login"
                aria-label="登入以申報比分"
                className="flex flex-col items-center justify-center gap-0.5 w-full pb-1 group"
              >
                <span className="-mt-4 size-12 rounded-2xl bg-gradient-to-br from-sapphire-blue to-blue-700 text-white shadow-lg shadow-sapphire-blue/25 border-2 border-card flex items-center justify-center group-hover:scale-105 group-active:scale-95 transition-transform">
                  <Plus size={22} strokeWidth={2.75} aria-hidden="true" />
                </span>
                <span className="text-[11px] font-sans font-black text-sapphire-blue leading-tight">
                  報分
                </span>
              </NavLink>
            )}
          </div>

          <MobileBottomNavLink item={navItems[2]} pendingActionCount={pendingActionCount} />
          <MobileBottomNavLink item={navItems[3]} pendingActionCount={pendingActionCount} />
        </div>
      </nav>

      {/* Desktop Sidebar (Slim w-64) */}
      <aside className="hidden lg:flex flex-col w-64 h-dvh p-5 fixed top-0 left-0 bg-background/95 border-r border-border z-40">
        {/* Brand Logo */}
        <NavLink to="/" className="flex items-center gap-3 mb-8 px-2 group">
          <div className="size-11 rounded-2xl bg-primary-navy shadow-md shadow-primary-navy/20 border border-white/10 flex items-center justify-center transform group-hover:rotate-6 transition-transform shrink-0">
            <Crown size={22} className="text-olympic-gold" aria-hidden="true" />
          </div>
          <div>
            <h2 className="text-foreground font-display font-black text-xl leading-tight">Precision</h2>
            <p className="text-xs text-muted-foreground uppercase tracking-[0.26em] font-sans font-bold">Arena Club</p>
          </div>
        </NavLink>

        {/* Primary Action */}
        <div className="mb-6">
          {user ? (
            <ReportScore
              trigger={
                <Button className="w-full h-12 rounded-2xl bg-gradient-to-r from-sapphire-blue to-blue-700 hover:opacity-95 text-white font-display font-black text-sm tracking-wider shadow-lg shadow-sapphire-blue/25 transition-all border-none">
                  <Plus className="mr-2 h-4 w-4" aria-hidden="true" />
                  申報比分
                </Button>
              }
            />
          ) : (
            <NavLink to="/login" className="block">
              <Button className="w-full h-12 rounded-2xl bg-primary hover:opacity-90 text-primary-foreground font-display font-black text-sm tracking-wider shadow-md border-none">
                <LogIn className="mr-2 h-4 w-4" aria-hidden="true" />
                登入戰情室
              </Button>
            </NavLink>
          )}
        </div>

        {/* Desktop Nav Links */}
        <p className="text-xs text-muted-foreground uppercase tracking-[0.2em] font-sans font-black px-3 mb-2">
          Main Navigation
        </p>
        <nav aria-label="主導覽" className="flex-1 space-y-1.5 overflow-y-auto no-scrollbar">
          {displayedNavItems.map((item) => (
            <NavLink
              key={item.path}
              to={item.path}
              end={item.path === '/'}
              className={({ isActive }) =>
                cn(
                  'flex items-center gap-3.5 px-4 py-3.5 rounded-2xl transition-all duration-200 relative group',
                  isActive
                    ? 'bg-card text-foreground shadow-xs border border-border font-black'
                    : 'text-muted-foreground hover:bg-card/70 hover:text-foreground font-bold border border-transparent'
                )
              }
            >
              {({ isActive }) => (
                <>
                  {isActive && (
                    <span
                      aria-hidden="true"
                      className="absolute left-0 top-2.5 bottom-2.5 w-1 rounded-r-full bg-sapphire-blue"
                    />
                  )}
                  <item.icon
                    size={20}
                    aria-hidden="true"
                    className={cn(
                      'shrink-0 transition-transform duration-200 group-hover:scale-105',
                      isActive ? 'text-sapphire-blue' : 'text-muted-foreground group-hover:text-foreground'
                    )}
                  />
                  <span className="font-sans text-sm tracking-wide truncate flex-1">
                    {item.label}
                  </span>
                  {item.path === '/' && pendingActionCount > 0 && (
                    <span
                      aria-label={`${pendingActionCount} 筆待確認賽果`}
                      className="px-2 py-0.5 rounded-full bg-rose-500 text-white text-xs font-black tabular-nums leading-tight shrink-0"
                    >
                      {pendingActionCount > 9 ? '9+' : pendingActionCount}
                    </span>
                  )}
                </>
              )}
            </NavLink>
          ))}
        </nav>

        {/* Theme Switcher & User Profile Trigger (Desktop) */}
        <div className="mt-auto pt-4 border-t border-border space-y-3">
          <ThemeToggle variant="segmented" />

          {user ? (
            <UserProfileSettings
              trigger={
                <button
                  type="button"
                  className="w-full bg-card hover:bg-secondary/80 p-3 rounded-2xl border border-border transition-all flex items-center gap-3 text-left group shadow-xs"
                >
                  <PlayerAvatar
                    src={user.avatar_url || user.avatar}
                    name={user.name}
                    className="size-10 rounded-xl border border-border shrink-0 group-hover:border-sapphire-blue transition-colors"
                  />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-black text-foreground truncate group-hover:text-sapphire-blue transition-colors">
                      {user.name}
                    </p>
                    <p className="text-xs font-bold text-muted-foreground truncate">
                      {user.department || '一般同仁'}
                    </p>
                  </div>
                  <Settings
                    size={17}
                    aria-hidden="true"
                    className="text-muted-foreground group-hover:text-sapphire-blue transition-transform group-hover:rotate-90 duration-500 shrink-0"
                  />
                </button>
              }
            />
          ) : (
            <NavLink
              to="/login"
              className="w-full bg-card hover:bg-secondary/80 p-3 rounded-2xl border border-border transition-all flex items-center gap-3 text-left group shadow-xs"
            >
              <PlayerAvatar name="Guest" className="size-10 rounded-xl border border-border shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-black text-foreground">訪客模式</p>
                <p className="text-xs font-bold text-sapphire-blue">點擊登入戰情室 →</p>
              </div>
            </NavLink>
          )}
        </div>
      </aside>
    </>
  );
}
