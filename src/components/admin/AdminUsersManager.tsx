import { useMemo, useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import {
  Building2,
  Edit3,
  Loader2,
  Scale,
  Search,
  Shield,
  ShieldAlert,
  ShieldCheck,
  TrendingDown,
  TrendingUp,
  UserCheck,
  UserX,
  Users,
  X,
} from 'lucide-react';
import { toast } from 'sonner';
import { adminApi } from '@/lib/admin';
import type { AdminUserItem } from '@/types/admin';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { PlayerAvatar } from '@/components/PlayerAvatar';
import { ResponsiveFormModal } from '@/components/ResponsiveFormModal';
import { ResponsiveSelect, type ResponsiveSelectOption } from '@/components/ui/responsive-select';

interface AdminUsersManagerProps {
  currentUserId?: string;
  onUpdate: () => void;
}

type StatusFilter = 'all' | 'admin' | 'active' | 'inactive';
type SortOption = 'default' | 'mmr_desc' | 'mmr_asc' | 'matches_desc';
type MmrMode = 'delta' | 'target';

const QUICK_DELTAS = [-50, -20, -10, 10, 20, 50];
const QUICK_MMR_REASONS = ['賽事積分誤算補正', '新進同仁實力定位', '活動賽事特殊補償'];

const SORT_OPTIONS: ResponsiveSelectOption[] = [
  { value: 'default', label: '預設排序（啟用 / 管理員優先）' },
  { value: 'mmr_desc', label: 'ELO 積分由高到低' },
  { value: 'mmr_asc', label: 'ELO 積分由低到高' },
  { value: 'matches_desc', label: '生涯出賽場次最多' },
];

export function AdminUsersManager({ currentUserId, onUpdate }: AdminUsersManagerProps) {
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [departmentFilter, setDepartmentFilter] = useState<string>('all');
  const [sortBy, setSortBy] = useState<SortOption>('default');
  const [search, setSearch] = useState('');

  // Edit User Modal State
  const [editingUser, setEditingUser] = useState<AdminUserItem | null>(null);
  const [editName, setEditName] = useState('');
  const [editDepartment, setEditDepartment] = useState('');
  const [editRole, setEditRole] = useState<'admin' | 'user'>('user');
  const [editActive, setEditActive] = useState(true);

  // Adjust MMR Modal State
  const [mmrUser, setMmrUser] = useState<AdminUserItem | null>(null);
  const [mmrMode, setMmrMode] = useState<MmrMode>('delta');
  const [mmrInput, setMmrInput] = useState('20');
  const [mmrReason, setMmrReason] = useState('');

  const { data: users = [], isLoading } = useQuery<AdminUserItem[]>({
    queryKey: ['admin', 'users'],
    queryFn: () => adminApi.getUsers(),
  });

  const summary = useMemo(() => {
    let admins = 0;
    let active = 0;
    let inactive = 0;
    for (const u of users) {
      if (u.is_active) {
        active += 1;
        if (u.role === 'admin') admins += 1;
      } else {
        inactive += 1;
      }
    }
    return {
      total: users.length,
      admins,
      active,
      inactive,
    };
  }, [users]);

  const { departmentOptions, existingDepartments } = useMemo(() => {
    const counts = new Map<string, number>();
    for (const u of users) {
      const dept = (u.department || '未設定單位').trim() || '未設定單位';
      counts.set(dept, (counts.get(dept) ?? 0) + 1);
    }

    const sortedDepts = Array.from(counts.entries()).sort((a, b) => b[1] - a[1]);
    const options: ResponsiveSelectOption[] = [
      { value: 'all', label: '全部單位', badge: users.length },
      ...sortedDepts.map(([dept, count]) => ({
        value: dept,
        label: dept,
        badge: count,
      })),
    ];

    return {
      departmentOptions: options,
      existingDepartments: sortedDepts
        .map(([dept]) => dept)
        .filter((dept) => dept !== '未設定單位')
        .slice(0, 6),
    };
  }, [users]);

  const filteredUsers = useMemo(() => {
    const q = search.trim().toLowerCase();
    const list = users.filter((u) => {
      if (statusFilter === 'admin' && (u.role !== 'admin' || !u.is_active)) return false;
      if (statusFilter === 'active' && !u.is_active) return false;
      if (statusFilter === 'inactive' && u.is_active) return false;

      const userDept = (u.department || '未設定單位').trim() || '未設定單位';
      if (departmentFilter !== 'all' && userDept !== departmentFilter) return false;

      if (q) {
        const hay = `${u.name} ${u.email || ''} ${userDept}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });

    if (sortBy === 'mmr_desc') {
      return [...list].sort((a, b) => b.global_mmr - a.global_mmr);
    }
    if (sortBy === 'mmr_asc') {
      return [...list].sort((a, b) => a.global_mmr - b.global_mmr);
    }
    if (sortBy === 'matches_desc') {
      return [...list].sort((a, b) => b.matches_played - a.matches_played);
    }
    return list;
  }, [users, statusFilter, departmentFilter, search, sortBy]);

  const updateUserMutation = useMutation({
    mutationFn: ({ userId, payload }: { userId: string; payload: Parameters<typeof adminApi.updateUser>[1] }) =>
      adminApi.updateUser(userId, payload),
    onSuccess: (res) => {
      onUpdate();
      setEditingUser(null);
      toast.success(res.message);
    },
    onError: (err: Error) => {
      toast.error('更新成員失敗', { description: err.message });
    },
  });

  const adjustMmrMutation = useMutation({
    mutationFn: ({ userId, payload }: { userId: string; payload: Parameters<typeof adminApi.adjustUserMmr>[1] }) =>
      adminApi.adjustUserMmr(userId, payload),
    onSuccess: (res) => {
      onUpdate();
      setMmrUser(null);
      toast.success(res.message);
    },
    onError: (err: Error) => {
      toast.error('校準積分失敗', { description: err.message });
    },
  });

  const openEditModal = (u: AdminUserItem) => {
    setEditingUser(u);
    setEditName(u.name);
    setEditDepartment(u.department || '');
    setEditRole(u.role === 'admin' ? 'admin' : 'user');
    setEditActive(u.is_active);
  };

  const openMmrModal = (u: AdminUserItem) => {
    setMmrUser(u);
    setMmrMode('delta');
    setMmrInput('20');
    setMmrReason('');
  };

  // Modal guards for Edit User
  const isEditingSelf = editingUser ? editingUser.id === currentUserId : false;
  const isEditingLastActiveAdmin = editingUser
    ? editingUser.role === 'admin' && editingUser.is_active && summary.admins <= 1
    : false;
  const roleLockReason = editingUser
    ? isEditingSelf
      ? '無法降級自己目前登入中的管理員帳號'
      : editingUser.is_env_admin
        ? '此帳號受環境變數 ADMIN_EMAILS 保護，需由主機設定移除後才可變更角色'
        : isEditingLastActiveAdmin
          ? '系統至少需保留一位啟用中的管理員'
          : null
    : null;
  const activeLockReason = editingUser
    ? isEditingSelf
      ? '無法停用自己目前登入中的帳號'
      : isEditingLastActiveAdmin
        ? '無法停用系統中最後一位啟用中的管理員'
        : null
    : null;

  const handleSaveUser = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!editingUser || updateUserMutation.isPending) return;
    if (!editName.trim()) {
      toast.error('顯示姓名不得為空');
      return;
    }
    updateUserMutation.mutate({
      userId: editingUser.id,
      payload: {
        name: editName.trim(),
        department: editDepartment.trim() || '未設定單位',
        role: roleLockReason ? undefined : editRole,
        is_active: activeLockReason ? undefined : editActive,
      },
    });
  };

  // Live MMR preview calculation
  const mmrPreview = useMemo(() => {
    if (!mmrUser) return null;
    const rawNumber = Number(mmrInput);
    if (!mmrInput.trim() || Number.isNaN(rawNumber)) {
      return { valid: false as const, nextMmr: mmrUser.global_mmr, delta: 0, clamped: false };
    }
    const uncapped = mmrMode === 'delta' ? mmrUser.global_mmr + rawNumber : rawNumber;
    const clampedMmr = Math.round(Math.max(600, Math.min(3000, uncapped)) * 10) / 10;
    const actualDelta = Math.round((clampedMmr - mmrUser.global_mmr) * 10) / 10;
    return {
      valid: Math.abs(actualDelta) >= 0.05,
      nextMmr: clampedMmr,
      delta: actualDelta,
      clamped: Math.abs(clampedMmr - uncapped) > 0.05,
    };
  }, [mmrUser, mmrMode, mmrInput]);

  const handleSaveMmr = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!mmrUser || !mmrPreview || adjustMmrMutation.isPending) return;
    if (!mmrPreview.valid) {
      toast.error('請輸入有效的異動幅度或目標積分');
      return;
    }
    if (mmrReason.trim().length < 2) {
      toast.error('請填寫校準原因（至少 2 個字，將同步發送透明通知給選手）');
      return;
    }

    const numericVal = Number(mmrInput);
    adjustMmrMutation.mutate({
      userId: mmrUser.id,
      payload:
        mmrMode === 'target'
          ? { target_mmr: numericVal, reason: mmrReason.trim() }
          : { delta: numericVal, reason: mmrReason.trim() },
    });
  };

  const statTiles: Array<{
    key: StatusFilter;
    label: string;
    value: number;
    icon: typeof Users;
    accent: string;
    activeRing: string;
  }> = [
    {
      key: 'all',
      label: '總成員數',
      value: summary.total,
      icon: Users,
      accent: 'text-sapphire-blue dark:text-blue-400 bg-sapphire-blue/10 dark:bg-blue-500/15',
      activeRing: 'border-sapphire-blue ring-2 ring-sapphire-blue/20',
    },
    {
      key: 'admin',
      label: '管理員',
      value: summary.admins,
      icon: ShieldCheck,
      accent: 'text-amber-600 dark:text-amber-400 bg-amber-100/80 dark:bg-amber-500/15',
      activeRing: 'border-amber-500 ring-2 ring-amber-500/20',
    },
    {
      key: 'active',
      label: '啟用帳號',
      value: summary.active,
      icon: UserCheck,
      accent: 'text-emerald-600 dark:text-emerald-400 bg-emerald-100/80 dark:bg-emerald-500/15',
      activeRing: 'border-emerald-500 ring-2 ring-emerald-500/20',
    },
    {
      key: 'inactive',
      label: '已停用',
      value: summary.inactive,
      icon: UserX,
      accent: 'text-rose-600 dark:text-rose-400 bg-rose-100/80 dark:bg-rose-500/15',
      activeRing: 'border-rose-500 ring-2 ring-rose-500/20',
    },
  ];

  if (isLoading) {
    return (
      <div className="py-20 flex flex-col items-center justify-center gap-3">
        <Loader2 className="animate-spin text-sapphire-blue" size={32} />
        <p className="text-xs font-bold text-muted-foreground tracking-wider uppercase">
          載入成員名錄中...
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4 sm:space-y-5">
      {/* KPI Quick-Filter Strip */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 sm:gap-3">
        {statTiles.map((tile) => {
          const isSelected = statusFilter === tile.key;
          return (
            <button
              key={tile.key}
              type="button"
              onClick={() => setStatusFilter(tile.key)}
              className={cn(
                'p-3.5 sm:p-4 rounded-2xl bg-card border text-left transition-all active:scale-[0.98] flex items-center gap-3',
                isSelected ? tile.activeRing : 'border-border hover:border-border/80'
              )}
            >
              <div className={cn('size-10 rounded-xl flex items-center justify-center shrink-0', tile.accent)}>
                <tile.icon size={18} aria-hidden="true" />
              </div>
              <div className="min-w-0">
                <p className="text-xs font-bold text-muted-foreground truncate">{tile.label}</p>
                <p className="text-xl font-display font-black text-foreground tabular-nums leading-tight mt-0.5">
                  {tile.value}
                </p>
              </div>
            </button>
          );
        })}
      </div>

      {/* Filter & Search Toolbar */}
      <Card className="p-3.5 sm:p-4 rounded-2xl border-border shadow-xs space-y-3">
        <div className="grid grid-cols-1 md:grid-cols-[minmax(0,1.2fr)_minmax(0,0.85fr)_minmax(0,0.95fr)] gap-2.5">
          {/* Search Input */}
          <div className="relative">
            <Search
              size={16}
              className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none"
              aria-hidden="true"
            />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="搜尋姓名、Email 或處室..."
              aria-label="搜尋成員"
              className="w-full h-11 pl-10 pr-9 rounded-xl border border-input bg-surface-subtle text-base sm:text-sm font-bold text-foreground placeholder:text-muted-foreground/70 focus:outline-none focus:ring-2 focus:ring-sapphire-blue/25 focus:border-sapphire-blue"
            />
            {search && (
              <button
                type="button"
                aria-label="清除搜尋條件"
                onClick={() => setSearch('')}
                className="absolute right-2 top-1/2 -translate-y-1/2 size-8 rounded-lg flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-secondary"
              >
                <X size={15} aria-hidden="true" />
              </button>
            )}
          </div>

          <ResponsiveSelect
            value={departmentFilter}
            onValueChange={setDepartmentFilter}
            options={departmentOptions}
            title="依單位篩選"
            description="選擇要檢視的處室或單位成員"
            icon={<Building2 size={15} className="text-muted-foreground" />}
          />

          <ResponsiveSelect
            value={sortBy}
            onValueChange={(val) => setSortBy(val as SortOption)}
            options={SORT_OPTIONS}
            title="排序方式"
            description="調整成員名錄排列順序"
          />
        </div>

        <div className="flex items-center justify-between text-xs font-bold text-muted-foreground pt-0.5">
          <span>
            顯示 <strong className="text-foreground font-black tabular-nums">{filteredUsers.length}</strong> 位成員
          </span>
          {(statusFilter !== 'all' || departmentFilter !== 'all' || search) && (
            <button
              type="button"
              onClick={() => {
                setStatusFilter('all');
                setDepartmentFilter('all');
                setSearch('');
              }}
              className="text-sapphire-blue hover:underline font-black"
            >
              重設篩選條件
            </button>
          )}
        </div>
      </Card>

      {/* Member Cards Grid */}
      {filteredUsers.length === 0 ? (
        <Card className="p-10 sm:p-12 rounded-2xl border-border text-center space-y-2">
          <Users size={36} className="mx-auto text-muted-foreground/40" aria-hidden="true" />
          <p className="text-base font-display font-black text-foreground">找不到符合條件的成員</p>
          <p className="text-xs font-bold text-muted-foreground">請試著放寬搜尋關鍵字或篩選標籤。</p>
        </Card>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
          {filteredUsers.map((u) => {
            const isSelf = u.id === currentUserId;
            const winRate =
              u.matches_played > 0 ? Math.round((u.wins / u.matches_played) * 100) : 0;

            return (
              <Card
                key={u.id}
                className={cn(
                  'p-4 rounded-2xl border shadow-xs flex flex-col justify-between gap-3.5 transition-all',
                  !u.is_active
                    ? 'border-rose-200/80 dark:border-rose-500/25 bg-rose-50/20 dark:bg-rose-950/10 opacity-85'
                    : u.role === 'admin'
                      ? 'border-sapphire-blue/25 bg-card'
                      : 'border-border bg-card'
                )}
              >
                {/* Member Identity Row */}
                <div className="flex items-start gap-3 min-w-0">
                  <PlayerAvatar
                    src={u.avatar_url}
                    name={u.name}
                    className={cn(
                      'size-12 rounded-2xl border shrink-0 text-base',
                      u.role === 'admin' ? 'border-sapphire-blue/40' : 'border-border'
                    )}
                  />
                  <div className="min-w-0 flex-1 space-y-1">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <h4 className="font-display font-black text-base text-foreground truncate max-w-full">
                        {u.name}
                      </h4>
                      {isSelf && (
                        <span className="px-2 py-0.5 rounded-md bg-sapphire-blue/12 text-sapphire-blue dark:text-blue-300 text-[11px] font-black leading-none shrink-0">
                          YOU
                        </span>
                      )}
                      {u.role === 'admin' && (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-amber-100 text-amber-800 dark:bg-amber-500/20 dark:text-amber-300 text-[11px] font-black leading-none shrink-0">
                          <ShieldCheck size={11} aria-hidden="true" />
                          管理員
                        </span>
                      )}
                      {u.is_env_admin && (
                        <span className="px-2 py-0.5 rounded-md bg-indigo-100 text-indigo-700 dark:bg-indigo-500/20 dark:text-indigo-300 text-[11px] font-black leading-none shrink-0">
                          環境保護
                        </span>
                      )}
                      {!u.is_active && (
                        <span className="px-2 py-0.5 rounded-md bg-rose-100 text-rose-700 dark:bg-rose-500/20 dark:text-rose-300 text-[11px] font-black leading-none shrink-0">
                          已停用
                        </span>
                      )}
                    </div>

                    <p className="text-xs font-bold text-muted-foreground truncate">
                      {u.department || '未設定單位'}
                      {u.email ? ` · ${u.email}` : ''}
                    </p>
                  </div>
                </div>

                {/* Metrics Strip */}
                <div className="bg-surface-subtle/80 border border-border/70 rounded-xl px-3.5 py-2.5 flex items-center justify-between gap-2">
                  <div>
                    <span className="text-[11px] font-bold text-muted-foreground block">目前 ELO</span>
                    <span className="text-lg font-display font-black text-foreground tabular-nums leading-tight">
                      {Math.round(u.global_mmr)}
                    </span>
                  </div>
                  <div className="h-7 w-px bg-border" />
                  <div className="text-center">
                    <span className="text-[11px] font-bold text-muted-foreground block">生涯戰績</span>
                    <span className="text-sm font-display font-black tabular-nums leading-tight text-foreground">
                      <span className="text-emerald-600 dark:text-emerald-400">{u.wins}勝</span>{' '}
                      <span className="text-rose-600 dark:text-rose-400">{u.losses}敗</span>
                    </span>
                  </div>
                  <div className="h-7 w-px bg-border" />
                  <div className="text-right">
                    <span className="text-[11px] font-bold text-muted-foreground block">生涯勝率</span>
                    <span className="text-sm font-display font-black text-foreground tabular-nums leading-tight">
                      {u.matches_played > 0 ? `${winRate}%` : '—'}
                    </span>
                  </div>
                </div>

                {/* Action Bar */}
                <div className="grid grid-cols-2 gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => openEditModal(u)}
                    className="min-h-10 rounded-xl border-border font-bold text-xs sm:text-sm gap-1.5"
                  >
                    <Edit3 size={15} aria-hidden="true" />
                    編輯與權限
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => openMmrModal(u)}
                    className="min-h-10 rounded-xl border-sapphire-blue/30 text-sapphire-blue dark:text-blue-300 hover:bg-sapphire-blue/8 font-bold text-xs sm:text-sm gap-1.5"
                  >
                    <Scale size={15} aria-hidden="true" />
                    校準積分
                  </Button>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      {/* Modal 1: Edit User Role / Status / Profile */}
      <ResponsiveFormModal
        open={!!editingUser}
        onOpenChange={(open) => {
          if (!open && !updateUserMutation.isPending) setEditingUser(null);
        }}
        size="md"
        tone="default"
        icon={<Shield size={18} />}
        title={editingUser ? `編輯成員 · ${editingUser.name}` : '編輯成員與權限'}
        description="調整顯示姓名、所屬單位、管理員權限或停用帳號。"
        onSubmit={handleSaveUser}
        footer={
          <>
            <Button
              type="button"
              variant="outline"
              disabled={updateUserMutation.isPending}
              onClick={() => setEditingUser(null)}
              className="w-full sm:w-auto h-11 px-5 rounded-xl font-bold"
            >
              取消
            </Button>
            <Button
              type="submit"
              disabled={updateUserMutation.isPending || !editName.trim()}
              className="w-full sm:w-auto h-11 px-6 rounded-xl bg-primary text-primary-foreground font-display font-black text-sm"
            >
              {updateUserMutation.isPending ? '儲存中...' : '儲存成員設定'}
            </Button>
          </>
        }
      >
        {editingUser && (
          <div className="space-y-4">
            <div className="space-y-1.5">
              <label htmlFor="admin-edit-user-name" className="arena-label">
                顯示姓名
              </label>
              <input
                id="admin-edit-user-name"
                type="text"
                required
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                className="w-full h-11 px-3.5 rounded-xl border border-input bg-surface-subtle text-base sm:text-sm font-bold text-foreground focus:outline-none focus:ring-2 focus:ring-sapphire-blue/25 focus:border-sapphire-blue"
              />
            </div>

            <div className="space-y-2">
              <label htmlFor="admin-edit-user-dept" className="arena-label">
                所屬處室 / 單位
              </label>
              <input
                id="admin-edit-user-dept"
                type="text"
                value={editDepartment}
                onChange={(e) => setEditDepartment(e.target.value)}
                placeholder="例如：資訊處、秘書室"
                className="w-full h-11 px-3.5 rounded-xl border border-input bg-surface-subtle text-base sm:text-sm font-bold text-foreground focus:outline-none focus:ring-2 focus:ring-sapphire-blue/25 focus:border-sapphire-blue"
              />
              {existingDepartments.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {existingDepartments.map((dept) => (
                    <button
                      key={dept}
                      type="button"
                      onClick={() => setEditDepartment(dept)}
                      className={cn(
                        'px-2.5 py-1 rounded-lg text-xs font-bold border transition-colors',
                        editDepartment === dept
                          ? 'bg-sapphire-blue/12 border-sapphire-blue text-sapphire-blue dark:text-blue-300'
                          : 'bg-secondary/70 border-border text-muted-foreground hover:text-foreground'
                      )}
                    >
                      {dept}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Role Toggle */}
            <div className="space-y-2 pt-1">
              <span className="arena-label">系統角色權限</span>
              <div className="grid grid-cols-2 gap-2">
                {(['user', 'admin'] as const).map((r) => {
                  const selected = editRole === r;
                  const disabled = Boolean(roleLockReason);
                  return (
                    <button
                      key={r}
                      type="button"
                      disabled={disabled}
                      onClick={() => setEditRole(r)}
                      className={cn(
                        'min-h-11 px-3 py-2.5 rounded-xl border text-xs sm:text-sm font-black transition-all flex items-center justify-center gap-1.5 disabled:opacity-55 disabled:cursor-not-allowed',
                        selected
                          ? r === 'admin'
                            ? 'bg-amber-50 border-amber-500 text-amber-800 dark:bg-amber-500/20 dark:text-amber-200'
                            : 'bg-sapphire-blue/10 border-sapphire-blue text-sapphire-blue dark:text-blue-200'
                          : 'bg-card border-border text-muted-foreground hover:text-foreground'
                      )}
                    >
                      {r === 'admin' ? <ShieldCheck size={16} /> : <Users size={16} />}
                      {r === 'admin' ? '系統管理員' : '一般同仁'}
                    </button>
                  );
                })}
              </div>
              {roleLockReason && (
                <p className="text-xs font-bold text-amber-700 dark:text-amber-300 bg-amber-50/80 dark:bg-amber-500/12 border border-amber-200 dark:border-amber-500/30 rounded-xl px-3 py-2">
                  {roleLockReason}
                </p>
              )}
            </div>

            {/* Active Status Toggle */}
            <div className="space-y-2 pt-1">
              <span className="arena-label">帳號狀態</span>
              <div className="grid grid-cols-2 gap-2">
                {[
                  { val: true, label: '啟用中（可登入報分）', icon: UserCheck },
                  { val: false, label: '已停用（禁止登入）', icon: UserX },
                ].map((opt) => {
                  const selected = editActive === opt.val;
                  const disabled = Boolean(activeLockReason);
                  return (
                    <button
                      key={String(opt.val)}
                      type="button"
                      disabled={disabled}
                      onClick={() => setEditActive(opt.val)}
                      className={cn(
                        'min-h-11 px-3 py-2.5 rounded-xl border text-xs font-black transition-all flex items-center justify-center gap-1.5 disabled:opacity-55 disabled:cursor-not-allowed',
                        selected
                          ? opt.val
                            ? 'bg-emerald-50 border-emerald-500 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-200'
                            : 'bg-rose-50 border-rose-500 text-rose-700 dark:bg-rose-500/20 dark:text-rose-200'
                          : 'bg-card border-border text-muted-foreground hover:text-foreground'
                      )}
                    >
                      <opt.icon size={15} aria-hidden="true" />
                      {opt.label}
                    </button>
                  );
                })}
              </div>
              {activeLockReason && (
                <p className="text-xs font-bold text-amber-700 dark:text-amber-300 bg-amber-50/80 dark:bg-amber-500/12 border border-amber-200 dark:border-amber-500/30 rounded-xl px-3 py-2">
                  {activeLockReason}
                </p>
              )}
            </div>
          </div>
        )}
      </ResponsiveFormModal>

      {/* Modal 2: Calibrate User MMR */}
      <ResponsiveFormModal
        open={!!mmrUser}
        onOpenChange={(open) => {
          if (!open && !adjustMmrMutation.isPending) setMmrUser(null);
        }}
        size="md"
        tone="gold"
        icon={<Scale size={18} />}
        title={mmrUser ? `校準 ELO 積分 · ${mmrUser.name}` : '校準 ELO 積分'}
        description="校準結果將寫入選手歷史曲線，並發送透明通知。"
        onSubmit={handleSaveMmr}
        footer={
          <>
            <Button
              type="button"
              variant="outline"
              disabled={adjustMmrMutation.isPending}
              onClick={() => setMmrUser(null)}
              className="w-full sm:w-auto h-11 px-5 rounded-xl font-bold"
            >
              取消
            </Button>
            <Button
              type="submit"
              disabled={
                adjustMmrMutation.isPending ||
                !mmrPreview?.valid ||
                mmrReason.trim().length < 2
              }
              className="w-full sm:w-auto h-11 px-6 rounded-xl bg-amber-600 hover:bg-amber-700 text-white font-display font-black text-sm"
            >
              {adjustMmrMutation.isPending ? '套用中...' : '確認校準積分'}
            </Button>
          </>
        }
      >
        {mmrUser && (
          <div className="space-y-4">
            {/* Mode Switch */}
            <div className="grid grid-cols-2 p-1 rounded-xl bg-secondary border border-border gap-1">
              <button
                type="button"
                onClick={() => {
                  setMmrMode('delta');
                  setMmrInput('20');
                }}
                className={cn(
                  'min-h-10 rounded-lg text-xs sm:text-sm font-black transition-all',
                  mmrMode === 'delta'
                    ? 'bg-card text-foreground shadow-xs'
                    : 'text-muted-foreground hover:text-foreground'
                )}
              >
                調整增減值 (+/-)
              </button>
              <button
                type="button"
                onClick={() => {
                  setMmrMode('target');
                  setMmrInput(String(Math.round(mmrUser.global_mmr)));
                }}
                className={cn(
                  'min-h-10 rounded-lg text-xs sm:text-sm font-black transition-all',
                  mmrMode === 'target'
                    ? 'bg-card text-foreground shadow-xs'
                    : 'text-muted-foreground hover:text-foreground'
                )}
              >
                直接設定目標分數
              </button>
            </div>

            {/* Quick Delta Chips */}
            <div className="space-y-1.5">
              <span className="text-xs font-bold text-muted-foreground block">快速增減幅度</span>
              <div className="grid grid-cols-3 sm:grid-cols-6 gap-1.5">
                {QUICK_DELTAS.map((d) => {
                  const active = mmrMode === 'delta' && Number(mmrInput) === d;
                  return (
                    <button
                      key={d}
                      type="button"
                      onClick={() => {
                        setMmrMode('delta');
                        setMmrInput(String(d));
                      }}
                      className={cn(
                        'min-h-10 rounded-xl border text-xs font-display font-black tabular-nums transition-all active:scale-95',
                        active
                          ? d > 0
                            ? 'bg-emerald-600 border-emerald-600 text-white'
                            : 'bg-rose-600 border-rose-600 text-white'
                          : d > 0
                            ? 'bg-emerald-50/70 border-emerald-200 text-emerald-700 dark:bg-emerald-500/12 dark:border-emerald-500/30 dark:text-emerald-300'
                            : 'bg-rose-50/70 border-rose-200 text-rose-700 dark:bg-rose-500/12 dark:border-rose-500/30 dark:text-rose-300'
                      )}
                    >
                      {d > 0 ? `+${d}` : d}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Numeric Input */}
            <div className="space-y-1.5">
              <label htmlFor="admin-mmr-input" className="arena-label">
                {mmrMode === 'delta' ? '調整幅度（正數加分、負數扣分）' : '指定目標 ELO 分數（600 – 3000）'}
              </label>
              <input
                id="admin-mmr-input"
                type="number"
                step="0.5"
                inputMode="decimal"
                value={mmrInput}
                onChange={(e) => setMmrInput(e.target.value)}
                className="w-full h-11 px-3.5 rounded-xl border border-input bg-surface-subtle text-base sm:text-sm font-display font-black tabular-nums text-foreground focus:outline-none focus:ring-2 focus:ring-amber-500/25 focus:border-amber-500"
              />
            </div>

            {/* Live Preview Banner */}
            {mmrPreview && (
              <div className="bg-surface-subtle border border-border rounded-2xl p-3.5 flex items-center justify-between gap-3">
                <div>
                  <span className="text-xs font-bold text-muted-foreground block">
                    調整前後預覽 {mmrPreview.clamped && '(已套用 600–3000 上下限)'}
                  </span>
                  <div className="flex items-center gap-2 mt-0.5 font-display font-black text-base sm:text-lg tabular-nums">
                    <span className="text-muted-foreground">{Math.round(mmrUser.global_mmr)}</span>
                    <span className="text-muted-foreground/50">→</span>
                    <span className="text-foreground">{Math.round(mmrPreview.nextMmr)} ELO</span>
                  </div>
                </div>
                <div
                  className={cn(
                    'inline-flex items-center gap-1 px-3 py-1.5 rounded-xl font-display font-black text-sm tabular-nums',
                    mmrPreview.delta > 0
                      ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-300'
                      : mmrPreview.delta < 0
                        ? 'bg-rose-100 text-rose-700 dark:bg-rose-500/20 dark:text-rose-300'
                        : 'bg-secondary text-muted-foreground'
                  )}
                >
                  {mmrPreview.delta > 0 ? (
                    <TrendingUp size={15} aria-hidden="true" />
                  ) : mmrPreview.delta < 0 ? (
                    <TrendingDown size={15} aria-hidden="true" />
                  ) : null}
                  {mmrPreview.delta > 0 ? `+${mmrPreview.delta}` : mmrPreview.delta}
                </div>
              </div>
            )}

            {/* Required Reason */}
            <div className="space-y-2">
              <label htmlFor="admin-mmr-reason" className="arena-label">
                調整原因 <span className="text-rose-500">*</span>
              </label>
              <input
                id="admin-mmr-reason"
                type="text"
                required
                placeholder="請說明校準原因，選手將於通知中心收到此說明"
                value={mmrReason}
                onChange={(e) => setMmrReason(e.target.value)}
                className="w-full h-11 px-3.5 rounded-xl border border-input bg-surface-subtle text-base sm:text-sm font-bold text-foreground focus:outline-none focus:ring-2 focus:ring-amber-500/25 focus:border-amber-500"
              />
              <div className="flex flex-wrap gap-1.5">
                {QUICK_MMR_REASONS.map((preset) => (
                  <button
                    key={preset}
                    type="button"
                    onClick={() => setMmrReason(preset)}
                    className="px-2.5 py-1 rounded-lg bg-secondary/70 border border-border text-xs font-bold text-muted-foreground hover:text-foreground transition-colors"
                  >
                    {preset}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex items-start gap-2 rounded-xl bg-amber-50/70 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/25 px-3 py-2.5 text-xs font-bold text-amber-800 dark:text-amber-300">
              <ShieldAlert size={15} className="shrink-0 mt-0.5" aria-hidden="true" />
              <span>所有手動校準皆會紀錄於選手戰績曲線與系統通知，確保排行公開透明。</span>
            </div>
          </div>
        )}
      </ResponsiveFormModal>
    </div>
  );
}
