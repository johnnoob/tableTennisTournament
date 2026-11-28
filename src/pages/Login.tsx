import { Shield, ArrowRight, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Link, useSearchParams } from 'react-router-dom';
import { ThemeToggle } from '@/components/ThemeToggle';
import { BrandLogo } from '@/components/BrandLogo';
import { API_BASE_URL } from '@/utils/apiClient';
import { useAuthProviders } from '@/hooks/useAuth';

const OAUTH_ERROR_MESSAGES: Record<string, string> = {
  mismatching_state: '登入驗證狀態已失效，請重新點擊登入按鈕。',
  access_denied: '您已取消第三方帳號授權，請再試一次。',
  missing_userinfo: '無法取得帳號基本資料，請稍後再試。',
  account_disabled: '此帳號已被管理員停用，如有疑問請聯繫社團管理員。',
  session_expired: '登入狀態已逾時，請重新登入後再進行綁定。',
  line_not_configured: '系統尚未完成 LINE 登入金鑰設定，請先使用 Google 登入或聯繫管理員。',
  google_not_configured: '系統尚未完成 Google 登入金鑰設定，請聯繫管理員。',
  email_already_bound_other_line: '此 Email 對應的帳號已綁定其他 LINE 帳號，請使用原登入方式或聯繫管理員。',
  email_already_bound_other_google: '此 Email 對應的帳號已綁定其他 Google 帳號，請使用原登入方式或聯繫管理員。',
};

const handleOAuthLogin = (provider: 'google' | 'line') => {
  window.location.href = `${API_BASE_URL}/auth/${provider}/login`;
};

export function Login() {
  const [searchParams] = useSearchParams();
  const { data: providers } = useAuthProviders();
  const authError = searchParams.get('error');
  const authErrorMessage = authError
    ? OAUTH_ERROR_MESSAGES[authError] || '登入失敗，請稍後再試。'
    : null;

  const isGoogleDisabled = providers?.google === false;
  const isLineDisabled = providers?.line === false;

  return (
    <div className="min-h-screen w-full flex flex-col lg:flex-row bg-background">

      {/* 🌟 左側：品牌形象視覺區 */}
      <div className="relative hidden lg:flex flex-col justify-between w-1/2 arena-hero-dark p-12 overflow-hidden">
        {/* 背景裝飾浮水印 */}
        <div className="absolute -bottom-24 -left-24 opacity-[0.07] pointer-events-none">
          <BrandLogo variant="icon" surface="dark" className="size-[460px]" decorative />
        </div>

        {/* 頂部識別膠囊 */}
        <div className="relative z-10">
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-white/10 backdrop-blur-sm border border-white/15 text-xs font-semibold text-slate-200">
            <Shield size={14} className="text-tita-teal shrink-0" aria-hidden="true" />
            <span>TT戰網 · 經濟部國際貿易署桌球社</span>
          </div>
        </div>

        {/* 中間精神標語 */}
        <div className="relative z-10 space-y-6 max-w-md">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-tita-teal/15 border border-tita-teal/35 text-[#8CF7F0] text-xs font-semibold">
            <Shield size={14} aria-hidden="true" />
            <span>官方指定單軌積分系統</span>
          </div>
          <h2 className="text-5xl font-display font-bold text-white leading-[1.12] tracking-tight">
            淬鍊每一拍的<br />
            <span className="bg-gradient-to-r from-olympic-gold via-amber-300 to-tita-teal bg-clip-text text-transparent">極致榮耀。</span>
          </h2>
          <p className="text-slate-300 font-medium leading-relaxed">
            歡迎來到貿易署桌球社專屬積分系統。免報名、隨時戰，透過單軌積分制記錄您的每一場熱血對決。
          </p>
        </div>

        {/* 底部版權聲明 */}
        <div className="relative z-10 text-xs font-medium text-slate-400">
          © 2026 TT戰網｜經濟部國際貿易署桌球社
        </div>
      </div>

      {/* 🔐 右側：登入表單區 */}
      <div className="flex-1 flex flex-col justify-center items-center p-8 lg:p-12 relative">
        <div className="absolute top-5 right-5 sm:top-6 sm:right-6">
          <ThemeToggle variant="icon" />
        </div>

        <div className="w-full max-w-sm space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-700">
          <div className="flex justify-center">
            <BrandLogo variant="vertical" className="w-44 sm:w-48 h-auto" />
          </div>

          {/* 登入標題 */}
          <div className="text-center space-y-2">
            <h2 className="text-3xl font-display font-black text-foreground tracking-tight">登入戰情室</h2>
            <p className="text-sm font-bold text-muted-foreground tracking-wide">
              使用 Google 或 LINE 帳號一鍵驗證進入戰情室
            </p>
          </div>

          {/* 登入按鈕區 (SSO) */}
          <div className="space-y-3.5 pt-2">
            {authErrorMessage && (
              <div
                role="alert"
                className="rounded-2xl border border-rose-200 dark:border-rose-500/30 bg-rose-50 dark:bg-rose-500/12 px-4 py-3 text-xs font-bold text-rose-700 dark:text-rose-300 flex items-start gap-2.5"
              >
                <AlertCircle className="size-4 shrink-0 mt-0.5 text-rose-500 dark:text-rose-400" aria-hidden="true" />
                <span>{authErrorMessage}</span>
              </div>
            )}

            {/* Google 登入按鈕 */}
            <Button
              type="button"
              variant="outline"
              disabled={isGoogleDisabled}
              className="w-full h-14 rounded-2xl bg-card hover:bg-secondary/80 border-input text-foreground font-black tracking-wide shadow-sm transition-all active:scale-95 flex items-center justify-center gap-3 disabled:opacity-55"
              onClick={() => handleOAuthLogin('google')}
            >
              <svg className="size-5 shrink-0" viewBox="0 0 24 24" aria-hidden="true">
                <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
                <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
                <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
                <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
              </svg>
              {isGoogleDisabled ? 'Google 帳號登入（尚未設定金鑰）' : '使用 Google 帳號登入'}
            </Button>

            {/* LINE 登入按鈕 */}
            {isLineDisabled ? (
              <Button
                type="button"
                disabled
                className="w-full h-14 rounded-2xl bg-secondary text-muted-foreground border border-border font-bold tracking-wide flex items-center justify-center gap-2.5 opacity-80"
              >
                LINE 帳號登入（尚未設定金鑰）
              </Button>
            ) : (
              <Button
                type="button"
                className="w-full h-14 rounded-2xl bg-[#06C755] hover:bg-[#05b34c] border border-[#05b34c] text-white font-black tracking-wide shadow-sm transition-all active:scale-95 flex items-center justify-center gap-3"
                onClick={() => handleOAuthLogin('line')}
              >
                <svg className="size-6 shrink-0" viewBox="0 0 24 24" aria-hidden="true">
                  <path
                    fill="currentColor"
                    d="M12 3C6.48 3 2 6.58 2 11c0 3.95 3.51 7.26 8.26 7.89.32.07.76.21.87.49.1.25.06.64.03.9l-.14.84c-.04.25-.2.98.86.53 1.06-.44 5.71-3.36 7.79-5.75C21.14 14.28 22 12.73 22 11c0-4.42-4.48-8-10-8zm-4.18 10.1H5.97a.46.46 0 0 1-.46-.46V8.94c0-.25.21-.46.46-.46s.46.21.46.46v3.24h1.39c.25 0 .46.21.46.46s-.21.46-.46.46zm1.93-.46c0 .25-.21.46-.46.46s-.46-.21-.46-.46V8.94c0-.25.21-.46.46-.46s.46.21.46.46v3.7zm4.32 0c0 .2-.13.38-.32.44-.05.01-.09.02-.14.02-.15 0-.29-.07-.37-.19l-1.91-2.59v2.32c0 .25-.21.46-.46.46s-.46-.21-.46-.46V8.94c0-.2.13-.38.32-.44.19-.06.4.01.51.17l1.91 2.59V8.94c0-.25.21-.46.46-.46s.46.21.46.46v3.7zm3.4-2.31c.25 0 .46.21.46.46s-.21.46-.46.46h-1.39v.93h1.39c.25 0 .46.21.46.46s-.21.46-.46.46h-1.85a.46.46 0 0 1-.46-.46V8.94c0-.25.21-.46.46-.46h1.85c.25 0 .46.21.46.46s-.21.46-.46.46h-1.39v.93h1.39z"
                  />
                </svg>
                使用 LINE 帳號登入
              </Button>
            )}

            <p className="text-center text-[11px] font-medium text-muted-foreground leading-relaxed pt-1">
              既有社員登入後，可在「個人設定」同時綁定 Google 與 LINE，整合同一份戰績。
            </p>
          </div>

          {/* 訪客/純瀏覽入口 */}
          <div className="pt-6 border-t border-border flex flex-col items-center">
            <p className="text-xs font-bold text-muted-foreground uppercase tracking-widest mb-4">或者</p>
            <Link to="/leaderboard">
              <Button variant="ghost" className="text-sapphire-blue font-black tracking-widest hover:bg-sapphire-blue/10 rounded-xl px-6 gap-2">
                以訪客身分進入榮譽榜 <ArrowRight size={16} />
              </Button>
            </Link>
          </div>

        </div>
      </div>
    </div>
  );
}
