import { useId, useState, useEffect, useRef } from 'react';
import { format, parseISO, isValid } from 'date-fns';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
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
    Image as ImageIcon,
    UploadCloud,
    X
} from 'lucide-react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { adminApi, type AnnouncementPayload, type TournamentCreatePayload } from '@/lib/admin';
import apiClient from '@/utils/apiClient';
import type { SystemConfig, Announcement, TournamentEvent, SeasonPrize } from '@/types/admin';
import type { AnnouncementType, SeasonSummary } from '@/types/api.types';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { PageHeader } from '@/components/PageHeader';
import { PlayerAvatar } from '@/components/PlayerAvatar';
import { ResponsiveFormModal } from '@/components/ResponsiveFormModal';
import { toast } from 'sonner';

const tabs = [
    { id: 'general', label: '系統設定', icon: Settings },
    { id: 'announcements', label: '公告管理', icon: Megaphone },
    { id: 'prizes', label: '賽季獎品', icon: Trophy },
    { id: 'tournaments', label: '錦標賽', icon: Users },
];

export function AdminDashboard() {
    const { data: user } = useAuth();
    const queryClient = useQueryClient();
    const [activeTab, setActiveTab] = useState('general');

    // Fetch configs
    const { data: configs = [], isLoading: isConfigsLoading } = useQuery({
        queryKey: ['admin', 'configs'],
        queryFn: () => adminApi.getConfigs()
    });

    // Fetch announcements
    const { data: announcements = [], isLoading: isAnnouncementsLoading } = useQuery({
        queryKey: ['admin', 'announcements'],
        queryFn: () => adminApi.getAnnouncements()
    });

    // Fetch tournaments
    const { data: tournaments = [], isLoading: isTournamentsLoading } = useQuery({
        queryKey: ['admin', 'tournaments'],
        queryFn: () => adminApi.getTournaments()
    });

    // Fetch seasons
    const { data: seasons = [], isLoading: isSeasonsLoading } = useQuery<SeasonSummary[]>({
        queryKey: ['seasons', 'list'],
        queryFn: async () => {
            const res = await apiClient.get<SeasonSummary[]>('/seasons');
            return res.data;
        }
    });

    const loading = isConfigsLoading || isAnnouncementsLoading || isTournamentsLoading || isSeasonsLoading;

    // Security: Redirect if not admin
    if (user && user.role !== 'admin') {
        return <Navigate to="/" replace />;
    }

    const handleUpdate = () => {
        queryClient.invalidateQueries({ queryKey: ['admin'] });
        queryClient.invalidateQueries({ queryKey: ['seasons'] });
    };

    const isSeasonPaused = configs.find((c) => c.key === 'season_paused')?.value === 'true';

    const statusCard = (
        <Card className={cn(
            "px-4 py-3 flex items-center gap-3.5 border shadow-xs transition-all duration-500 rounded-2xl w-full md:w-auto",
            isSeasonPaused
                ? "bg-rose-50 text-rose-600 border-rose-200 dark:bg-rose-500/12 dark:text-rose-300 dark:border-rose-500/30"
                : "bg-emerald-50 text-emerald-600 border-emerald-200 dark:bg-emerald-500/12 dark:text-emerald-300 dark:border-emerald-500/30"
        )}>
            <div className={cn(
                "size-9 rounded-xl flex items-center justify-center shrink-0",
                isSeasonPaused ? "bg-rose-100 dark:bg-rose-500/20" : "bg-emerald-100 dark:bg-emerald-500/20"
            )}>
                {isSeasonPaused ? <Pause size={18} /> : <Play size={18} />}
            </div>
            <div>
                <p className="text-xs font-black uppercase tracking-wider opacity-75">賽季狀態</p>
                <p className="font-bold text-sm">{isSeasonPaused ? '已暫停報分' : '正常運作中'}</p>
            </div>
        </Card>
    );

    return (
        <div className="arena-page">
            {/* Header Section */}
            <PageHeader
                title="管理主控台"
                subtitle="Precision Arena · Admin Control"
                badge={
                    <span className="px-2.5 py-0.5 bg-sapphire-blue/10 text-sapphire-blue dark:bg-blue-500/15 dark:text-blue-300 text-xs font-black uppercase tracking-wider rounded-full border border-sapphire-blue/20 dark:border-blue-500/30">
                        Admin
                    </span>
                }
                actions={statusCard}
            />

            {/* Tab Navigation */}
            <div className="flex flex-nowrap overflow-x-auto no-scrollbar gap-1.5 p-1 bg-secondary rounded-2xl border border-border w-full md:w-fit">
                {tabs.map((tab) => (
                    <button
                        type="button"
                        key={tab.id}
                        onClick={() => setActiveTab(tab.id)}
                        className={cn(
                            "flex items-center gap-2 px-4 sm:px-5 py-2.5 rounded-xl text-xs sm:text-sm font-bold transition-all duration-300 relative overflow-hidden shrink-0 whitespace-nowrap",
                            activeTab === tab.id
                                ? "bg-card text-foreground shadow-xs"
                                : "text-muted-foreground hover:bg-card/60 hover:text-foreground"
                        )}
                    >
                        <tab.icon size={16} aria-hidden="true" />
                        {tab.label}
                        {activeTab === tab.id && (
                            <motion.div
                                layoutId="tab-active"
                                className="absolute inset-0 bg-card -z-10"
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
                            <p className="text-muted-foreground font-bold uppercase tracking-widest text-xs">載入數據中...</p>
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
                            {activeTab === 'general' && <GeneralConfig configs={configs} onUpdate={handleUpdate} />}
                            {activeTab === 'announcements' && <AnnouncementManager announcements={announcements} onUpdate={handleUpdate} />}
                            {activeTab === 'prizes' && <PrizeManager seasons={seasons} onUpdate={handleUpdate} />}
                            {activeTab === 'tournaments' && <TournamentManager tournaments={tournaments} onUpdate={handleUpdate} />}
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
    const daysId = useId();
    const hoursId = useId();
    const minsId = useId();
    const startDateId = useId();

    const isPaused = configs.find((c) => c.key === 'season_paused')?.value === 'true';
    const intervalDays = configs.find((c) => c.key === 'season_interval_days')?.value || '90';
    const intervalHours = configs.find((c) => c.key === 'season_interval_hours')?.value || '0';
    const intervalMinutes = configs.find((c) => c.key === 'season_interval_minutes')?.value || '0';
    const startDate = configs.find((c) => c.key === 'season_start_date')?.value || '';

    const [localDays, setLocalDays] = useState(intervalDays);
    const [localHours, setLocalHours] = useState(intervalHours);
    const [localMinutes, setLocalMinutes] = useState(intervalMinutes);

    // 初始化時將 UTC 轉為本地格式給 datetime-local 使用
    const [localStartDate, setLocalStartDate] = useState(() => {
        if (!startDate) return '';
        try {
            const date = parseISO(startDate);
            return isValid(date) ? format(date, "yyyy-MM-dd'T'HH:mm:ss") : startDate;
        } catch { return startDate; }
    });

    const updateConfigsMutation = useMutation({
        mutationFn: async (updates: { key: string, value: string }[]) => {
            return Promise.all(updates.map(u => adminApi.updateConfig(u.key, u.value)));
        },
        onSuccess: () => {
            onUpdate();
            toast.success("系統設定已更新！");
        },
        onError: (err: Error) => {
            toast.error("更新失敗", { description: err.message || "請檢查網路連線" });
        }
    });

    const handleSave = (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        // 存檔前轉回 UTC ISO 字串
        let finalStartDate = localStartDate;
        if (localStartDate) {
            try {
                const date = new Date(localStartDate);
                if (!isNaN(date.getTime())) {
                    finalStartDate = date.toISOString();
                }
            } catch (err) {
                console.error("Date conversion error", err);
            }
        }

        updateConfigsMutation.mutate([
            { key: 'season_interval_days', value: localDays },
            { key: 'season_interval_hours', value: localHours },
            { key: 'season_interval_minutes', value: localMinutes },
            { key: 'season_start_date', value: finalStartDate },
        ]);
    };

    const handleTogglePause = () => {
        updateConfigsMutation.mutate([{ key: 'season_paused', value: String(!isPaused) }]);
    };

    const saving = updateConfigsMutation.isPending;

    return (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 sm:gap-8">
            <Card className="arena-card p-6 sm:p-8">
                <h3 className="text-xl font-black text-foreground mb-6 flex items-center gap-3">
                    <Pause className="text-sapphire-blue" size={22} aria-hidden="true" />
                    賽季自動管控
                </h3>

                <form onSubmit={handleSave} className="space-y-6">
                    <div className="flex items-center justify-between gap-4 p-4 sm:p-5 bg-surface-subtle/80 rounded-2xl border border-border">
                        <div>
                            <p className="font-bold text-foreground">暫停積分申報</p>
                            <p className="text-xs text-muted-foreground mt-1">開啟後所有人將無法發起新的大會積分報分</p>
                        </div>
                        <button
                            type="button"
                            role="switch"
                            aria-checked={isPaused}
                            aria-label="暫停積分申報"
                            onClick={handleTogglePause}
                            disabled={saving}
                            className={cn(
                                "w-14 h-8 rounded-full transition-colors duration-300 relative shrink-0",
                                isPaused ? "bg-rose-500" : "bg-slate-300 dark:bg-slate-700"
                            )}
                        >
                            <motion.div
                                animate={{ x: isPaused ? 28 : 4 }}
                                className="size-6 bg-white rounded-full absolute top-1 shadow-sm"
                            />
                        </button>
                    </div>

                    <fieldset className="space-y-3">
                        <legend className="arena-label text-muted-foreground">自動產生賽季間隔</legend>
                        <div className="grid grid-cols-3 gap-3">
                            <div>
                                <label htmlFor={daysId} className="arena-label text-center text-muted-foreground">Days 天</label>
                                <input
                                    id={daysId}
                                    name="intervalDays"
                                    type="number"
                                    min={0}
                                    value={localDays}
                                    onChange={e => setLocalDays(e.target.value)}
                                    className="arena-input text-center tabular-nums"
                                />
                            </div>
                            <div>
                                <label htmlFor={hoursId} className="arena-label text-center text-muted-foreground">Hours 時</label>
                                <input
                                    id={hoursId}
                                    name="intervalHours"
                                    type="number"
                                    min={0}
                                    max={23}
                                    value={localHours}
                                    onChange={e => setLocalHours(e.target.value)}
                                    className="arena-input text-center tabular-nums"
                                />
                            </div>
                            <div>
                                <label htmlFor={minsId} className="arena-label text-center text-muted-foreground">Mins 分</label>
                                <input
                                    id={minsId}
                                    name="intervalMinutes"
                                    type="number"
                                    min={0}
                                    max={59}
                                    value={localMinutes}
                                    onChange={e => setLocalMinutes(e.target.value)}
                                    className="arena-input text-center tabular-nums"
                                />
                            </div>
                        </div>
                    </fieldset>

                    <div>
                        <label htmlFor={startDateId} className="arena-label text-muted-foreground">首季起始基準時間 (含秒)</label>
                        <input
                            id={startDateId}
                            name="seasonStartDate"
                            type="datetime-local"
                            step="1"
                            value={localStartDate}
                            onChange={e => setLocalStartDate(e.target.value)}
                            className="arena-input"
                        />
                    </div>

                    <Button
                        type="submit"
                        disabled={saving}
                        className="w-full h-11 rounded-xl bg-primary hover:opacity-90 text-primary-foreground border-none shadow-sm font-display font-black text-sm tracking-wide transition-all"
                    >
                        {saving ? <Loader2 className="animate-spin mr-2" size={18} aria-hidden="true" /> : <Save className="mr-2" size={18} aria-hidden="true" />}
                        儲存設定變更
                    </Button>
                </form>
            </Card>

            <div className="space-y-8">
                <Card className="p-6 sm:p-8 border border-blue-700 shadow-lg bg-sapphire-blue text-white rounded-2xl md:rounded-3xl overflow-hidden relative group">
                    <div className="absolute top-0 right-0 w-64 h-64 bg-white/10 rounded-full -mr-20 -mt-20 blur-3xl group-hover:bg-white/20 transition-all duration-1000" />
                    <h3 className="text-xl font-black mb-4 relative z-10">
                        自動排程說明
                    </h3>
                    <p className="text-sm text-white/80 leading-relaxed mb-6 relative z-10">
                        系統會依據您設定的「起始基準日」與「間隔時間」自動定義出連續時間區間。
                        後端排程器每日檢查當前時間落在哪個區間，若該區間的「賽季紀錄」尚未建立，則會自動啟動新賽季並封存舊賽季。
                    </p>
                    <div className="bg-white/10 backdrop-blur-md rounded-2xl p-4 border border-white/10 relative z-10">
                        <p className="text-xs font-black uppercase tracking-widest text-white/60 mb-2">排程運作提示</p>
                        <div className="flex items-center gap-3">
                            <Calendar size={18} className="text-olympic-gold" aria-hidden="true" />
                            <p className="font-bold text-sm">依據基準時刻與間隔自動輪替賽季</p>
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
    const [deletingAnn, setDeletingAnn] = useState<Announcement | null>(null);
    const [formData, setFormData] = useState<AnnouncementPayload>({
        title: '',
        content: '',
        link_text: '',
        link_url: '',
        type: 'system',
        is_active: true
    });

    const createMutation = useMutation({
        mutationFn: (data: AnnouncementPayload) => adminApi.createAnnouncement(data),
        onSuccess: () => {
            setIsAdding(false);
            onUpdate();
            toast.success("公告發布成功");
        },
        onError: (err: Error) => toast.error("發布失敗", { description: err.message })
    });

    const updateMutation = useMutation({
        mutationFn: (data: { id: string; payload: AnnouncementPayload }) => adminApi.updateAnnouncement(data.id, data.payload),
        onSuccess: () => {
            setIsAdding(false);
            setEditingId(null);
            onUpdate();
            toast.success("公告已更新");
        },
        onError: (err: Error) => toast.error("更新失敗", { description: err.message })
    });

    const deleteMutation = useMutation({
        mutationFn: (id: string) => adminApi.deleteAnnouncement(id),
        onSuccess: () => {
            setDeletingAnn(null);
            onUpdate();
            toast.success("公告已刪除");
        },
        onError: (err: Error) => toast.error("刪除失敗", { description: err.message })
    });

    const handleSave = (data: typeof formData) => {
        if (!data.title.trim()) {
            toast.error("請輸入公告標題");
            return;
        }
        if (editingId) {
            updateMutation.mutate({ id: editingId, payload: data });
        } else {
            createMutation.mutate(data);
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

    const getTypeBadge = (type: string) => {
        switch (type) {
            case 'tournament': return { label: '賽事公告', bg: 'bg-amber-100 dark:bg-amber-500/15', text: 'text-amber-700 dark:text-amber-300' };
            case 'club': return { label: '社團公告', bg: 'bg-emerald-100 dark:bg-emerald-500/15', text: 'text-emerald-700 dark:text-emerald-300' };
            default: return { label: '系統公告', bg: 'bg-blue-100 dark:bg-blue-500/15', text: 'text-sapphire-blue dark:text-blue-300' };
        }
    };

    return (
        <div className="space-y-6">
            {/* Header / New Button */}
            <div className="flex flex-wrap items-center justify-between gap-4">
                <div className="space-y-1">
                    <h3 className="text-xl sm:text-2xl font-black text-foreground">公告管理</h3>
                    <p className="text-xs text-muted-foreground font-bold tracking-wide">系統、社團與賽事即時資訊發布</p>
                </div>
                <Button
                    type="button"
                    onClick={() => {
                        setEditingId(null);
                        setFormData({ title: '', content: '', link_text: '', link_url: '', type: 'system', is_active: true });
                        setIsAdding(true);
                    }}
                    className="h-11 px-5 rounded-xl bg-sapphire-blue hover:bg-blue-700 text-white transition-all shadow-sm flex items-center gap-2 font-black text-sm"
                >
                    <Plus size={17} aria-hidden="true" /> 新增公告
                </Button>
            </div>

            {/* List */}
            <div className="space-y-4">
                {announcements.map(ann => {
                    const badge = getTypeBadge(ann.type || 'system');
                    return (
                        <Card key={ann.id} className="arena-card p-4 sm:p-6 flex flex-col gap-4">
                            <div className="space-y-1.5 w-full">
                                <div className="flex items-center gap-2.5 flex-wrap">
                                    <h4 className="font-bold text-base md:text-lg text-foreground truncate">{ann.title}</h4>
                                    <span className={cn("px-2.5 py-0.5 text-xs font-black rounded-md", badge.bg, badge.text)}>
                                        {badge.label}
                                    </span>
                                    {!ann.is_active && (
                                        <span className="px-2 py-0.5 bg-secondary text-muted-foreground text-xs font-black rounded-md">已下架</span>
                                    )}
                                </div>
                                <p className="text-xs md:text-sm text-muted-foreground leading-relaxed whitespace-pre-wrap">{ann.content}</p>
                                {ann.link_url && (
                                    <div className="flex items-center gap-2 text-xs font-bold text-sapphire-blue pt-1">
                                        <ExternalLink size={12} aria-hidden="true" />
                                        {ann.link_text || '連結'} : <span className="opacity-70 truncate">{ann.link_url}</span>
                                    </div>
                                )}
                            </div>
                            <div className="flex items-center justify-end gap-2 pt-3 border-t border-border">
                                <button
                                    type="button"
                                    onClick={() => handleEdit(ann)}
                                    className="flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold text-sapphire-blue bg-sapphire-blue/5 hover:bg-sapphire-blue/10 dark:text-blue-300 dark:bg-blue-500/10 dark:hover:bg-blue-500/20 rounded-xl transition-colors"
                                >
                                    <Edit size={14} aria-hidden="true" />
                                    <span>編輯</span>
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setDeletingAnn(ann)}
                                    className="flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold text-rose-600 bg-rose-50 hover:bg-rose-100 dark:text-rose-300 dark:bg-rose-500/12 dark:hover:bg-rose-500/20 rounded-xl transition-colors"
                                >
                                    <Trash2 size={14} aria-hidden="true" />
                                    <span>刪除</span>
                                </button>
                            </div>
                        </Card>
                    );
                })}

                {announcements.length === 0 && (
                    <div className="py-20 text-center text-muted-foreground bg-surface-subtle/50 rounded-3xl border border-dashed border-border">
                        目前沒有任何公開公告
                    </div>
                )}
            </div>

            {/* 新增 / 編輯公告 Modal */}
            <ResponsiveAnnouncementModal
                isOpen={isAdding}
                onClose={() => setIsAdding(false)}
                title={editingId ? '編輯公告' : '發布新公告'}
                isEditing={Boolean(editingId)}
                isSaving={createMutation.isPending || updateMutation.isPending}
                data={formData}
                onChange={setFormData}
                onSave={handleSave}
                getTypeBadge={getTypeBadge}
            />

            {/* 刪除公告確認 Modal */}
            <ResponsiveFormModal
                open={Boolean(deletingAnn)}
                onOpenChange={(open) => !open && setDeletingAnn(null)}
                size="sm"
                tone="danger"
                icon={<Trash2 size={18} />}
                title="刪除公告"
                description="確定要永久刪除這則公告嗎？"
                onSubmit={(e) => {
                    e.preventDefault();
                    if (deletingAnn) deleteMutation.mutate(deletingAnn.id);
                }}
                footer={
                    <>
                        <Button
                            type="button"
                            variant="outline"
                            disabled={deleteMutation.isPending}
                            onClick={() => setDeletingAnn(null)}
                            className="w-full sm:w-auto h-11 px-5 rounded-xl border-border text-muted-foreground font-bold hover:bg-secondary hover:text-foreground"
                        >
                            取消
                        </Button>
                        <Button
                            type="submit"
                            disabled={deleteMutation.isPending}
                            className="w-full sm:w-auto h-11 px-6 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-display font-black text-sm shadow-sm"
                        >
                            {deleteMutation.isPending ? '刪除中...' : '確認刪除'}
                        </Button>
                    </>
                }
            >
                {deletingAnn && (
                    <div className="bg-rose-50/70 dark:bg-rose-500/12 border border-rose-200/80 dark:border-rose-500/30 rounded-2xl p-4 space-y-1">
                        <p className="text-sm font-black text-foreground">{deletingAnn.title}</p>
                        <p className="text-xs text-rose-700 dark:text-rose-300 font-bold">刪除後將立即從戰情室公告欄移除，無法復原。</p>
                    </div>
                )}
            </ResponsiveFormModal>
        </div>
    );
}

// ==========================================
// Specialized UI for Form/Modal
// ==========================================

function AnnouncementFormContent({
    data,
    onChange,
    getTypeBadge,
}: {
    data: AnnouncementPayload;
    onChange: (next: AnnouncementPayload) => void;
    getTypeBadge: (type: AnnouncementType) => { label: string; bg: string; text: string };
}) {
    const titleId = useId();
    const contentId = useId();
    const linkTextId = useId();
    const linkUrlId = useId();
    const activeId = useId();

    return (
        <div className="space-y-4">
            <fieldset>
                <legend className="arena-label text-muted-foreground">公告類型</legend>
                <div className="grid grid-cols-3 gap-2">
                    {(['system', 'club', 'tournament'] as const).map(t => {
                        const badge = getTypeBadge(t);
                        const isSelected = data.type === t;
                        return (
                            <button
                                type="button"
                                key={t}
                                aria-pressed={isSelected}
                                onClick={() => onChange({ ...data, type: t })}
                                className={cn(
                                    "min-h-11 px-2 rounded-xl border transition-all text-xs font-black flex items-center justify-center",
                                    isSelected
                                        ? cn(badge.bg, "border-current shadow-xs", badge.text)
                                        : "bg-card border-input text-muted-foreground hover:bg-secondary hover:text-foreground"
                                )}
                            >
                                {badge.label}
                            </button>
                        );
                    })}
                </div>
            </fieldset>

            <div>
                <label htmlFor={titleId} className="arena-label text-muted-foreground">
                    標題 <span aria-hidden="true" className="text-rose-500">*</span>
                </label>
                <input
                    id={titleId}
                    name="announcementTitle"
                    type="text"
                    required
                    placeholder="請輸入公告標題"
                    value={data.title}
                    onChange={e => onChange({ ...data, title: e.target.value })}
                    className="arena-input"
                />
            </div>

            <div>
                <label htmlFor={contentId} className="arena-label text-muted-foreground">內文詳情</label>
                <textarea
                    id={contentId}
                    name="announcementContent"
                    placeholder="請輸入公告詳細說明..."
                    rows={4}
                    value={data.content}
                    onChange={e => onChange({ ...data, content: e.target.value })}
                    className="arena-textarea"
                />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                    <label htmlFor={linkTextId} className="arena-label text-muted-foreground">連結按鈕文字</label>
                    <input
                        id={linkTextId}
                        name="linkText"
                        type="text"
                        placeholder="例：前往報名"
                        value={data.link_text || ''}
                        onChange={e => onChange({ ...data, link_text: e.target.value })}
                        className="arena-input"
                    />
                </div>
                <div>
                    <label htmlFor={linkUrlId} className="arena-label text-muted-foreground">連結 URL</label>
                    <input
                        id={linkUrlId}
                        name="linkUrl"
                        type="url"
                        autoCorrect="off"
                        autoCapitalize="none"
                        spellCheck={false}
                        placeholder="https://..."
                        value={data.link_url || ''}
                        onChange={e => onChange({ ...data, link_url: e.target.value })}
                        className="arena-input"
                    />
                </div>
            </div>

            <div className="flex items-center gap-3 p-3.5 bg-surface-subtle border border-border rounded-xl">
                <input
                    type="checkbox"
                    id={activeId}
                    name="isActive"
                    checked={data.is_active}
                    onChange={e => onChange({ ...data, is_active: e.target.checked })}
                    className="size-5 rounded border-input text-sapphire-blue focus:ring-sapphire-blue"
                />
                <label htmlFor={activeId} className="text-xs sm:text-sm font-bold text-foreground cursor-pointer">
                    上架狀態（開啟後立即對全體成員顯示）
                </label>
            </div>
        </div>
    );
}

function ResponsiveAnnouncementModal({
    isOpen,
    onClose,
    title,
    isEditing,
    isSaving,
    data,
    onChange,
    onSave,
    getTypeBadge,
}: {
    isOpen: boolean;
    onClose: () => void;
    title: string;
    isEditing: boolean;
    isSaving: boolean;
    data: AnnouncementPayload;
    onChange: (next: AnnouncementPayload) => void;
    onSave: (data: AnnouncementPayload) => void;
    getTypeBadge: (type: AnnouncementType) => { label: string; bg: string; text: string };
}) {
    return (
        <ResponsiveFormModal
            open={isOpen}
            onOpenChange={(open) => !open && onClose()}
            size="lg"
            tone="default"
            icon={<Megaphone size={18} />}
            title={title}
            description="填寫公告內容並設定顯示狀態，發布後將顯示於戰情室首頁。"
            onSubmit={(e) => {
                e.preventDefault();
                onSave(data);
            }}
            footer={
                <>
                    <Button
                        type="button"
                        variant="outline"
                        disabled={isSaving}
                        onClick={onClose}
                        className="w-full sm:w-auto h-11 px-5 rounded-xl border-border text-muted-foreground font-bold hover:bg-secondary hover:text-foreground"
                    >
                        取消
                    </Button>
                    <Button
                        type="submit"
                        disabled={isSaving || !data.title.trim()}
                        className="w-full sm:w-auto h-11 px-6 rounded-xl bg-sapphire-blue hover:bg-blue-700 text-white font-display font-black text-sm shadow-sm disabled:opacity-40"
                    >
                        {isSaving ? '處理中...' : isEditing ? '儲存變更' : '確認發布'}
                    </Button>
                </>
            }
        >
            <AnnouncementFormContent data={data} onChange={onChange} getTypeBadge={getTypeBadge} />
        </ResponsiveFormModal>
    );
}

function PrizeManager({ seasons, onUpdate }: { seasons: SeasonSummary[], onUpdate: () => void }) {
    const seasonSelectId = useId();
    const [selectedSeason, setSelectedSeason] = useState(seasons[0]?.id || '');
    const [extraPrizes, setExtraPrizes] = useState<Partial<SeasonPrize>[]>([]);
    const [deletingPrizeId, setDeletingPrizeId] = useState<string | null>(null);

    const { data: prizes = [], refetch: fetchPrizes } = useQuery({
        queryKey: ['admin', 'prizes', selectedSeason],
        queryFn: () => adminApi.getSeasonPrizes(selectedSeason),
        enabled: !!selectedSeason
    });

    const saveMutation = useMutation({
        mutationFn: (p: Partial<SeasonPrize>) => {
            if (p.id) return adminApi.updateSeasonPrize(p.id, p);
            return adminApi.saveSeasonPrize({ ...p, season_id: selectedSeason });
        },
        onSuccess: (_res, variables) => {
            fetchPrizes();
            if (!variables.id) {
                setExtraPrizes(prev => prev.filter(ep => ep !== variables));
            }
            toast.success("獎項已更新");
            onUpdate();
        },
        onError: (err: Error) => toast.error("儲存失敗", { description: err.message })
    });

    const deleteMutation = useMutation({
        mutationFn: (id: string) => adminApi.deleteSeasonPrize(id),
        onSuccess: () => {
            setDeletingPrizeId(null);
            fetchPrizes();
            onUpdate();
            toast.success("獎項已刪除");
        },
        onError: (err: Error) => toast.error("刪除失敗", { description: err.message })
    });

    const handleSavePrize = (p: Partial<SeasonPrize>) => {
        saveMutation.mutate(p);
    };

    const handleDeletePrize = (id?: string) => {
        if (!id) return;
        setDeletingPrizeId(id);
    };

    return (
        <div className="space-y-6">
            <header className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h3 className="text-xl font-black text-foreground">賽季獎勵設置</h3>
                    <p className="text-sm text-muted-foreground mt-1">選定具體賽季並設置對應的名次或特殊獎勵</p>
                </div>
                <div className="flex flex-wrap items-center gap-3">
                    <div>
                        <label htmlFor={seasonSelectId} className="sr-only">選擇賽季</label>
                        <select
                            id={seasonSelectId}
                            name="selectedSeason"
                            value={selectedSeason}
                            onChange={e => {
                                setSelectedSeason(e.target.value);
                                setExtraPrizes([]);
                            }}
                            className="arena-select min-w-[200px]"
                        >
                            {seasons.map(s => <option key={s.id} value={s.id}>{s.name || s.id}</option>)}
                        </select>
                    </div>
                    <Button
                        type="button"
                        onClick={() => setExtraPrizes([...extraPrizes, { rank: 0, item_name: '', quantity: 1 }])}
                        className="h-11 px-5 bg-sapphire-blue hover:bg-blue-700 text-white rounded-xl border-none shadow-sm font-black text-sm"
                    >
                        <Plus size={17} className="mr-1.5" aria-hidden="true" /> 新增特殊獎項
                    </Button>
                </div>
            </header>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {[1, 2, 3].map(rank => {
                    const prize = (prizes as SeasonPrize[]).find((p: SeasonPrize) => p.rank === rank);
                    return (
                        <PrizeFormCard
                            key={`rank-${rank}-${prize?.id ?? 'new'}`}
                            rank={rank}
                            prize={prize}
                            onSave={handleSavePrize}
                            onDelete={handleDeletePrize}
                        />
                    );
                })}

                {(prizes as SeasonPrize[]).filter((p: SeasonPrize) => (p.rank || 0) <= 0 || (p.rank || 0) > 3).map((prize: SeasonPrize) => (
                    <PrizeFormCard
                        key={prize.id}
                        prize={prize}
                        onSave={handleSavePrize}
                        onDelete={handleDeletePrize}
                    />
                ))}

                {extraPrizes.map((p, idx: number) => (
                    <PrizeFormCard
                        key={`extra-${idx}`}
                        prize={p}
                        isNew
                        onSave={handleSavePrize}
                        onDelete={() => setExtraPrizes(extraPrizes.filter((_, i) => i !== idx))}
                    />
                ))}
            </div>

            {/* 刪除獎項確認 Modal */}
            <ResponsiveFormModal
                open={Boolean(deletingPrizeId)}
                onOpenChange={(open) => !open && setDeletingPrizeId(null)}
                size="sm"
                tone="danger"
                icon={<Trash2 size={18} />}
                title="刪除獎項"
                description="確定要移除這項賽季獎勵嗎？"
                onSubmit={(e) => {
                    e.preventDefault();
                    if (deletingPrizeId) deleteMutation.mutate(deletingPrizeId);
                }}
                footer={
                    <>
                        <Button
                            type="button"
                            variant="outline"
                            disabled={deleteMutation.isPending}
                            onClick={() => setDeletingPrizeId(null)}
                            className="w-full sm:w-auto h-11 px-5 rounded-xl border-border text-muted-foreground font-bold hover:bg-secondary hover:text-foreground"
                        >
                            取消
                        </Button>
                        <Button
                            type="submit"
                            disabled={deleteMutation.isPending}
                            className="w-full sm:w-auto h-11 px-6 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-display font-black text-sm shadow-sm"
                        >
                            {deleteMutation.isPending ? '刪除中...' : '確認刪除'}
                        </Button>
                    </>
                }
            >
                <div className="bg-rose-50/70 dark:bg-rose-500/12 border border-rose-200/80 dark:border-rose-500/30 rounded-2xl p-4">
                    <p className="text-xs font-bold text-rose-700 dark:text-rose-300 leading-relaxed">
                        確認後將從該賽季獎品展示清單中永久刪除，無法復原。
                    </p>
                </div>
            </ResponsiveFormModal>
        </div>
    );
}

function PrizeFormCard({ rank: initialRank, prize, onSave, onDelete, isNew }: {
    rank?: number,
    prize?: Partial<SeasonPrize>,
    onSave: (p: Partial<SeasonPrize>) => void,
    onDelete: (id?: string) => void,
    isNew?: boolean
}) {
    const rankId = useId();
    const labelId = useId();
    const itemId = useId();
    const qtyId = useId();
    const fileId = useId();

    const [name, setName] = useState(prize?.item_name || '');
    const [qty, setQty] = useState(prize?.quantity || 1);
    const [url, setUrl] = useState(prize?.image_url || '');
    const [rank, setRank] = useState(prize?.rank ?? initialRank ?? 0);
    const [label, setLabel] = useState(prize?.label || '');
    const [uploading, setUploading] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        setUploading(true);
        try {
            const res = await adminApi.uploadImage(file);
            let uploadedUrl = res.url;
            if (uploadedUrl.includes("cloudinary.com")) {
                uploadedUrl = uploadedUrl.replace("/upload/", "/upload/q_auto,f_auto/");
            }
            setUrl(uploadedUrl);
            toast.success("圖片上傳成功！");
        } catch (err: unknown) {
            toast.error(err instanceof Error ? err.message : "上傳失敗");
        } finally {
            setUploading(false);
            if (fileInputRef.current) fileInputRef.current.value = '';
        }
    };

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

    const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        onSave({
            ...prize,
            rank,
            label: label || defaultLabel,
            item_name: name,
            quantity: qty,
            image_url: url
        });
    };

    return (
        <Card className={cn(
            "arena-card p-6 sm:p-7 relative group",
            isNew && "ring-2 ring-sapphire-blue ring-offset-2 ring-offset-background"
        )}>
            <form onSubmit={handleSubmit} className="space-y-5">
                {prize?.id && (
                    <button
                        type="button"
                        aria-label="刪除獎項"
                        title="刪除獎項"
                        onClick={() => onDelete(prize.id)}
                        className="absolute top-5 right-5 size-9 flex items-center justify-center text-muted-foreground hover:text-rose-600 dark:hover:text-rose-300 hover:bg-rose-50 dark:hover:bg-rose-500/15 rounded-xl transition-colors lg:opacity-0 lg:group-hover:opacity-100"
                    >
                        <Trash2 size={16} aria-hidden="true" />
                    </button>
                )}

                <div className="flex items-center justify-between pr-8">
                    <div className={cn(
                        "size-11 rounded-2xl flex items-center justify-center font-black text-lg",
                        isStandard && !label ? (
                            rank === 1 ? "bg-amber-100 text-amber-600 dark:bg-amber-500/15 dark:text-amber-300" :
                                rank === 2 ? "bg-slate-200 text-slate-600 dark:bg-slate-700 dark:text-slate-200" : "bg-orange-100 text-orange-600 dark:bg-orange-500/15 dark:text-orange-300"
                        ) : "bg-sapphire-blue/10 text-sapphire-blue dark:bg-blue-500/15 dark:text-blue-300"
                    )}>
                        {rank || '★'}
                    </div>
                    <p className="text-xs font-black uppercase tracking-wider text-muted-foreground">
                        {displayLabel || `Rank ${rank} Prize`}
                    </p>
                </div>

                <div className="space-y-4">
                    <div className="grid grid-cols-2 gap-3">
                        <div>
                            <label htmlFor={rankId} className="arena-label text-muted-foreground">名次 (Rank)</label>
                            <input
                                id={rankId}
                                name="prizeRank"
                                type="number"
                                value={rank}
                                onChange={e => setRank(parseInt(e.target.value) || 0)}
                                className="arena-input tabular-nums"
                            />
                        </div>
                        <div>
                            <label htmlFor={labelId} className="arena-label text-muted-foreground">標籤 (Label)</label>
                            <input
                                id={labelId}
                                name="prizeLabel"
                                type="text"
                                placeholder={defaultLabel || "例：MVP"}
                                value={label}
                                onChange={e => setLabel(e.target.value)}
                                className="arena-input"
                            />
                        </div>
                    </div>

                    <div>
                        <label htmlFor={itemId} className="arena-label text-muted-foreground">物品名稱</label>
                        <input
                            id={itemId}
                            name="prizeItemName"
                            type="text"
                            placeholder="例如：比賽級桌球拍組"
                            value={name}
                            onChange={e => setName(e.target.value)}
                            className="arena-input"
                        />
                    </div>

                    <div className="grid grid-cols-3 gap-3">
                        <div className="col-span-1">
                            <label htmlFor={qtyId} className="arena-label text-muted-foreground">數量</label>
                            <input
                                id={qtyId}
                                name="prizeQty"
                                type="number"
                                min={1}
                                value={qty}
                                onChange={e => setQty(parseInt(e.target.value) || 0)}
                                className="arena-input tabular-nums"
                            />
                        </div>
                        <div className="col-span-2">
                            <label htmlFor={fileId} className="arena-label text-muted-foreground">圖片</label>
                            <input
                                id={fileId}
                                type="file"
                                accept="image/jpeg, image/png, image/gif"
                                className="hidden"
                                ref={fileInputRef}
                                onChange={handleFileChange}
                            />
                            <Button
                                type="button"
                                variant="outline"
                                onClick={() => fileInputRef.current?.click()}
                                disabled={uploading}
                                className="w-full min-h-11 h-11 rounded-xl bg-card border-input text-xs font-bold text-muted-foreground hover:bg-secondary hover:text-foreground"
                            >
                                {uploading ? <Loader2 className="animate-spin mr-1.5" size={15} aria-hidden="true" /> : <UploadCloud className="mr-1.5" size={15} aria-hidden="true" />}
                                {uploading ? '上傳中...' : url ? '重新上傳' : '上傳圖片'}
                            </Button>
                        </div>
                    </div>

                    {url && (
                        <div className="rounded-xl overflow-hidden border border-border bg-surface-subtle relative flex items-center justify-center p-2 min-h-[112px]">
                            <img src={url} alt="獎品預覽" className="max-h-28 object-contain" />
                            <button
                                type="button"
                                aria-label="移除獎品圖片"
                                onClick={() => setUrl('')}
                                className="absolute top-2 right-2 size-7 flex items-center justify-center bg-slate-900/70 hover:bg-slate-900 text-white rounded-lg transition-colors"
                            >
                                <X size={14} aria-hidden="true" />
                            </button>
                        </div>
                    )}
                </div>

                <Button
                    type="submit"
                    className="w-full h-11 bg-primary hover:opacity-90 text-primary-foreground rounded-xl border-none transition-all font-display font-black text-sm"
                >
                    {prize?.id ? '更新項目' : '建立獎項'}
                </Button>
            </form>
        </Card>
    );
}

function TournamentManager({ tournaments, onUpdate }: { tournaments: TournamentEvent[], onUpdate: () => void }) {
    const titleId = useId();
    const rulesId = useId();
    const startId = useId();
    const endId = useId();
    const imageId = useId();
    const playerSearchId = useId();

    const [isAdding, setIsAdding] = useState(false);
    const [selectedTourn, setSelectedTourn] = useState<string | null>(null);
    const [statusModalOpen, setStatusModalOpen] = useState(false);
    const [nextStatus, setNextStatus] = useState<string>('registering');
    const [deleteModalOpen, setDeleteModalOpen] = useState(false);
    const [addPlayerModalOpen, setAddPlayerModalOpen] = useState(false);
    const [playerSearch, setPlayerSearch] = useState('');

    const [formData, setFormData] = useState({
        title: '',
        rules: '',
        image_url: '',
        start_date: '',
        end_date: ''
    });

    const { data: participants = [], refetch: fetchParticipants } = useQuery({
        queryKey: ['admin', 'tournament-participants', selectedTourn],
        queryFn: () => adminApi.getParticipants(selectedTourn!),
        enabled: !!selectedTourn
    });

    const { data: allUsers = [] } = useQuery({
        queryKey: ['users'],
        queryFn: async () => {
            const res = await apiClient.get<{ id: string; name: string; department?: string; avatar?: string | null }[]>('/users');
            return res.data;
        },
        enabled: addPlayerModalOpen,
    });

    const createMutation = useMutation({
        mutationFn: (data: TournamentCreatePayload) => adminApi.createTournament(data),
        onSuccess: () => {
            setIsAdding(false);
            setFormData({ title: '', rules: '', image_url: '', start_date: '', end_date: '' });
            onUpdate();
            toast.success("賽事建立成功");
        },
        onError: (err: Error) => toast.error("建立失敗", { description: err.message })
    });

    const statusMutation = useMutation({
        mutationFn: ({ id, status }: { id: string; status: string }) =>
            adminApi.updateTournamentStatus(id, status),
        onSuccess: () => {
            setStatusModalOpen(false);
            onUpdate();
            toast.success("賽事狀態已更新");
        },
        onError: (err: Error) => toast.error("狀態更新失敗", { description: err.message }),
    });

    const deleteTournMutation = useMutation({
        mutationFn: (id: string) => adminApi.deleteTournament(id),
        onSuccess: () => {
            setDeleteModalOpen(false);
            setSelectedTourn(null);
            onUpdate();
            toast.success("賽事已刪除");
        },
        onError: (err: Error) => toast.error("刪除賽事失敗", { description: err.message }),
    });

    const addParticipantMutation = useMutation({
        mutationFn: ({ tournId, userId }: { tournId: string; userId: string }) =>
            adminApi.addParticipant(tournId, userId),
        onSuccess: () => {
            fetchParticipants();
            toast.success("已將同仁加入參賽名單");
        },
        onError: (err: Error) => toast.error("加入失敗", { description: err.message }),
    });

    const removeParticipantMutation = useMutation({
        mutationFn: (userId: string) => adminApi.removeParticipant(selectedTourn!, userId),
        onSuccess: () => {
            fetchParticipants();
            toast.success("已移除參賽者");
        },
        onError: (err: Error) => toast.error("移除失敗", { description: err.message })
    });

    const handleCreate = (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        if (!formData.title.trim()) {
            toast.error("請輸入賽事名稱");
            return;
        }
        const payload = {
            ...formData,
            start_date: formData.start_date ? new Date(formData.start_date).toISOString() : null,
            end_date: formData.end_date ? new Date(formData.end_date).toISOString() : null,
        };
        createMutation.mutate(payload);
    };

    const handleRemovePlayer = (userId: string) => {
        if (!selectedTourn) return;
        removeParticipantMutation.mutate(userId);
    };

    const activeTournament = tournaments.find(t => t.id === selectedTourn);
    const participantUserIds = new Set(participants.map((p) => String(p.user?.id)));
    const availableToAdd = allUsers.filter((u) => {
        if (participantUserIds.has(String(u.id))) return false;
        const q = playerSearch.trim().toLowerCase();
        if (!q) return true;
        return u.name.toLowerCase().includes(q) || (u.department && u.department.toLowerCase().includes(q));
    });

    return (
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 sm:gap-8">
            {/* List */}
            <div className="lg:col-span-1 space-y-3">
                <Button
                    type="button"
                    onClick={() => setIsAdding(true)}
                    className="w-full h-11 bg-sapphire-blue hover:bg-blue-700 text-white rounded-xl border-none transition-all shadow-sm font-black text-sm mb-2"
                >
                    <Plus className="mr-1.5" size={17} aria-hidden="true" /> 新賽事
                </Button>

                {tournaments.map(t => (
                    <Card
                        key={t.id}
                        onClick={() => { setSelectedTourn(t.id); setIsAdding(false); }}
                        className={cn(
                            "p-4 cursor-pointer border transition-all rounded-2xl group",
                            selectedTourn === t.id
                                ? "bg-primary text-primary-foreground border-primary shadow-md"
                                : "bg-card hover:bg-secondary/60 border-border text-foreground shadow-xs"
                        )}
                    >
                        <div className="flex items-center justify-between">
                            <p className="font-bold truncate pr-3">{t.title}</p>
                            <ChevronRight size={16} aria-hidden="true" className={cn(selectedTourn === t.id ? "opacity-100" : "opacity-0 group-hover:opacity-100")} />
                        </div>
                        <p className={cn("text-xs mt-1 font-black uppercase tracking-wider", selectedTourn === t.id ? "text-blue-100" : "text-muted-foreground")}>
                            {t.status}
                        </p>
                    </Card>
                ))}
            </div>

            {/* Management Section */}
            <div className="lg:col-span-3">
                {isAdding ? (
                    <Card className="arena-card p-6 sm:p-8 max-w-2xl">
                        <h3 className="text-xl sm:text-2xl font-black text-foreground mb-6">發起獨立錦標賽</h3>
                        <form onSubmit={handleCreate} className="space-y-4">
                            <div>
                                <label htmlFor={titleId} className="arena-label text-muted-foreground">
                                    賽事名稱 <span aria-hidden="true" className="text-rose-500">*</span>
                                </label>
                                <input
                                    id={titleId}
                                    name="tournamentTitle"
                                    type="text"
                                    required
                                    placeholder="例如：2026 尾牙友誼賽"
                                    value={formData.title}
                                    onChange={e => setFormData({ ...formData, title: e.target.value })}
                                    className="arena-input"
                                />
                            </div>
                            <div>
                                <label htmlFor={rulesId} className="arena-label text-muted-foreground">Challonge 賽程連結 或 規則說明</label>
                                <input
                                    id={rulesId}
                                    name="tournamentRules"
                                    type="text"
                                    placeholder="https://challonge.com/..."
                                    value={formData.rules}
                                    onChange={e => setFormData({ ...formData, rules: e.target.value })}
                                    className="arena-input"
                                />
                            </div>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                <div>
                                    <label htmlFor={startId} className="arena-label text-muted-foreground">賽事開始時間 (含秒)</label>
                                    <input
                                        id={startId}
                                        name="startDate"
                                        type="datetime-local"
                                        step="1"
                                        value={formData.start_date}
                                        onChange={e => setFormData({ ...formData, start_date: e.target.value })}
                                        className="arena-input"
                                    />
                                </div>
                                <div>
                                    <label htmlFor={endId} className="arena-label text-muted-foreground">賽事結束時間 (含秒)</label>
                                    <input
                                        id={endId}
                                        name="endDate"
                                        type="datetime-local"
                                        step="1"
                                        value={formData.end_date}
                                        onChange={e => setFormData({ ...formData, end_date: e.target.value })}
                                        className="arena-input"
                                    />
                                </div>
                            </div>
                            <div>
                                <label htmlFor={imageId} className="arena-label text-muted-foreground">預覽圖 URL</label>
                                <input
                                    id={imageId}
                                    name="imageUrl"
                                    type="url"
                                    autoCorrect="off"
                                    autoCapitalize="none"
                                    spellCheck={false}
                                    placeholder="https://..."
                                    value={formData.image_url}
                                    onChange={e => setFormData({ ...formData, image_url: e.target.value })}
                                    className="arena-input"
                                />
                            </div>
                            <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-2.5 pt-3 border-t border-border">
                                <Button
                                    type="button"
                                    variant="outline"
                                    onClick={() => setIsAdding(false)}
                                    className="w-full sm:w-auto h-11 px-5 rounded-xl border-border text-muted-foreground font-bold hover:bg-secondary hover:text-foreground"
                                >
                                    取消
                                </Button>
                                <Button
                                    type="submit"
                                    disabled={createMutation.isPending || !formData.title.trim()}
                                    className="w-full sm:w-auto h-11 px-7 bg-sapphire-blue hover:bg-blue-700 text-white rounded-xl border-none shadow-sm font-display font-black text-sm disabled:opacity-40"
                                >
                                    {createMutation.isPending ? '建立中...' : '建立賽事'}
                                </Button>
                            </div>
                        </form>
                    </Card>
                ) : activeTournament ? (
                    <div className="space-y-6">
                        <Card className="arena-card p-6 sm:p-8 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                            <div>
                                <div className="flex items-center gap-2.5 flex-wrap">
                                    <h3 className="text-xl sm:text-2xl font-black text-foreground">{activeTournament.title}</h3>
                                    <span className="px-2.5 py-0.5 rounded-full bg-blue-50 dark:bg-blue-500/15 text-sapphire-blue dark:text-blue-300 text-xs font-black uppercase">
                                        {activeTournament.status}
                                    </span>
                                </div>
                                <p className="text-sm text-muted-foreground mt-1">{participants.length} 位已報名同仁</p>
                            </div>
                            <div className="flex gap-2.5">
                                <Button
                                    type="button"
                                    variant="outline"
                                    onClick={() => {
                                        setNextStatus(activeTournament.status || 'registering');
                                        setStatusModalOpen(true);
                                    }}
                                    className="h-10 rounded-xl font-bold text-muted-foreground border-border hover:bg-secondary hover:text-foreground"
                                >
                                    切換狀態
                                </Button>
                                <Button
                                    type="button"
                                    onClick={() => setDeleteModalOpen(true)}
                                    className="h-10 rounded-xl font-bold bg-rose-50 text-rose-600 hover:bg-rose-100 border border-rose-200/80 dark:bg-rose-500/12 dark:text-rose-300 dark:hover:bg-rose-500/20 dark:border-rose-500/30"
                                >
                                    刪除賽事
                                </Button>
                            </div>
                        </Card>

                        <Card className="arena-card p-6 sm:p-8">
                            <h4 className="font-black text-foreground mb-6 flex items-center justify-between">
                                參賽名單
                                <Button
                                    type="button"
                                    size="sm"
                                    onClick={() => {
                                        setPlayerSearch('');
                                        setAddPlayerModalOpen(true);
                                    }}
                                    className="rounded-xl bg-blue-50 text-sapphire-blue hover:bg-blue-100 dark:bg-blue-500/15 dark:text-blue-300 dark:hover:bg-blue-500/25 border-none font-bold"
                                >
                                    <Plus size={16} className="mr-1" aria-hidden="true" /> 手動加入玩家
                                </Button>
                            </h4>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                {participants.map((p) => (
                                    <div key={p.participant.id} className="p-4 bg-surface-subtle rounded-2xl flex items-center justify-between group border border-border">
                                        <div className="flex items-center gap-3 min-w-0">
                                            <PlayerAvatar
                                                src={p.user.avatar_url}
                                                name={p.user.name}
                                                className="size-10 rounded-xl border border-border text-xs"
                                            />
                                            <div className="min-w-0">
                                                <p className="font-bold text-foreground truncate">{p.user.name}</p>
                                                <p className="text-xs text-muted-foreground font-medium truncate">{p.user.department}</p>
                                            </div>
                                        </div>
                                        <button
                                            type="button"
                                            aria-label={`移除參賽者 ${p.user.name}`}
                                            onClick={() => handleRemovePlayer(p.user.id)}
                                            className="p-2 text-muted-foreground hover:text-rose-600 dark:hover:text-rose-300 hover:bg-rose-100 dark:hover:bg-rose-500/20 rounded-lg transition-all lg:opacity-0 lg:group-hover:opacity-100"
                                        >
                                            <Trash2 size={16} aria-hidden="true" />
                                        </button>
                                    </div>
                                ))}
                                {participants.length === 0 && <p className="col-span-2 py-8 text-center text-muted-foreground text-sm">目前無任何參賽者</p>}
                            </div>
                        </Card>

                        {/* 切換賽事狀態 Modal */}
                        <ResponsiveFormModal
                            open={statusModalOpen}
                            onOpenChange={setStatusModalOpen}
                            size="sm"
                            tone="default"
                            icon={<Trophy size={18} />}
                            title="切換賽事狀態"
                            description={`選擇「${activeTournament.title}」的目前階段`}
                            onSubmit={(e) => {
                                e.preventDefault();
                                statusMutation.mutate({ id: activeTournament.id, status: nextStatus });
                            }}
                            footer={
                                <>
                                    <Button
                                        type="button"
                                        variant="outline"
                                        onClick={() => setStatusModalOpen(false)}
                                        className="w-full sm:w-auto h-11 px-5 rounded-xl border-border text-muted-foreground font-bold hover:bg-secondary hover:text-foreground"
                                    >
                                        取消
                                    </Button>
                                    <Button
                                        type="submit"
                                        disabled={statusMutation.isPending}
                                        className="w-full sm:w-auto h-11 px-6 rounded-xl bg-primary hover:opacity-90 text-primary-foreground font-display font-black text-sm"
                                    >
                                        {statusMutation.isPending ? '更新中...' : '儲存狀態'}
                                    </Button>
                                </>
                            }
                        >
                            <div className="space-y-2.5">
                                {[
                                    { id: 'registering', label: '報名中 (Registering)' },
                                    { id: 'ongoing', label: '進行中 (Ongoing)' },
                                    { id: 'completed', label: '已結束 (Completed)' },
                                ].map((opt) => (
                                    <button
                                        key={opt.id}
                                        type="button"
                                        aria-pressed={nextStatus === opt.id}
                                        onClick={() => setNextStatus(opt.id)}
                                        className={cn(
                                            "w-full min-h-11 px-4 rounded-xl border text-left text-sm font-black transition-all flex items-center justify-between",
                                            nextStatus === opt.id
                                                ? "bg-blue-50 dark:bg-blue-500/15 border-sapphire-blue text-sapphire-blue dark:text-blue-300"
                                                : "bg-card border-border text-foreground hover:bg-secondary"
                                        )}
                                    >
                                        <span>{opt.label}</span>
                                        {nextStatus === opt.id && <span className="size-2.5 rounded-full bg-sapphire-blue" />}
                                    </button>
                                ))}
                            </div>
                        </ResponsiveFormModal>

                        {/* 刪除賽事確認 Modal */}
                        <ResponsiveFormModal
                            open={deleteModalOpen}
                            onOpenChange={setDeleteModalOpen}
                            size="sm"
                            tone="danger"
                            icon={<Trash2 size={18} />}
                            title="刪除錦標賽"
                            description="確定要永久刪除這項賽事嗎？"
                            onSubmit={(e) => {
                                e.preventDefault();
                                deleteTournMutation.mutate(activeTournament.id);
                            }}
                            footer={
                                <>
                                    <Button
                                        type="button"
                                        variant="outline"
                                        onClick={() => setDeleteModalOpen(false)}
                                        className="w-full sm:w-auto h-11 px-5 rounded-xl border-border text-muted-foreground font-bold hover:bg-secondary hover:text-foreground"
                                    >
                                        取消
                                    </Button>
                                    <Button
                                        type="submit"
                                        disabled={deleteTournMutation.isPending}
                                        className="w-full sm:w-auto h-11 px-6 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-display font-black text-sm"
                                    >
                                        {deleteTournMutation.isPending ? '刪除中...' : '確認刪除'}
                                    </Button>
                                </>
                            }
                        >
                            <div className="bg-rose-50/70 dark:bg-rose-500/12 border border-rose-200/80 dark:border-rose-500/30 rounded-2xl p-4 space-y-1">
                                <p className="text-sm font-black text-foreground">{activeTournament.title}</p>
                                <p className="text-xs font-bold text-rose-700 dark:text-rose-300">刪除後將同步清除該賽事的參賽名單，無法復原。</p>
                            </div>
                        </ResponsiveFormModal>

                        {/* 手動加入參賽者 Modal */}
                        <ResponsiveFormModal
                            open={addPlayerModalOpen}
                            onOpenChange={setAddPlayerModalOpen}
                            size="md"
                            tone="default"
                            icon={<Users size={18} />}
                            title="手動加入參賽玩家"
                            description={`為「${activeTournament.title}」新增參賽同仁`}
                            footer={
                                <Button
                                    type="button"
                                    onClick={() => setAddPlayerModalOpen(false)}
                                    className="w-full sm:w-auto h-11 px-6 rounded-xl bg-primary hover:opacity-90 text-primary-foreground font-display font-black text-sm"
                                >
                                    完成
                                </Button>
                            }
                        >
                            <div className="space-y-4">
                                <div>
                                    <label htmlFor={playerSearchId} className="arena-label text-muted-foreground">搜尋同仁</label>
                                    <input
                                        id={playerSearchId}
                                        type="search"
                                        autoComplete="off"
                                        spellCheck={false}
                                        placeholder="輸入姓名或處室..."
                                        value={playerSearch}
                                        onChange={(e) => setPlayerSearch(e.target.value)}
                                        className="arena-input"
                                    />
                                </div>

                                <div className="max-h-64 overflow-y-auto space-y-2 pr-1">
                                    {availableToAdd.length > 0 ? (
                                        availableToAdd.map((u) => (
                                            <div
                                                key={u.id}
                                                className="flex items-center justify-between gap-3 p-3 rounded-xl border border-border bg-card"
                                            >
                                                <div className="flex items-center gap-3 min-w-0">
                                                    <PlayerAvatar src={u.avatar} name={u.name} className="size-9 rounded-xl text-xs" />
                                                    <div className="min-w-0">
                                                        <p className="text-sm font-bold text-foreground truncate">{u.name}</p>
                                                        <p className="text-xs text-muted-foreground truncate">{u.department || '一般同仁'}</p>
                                                    </div>
                                                </div>
                                                <Button
                                                    type="button"
                                                    size="sm"
                                                    disabled={addParticipantMutation.isPending}
                                                    onClick={() => addParticipantMutation.mutate({ tournId: activeTournament.id, userId: u.id })}
                                                    className="h-9 px-3.5 rounded-xl bg-sapphire-blue hover:bg-blue-700 text-white text-xs font-black shrink-0"
                                                >
                                                    <Plus size={14} className="mr-1" aria-hidden="true" /> 加入
                                                </Button>
                                            </div>
                                        ))
                                    ) : (
                                        <p className="py-8 text-center text-xs font-bold text-muted-foreground">
                                            {playerSearch ? '找不到符合的同仁' : '所有同仁皆已在名單內'}
                                        </p>
                                    )}
                                </div>
                            </div>
                        </ResponsiveFormModal>
                    </div>
                ) : (
                    <div className="h-[400px] flex flex-col items-center justify-center text-muted-foreground/40 space-y-4">
                        <ImageIcon size={64} strokeWidth={1} aria-hidden="true" />
                        <p className="font-bold">請從左側選擇要管理的錦標賽</p>
                    </div>
                )}
            </div>
        </div>
    );
}
