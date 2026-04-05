import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Settings, 
  Megaphone, 
  Trophy, 
  Users, 
  Pause, 
  Play, 
  Plus, 
  Trash2, 
  Save, 
  Edit,
  Calendar, 
  ExternalLink,
  ChevronRight,
  Loader2,
  Image as ImageIcon
} from 'lucide-react';
import { Navigate } from 'react-router-dom';
import { useAuthStore } from '@/store/authStore';
import { adminApi } from '@/lib/admin';
import type { SystemConfig, Announcement, TournamentEvent, SeasonPrize, AdminParticipantResponse } from '@/types/admin';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { toast } from 'sonner';
import { useMediaQuery } from '@/hooks/use-media-query';

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";

import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
  DrawerDescription,
  DrawerFooter,
} from "@/components/ui/drawer";

const tabs = [
  { id: 'general', label: '系統設定', icon: Settings },
  { id: 'announcements', label: '公告管理', icon: Megaphone },
  { id: 'prizes', label: '賽季獎品', icon: Trophy },
  { id: 'tournaments', label: '錦標賽', icon: Users },
];

export function AdminDashboard() {
  const { user } = useAuthStore();
  const [activeTab, setActiveTab] = useState('general');
  const [loading, setLoading] = useState(true);
  
  // State for various data
  const [configs, setConfigs] = useState<SystemConfig[]>([]);
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [tournaments, setTournaments] = useState<TournamentEvent[]>([]);
  const [seasons, setSeasons] = useState<any[]>([]); // To select season for prizes
  
  // Security: Redirect if not admin
  if (user && user.role !== 'admin') {
    return <Navigate to="/" replace />;
  }

  useEffect(() => {
    fetchInitialData();
  }, []);

  const fetchInitialData = async () => {
    setLoading(true);
    try {
      const [cfg, ann, tour] = await Promise.all([
        adminApi.getConfigs(),
        adminApi.getAnnouncements(),
        adminApi.getTournaments(),
      ]);
      setConfigs(cfg);
      setAnnouncements(ann);
      setTournaments(tour);
      
      // Fetch seasons from existing leaderboard/season API if available
      const sRes = await fetch("http://localhost:8000/api/seasons");
      if (sRes.ok) {
          const sData = await sRes.json();
          setSeasons(sData);
      }
    } catch (err) {
      console.error("Failed to fetch admin data", err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="pb-24 pt-8 md:pt-12 px-6 md:px-12 space-y-12 bg-white relative">
      {/* Header Section */}
      <header className="flex flex-col md:flex-row md:items-end justify-between gap-6">
        <div className="flex items-center gap-6">
          <div className="w-2 h-16 bg-gradient-to-b from-sapphire-blue to-primary-navy rounded-full shadow-[0_0_15px_rgba(15,23,42,0.2)]" />
          <div>
            <div className="flex items-center gap-3 mb-2">
              <span className="px-3 py-1 bg-sapphire-blue/10 text-sapphire-blue text-[10px] font-black uppercase tracking-widest rounded-full border border-sapphire-blue/20">
                Admin Control
              </span>
            </div>
            <h1 className="text-4xl lg:text-5xl font-black text-primary-navy tracking-tight uppercase leading-none">
              管理主控台
            </h1>
          </div>
        </div>

        {/* Global System Stats / Quick Actions */}
        <div className="flex gap-4">
            <Card className={cn(
                "px-6 py-4 flex items-center gap-4 border-none shadow-lg transition-all duration-500",
                configs.find(c => c.key === 'season_paused')?.value === 'true' 
                    ? "bg-rose-50 text-rose-600 ring-1 ring-rose-200" 
                    : "bg-emerald-50 text-emerald-600 ring-1 ring-emerald-200"
            )}>
                <div className={cn(
                    "size-10 rounded-xl flex items-center justify-center",
                    configs.find(c => c.key === 'season_paused')?.value === 'true' ? "bg-rose-100" : "bg-emerald-100"
                )}>
                    {configs.find(c => c.key === 'season_paused')?.value === 'true' ? <Pause size={20} /> : <Play size={20} />}
                </div>
                <div>
                    <p className="text-[10px] font-black uppercase tracking-widest opacity-70">賽季狀態</p>
                    <p className="font-bold">{configs.find(c => c.key === 'season_paused')?.value === 'true' ? '已暫停報分' : '正常運作中'}</p>
                </div>
            </Card>
        </div>
      </header>

      {/* Tab Navigation */}
      <div className="flex flex-wrap gap-2 p-1 bg-slate-100/50 backdrop-blur-sm rounded-2xl border border-slate-200/50 w-fit">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={cn(
              "flex items-center gap-2 px-6 py-3 rounded-xl text-sm font-bold transition-all duration-300 relative overflow-hidden",
              activeTab === tab.id 
                ? "bg-white text-primary-navy shadow-md" 
                : "text-slate-500 hover:bg-white/40 hover:text-slate-700"
            )}
          >
            <tab.icon size={18} />
            {tab.label}
            {activeTab === tab.id && (
              <motion.div 
                layoutId="tab-active"
                className="absolute inset-0 bg-white -z-10"
                transition={{ type: "spring", bounce: 0.2, duration: 0.6 }}
              />
            )}
          </button>
        ))}
      </div>

      {/* Main Content Area */}
      <div className="relative min-h-[500px]">
        {loading ? (
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="flex flex-col items-center gap-4">
                <Loader2 className="animate-spin text-sapphire-blue" size={40} />
                <p className="text-slate-400 font-bold uppercase tracking-widest text-xs">載入數據中...</p>
            </div>
          </div>
        ) : (
          <AnimatePresence mode="wait">
            <motion.div
              key={activeTab}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.3 }}
            >
              {activeTab === 'general' && <GeneralConfig configs={configs} onUpdate={fetchInitialData} />}
              {activeTab === 'announcements' && <AnnouncementManager announcements={announcements} onUpdate={fetchInitialData} />}
              {activeTab === 'prizes' && <PrizeManager seasons={seasons} onUpdate={fetchInitialData} />}
              {activeTab === 'tournaments' && <TournamentManager tournaments={tournaments} onUpdate={fetchInitialData} />}
            </motion.div>
          </AnimatePresence>
        )}
      </div>
    </div>
  );
}

// ==========================================
// Sub-Components for Tabs
// ==========================================

function GeneralConfig({ configs, onUpdate }: { configs: SystemConfig[], onUpdate: () => void }) {
    const isPaused = configs.find(c => c.key === 'season_paused')?.value === 'true';
    const intervalDays = configs.find(c => c.key === 'season_interval_days')?.value || '90';
    const intervalHours = configs.find(c => c.key === 'season_interval_hours')?.value || '0';
    const intervalMinutes = configs.find(c => c.key === 'season_interval_minutes')?.value || '0';
    const startDate = configs.find(c => c.key === 'season_start_date')?.value || '';

    const [localDays, setLocalDays] = useState(intervalDays);
    const [localHours, setLocalHours] = useState(intervalHours);
    const [localMinutes, setLocalMinutes] = useState(intervalMinutes);
    const [localStartDate, setLocalStartDate] = useState(startDate.split('T')[0]);
    const [saving, setSaving] = useState(false);

    const handleSave = async () => {
        setSaving(true);
        try {
            await Promise.all([
                adminApi.updateConfig('season_interval_days', localDays),
                adminApi.updateConfig('season_interval_hours', localHours),
                adminApi.updateConfig('season_interval_minutes', localMinutes),
                adminApi.updateConfig('season_start_date', `${localStartDate}T00:00:00`),
            ]);
            onUpdate();
            toast.success("系統設定已更新！");
        } catch (err: any) {
            toast.error("更新失敗", { description: err.message || "請檢查網路連線" });
        } finally {
            setSaving(false);
        }
    };

    const handleTogglePause = async () => {
        setSaving(true);
        try {
            await adminApi.updateConfig('season_paused', String(!isPaused));
            onUpdate();
        } finally {
            setSaving(false);
        }
    };

    return (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            <Card className="p-8 border-none shadow-xl bg-gradient-to-br from-white to-slate-50/50 rounded-[2rem]">
                <h3 className="text-xl font-black text-primary-navy mb-8 flex items-center gap-3">
                    <Pause className="text-sapphire-blue" size={24} />
                    賽季自動管控
                </h3>
                
                <div className="space-y-8">
                    <div className="flex items-center justify-between p-6 bg-white rounded-3xl border border-slate-100 shadow-sm">
                        <div>
                            <p className="font-bold text-slate-800">暫停積分申報</p>
                            <p className="text-xs text-slate-400 mt-1">開啟後所有人將無法發起新的大會積分報分</p>
                        </div>
                        <button 
                            onClick={handleTogglePause}
                            disabled={saving}
                            className={cn(
                                "w-16 h-8 rounded-full transition-all duration-500 relative",
                                isPaused ? "bg-rose-500" : "bg-slate-200"
                            )}
                        >
                            <motion.div 
                                animate={{ x: isPaused ? 32 : 4 }}
                                className="size-6 bg-white rounded-full absolute top-1 shadow-md" 
                            />
                        </button>
                    </div>

                    <div className="space-y-4">
                        <label className="text-xs font-black text-slate-400 uppercase tracking-widest ml-1">自動產生賽季間隔</label>
                        <div className="grid grid-cols-3 gap-4">
                            <div className="space-y-2">
                                <p className="text-[10px] font-bold text-slate-400 text-center uppercase tracking-tighter">Days 天</p>
                                <input 
                                    type="number" 
                                    value={localDays}
                                    onChange={e => setLocalDays(e.target.value)}
                                    className="w-full h-14 px-4 rounded-2xl bg-white border border-slate-100 shadow-sm focus:ring-2 focus:ring-sapphire-blue outline-none font-bold text-center"
                                />
                            </div>
                            <div className="space-y-2">
                                <p className="text-[10px] font-bold text-slate-400 text-center uppercase tracking-tighter">Hours 時</p>
                                <input 
                                    type="number" 
                                    value={localHours}
                                    onChange={e => setLocalHours(e.target.value)}
                                    className="w-full h-14 px-4 rounded-2xl bg-white border border-slate-100 shadow-sm focus:ring-2 focus:ring-sapphire-blue outline-none font-bold text-center"
                                />
                            </div>
                            <div className="space-y-2">
                                <p className="text-[10px] font-bold text-slate-400 text-center uppercase tracking-tighter">Mins 分</p>
                                <input 
                                    type="number" 
                                    value={localMinutes}
                                    onChange={e => setLocalMinutes(e.target.value)}
                                    className="w-full h-14 px-4 rounded-2xl bg-white border border-slate-100 shadow-sm focus:ring-2 focus:ring-sapphire-blue outline-none font-bold text-center"
                                />
                            </div>
                        </div>
                    </div>

                    <div className="space-y-4">
                        <label className="text-xs font-black text-slate-400 uppercase tracking-widest ml-1">首季起始基準日</label>
                        <input 
                            type="date" 
                            value={localStartDate}
                            onChange={e => setLocalStartDate(e.target.value)}
                            className="w-full h-14 px-6 rounded-2xl bg-white border border-slate-100 shadow-sm focus:ring-2 focus:ring-sapphire-blue focus:border-transparent transition-all outline-none font-bold"
                        />
                    </div>

                    <Button 
                        onClick={handleSave}
                        disabled={saving}
                        className="w-full h-14 rounded-2xl bg-primary-navy hover:bg-slate-800 text-white border-none shadow-lg shadow-primary-navy/20 font-black tracking-widest uppercase transition-all"
                    >
                        {saving ? <Loader2 className="animate-spin mr-2" /> : <Save className="mr-2" size={20} />}
                        儲存變更
                    </Button>
                </div>
            </Card>

            <div className="space-y-8">
                <Card className="p-8 border-none shadow-xl bg-sapphire-blue text-white rounded-[2rem] overflow-hidden relative group">
                    <div className="absolute top-0 right-0 w-64 h-64 bg-white/10 rounded-full -mr-20 -mt-20 blur-3xl group-hover:bg-white/20 transition-all duration-1000" />
                    <h3 className="text-xl font-black mb-4 relative z-10">
                        自動排程說明
                    </h3>
                    <p className="text-sm text-white/80 leading-relaxed mb-6 relative z-10">
                        系統會依據您設定的「起始基準日」與「間隔月份」自動定義出無限個虛擬時間區間。
                        後端排程器每日凌晨會檢查當前時間落在哪個區間，若該區間的「賽季紀錄」尚未建立，則會自動啟動新賽季並封存舊賽季。
                    </p>
                    <div className="bg-white/10 backdrop-blur-md rounded-2xl p-4 border border-white/10 relative z-10">
                        <p className="text-[10px] font-black uppercase tracking-widest text-white/60 mb-2">預覽下一個賽季</p>
                        <div className="flex items-center gap-3">
                            <Calendar size={18} className="text-olympic-gold" />
                            <p className="font-bold">2026 積分賽 (第 3 階段)</p>
                        </div>
                    </div>
                </Card>
            </div>
        </div>
    );
}

function AnnouncementManager({ announcements, onUpdate }: { announcements: Announcement[], onUpdate: () => void }) {
    const [isAdding, setIsAdding] = useState(false);
    const [editingId, setEditingId] = useState<string | null>(null);
    const [formData, setFormData] = useState({ 
        title: '', 
        content: '', 
        link_text: '', 
        link_url: '',
        type: 'system' as 'club' | 'system' | 'tournament',
        is_active: true
    });

    const handleCreate = async (data: any) => {
        try {
            if (editingId) {
                await adminApi.updateAnnouncement(editingId, data);
            } else {
                await adminApi.createAnnouncement(data);
            }
            setIsAdding(false);
            setEditingId(null);
            onUpdate();
            toast.success(editingId ? "公告已更新" : "公告發布成功");
        } catch (err: any) { 
            toast.error(editingId ? "更新失敗" : "發布失敗", { description: err.message });
        }
    };

    const handleEdit = (ann: Announcement) => {
        setEditingId(ann.id);
        setFormData({
            title: ann.title,
            content: ann.content,
            link_text: ann.link_text || '',
            link_url: ann.link_url || '',
            type: ann.type,
            is_active: ann.is_active
        });
        setIsAdding(true);
    };

    const handleDelete = async (id: string) => {
        if (!confirm("確定要刪除這條公告嗎？")) return;
        try {
            await adminApi.deleteAnnouncement(id);
            onUpdate();
            toast.success("公告已刪除");
        } catch (err: any) { 
            toast.error("刪除失敗", { description: err.message });
        }
    };

    const getTypeBadge = (type: string) => {
        switch(type) {
            case 'tournament': return { label: '賽事公告', bg: 'bg-amber-100', text: 'text-amber-600' };
            case 'club': return { label: '社團公告', bg: 'bg-emerald-100', text: 'text-emerald-600' };
            default: return { label: '系統公告', bg: 'bg-indigo-100', text: 'text-indigo-600' };
        }
    };

    return (
        <div className="space-y-8">
            {/* Header / New Button */}
            <div className="flex items-center justify-between">
                <div className="space-y-1">
                    <h3 className="text-2xl font-black text-primary-navy">公告管理</h3>
                    <p className="text-xs text-slate-400 font-bold uppercase tracking-widest">系統、社團與賽事即時資訊發布</p>
                </div>
                <Button 
                    onClick={() => {
                        setEditingId(null);
                        setFormData({ title: '', content: '', link_text: '', link_url: '', type: 'system', is_active: true });
                        setIsAdding(true);
                    }}
                    className="h-12 px-6 rounded-xl bg-sapphire-blue hover:bg-primary-navy text-white transition-all shadow-lg shadow-sapphire-blue/20 flex items-center gap-2 font-black uppercase tracking-widest"
                >
                    <Plus size={18} /> 新增公告
                </Button>
            </div>

            {/* List */}
            <div className="space-y-4">

                {announcements.map(ann => {
                    const badge = getTypeBadge(ann.type || 'system');
                    return (
                        <Card key={ann.id} className="p-4 md:p-6 border-none shadow-md hover:shadow-lg transition-shadow bg-white rounded-2xl group flex flex-col gap-4">
                            <div className="space-y-1 w-full">
                                <div className="flex items-center gap-3 flex-wrap">
                                    <h4 className="font-bold text-base md:text-lg text-primary-navy truncate">{ann.title}</h4>
                                    <span className={cn(
                                        "px-2 py-0.5 text-[9px] md:text-[10px] font-black uppercase rounded",
                                        badge.bg, badge.text
                                    )}>
                                        {badge.label}
                                    </span>
                                    {!ann.is_active && <span className="px-2 py-0.5 bg-slate-100 text-slate-400 text-[9px] md:text-[10px] font-black uppercase rounded">已下架</span>}
                                </div>
                                <p className="text-xs md:text-sm text-slate-500 leading-relaxed whitespace-pre-wrap">{ann.content}</p>
                                {ann.link_url && (
                                    <div className="flex items-center gap-2 text-[10px] md:text-xs font-bold text-sapphire-blue pt-1">
                                        <ExternalLink size={12} />
                                        {ann.link_text || '連結'} : <span className="opacity-60 truncate">{ann.link_url}</span>
                                    </div>
                                )}
                            </div>
                            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-50 transition-all">
                                <button 
                                    onClick={() => handleEdit(ann)}
                                    className="flex items-center gap-2 px-3 py-2 text-xs font-bold text-sapphire-blue bg-sapphire-blue/5 hover:bg-sapphire-blue/10 rounded-lg transition-all"
                                >
                                    <Edit size={14} />
                                    <span>編輯</span>
                                </button>
                                <button 
                                    onClick={() => handleDelete(ann.id)}
                                    className="flex items-center gap-2 px-3 py-2 text-xs font-bold text-rose-500 bg-rose-50 hover:bg-rose-100 rounded-lg transition-all"
                                >
                                    <Trash2 size={14} />
                                    <span>刪除</span>
                                </button>
                            </div>
                        </Card>
                    );
                })}

                {announcements.length === 0 && (
                    <div className="py-20 text-center text-slate-400 bg-slate-50/50 rounded-4xl border border-dashed border-slate-200">
                        目前沒有任何公開公告
                    </div>
                )}
            </div>

            {/* Modal / Drawer Section */}
            <ResponsiveAnnouncementModal 
                isOpen={isAdding}
                onClose={() => setIsAdding(false)}
                title={editingId ? '編輯公告' : '發布新公告'}
                data={formData}
                onSave={handleCreate}
                getTypeBadge={getTypeBadge}
            />
        </div>
    );
}

// ==========================================
// Specialized UI for Form/Modal
// ==========================================

function AnnouncementFormContent({ data, onChange, getTypeBadge }: any) {
    return (
        <div className="p-1 space-y-6">
            <div className="space-y-4">
                <div className="space-y-2">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">公告類型</label>
                    <div className="grid grid-cols-3 gap-2">
                        {(['system', 'club', 'tournament'] as const).map(t => {
                            const badge = getTypeBadge(t);
                            const isSelected = data.type === t;
                            return (
                                <button
                                    key={t}
                                    onClick={() => onChange({...data, type: t})}
                                    className={cn(
                                        "px-2 py-3 rounded-xl border-2 transition-all text-[11px] font-bold flex items-center justify-center",
                                        isSelected 
                                            ? cn(badge.bg, "border-current shadow-sm", badge.text) 
                                            : "bg-white border-slate-100 text-slate-300 hover:bg-slate-50"
                                    )}
                                >
                                    {badge.label}
                                </button>
                            );
                        })}
                    </div>
                </div>

                <div className="space-y-2">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">標題</label>
                    <input 
                        placeholder="請輸入標題"
                        value={data.title}
                        onChange={e => onChange({...data, title: e.target.value})}
                        className="w-full h-12 px-5 rounded-xl bg-slate-50 border-none focus:ring-2 focus:ring-sapphire-blue transition-all outline-none font-bold text-sm"
                    />
                </div>
                <div className="space-y-2">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">內文詳情</label>
                    <textarea 
                        placeholder="公告內容..."
                        rows={4}
                        value={data.content}
                        onChange={e => onChange({...data, content: e.target.value})}
                        className="w-full px-5 py-4 rounded-xl bg-slate-50 border-none focus:ring-2 focus:ring-sapphire-blue transition-all outline-none font-bold text-sm resize-none"
                    />
                </div>
                <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">按鈕文字</label>
                        <input 
                            placeholder="例：前往報名"
                            value={data.link_text}
                            onChange={e => onChange({...data, link_text: e.target.value})}
                            className="w-full h-12 px-5 rounded-xl bg-slate-50 border-none focus:ring-2 focus:ring-sapphire-blue transition-all outline-none font-bold text-xs"
                        />
                    </div>
                    <div className="space-y-2">
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">連結 URL</label>
                        <input 
                            placeholder="https://..."
                            value={data.link_url}
                            onChange={e => onChange({...data, link_url: e.target.value})}
                            className="w-full h-12 px-5 rounded-xl bg-slate-50 border-none focus:ring-2 focus:ring-sapphire-blue transition-all outline-none font-bold text-xs"
                        />
                    </div>
                </div>
                
                <div className="flex items-center gap-3 p-4 bg-slate-50 rounded-2xl">
                    <input 
                        type="checkbox" 
                        id="is_active" 
                        checked={data.is_active}
                        onChange={e => onChange({...data, is_active: e.target.checked})}
                        className="size-5 rounded border-slate-300 text-sapphire-blue focus:ring-sapphire-blue"
                    />
                    <label htmlFor="is_active" className="text-xs font-bold text-slate-600">上架狀態 (開啟則對外顯示)</label>
                </div>
            </div>
        </div>
    );
}

function ResponsiveAnnouncementModal({ isOpen, onClose, title, data, onSave, getTypeBadge }: any) {
    const isDesktop = useMediaQuery("(min-width: 1024px)");
    const [localData, setLocalData] = useState(data);

    useEffect(() => {
        setLocalData(data);
    }, [data, isOpen]);

    if (isDesktop) {
        return (
            <Dialog open={isOpen} onOpenChange={onClose}>
                <DialogContent className="max-w-2xl">
                    <DialogHeader>
                        <DialogTitle>{title}</DialogTitle>
                        <DialogDescription>發布新的公告資訊到對戰主卡片中</DialogDescription>
                    </DialogHeader>
                    <AnnouncementFormContent 
                        data={localData} 
                        onChange={setLocalData} 
                        getTypeBadge={getTypeBadge}
                    />
                    <DialogFooter>
                        <Button 
                            onClick={() => onSave(localData)}
                            className="w-full h-14 bg-sapphire-blue hover:bg-primary-navy text-white rounded-2xl border-none font-black uppercase tracking-widest shadow-lg"
                        >
                            確定儲存
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        );
    }

    return (
        <Drawer open={isOpen} onOpenChange={onClose}>
            <DrawerContent>
                 <DrawerHeader className="text-left border-b border-slate-50">
                    <DrawerTitle className="text-xl font-black text-primary-navy tracking-tight">{title}</DrawerTitle>
                    <DrawerDescription>填寫公告詳情後點擊發布</DrawerDescription>
                </DrawerHeader>
                <div className="px-6 py-4 pb-12 overflow-y-auto max-h-[70vh]">
                    <AnnouncementFormContent 
                        data={localData} 
                        onChange={setLocalData} 
                        getTypeBadge={getTypeBadge}
                    />
                    <DrawerFooter className="px-0 pt-6">
                        <Button 
                            onClick={() => onSave(localData)}
                            className="w-full h-14 bg-sapphire-blue hover:bg-primary-navy text-white rounded-2xl border-none font-black uppercase tracking-widest shadow-md"
                        >
                            確認發布
                        </Button>
                    </DrawerFooter>
                </div>
            </DrawerContent>
        </Drawer>
    );
}

function PrizeManager({ seasons, onUpdate }: { seasons: any[], onUpdate: () => void }) {
    const [selectedSeason, setSelectedSeason] = useState(seasons[0]?.id || '');
    const [prizes, setPrizes] = useState<SeasonPrize[]>([]);
    const [extraPrizes, setExtraPrizes] = useState<Partial<SeasonPrize>[]>([]);

    useEffect(() => {
        if (selectedSeason) fetchPrizes();
        setExtraPrizes([]);
    }, [selectedSeason]);

    const fetchPrizes = async () => {
        try {
            const data = await adminApi.getSeasonPrizes(selectedSeason);
            setPrizes(data);
        } catch (err) { console.error(err); }
    };

    const handleSavePrize = async (p: Partial<SeasonPrize>) => {
        try {
            if (p.id) {
                await adminApi.updateSeasonPrize(p.id, p);
            } else {
                await adminApi.saveSeasonPrize({ ...p, season_id: selectedSeason });
            }
            fetchPrizes();
            setExtraPrizes(prev => prev.filter(ep => ep !== p));
            toast.success("獎項已更新");
            onUpdate();
        } catch (err: any) { 
            toast.error("儲存失敗", { description: err.message });
        }
    };

    const handleDeletePrize = async (id?: string) => {
        if (!id) return;
        if (!confirm("確定要刪除這個獎項嗎？")) return;
        try {
            await adminApi.deleteSeasonPrize(id);
            fetchPrizes();
            onUpdate();
            toast.success("獎項已刪除");
        } catch (err: any) { 
            toast.error("刪除失敗", { description: err.message });
        }
    };

    return (
        <div className="space-y-8">
            <header className="flex flex-col md:flex-row md:items-center justify-between gap-6">
                <div>
                    <h3 className="text-xl font-black text-primary-navy">賽季獎勵設置</h3>
                    <p className="text-sm text-slate-400 mt-1">選定具體賽季並設置對應的名次或特殊獎勵</p>
                </div>
                <div className="flex items-center gap-4">
                    <select 
                        value={selectedSeason}
                        onChange={e => setSelectedSeason(e.target.value)}
                        className="h-12 px-6 rounded-xl bg-white border border-slate-200 shadow-sm font-bold min-w-[200px] outline-none focus:ring-2 focus:ring-sapphire-blue transition-all"
                    >
                        {seasons.map(s => <option key={s.id} value={s.id}>{s.name || s.id}</option>)}
                    </select>
                    <Button 
                        onClick={() => setExtraPrizes([...extraPrizes, { rank: 0, item_name: '', quantity: 1 }])}
                        className="h-12 px-6 bg-sapphire-blue hover:bg-primary-navy text-white rounded-xl border-none shadow-md"
                    >
                        <Plus size={18} className="mr-2" /> 新增特殊獎項
                    </Button>
                </div>
            </header>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Standard Ranks 1, 2, 3 */}
                {[1, 2, 3].map(rank => {
                    // 優先找到該名次的獎項，不論有無標籤
                    const prize = prizes.find(p => p.rank === rank);
                    return (
                        <PrizeFormCard 
                            key={`rank-${rank}`} 
                            rank={rank} 
                            prize={prize} 
                            onSave={handleSavePrize}
                            onDelete={handleDeletePrize}
                        />
                    );
                })}

                {/* Existing Extra / Labelled Prizes (排除已經在 1, 2, 3 顯示的) */}
                {prizes.filter(p => p.rank <= 0 || p.rank > 3).map(prize => (
                    <PrizeFormCard 
                        key={prize.id} 
                        prize={prize} 
                        onSave={handleSavePrize}
                        onDelete={handleDeletePrize}
                    />
                ))}

                {/* Temporary New Extra Prizes */}
                {extraPrizes.map((p, idx) => (
                    <PrizeFormCard 
                        key={`extra-${idx}`}
                        prize={p as SeasonPrize}
                        isNew
                        onSave={handleSavePrize}
                        onDelete={() => setExtraPrizes(extraPrizes.filter((_, i) => i !== idx))}
                    />
                ))}
            </div>
        </div>
    );
}

function PrizeFormCard({ rank: initialRank, prize, onSave, onDelete, isNew }: { 
    rank?: number, 
    prize?: SeasonPrize, 
    onSave: (p: Partial<SeasonPrize>) => void, 
    onDelete: (id?: string) => void,
    isNew?: boolean
}) {
    const [name, setName] = useState(prize?.item_name || '');
    const [qty, setQty] = useState(prize?.quantity || 1);
    const [url, setUrl] = useState(prize?.image_url || '');
    const [rank, setRank] = useState(prize?.rank ?? initialRank ?? 0);
    const [label, setLabel] = useState(prize?.label || '');

    useEffect(() => {
        setName(prize?.item_name || '');
        setQty(prize?.quantity || 1);
        setUrl(prize?.image_url || '');
        setRank(prize?.rank ?? initialRank ?? 0);
        setLabel(prize?.label || '');
    }, [prize, initialRank]);

    const isStandard = rank >= 1 && rank <= 3;
    const defaultLabel = rank === 1 ? '冠軍' : rank === 2 ? '亞軍' : rank === 3 ? '季軍' : '';
    const displayLabel = label || defaultLabel;

    return (
        <Card className={cn(
            "p-8 border-none shadow-xl bg-white rounded-[2rem] space-y-6 relative group",
            isNew && "ring-2 ring-sapphire-blue ring-offset-4"
        )}>
            {prize?.id && (
                <button 
                    onClick={() => onDelete(prize.id)}
                    className="absolute top-6 right-6 p-2 text-slate-300 hover:text-rose-500 hover:bg-rose-50 rounded-lg transition-all opacity-0 group-hover:opacity-100"
                >
                    <Trash2 size={18} />
                </button>
            )}

            <div className="flex items-center justify-between">
                <div className={cn(
                    "size-12 rounded-2xl flex items-center justify-center font-black text-xl",
                    isStandard && !label ? (
                        rank === 1 ? "bg-olympic-gold/20 text-olympic-gold" : 
                        rank === 2 ? "bg-slate-200 text-slate-500" : "bg-orange-100 text-orange-600"
                    ) : "bg-sapphire-blue/10 text-sapphire-blue"
                )}>
                    {rank || '★'}
                </div>
                <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 underline decoration-slate-200 underline-offset-4">
                    {displayLabel || `Rank ${rank} Prize`}
                </p>
            </div>

            <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                        <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">名次 (Rank)</label>
                        <input 
                            type="number"
                            value={rank} onChange={e => setRank(parseInt(e.target.value) || 0)}
                            className="w-full h-11 px-4 rounded-xl bg-slate-50 border-none outline-none font-bold text-sm"
                        />
                    </div>
                    <div className="space-y-2">
                        <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">標籤 (Label)</label>
                        <input 
                            placeholder={defaultLabel || "例：MVP"}
                            value={label} onChange={e => setLabel(e.target.value)}
                            className="w-full h-11 px-4 rounded-xl bg-slate-50 border-none outline-none font-bold text-sm"
                        />
                    </div>
                </div>

                <div className="space-y-2">
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">物品名稱</label>
                    <input 
                        value={name} onChange={e => setName(e.target.value)}
                        className="w-full h-11 px-4 rounded-xl bg-slate-50 border-none outline-none font-bold text-sm"
                    />
                </div>
                <div className="grid grid-cols-3 gap-4">
                    <div className="col-span-1 space-y-2">
                        <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">數量</label>
                        <input 
                            type="number" value={qty} onChange={e => setQty(parseInt(e.target.value) || 0)}
                            className="w-full h-11 px-4 rounded-xl bg-slate-50 border-none outline-none font-bold text-sm"
                        />
                    </div>
                    <div className="col-span-2 space-y-2">
                        <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">圖片網址</label>
                        <input 
                            value={url} onChange={e => setUrl(e.target.value)}
                            className="w-full h-11 px-4 rounded-xl bg-slate-50 border-none outline-none font-bold text-xs"
                        />
                    </div>
                </div>
            </div>

            <Button 
                onClick={() => onSave({ 
                    ...prize, 
                    rank, 
                    label: label || defaultLabel, 
                    item_name: name, 
                    quantity: qty, 
                    image_url: url 
                })}
                className="w-full h-12 bg-primary-navy hover:bg-slate-800 text-white rounded-xl border-none transition-all font-bold"
            >
                {prize?.id ? '更新項目' : '建立獎項'}
            </Button>
        </Card>
    );
}

function TournamentManager({ tournaments, onUpdate }: { tournaments: TournamentEvent[], onUpdate: () => void }) {
    const [isAdding, setIsAdding] = useState(false);
    const [selectedTourn, setSelectedTourn] = useState<string | null>(null);
    const [participants, setParticipants] = useState<AdminParticipantResponse[]>([]);
    
    // Create Form
    const [formData, setFormData] = useState({ title: '', rules: '', image_url: '' });

    useEffect(() => {
        if (selectedTourn) fetchParticipants();
    }, [selectedTourn]);

    const fetchParticipants = async () => {
        if (!selectedTourn) return;
        const res = await adminApi.getParticipants(selectedTourn);
        setParticipants(res);
    };

    const handleCreate = async () => {
        await adminApi.createTournament(formData);
        setIsAdding(false);
        setFormData({ title: '', rules: '', image_url: '' });
        onUpdate();
    };

    const handleRemovePlayer = async (userId: string) => {
        if (!selectedTourn) return;
        await adminApi.removeParticipant(selectedTourn, userId);
        fetchParticipants();
    };

    return (
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
            {/* List */}
            <div className="lg:col-span-1 space-y-4">
                <Button 
                    onClick={() => setIsAdding(true)}
                    className="w-full h-14 bg-indigo-600 hover:bg-indigo-700 text-white rounded-2xl border-none transition-all shadow-lg shadow-indigo-200 font-bold mb-4"
                >
                    <Plus className="mr-2" /> 新賽事
                </Button>
                
                {tournaments.map(t => (
                    <Card 
                        key={t.id} 
                        onClick={() => { setSelectedTourn(t.id); setIsAdding(false); }}
                        className={cn(
                            "p-4 cursor-pointer border-none transition-all rounded-2xl group",
                            selectedTourn === t.id ? "bg-primary-navy text-white shadow-xl" : "bg-white hover:bg-slate-50 shadow-md"
                        )}
                    >
                        <div className="flex items-center justify-between">
                            <p className="font-bold truncate pr-4">{t.title}</p>
                            <ChevronRight size={16} className={cn(selectedTourn === t.id ? "opacity-100" : "opacity-0 group-hover:opacity-100")} />
                        </div>
                        <p className={cn("text-[10px] mt-1 font-black", selectedTourn === t.id ? "text-indigo-300" : "text-slate-400 uppercase tracking-widest")}>
                            {t.status}
                        </p>
                    </Card>
                ))}
            </div>

            {/* Management Section */}
            <div className="lg:col-span-3">
                {isAdding ? (
                    <Card className="p-10 border-none shadow-2xl bg-white rounded-[2.5rem] max-w-2xl">
                         <h3 className="text-2xl font-black text-primary-navy mb-8">發起獨立錦標賽</h3>
                         <div className="space-y-6">
                            <div className="space-y-2">
                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">賽事名稱</label>
                                <input 
                                    placeholder="例如：2026 尾牙友誼賽"
                                    value={formData.title}
                                    onChange={e => setFormData({...formData, title: e.target.value})}
                                    className="w-full h-14 px-6 rounded-2xl bg-slate-50 border-none focus:ring-2 focus:ring-indigo-500 transition-all outline-none font-bold"
                                />
                            </div>
                            <div className="space-y-2">
                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Challonge 賽程連結 或 規則</label>
                                <input 
                                    placeholder="https://challonge.com/..."
                                    value={formData.rules}
                                    onChange={e => setFormData({...formData, rules: e.target.value})}
                                    className="w-full h-14 px-6 rounded-2xl bg-slate-50 border-none focus:ring-2 focus:ring-indigo-500 transition-all outline-none font-bold"
                                />
                            </div>
                            <div className="space-y-2">
                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">預覽圖 URL</label>
                                <input 
                                    placeholder="https://..."
                                    value={formData.image_url}
                                    onChange={e => setFormData({...formData, image_url: e.target.value})}
                                    className="w-full h-14 px-6 rounded-2xl bg-slate-50 border-none focus:ring-2 focus:ring-indigo-500 transition-all outline-none font-bold"
                                />
                            </div>
                            <div className="flex gap-4 pt-4">
                                <Button onClick={() => setIsAdding(false)} variant="outline" className="flex-1 h-14 rounded-2xl font-black uppercase">取消</Button>
                                <Button onClick={handleCreate} className="flex-2 h-14 bg-indigo-600 hover:bg-indigo-700 text-white rounded-2xl border-none shadow-lg shadow-indigo-100 font-black uppercase tracking-widest">建立賽事</Button>
                            </div>
                         </div>
                    </Card>
                ) : selectedTourn ? (
                    <div className="space-y-8">
                        <Card className="p-8 border-none shadow-xl bg-white rounded-[2rem] flex items-center justify-between">
                            <div>
                                <h3 className="text-2xl font-black text-primary-navy">{tournaments.find(t => t.id === selectedTourn)?.title}</h3>
                                <p className="text-sm text-slate-400">{participants.length} 位已報名同仁</p>
                            </div>
                            <div className="flex gap-3">
                                <Button className="rounded-xl font-bold bg-slate-50 text-slate-600 hover:bg-slate-100 border-none">切換狀態</Button>
                                <Button className="rounded-xl font-bold bg-rose-50 text-rose-600 hover:bg-rose-100 border-none">刪除賽事</Button>
                            </div>
                        </Card>

                        <Card className="p-8 border-none shadow-xl bg-white rounded-[2rem]">
                            <h4 className="font-black text-primary-navy mb-6 flex items-center justify-between">
                                參賽名單
                                <Button size="sm" className="rounded-lg bg-indigo-50 text-indigo-600 hover:bg-indigo-100 border-none"><Plus size={16} className="mr-1" /> 手動加入玩家</Button>
                            </h4>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                {participants.map(p => (
                                    <div key={p.participant.id} className="p-4 bg-slate-50 rounded-2xl flex items-center justify-between group">
                                        <div className="flex items-center gap-3">
                                            <div className="size-10 rounded-xl overflow-hidden bg-white border border-slate-200">
                                                <img src={p.user.avatar_url || '/api/placeholder/40/40'} className="size-full object-cover" />
                                            </div>
                                            <div>
                                                <p className="font-bold text-slate-800">{p.user.name}</p>
                                                <p className="text-[10px] text-slate-400 font-medium">{p.user.department}</p>
                                            </div>
                                        </div>
                                        <button 
                                            onClick={() => handleRemovePlayer(p.user.id)}
                                            className="p-2 text-slate-300 hover:text-rose-500 hover:bg-rose-100 rounded-lg transition-all opacity-0 group-hover:opacity-100"
                                        >
                                            <Trash2 size={16} />
                                        </button>
                                    </div>
                                ))}
                                {participants.length === 0 && <p className="col-span-2 py-8 text-center text-slate-400 text-sm">目前無任何參賽者</p>}
                            </div>
                        </Card>
                    </div>
                ) : (
                    <div className="h-[400px] flex flex-col items-center justify-center text-slate-300 space-y-4">
                        <ImageIcon size={64} strokeWidth={1} />
                        <p className="font-bold">請從左側選擇要管理的錦標賽</p>
                    </div>
                )}
            </div>
        </div>
    );
}
