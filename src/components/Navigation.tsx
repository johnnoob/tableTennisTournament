import { useState } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Gauge, Swords, Trophy, BarChart3, Plus, Shield, Settings, LogIn } from 'lucide-react';
import { cn } from '@/lib/utils';
import { BrandLogo } from './BrandLogo';
import { ReportScore } from './ReportScore';
import { Button } from './ui/button';
import { UserProfileSettings } from './UserProfileSettings';
import { PlayerAvatar } from './PlayerAvatar';
import { ThemeToggle } from './ThemeToggle';
import { useNotificationsQuery } from '@/hooks/useNotifications';
import {
  NotificationBellButton,
  NotificationCenterSheet,
} from './NotificationCenter';
import { useAuth } from '@/hooks/useAuth';
import { useScrollHide } from '@/hooks/use-scroll-hide';
import apiClient from '@/utils/apiClient';

interface NavPendingMatch {
  id: string;
  opponent?: Array<{ id: string }>;
}

interface NavItemConfig {
  icon: typeof Gauge;
  label: string;
  shortLabel: string;
  path: string;
}

const navItems: NavItemConfig[] = [
  { icon: Gauge, label: '戰情室', shortLabel: '戰情', path: '/' },
  { icon: Swords, label: '對戰紀錄', shortLabel: '紀錄', path: '/history' },
  { icon: Trophy, label: '賽事中心', shortLabel: '賽事', path: '/tournament' },
  { icon: BarChart3, label: '積分榜', shortLabel: '積分', path: '/leaderboard' },
];

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
  const { pathname } = useLocation();
  const isAdmin = user?.role === 'admin';
  const isMobileNavHidden = useScrollHide(pathname, true);
  const [notifOpen, setNotifOpen] = useState(false);

  const { data: notificationsData, isLoading: isNotifLoading } = useNotificationsQuery(Boolean(user));
  const unreadNotifCount = notificationsData?.unread_count ?? 0;
  const hasUrgentNotif = Boolean(
    notificationsData?.notifications?.some(
      (n) =>
        !n.is_read &&
        (n.category === 'disputed' ||
          n.category === 'action_required' ||
          n.type === 'challenge_received' ||
          n.type === 'challenge_countered')
    )
  );

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

  const displayedNavItems: NavItemConfig[] = isAdmin
    ? [...navItems, { icon: Shield, label: '管理後台', shortLabel: '管理', path: '/admin' }]
    : navItems;

  return (
    <>
      {/* Mobile Top App Bar (< md, unpinned so it scrolls away cleanly) */}
      <header className="relative z-30 md:hidden bg-card/90 dark:bg-[#0b1120]/90 backdrop-blur-md border-b border-border pt-[env(safe-area-inset-top,0px)]">
        <div className="h-14 px-4 flex items-center justify-between gap-2.5">
          <NavLink
            to="/"
            aria-label="TT戰網｜貿易署桌球社積分系統 首頁"
            title="TT戰網｜貿易署桌球社積分系統"
            className="inline-flex items-center rounded-xl active:scale-95 transition-transform min-w-0 shrink"
          >
            <BrandLogo variant="horizontal" className="h-11 w-auto max-w-full" decorative />
          </NavLink>

          <div className="flex items-center gap-1 shrink-0">
            {isAdmin && (
              <NavLink
                to="/admin"
                aria-label="管理後台"
                title="管理後台"
                className={({ isActive }) =>
                  cn(
                    'size-10 rounded-full flex items-center justify-center transition-colors shrink-0',
                    isActive
                      ? 'bg-sapphire-blue/12 text-sapphire-blue dark:bg-sapphire-blue/20 dark:text-blue-300'
                      : 'text-foreground hover:bg-secondary active:bg-secondary/90'
                  )
                }
              >
                <Shield size={18} aria-hidden="true" />
              </NavLink>
            )}

            {user && (
              <NotificationBellButton
                variant="mobile"
                unreadCount={unreadNotifCount}
                hasUrgent={hasUrgentNotif}
                onClick={() => setNotifOpen(true)}
              />
            )}

            {!user && (
              <ThemeToggle
                variant="icon"
                className="rounded-full border-transparent bg-transparent hover:bg-secondary"
              />
            )}

            {user ? (
              <UserProfileSettings
                trigger={
                  <button
                    type="button"
                    aria-label={`${user.name} 個人設定`}
                    title="個人設定與外觀主題"
                    className="size-10 rounded-full flex items-center justify-center hover:bg-secondary/80 active:scale-95 transition-all shrink-0"
                  >
                    <PlayerAvatar
                      src={user.avatar_url || user.avatar}
                      name={user.name}
                      className="size-8.5 rounded-full ring-1 ring-border shadow-xs text-xs"
                    />
                  </button>
                }
              />
            ) : (
              <NavLink
                to="/login"
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-primary text-primary-foreground text-xs font-semibold hover:opacity-90 transition-opacity min-h-10"
              >
                <LogIn size={14} aria-hidden="true" />
                <span>登入</span>
              </NavLink>
            )}
          </div>
        </div>
      </header>

      {/* Mobile Bottom Navigation (< md, 5-Slot Flush Center CTA + Auto-Hide on Scroll Down) */}
      <nav
        aria-label="主導覽"
        className={cn(
          'fixed bottom-0 inset-x-0 bg-card/90 dark:bg-[#0b1120]/90 backdrop-blur-xl border-t border-border z-50 md:hidden px-2 pb-[max(0.35rem,env(safe-area-inset-bottom,0px))] pt-1.5 transition-transform duration-300 ease-out will-change-transform',
          isMobileNavHidden ? 'translate-y-[calc(100%+1rem)] pointer-events-none' : 'translate-y-0'
        )}
      >
        <div className="max-w-lg mx-auto grid grid-cols-5 items-center gap-1">
          <MobileBottomNavLink item={navItems[0]} pendingActionCount={pendingActionCount} />
          <MobileBottomNavLink item={navItems[1]} pendingActionCount={pendingActionCount} />

          {/* Center Slot: Flush Report Score CTA */}
          <div className="flex items-center justify-center px-0.5">
            {user ? (
              <ReportScore
                trigger={
                  <button
                    type="button"
                    aria-label="立即報分"
                    className="min-h-12 w-full rounded-xl bg-gradient-to-br from-smash-orange to-orange-600 text-white shadow-md shadow-smash-orange/25 flex flex-col items-center justify-center gap-0.5 py-1 hover:opacity-95 active:scale-95 transition-all"
                  >
                    <Plus size={19} strokeWidth={2.75} aria-hidden="true" />
                    <span className="text-[11px] font-sans font-black leading-tight truncate max-w-full">
                      立即報分
                    </span>
                  </button>
                }
              />
            ) : (
              <NavLink
                to="/login"
                aria-label="登入以立即報分"
                className="min-h-12 w-full rounded-xl bg-gradient-to-br from-sapphire-blue to-blue-700 text-white shadow-md shadow-sapphire-blue/25 flex flex-col items-center justify-center gap-0.5 py-1 hover:opacity-95 active:scale-95 transition-all"
              >
                <Plus size={19} strokeWidth={2.75} aria-hidden="true" />
                <span className="text-[11px] font-sans font-black leading-tight truncate max-w-full">
                  立即報分
                </span>
              </NavLink>
            )}
          </div>

          <MobileBottomNavLink item={navItems[2]} pendingActionCount={pendingActionCount} />
          <MobileBottomNavLink item={navItems[3]} pendingActionCount={pendingActionCount} />
        </div>
      </nav>

      {/* Tablet Navigation Rail (md to < lg, zero top/bottom chrome) */}
      <aside
        aria-label="平板側邊導覽"
        className="hidden md:flex lg:hidden flex-col items-center w-20 h-dvh py-4 px-2 fixed top-0 left-0 bg-background/95 border-r border-border z-40"
      >
        <NavLink
          to="/"
          aria-label="TT戰網 首頁"
          title="TT戰網｜貿易署桌球社積分系統"
          className="size-12 rounded-xl flex items-center justify-center mb-5 hover:scale-105 active:scale-95 transition-transform shrink-0"
        >
          <BrandLogo variant="icon" className="size-11" decorative />
        </NavLink>

        <div className="mb-5 w-full flex justify-center">
          {user ? (
            <ReportScore
              trigger={
                <Button
                  type="button"
                  aria-label="立即報分"
                  title="立即報分"
                  className="size-11 p-0 rounded-2xl bg-gradient-to-br from-smash-orange to-orange-600 hover:opacity-95 text-white shadow-md shadow-smash-orange/25 border-none"
                >
                  <Plus size={20} strokeWidth={2.75} aria-hidden="true" />
                </Button>
              }
            />
          ) : (
            <NavLink
              to="/login"
              aria-label="登入戰情室"
              title="登入戰情室"
              className="size-11 rounded-2xl bg-primary text-primary-foreground flex items-center justify-center shadow-md hover:opacity-90 transition-opacity"
            >
              <LogIn size={18} aria-hidden="true" />
            </NavLink>
          )}
        </div>

        <nav aria-label="主導覽" className="flex-1 w-full space-y-1.5 overflow-y-auto no-scrollbar flex flex-col items-center">
          {displayedNavItems.map((item) => (
            <NavLink
              key={item.path}
              to={item.path}
              end={item.path === '/'}
              title={item.label}
              aria-label={item.label}
              className={({ isActive }) =>
                cn(
                  'w-full py-2.5 px-1 rounded-2xl flex flex-col items-center justify-center gap-1 relative transition-all',
                  isActive
                    ? 'bg-card text-sapphire-blue shadow-xs border border-border font-black'
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
                  <div className="relative">
                    <item.icon size={20} aria-hidden="true" className="shrink-0" />
                    {item.path === '/' && pendingActionCount > 0 && (
                      <span
                        aria-label={`${pendingActionCount} 筆待確認賽果`}
                        className="absolute -top-2 -right-3 min-w-4.5 px-1 py-0.5 rounded-full bg-rose-500 text-white text-[10px] leading-none font-black flex items-center justify-center shadow-xs tabular-nums"
                      >
                        {pendingActionCount > 9 ? '9+' : pendingActionCount}
                      </span>
                    )}
                  </div>
                  <span className="text-[11px] font-sans leading-tight truncate max-w-full">
                    {item.shortLabel}
                  </span>
                </>
              )}
            </NavLink>
          ))}
        </nav>

        <div className="mt-auto pt-3 border-t border-border w-full flex flex-col items-center gap-2.5">
          {user && (
            <NotificationBellButton
              variant="rail"
              unreadCount={unreadNotifCount}
              hasUrgent={hasUrgentNotif}
              onClick={() => setNotifOpen(true)}
            />
          )}
          <ThemeToggle variant="icon" />
          {user && (
            <UserProfileSettings
              trigger={
                <button
                  type="button"
                  aria-label="個人設定"
                  title="個人設定"
                  className="size-11 rounded-2xl border border-border bg-card hover:bg-secondary flex items-center justify-center transition-colors shadow-xs"
                >
                  <PlayerAvatar
                    src={user.avatar_url || user.avatar}
                    name={user.name}
                    className="size-8 rounded-xl text-xs"
                  />
                </button>
              }
            />
          )}
        </div>
      </aside>

      {/* Desktop Sidebar (Slim w-64) */}
      <aside className="hidden lg:flex flex-col w-64 h-dvh p-5 fixed top-0 left-0 bg-background/95 border-r border-border z-40">
        {/* Brand Logo */}
        <NavLink
          to="/"
          aria-label="TT戰網｜貿易署桌球社積分系統 首頁"
          className="block mb-7 px-1 group transition-transform hover:scale-[1.01]"
        >
          <BrandLogo variant="horizontal" className="w-full h-auto" decorative />
        </NavLink>

        {/* Primary Action */}
        <div className="mb-6">
          {user ? (
            <ReportScore
              trigger={
                <Button
                  type="button"
                  className="w-full h-12 rounded-2xl bg-gradient-to-r from-smash-orange to-orange-600 hover:opacity-95 text-white font-display font-black text-sm tracking-wider shadow-lg shadow-smash-orange/25 transition-all border-none"
                >
                  <Plus className="mr-2 h-4 w-4" aria-hidden="true" />
                  立即報分
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

        {/* Notifications, Theme Switcher & User Profile Trigger (Desktop) */}
        <div className="mt-auto pt-3.5 border-t border-border space-y-2.5">
          {user && (
            <NotificationBellButton
              variant="sidebar"
              unreadCount={unreadNotifCount}
              hasUrgent={hasUrgentNotif}
              onClick={() => setNotifOpen(true)}
            />
          )}
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

      {user && (
        <NotificationCenterSheet
          open={notifOpen}
          onOpenChange={setNotifOpen}
          data={notificationsData}
          isLoading={isNotifLoading}
          isAdmin={isAdmin}
        />
      )}
    </>
  );
}
