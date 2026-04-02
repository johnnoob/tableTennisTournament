import { Trophy, Shield, Target, ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { Link } from 'react-router-dom';

export function Login() {
  return (
    <div className="min-h-screen w-full flex flex-col lg:flex-row bg-white">
      
      {/* 🌟 左側：品牌形象視覺區 (晨星奧運風) */}
      <div className="relative hidden lg:flex flex-col justify-between w-1/2 bg-primary-navy p-12 overflow-hidden">
        {/* 背景裝飾浮水印 */}
        <div className="absolute -bottom-24 -left-24 opacity-5 pointer-events-none">
          <Trophy size={600} />
        </div>
        <div className="absolute top-1/4 right-10 opacity-10 pointer-events-none">
          <Target size={300} />
        </div>

        {/* 頂部 Logo */}
        <div className="flex items-center gap-3 relative z-10">
          <div className="size-12 rounded-2xl bg-white/10 backdrop-blur-sm border border-white/20 flex items-center justify-center shadow-2xl">
            <Trophy size={24} className="text-amber-500" />
          </div>
          <div>
            <h1 className="text-white font-display font-black text-xl leading-tight tracking-wider">PRECISION</h1>
            <p className="text-[10px] text-slate-400 uppercase tracking-[0.3em] font-sans font-bold">Arena Club</p>
          </div>
        </div>

        {/* 中間精神標語 */}
        <div className="relative z-10 space-y-6 max-w-md">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-sapphire-blue/20 border border-sapphire-blue/30 text-blue-300 text-xs font-black uppercase tracking-widest">
            <Shield size={14} />
            Season 4 Official Platform
          </div>
          <h2 className="text-5xl font-display font-black text-white leading-[1.1] tracking-tight italic">
            淬鍊每一拍的<br />
            <span className="text-amber-500">極致榮耀。</span>
          </h2>
          <p className="text-slate-300 font-medium leading-relaxed">
            歡迎來到機關專屬桌球戰情室。免報名、隨時戰，透過雙軌積分系統記錄您的每一場熱血對決。
          </p>
        </div>

        {/* 底部版權聲明 */}
        <div className="relative z-10 text-xs font-bold text-slate-500 uppercase tracking-widest">
          © 2026 Table Tennis Tournament System.
        </div>
      </div>

      {/* 🔐 右側：登入表單區 */}
      <div className="flex-1 flex flex-col justify-center items-center p-8 lg:p-12 relative">
        
        {/* 手機版顯示的頂部 Logo */}
        <div className="lg:hidden flex items-center gap-3 mb-12">
          <div className="size-12 rounded-2xl bg-primary-navy flex items-center justify-center shadow-xl">
            <Trophy size={24} className="text-amber-500" />
          </div>
          <div>
            <h1 className="text-primary-navy font-display font-black text-xl leading-tight tracking-wider">PRECISION</h1>
            <p className="text-[10px] text-slate-500 uppercase tracking-[0.3em] font-sans font-bold">Arena Club</p>
          </div>
        </div>

        <div className="w-full max-w-sm space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
          
          {/* 登入標題 */}
          <div className="text-center space-y-2">
            <h2 className="text-3xl font-display font-black text-primary-navy tracking-tight">登入戰情室</h2>
            <p className="text-sm font-bold text-slate-500 uppercase tracking-widest">
              支援同仁與外單位交流人員登入
            </p>
          </div>

          {/* 登入按鈕區 (SSO) */}
          <div className="space-y-4 pt-4">
            
            {/* LINE 登入按鈕 (品牌綠色 #06C755) */}
            <Button 
              className="w-full h-14 rounded-2xl bg-[#06C755] hover:bg-[#05b34c] text-white font-bold tracking-widest shadow-lg shadow-[#06C755]/20 transition-all active:scale-95 flex items-center justify-center gap-3"
            >
              {/* 簡單用圓圈模擬 LINE Logo，實務上可替換為真實 SVG */}
              <div className="size-6 bg-white rounded-full flex items-center justify-center">
                <div className="w-3.5 h-2.5 bg-[#06C755] rounded-sm" />
              </div>
              使用 LINE 帳號登入
            </Button>

            {/* Google 登入按鈕 */}
            <Button 
              variant="outline"
              className="w-full h-14 rounded-2xl bg-white hover:bg-slate-50 border-slate-200 text-slate-700 font-bold tracking-widest shadow-sm transition-all active:scale-95 flex items-center justify-center gap-3"
            >
              {/* Google G Logo (簡化版 SVG) */}
              <svg className="size-5" viewBox="0 0 24 24">
                <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
                <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
                <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
                <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
              </svg>
              使用 Google 帳號登入
            </Button>

          </div>

          {/* 訪客/純瀏覽入口 */}
          <div className="pt-8 border-t border-slate-100 flex flex-col items-center">
            <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-4">或者</p>
            <Link to="/hof">
              <Button variant="ghost" className="text-sapphire-blue font-black tracking-widest hover:bg-blue-50 rounded-xl px-6 gap-2">
                以訪客身分進入榮譽榜 <ArrowRight size={16} />
              </Button>
            </Link>
          </div>

        </div>
      </div>
    </div>
  );
}

