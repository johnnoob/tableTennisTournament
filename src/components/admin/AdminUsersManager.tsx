import { useEffect, useMemo, useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  ArrowLeftRight,
  Building2,
  Check,
  ChevronDown,
  Download,
  Edit3,
  FlaskConical,
  History,
  Loader2,
  Lock,
  Minus,
  Plus,
  Scale,
  Search,
  Shield,
  ShieldCheck,
  TrendingDown,
  TrendingUp,
  Users,
  X,
} from 'lucide-react';
import { toast } from 'sonner';
import { adminApi } from '@/lib/admin';
import { downloadCsv } from '@/lib/csv';
import type { AdminUserItem } from '@/types/admin';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { PlayerAvatar } from '@/components/PlayerAvatar';
import { ResponsiveFormModal } from '@/components/ResponsiveFormModal';
import { ResponsiveSelect, type ResponsiveSelectOption } from '@/components/ui/responsive-select';
import { AdminUserMmrLogsDrawer } from '@/components/admin/AdminUserMmrLogsDrawer';

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
  { value: 'mmr_desc', label: '積分由高到低' },
  { value: 'mmr_asc', label: '積分由低到高' },
  { value: 'matches_desc', label: '生涯出賽場次最多' },
];

interface DepartmentChoice {
  name: string;
  count: number;
}

interface DepartmentComboboxProps {
  id: string;
  value: string;
  onChange: (value: string) => void;
  choices: DepartmentChoice[];
  placeholder?: string;
  required?: boolean;
}

function DepartmentCombobox({
  id,
  value,
  onChange,
  choices,
  placeholder = '搜尋或選擇單位，亦可直接輸入名稱',
  required = false,
}: Readonly<DepartmentComboboxProps>) {
  const [open, setOpen] = useState(false);
  const [isFiltering, setIsFiltering] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handlePointerDown = (event: MouseEvent | TouchEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setOpen(false);
        setIsFiltering(false);
      }
    };
    document.addEventListener('mousedown', handlePointerDown);
    document.addEventListener('touchstart', handlePointerDown);
    return () => {
      document.removeEventListener('mousedown', handlePointerDown);
      document.removeEventListener('touchstart', handlePointerDown);
    };
  }, [open]);

  const trimmed = value.trim();
  const filteredChoices = useMemo(() => {
    if (!isFiltering || !trimmed) return choices;
    const query = trimmed.toLowerCase();
    return choices.filter((choice) => choice.name.toLowerCase().includes(query));
  }, [choices, isFiltering, trimmed]);

  const hasExactMatch = choices.some((choice) => choice.name === trimmed);

  const handleSelect = (dept: string) => {
    onChange(dept);
    setOpen(false);
    setIsFiltering(false);
  };

  return (
    <div ref={containerRef} className="space-y-1.5">
      <div className="relative">
        <Search
          size={15}
          className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground"
          aria-hidden="true"
        />
        <input
          id={id}
          type="text"
          required={required}
          role="combobox"
          aria-expanded={open}
          aria-autocomplete="list"
          value={value}
          onFocus={() => {
            setOpen(true);
            setIsFiltering(false);
          }}
          onChange={(e) => {
            onChange(e.target.value);
            setOpen(true);
            setIsFiltering(true);
          }}
          onKeyDown={(e) => {
            if (e.key === 'Escape') {
              setOpen(false);
              setIsFiltering(false);
            }
          }}
          placeholder={placeholder}
          className="arena-input pl-9 pr-16"
        />
        <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-0.5">
          {value.length > 0 && (
            <button
              type="button"
              aria-label="清除單位欄位"
              onClick={() => {
                onChange('');
                setOpen(true);
                setIsFiltering(false);
              }}
              className="size-7 rounded-lg flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-secondary/80 transition-colors"
            >
              <X size={14} aria-hidden="true" />
            </button>
          )}
          <button
            type="button"
            aria-label={open ? '收合單位清單' : '展開單位清單'}
            onClick={() => {
              setOpen((prev) => !prev);
              setIsFiltering(false);
            }}
            className="size-7 rounded-lg flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-secondary/80 transition-colors"
          >
            <ChevronDown
              size={15}
              aria-hidden="true"
              className={cn('transition-transform duration-150', open && 'rotate-180')}
            />
          </button>
        </div>
      </div>

      {open && (
        <div className="rounded-xl border border-border bg-card shadow-md overflow-hidden">
          {choices.length > 0 && (
            <div className="px-3 py-1.5 bg-surface-subtle/70 border-b border-border/70 flex items-center justify-between text-xs font-medium text-muted-foreground">
              <span>
                {isFiltering && trimmed
                  ? `符合「${trimmed}」的單位`
                  : '現有處室 / 單位快速選擇'}
              </span>
              <span className="tabular-nums">{filteredChoices.length} 項</span>
            </div>
          )}
          <div className="max-h-48 overflow-y-auto overscroll-contain divide-y divide-border/50">
            {trimmed && !hasExactMatch && (
              <button
                type="button"
                onClick={() => handleSelect(trimmed)}
                className="w-full px-3 py-2.5 flex items-center gap-2 text-left text-xs font-semibold text-sapphire-blue dark:text-blue-300 bg-sapphire-blue/[0.06] hover:bg-sapphire-blue/12 transition-colors"
              >
                <Plus size={14} className="shrink-0" aria-hidden="true" />
                <span className="truncate">使用新單位「{trimmed}」</span>
              </button>
            )}
            {filteredChoices.map((choice) => {
              const selected = trimmed === choice.name;
              return (
                <button
                  key={choice.name}
                  type="button"
                  onClick={() => handleSelect(choice.name)}
                  className={cn(
                    'w-full px-3 py-2 flex items-center justify-between gap-2 text-left transition-colors',
                    selected
                      ? 'bg-sapphire-blue/10 text-sapphire-blue dark:text-blue-300'
                      : 'hover:bg-secondary/70 text-foreground',
                  )}
                >
                  <span className="inline-flex items-center gap-2 min-w-0">
                    <Building2 size={14} className="shrink-0 text-muted-foreground" aria-hidden="true" />
                    <span className="text-xs sm:text-sm font-medium truncate">{choice.name}</span>
                  </span>
                  <span className="inline-flex items-center gap-1.5 shrink-0">
                    <span className="px-1.5 py-0.5 rounded-md bg-secondary text-xs font-semibold text-muted-foreground tabular-nums">
                      {choice.count} 人
                    </span>
                    {selected && <Check size={14} className="shrink-0" aria-hidden="true" />}
                  </span>
                </button>
              );
            })}
            {filteredChoices.length === 0 && !trimmed && (
              <p className="px-3 py-3 text-xs font-medium text-muted-foreground text-center">
                目前尚無已建檔單位，請直接於上方輸入名稱
              </p>
            )}
            {filteredChoices.length === 0 && trimmed && hasExactMatch && null}
          </div>
        </div>
      )}
    </div>
  );
}

export function AdminUsersManager({ currentUserId, onUpdate }: AdminUsersManagerProps) {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
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

  // Multi-select & Batch Department Modal State
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [batchDeptOpen, setBatchDeptOpen] = useState(false);
  const [batchDepartment, setBatchDepartment] = useState('');

  // User Score History Drawer State
  const [logsUser, setLogsUser] = useState<AdminUserItem | null>(null);

  // Create Test Account Modal State
  const [createTestOpen, setCreateTestOpen] = useState(false);
  const [testNameInput, setTestNameInput] = useState('');
  const [testDeptInput, setTestDeptInput] = useState('測試組');
  const [testMmrInput, setTestMmrInput] = useState('1000');

  const { data: users = [], isLoading } = useQuery<AdminUserItem[]>({
    queryKey: ['admin', 'users'],
    queryFn: () => adminApi.getUsers(),
  });

  const { data: testImpersonationStatus } = useQuery({
    queryKey: ['admin', 'test-impersonation-status'],
    queryFn: () => adminApi.getTestImpersonationStatus(),
    staleTime: 60_000,
  });
  const isTestImpersonationEnabled = testImpersonationStatus?.enabled !== false;

  const openInspect = (playerId: string) => {
    const next = new URLSearchParams(searchParams);
    next.set('inspect', playerId);
    setSearchParams(next);
  };

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

  const { departmentOptions, departmentChoices } = useMemo(() => {
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
      departmentChoices: sortedDepts
        .filter(([dept]) => dept !== '未設定單位' && dept !== '未設定處室')
        .map(([name, count]) => ({ name, count })),
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

  const visibleUserIds = useMemo(() => filteredUsers.map((u) => u.id), [filteredUsers]);
  const selectedValidIds = useMemo(() => {
    const allowed = new Set(visibleUserIds);
    return selectedIds.filter((id) => allowed.has(id));
  }, [selectedIds, visibleUserIds]);
  const allVisibleSelected =
    filteredUsers.length > 0 && selectedValidIds.length === filteredUsers.length;
  const selectedUsersList = useMemo(() => {
    const picked = new Set(selectedValidIds);
    return filteredUsers.filter((u) => picked.has(u.id));
  }, [filteredUsers, selectedValidIds]);

  const toggleSelectUser = (userId: string) => {
    setSelectedIds((prev) =>
      prev.includes(userId) ? prev.filter((id) => id !== userId) : [...prev, userId]
    );
  };

  const toggleSelectAllVisible = () => {
    setSelectedIds(allVisibleSelected ? [] : visibleUserIds);
  };

  const handleExportUsersCsv = () => {
    if (filteredUsers.length === 0) return;
    downloadCsv(
      `club_members_${new Date().toISOString().slice(0, 10)}.csv`,
      [
        '姓名',
        '所屬單位',
        'Email',
        '角色',
        '帳號狀態',
        '目前積分',
        '出賽場次',
        '勝場',
        '敗場',
        '勝率(%)',
        '登入方式',
      ],
      filteredUsers.map((u) => {
        const winRate =
          u.matches_played > 0 ? Math.round((u.wins / u.matches_played) * 1000) / 10 : 0;
        return [
          u.name,
          u.department || '未設定單位',
          u.email || '',
          u.role === 'admin' ? '管理員' : '一般同仁',
          u.is_active ? '啟用中' : '已停用',
          Math.round(u.global_mmr),
          u.matches_played,
          u.wins,
          u.losses,
          u.matches_played > 0 ? winRate : 0,
          u.auth_provider,
        ];
      })
    );
    toast.success(`已匯出 ${filteredUsers.length} 位成員名單 CSV`);
  };

  const updateUserMutation = useMutation({
    mutationFn: ({
      userId,
      payload,
    }: {
      userId: string;
      payload: Parameters<typeof adminApi.updateUser>[1];
    }) => adminApi.updateUser(userId, payload),
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
    mutationFn: ({
      userId,
      payload,
    }: {
      userId: string;
      payload: Parameters<typeof adminApi.adjustUserMmr>[1];
    }) => adminApi.adjustUserMmr(userId, payload),
    onSuccess: (res) => {
      onUpdate();
      setMmrUser(null);
      toast.success(res.message);
    },
    onError: (err: Error) => {
      toast.error('校準積分失敗', { description: err.message });
    },
  });

  const batchDeptMutation = useMutation({
    mutationFn: (payload: Parameters<typeof adminApi.batchUpdateDepartment>[0]) =>
      adminApi.batchUpdateDepartment(payload),
    onSuccess: (res) => {
      onUpdate();
      setBatchDeptOpen(false);
      setSelectedIds([]);
      setBatchDepartment('');
      toast.success(res.message);
    },
    onError: (err: Error) => {
      toast.error('批次設定單位失敗', { description: err.message });
    },
  });

  const handleSaveBatchDepartment = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (batchDeptMutation.isPending || selectedValidIds.length === 0) return;
    const clean = batchDepartment.trim();
    if (!clean) {
      toast.error('請輸入或點選目標單位名稱');
      return;
    }
    batchDeptMutation.mutate({
      user_ids: selectedValidIds,
      department: clean,
    });
  };

  const createTestMutation = useMutation({
    mutationFn: (payload: Parameters<typeof adminApi.createTestAccount>[0]) =>
      adminApi.createTestAccount(payload),
    onSuccess: (res) => {
      onUpdate();
      queryClient.invalidateQueries({ queryKey: ['users'] });
      setCreateTestOpen(false);
      setTestNameInput('');
      setTestDeptInput('測試組');
      setTestMmrInput('1000');
      toast.success(res.message);
    },
    onError: (err: Error) => {
      toast.error('建立測試帳號失敗', { description: err.message });
    },
  });

  const impersonateMutation = useMutation({
    mutationFn: (userId: string) => adminApi.impersonateTestUser(userId),
    onSuccess: async (res) => {
      queryClient.clear();
      await queryClient.invalidateQueries({ queryKey: ['authUser'] });
      toast.success(res.message);
      navigate('/');
    },
    onError: (err: Error) => {
      toast.error('切換測試帳號失敗', { description: err.message });
    },
  });

  const handleCreateTestAccount = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (createTestMutation.isPending) return;
    const parsedMmr = Number(testMmrInput);
    const safeMmr = Number.isNaN(parsedMmr) ? 1000 : Math.min(3000, Math.max(600, parsedMmr));
    createTestMutation.mutate({
      name: testNameInput.trim() || undefined,
      department: testDeptInput.trim() || '測試組',
      global_mmr: safeMmr,
    });
  };

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

  const stepMmrInput = (step: number) => {
    const parsed = Number(mmrInput);
    const current = Number.isNaN(parsed)
      ? mmrMode === 'target' && mmrUser
        ? mmrUser.global_mmr
        : 0
      : parsed;
    const next = mmrMode === 'target' ? Math.max(600, Math.min(3000, current + step)) : current + step;
    setMmrInput(String(Math.round(next * 10) / 10));
  };

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

  const statusTabs: Array<{ key: StatusFilter; label: string; count: number }> = [
    { key: 'all', label: '全部成員', count: summary.total },
    { key: 'admin', label: '管理員', count: summary.admins },
    { key: 'active', label: '啟用中', count: summary.active },
    { key: 'inactive', label: '已停用', count: summary.inactive },
  ];

  const hasActiveFilter =
    statusFilter !== 'all' ||
    departmentFilter !== 'all' ||
    sortBy !== 'default' ||
    search.trim().length > 0;

  if (isLoading) {
    return (
      <div className="rounded-2xl border border-border bg-card py-20 flex flex-col items-center justify-center gap-3">
        <Loader2 className="animate-spin text-sapphire-blue" size={32} />
        <p className="text-xs font-medium text-muted-foreground">
          載入成員名錄中...
        </p>
      </div>
    );
  }

  return (
    <section className="rounded-2xl border border-border bg-card shadow-xs overflow-hidden">
      {/* Unified Command Header */}
      <div className="p-3.5 sm:p-4 border-b border-border bg-surface-subtle/40 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex flex-nowrap overflow-x-auto no-scrollbar gap-1 p-1 rounded-xl bg-secondary/90 border border-border/80 w-full sm:w-fit">
            {statusTabs.map((tab) => {
              const active = statusFilter === tab.key;
              return (
                <button
                  key={tab.key}
                  type="button"
                  onClick={() => setStatusFilter(tab.key)}
                  className={cn(
                    'min-h-9 px-3 py-1.5 rounded-lg text-xs sm:text-sm font-semibold transition-all flex items-center gap-1.5 shrink-0 whitespace-nowrap',
                    active
                      ? 'bg-card text-foreground shadow-xs'
                      : 'text-muted-foreground hover:text-foreground'
                  )}
                >
                  <span>{tab.label}</span>
                  <span
                    className={cn(
                      'px-1.5 py-0.5 rounded-full text-xs font-display font-semibold tabular-nums leading-none',
                      active
                        ? 'bg-primary text-primary-foreground'
                        : tab.key === 'inactive' && tab.count > 0
                          ? 'bg-rose-100 text-rose-700 dark:bg-rose-500/20 dark:text-rose-300'
                          : 'bg-background/70 text-muted-foreground'
                    )}
                  >
                    {tab.count}
                  </span>
                </button>
              );
            })}
          </div>

          <div className="w-full sm:w-auto flex items-center justify-between sm:justify-end gap-2 text-xs font-bold text-muted-foreground sm:ml-auto flex-wrap">
            <span>
              顯示 <strong className="text-foreground font-semibold tabular-nums">{filteredUsers.length}</strong> / {summary.total} 位
            </span>
            <div className="flex items-center gap-2 flex-wrap">
              {hasActiveFilter && (
                <button
                  type="button"
                  onClick={() => {
                    setStatusFilter('all');
                    setDepartmentFilter('all');
                    setSortBy('default');
                    setSearch('');
                  }}
                  className="text-sapphire-blue hover:underline font-semibold"
                >
                  重設條件
                </button>
              )}
              {isTestImpersonationEnabled && (
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setCreateTestOpen(true)}
                  className="min-h-9 py-1.5 px-2.5 sm:px-3 rounded-xl border-violet-300/80 dark:border-violet-500/40 bg-violet-50/70 dark:bg-violet-500/12 text-violet-700 dark:text-violet-300 hover:bg-violet-100/80 dark:hover:bg-violet-500/20 font-semibold text-xs gap-1.5"
                >
                  <FlaskConical size={13} aria-hidden="true" />
                  <span>建立測試帳號</span>
                </Button>
              )}
              <Button
                type="button"
                variant="outline"
                disabled={filteredUsers.length === 0}
                onClick={handleExportUsersCsv}
                className="min-h-9 py-1.5 px-2.5 sm:px-3 rounded-xl border-border bg-card hover:bg-secondary text-foreground font-semibold text-xs gap-1.5"
              >
                <Download size={13} aria-hidden="true" />
                <span>匯出 CSV ({filteredUsers.length})</span>
              </Button>
            </div>
          </div>
        </div>

        {/* Search & Select Controls */}
        <div className="grid grid-cols-1 md:grid-cols-[minmax(0,1.4fr)_minmax(0,0.8fr)_minmax(0,0.9fr)] gap-2.5">
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
              className="arena-input pl-10 pr-9"
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

        {/* Contextual Multi-Select Bulk Action Bar */}
        {selectedValidIds.length > 0 && (
          <div className="rounded-xl bg-sapphire-blue/10 dark:bg-blue-500/15 border border-sapphire-blue/30 px-3.5 py-2.5 flex flex-wrap items-center justify-between gap-2.5">
            <div className="flex items-center gap-3 text-xs font-bold text-foreground">
              <span>
                已選取 <strong className="font-display font-semibold tabular-nums text-sapphire-blue dark:text-blue-300">{selectedValidIds.length}</strong> 位成員
              </span>
              <button
                type="button"
                onClick={toggleSelectAllVisible}
                className="text-sapphire-blue dark:text-blue-300 font-semibold hover:underline"
              >
                {allVisibleSelected ? '取消全選' : `全選目前 ${filteredUsers.length} 位`}
              </button>
              <button
                type="button"
                onClick={() => setSelectedIds([])}
                className="text-muted-foreground hover:text-foreground font-bold"
              >
                清除選取
              </button>
            </div>

            <Button
              type="button"
              onClick={() => {
                setBatchDepartment('');
                setBatchDeptOpen(true);
              }}
              className="min-h-9 py-1.5 px-3.5 rounded-xl bg-sapphire-blue hover:bg-blue-700 text-white font-display font-semibold text-xs gap-1.5 border-none"
            >
              <Building2 size={14} aria-hidden="true" />
              <span>批次設定單位 ({selectedValidIds.length})</span>
            </Button>
          </div>
        )}
      </div>

      {/* Empty State */}
      {filteredUsers.length === 0 ? (
        <div className="p-12 text-center space-y-2">
          <Users size={36} className="mx-auto text-muted-foreground/40" aria-hidden="true" />
          <p className="text-base font-display font-bold text-foreground">找不到符合條件的成員</p>
          <p className="text-xs font-bold text-muted-foreground">請試著放寬搜尋關鍵字或篩選標籤。</p>
        </div>
      ) : (
        <>
          {/* Desktop Directory Table (1024px+ so tablet never cramps 6 columns) */}
          <div className="hidden lg:block overflow-x-auto">
            <div className="px-5 py-2.5 bg-surface-subtle/60 border-b border-border/80 text-xs font-semibold text-muted-foreground grid grid-cols-[24px_minmax(0,1.4fr)_minmax(0,1.15fr)_116px_68px_248px] items-center gap-3">
              <button
                type="button"
                role="checkbox"
                aria-checked={allVisibleSelected}
                aria-label="全選目前顯示成員"
                onClick={toggleSelectAllVisible}
                className={cn(
                  'size-5 rounded-md border flex items-center justify-center transition-colors',
                  allVisibleSelected
                    ? 'bg-sapphire-blue border-sapphire-blue text-white'
                    : 'border-border bg-card text-transparent hover:border-sapphire-blue'
                )}
              >
                <Check size={12} strokeWidth={3} aria-hidden="true" />
              </button>
              <span>成員</span>
              <span>單位 / 信箱</span>
              <span>權限狀態</span>
              <span className="text-right">積分</span>
              <span className="text-right">操作</span>
            </div>

            <div className="divide-y divide-border/70">
              {filteredUsers.map((u) => {
                const isSelf = u.id === currentUserId;
                const isSelected = selectedValidIds.includes(u.id);

                return (
                  <div
                    key={u.id}
                    className={cn(
                      'px-5 py-3.5 grid grid-cols-[24px_minmax(0,1.4fr)_minmax(0,1.15fr)_116px_68px_248px] items-center gap-3 hover:bg-surface-subtle/40 transition-colors',
                      isSelected && 'bg-sapphire-blue/[0.045] dark:bg-blue-500/[0.08]',
                      !u.is_active && 'bg-rose-50/15 dark:bg-rose-950/10 opacity-75'
                    )}
                  >
                    <button
                      type="button"
                      role="checkbox"
                      aria-checked={isSelected}
                      aria-label={`選取成員 ${u.name}`}
                      onClick={() => toggleSelectUser(u.id)}
                      className={cn(
                        'size-5 rounded-md border flex items-center justify-center transition-colors shrink-0',
                        isSelected
                          ? 'bg-sapphire-blue border-sapphire-blue text-white'
                          : 'border-border bg-card text-transparent hover:border-sapphire-blue'
                      )}
                    >
                      <Check size={12} strokeWidth={3} aria-hidden="true" />
                    </button>

                    {/* Member Identity */}
                    <button
                      type="button"
                      onClick={() => openInspect(u.id)}
                      className="flex items-center gap-3 min-w-0 text-left group"
                    >
                      <PlayerAvatar
                        src={u.avatar_url}
                        name={u.name}
                        className={cn(
                          'size-10 rounded-xl border shrink-0 text-sm transition-all group-hover:ring-2 group-hover:ring-sapphire-blue/50',
                          u.role === 'admin' ? 'border-amber-400/60' : 'border-border'
                        )}
                      />
                      <div className="min-w-0 flex items-center gap-1.5 flex-wrap">
                        <span className="font-display font-bold text-sm text-foreground truncate group-hover:text-sapphire-blue transition-colors">
                          {u.name}
                        </span>
                        {u.auth_provider === 'test' && (
                          <span className="px-1.5 py-0.5 rounded bg-violet-100 text-violet-700 dark:bg-violet-500/20 dark:text-violet-300 text-xs font-semibold leading-none shrink-0">
                            測試帳號
                          </span>
                        )}
                        {isSelf && (
                          <span className="px-1.5 py-0.5 rounded bg-sapphire-blue/12 text-sapphire-blue dark:text-blue-300 text-xs font-semibold leading-none shrink-0">
                            我
                          </span>
                        )}
                      </div>
                    </button>

                    {/* Department & Email */}
                    <div className="min-w-0">
                      <p className="text-xs font-bold text-foreground truncate">
                        {u.department || '未設定單位'}
                      </p>
                      <p className="text-xs font-medium text-muted-foreground truncate mt-0.5">
                        {u.email || '未綁定信箱'}
                      </p>
                    </div>

                    {/* Role & Status */}
                    <div className="flex items-center gap-1.5 flex-wrap">
                      {!u.is_active ? (
                        <span className="px-2 py-0.5 rounded-full bg-rose-100 text-rose-700 dark:bg-rose-500/20 dark:text-rose-300 text-xs font-semibold leading-none">
                          已停用
                        </span>
                      ) : u.role === 'admin' ? (
                        <span
                          title={u.is_env_admin ? '受環境變數 ADMIN_EMAILS 保護' : undefined}
                          className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-amber-100 text-amber-800 dark:bg-amber-500/20 dark:text-amber-300 text-xs font-semibold leading-none"
                        >
                          <ShieldCheck size={11} aria-hidden="true" />
                          管理員
                          {u.is_env_admin && <Lock size={10} className="opacity-75" aria-hidden="true" />}
                        </span>
                      ) : (
                        <span className="px-2.5 py-0.5 rounded-full bg-secondary text-muted-foreground text-xs font-medium leading-none">
                          一般同仁
                        </span>
                      )}
                    </div>

                    {/* Score */}
                    <div className="text-right font-display font-bold text-base text-foreground tabular-nums">
                      {Math.round(u.global_mmr)}
                    </div>

                    {/* Actions */}
                    <div className="flex items-center justify-end gap-1.5">
                      {isTestImpersonationEnabled &&
                        u.auth_provider === 'test' &&
                        u.is_active &&
                        u.role !== 'admin' && (
                          <Button
                            type="button"
                            variant="outline"
                            disabled={impersonateMutation.isPending}
                            onClick={() => impersonateMutation.mutate(u.id)}
                            title="切換為此測試帳號實測雙向流程"
                            className="min-h-9 py-1.5 px-2.5 rounded-xl border-violet-300/80 dark:border-violet-500/40 bg-violet-50/60 dark:bg-violet-500/12 text-violet-700 dark:text-violet-300 hover:bg-violet-100/80 dark:hover:bg-violet-500/20 font-semibold text-xs gap-1 shrink-0"
                          >
                            <ArrowLeftRight size={13} aria-hidden="true" />
                            切換
                          </Button>
                        )}
                      <Button
                        type="button"
                        variant="outline"
                        size="icon"
                        onClick={() => setLogsUser(u)}
                        aria-label={`檢視 ${u.name} 的積分異動日誌`}
                        title="積分異動日誌"
                        className="size-9 rounded-xl border-border text-muted-foreground hover:text-foreground shrink-0"
                      >
                        <History size={14} aria-hidden="true" />
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => openMmrModal(u)}
                        className="min-h-9 py-1.5 px-2.5 rounded-xl border-sapphire-blue/30 text-sapphire-blue dark:text-blue-300 hover:bg-sapphire-blue/8 font-semibold text-xs gap-1"
                      >
                        <Scale size={13} aria-hidden="true" />
                        校準
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => openEditModal(u)}
                        className="min-h-9 py-1.5 px-2.5 rounded-xl border-border font-semibold text-xs gap-1"
                      >
                        <Edit3 size={13} aria-hidden="true" />
                        編輯
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Mobile & Tablet Clean Card List */}
          <div className="lg:hidden divide-y divide-border/70">
            {filteredUsers.map((u) => {
              const isSelf = u.id === currentUserId;
              const isSelected = selectedValidIds.includes(u.id);

              return (
                <div
                  key={u.id}
                  className={cn(
                    'p-3.5 sm:p-4 space-y-2.5 min-w-0 transition-colors',
                    isSelected && 'bg-sapphire-blue/[0.045] dark:bg-blue-500/[0.08]',
                    !u.is_active && 'bg-rose-50/15 dark:bg-rose-950/10 opacity-80'
                  )}
                >
                  {/* Row 1: Checkbox + Identity + Score */}
                  <div className="flex items-center justify-between gap-2.5 min-w-0">
                    <button
                      type="button"
                      role="checkbox"
                      aria-checked={isSelected}
                      aria-label={`選取成員 ${u.name}`}
                      onClick={() => toggleSelectUser(u.id)}
                      className={cn(
                        'size-5 rounded-md border flex items-center justify-center transition-colors shrink-0',
                        isSelected
                          ? 'bg-sapphire-blue border-sapphire-blue text-white'
                          : 'border-border bg-card text-transparent'
                      )}
                    >
                      <Check size={12} strokeWidth={3} aria-hidden="true" />
                    </button>

                    <button
                      type="button"
                      onClick={() => openInspect(u.id)}
                      className="flex items-center gap-2.5 min-w-0 flex-1 text-left"
                    >
                      <PlayerAvatar
                        src={u.avatar_url}
                        name={u.name}
                        className={cn(
                          'size-10 rounded-xl border shrink-0 text-sm',
                          u.role === 'admin' ? 'border-amber-400/60' : 'border-border'
                        )}
                      />
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5 flex-wrap min-w-0">
                          <span className="font-display font-bold text-sm sm:text-base text-foreground truncate max-w-full">
                            {u.name}
                          </span>
                          {u.auth_provider === 'test' && (
                            <span className="px-1.5 py-0.5 rounded bg-violet-100 text-violet-700 dark:bg-violet-500/20 dark:text-violet-300 text-xs font-semibold leading-none shrink-0">
                              測試帳號
                            </span>
                          )}
                          {isSelf && (
                            <span className="px-1.5 py-0.5 rounded bg-sapphire-blue/12 text-sapphire-blue dark:text-blue-300 text-xs font-semibold leading-none shrink-0">
                              我
                            </span>
                          )}
                          {u.role === 'admin' && (
                            <span className="inline-flex items-center gap-0.5 px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 dark:bg-amber-500/20 dark:text-amber-300 text-xs font-semibold leading-none shrink-0">
                              <ShieldCheck size={10} aria-hidden="true" />
                              管理員
                            </span>
                          )}
                          {u.is_env_admin && (
                            <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full bg-indigo-100 text-indigo-700 dark:bg-indigo-500/20 dark:text-indigo-300 text-xs font-semibold leading-none shrink-0">
                              <Lock size={9} aria-hidden="true" />
                              環境鎖定
                            </span>
                          )}
                          {!u.is_active && (
                            <span className="px-2 py-0.5 rounded-full bg-rose-100 text-rose-700 dark:bg-rose-500/20 dark:text-rose-300 text-xs font-semibold leading-none shrink-0">
                              已停用
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-muted-foreground font-bold truncate mt-0.5">
                          {u.department || '未設定單位'}
                          {u.email ? ` · ${u.email}` : ''}
                        </p>
                      </div>
                    </button>

                    <div className="text-right shrink-0 tabular-nums">
                      <span className="font-display font-bold text-lg text-foreground leading-none block">
                        {Math.round(u.global_mmr)}
                      </span>
                      <span className="text-xs font-medium text-muted-foreground">
                        分
                      </span>
                    </div>
                  </div>

                  {/* Row 3: Action Trio */}
                  <div className="grid grid-cols-3 gap-2 pt-0.5">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => setLogsUser(u)}
                      className="min-h-10 py-2 rounded-xl border-border font-semibold text-xs gap-1"
                    >
                      <History size={14} aria-hidden="true" />
                      日誌
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => openMmrModal(u)}
                      className="min-h-10 py-2 rounded-xl border-sapphire-blue/30 text-sapphire-blue dark:text-blue-300 hover:bg-sapphire-blue/8 font-semibold text-xs gap-1"
                    >
                      <Scale size={14} aria-hidden="true" />
                      校準
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => openEditModal(u)}
                      className="min-h-10 py-2 rounded-xl border-border font-semibold text-xs gap-1"
                    >
                      <Edit3 size={14} aria-hidden="true" />
                      編輯
                    </Button>
                  </div>

                  {isTestImpersonationEnabled &&
                    u.auth_provider === 'test' &&
                    u.is_active &&
                    u.role !== 'admin' && (
                      <Button
                        type="button"
                        variant="outline"
                        disabled={impersonateMutation.isPending}
                        onClick={() => impersonateMutation.mutate(u.id)}
                        className="w-full min-h-10 py-2 rounded-xl border-violet-300/80 dark:border-violet-500/40 bg-violet-50/70 dark:bg-violet-500/12 text-violet-700 dark:text-violet-300 hover:bg-violet-100/80 font-semibold text-xs gap-1.5"
                      >
                        <ArrowLeftRight size={14} aria-hidden="true" />
                        切換成此測試帳號進行實測
                      </Button>
                    )}
                </div>
              );
            })}
          </div>
        </>
      )}

      {/* Modal 1: Edit Member Profile, Role & Account Status */}
      <ResponsiveFormModal
        open={!!editingUser}
        onOpenChange={(open) => {
          if (!open && !updateUserMutation.isPending) setEditingUser(null);
        }}
        size="md"
        tone="default"
        icon={<Shield size={18} />}
        title={editingUser ? `編輯成員 · ${editingUser.name}` : '編輯成員與權限'}
        description="調整基本資料、系統管理員權限與帳號啟用狀態。"
        onSubmit={handleSaveUser}
        footer={
          <>
            <Button
              type="button"
              variant="outline"
              disabled={updateUserMutation.isPending}
              onClick={() => setEditingUser(null)}
              className="w-full sm:w-auto min-h-11 py-2 px-5 rounded-xl font-semibold"
            >
              取消
            </Button>
            <Button
              type="submit"
              disabled={updateUserMutation.isPending || !editName.trim()}
              className="w-full sm:w-auto min-h-11 py-2 px-6 rounded-xl bg-primary text-primary-foreground font-display font-semibold text-sm"
            >
              {updateUserMutation.isPending ? '儲存中...' : '儲存成員設定'}
            </Button>
          </>
        }
      >
        {editingUser && (
          <div className="space-y-4">
            {/* Compact Identity Strip */}
            <div className="flex items-center gap-3 p-3 rounded-2xl bg-surface-subtle/70 border border-border/80">
              <PlayerAvatar
                src={editingUser.avatar_url}
                name={editingUser.name}
                className="size-11 rounded-xl border border-border shrink-0 text-sm"
              />
              <div className="min-w-0 flex-1">
                <p className="font-display font-bold text-sm text-foreground truncate">
                  {editingUser.name}
                </p>
                <p className="text-xs font-bold text-muted-foreground truncate">
                  {editingUser.email || '未綁定 Email'}
                </p>
              </div>
              <span className="px-2.5 py-1 rounded-xl bg-card border border-border text-xs font-display font-semibold tabular-nums shrink-0">
                {Math.round(editingUser.global_mmr)} 分
              </span>
            </div>

            {/* Section 1: Basic Info */}
            <div className="space-y-2.5">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label htmlFor="admin-edit-user-name" className="arena-label">
                    顯示姓名
                  </label>
                  <input
                    id="admin-edit-user-name"
                    type="text"
                    required
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    className="arena-input"
                  />
                </div>
                <div>
                  <label htmlFor="admin-edit-user-dept" className="arena-label">
                    所屬處室 / 單位
                  </label>
                  <DepartmentCombobox
                    id="admin-edit-user-dept"
                    value={editDepartment}
                    onChange={setEditDepartment}
                    choices={departmentChoices}
                    placeholder="搜尋或選擇單位，亦可直接輸入"
                  />
                </div>
              </div>
            </div>

            {/* Section 2: Settings Rows + Toggle Switches */}
            <div className="rounded-2xl border border-border bg-surface-subtle/40 divide-y divide-border/80">
              {/* Row A: Admin Role Switch */}
              <div className="p-3.5 sm:p-4 flex items-center justify-between gap-4">
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5">
                    <p className="text-sm font-bold text-foreground">系統管理員權限</p>
                    {roleLockReason && (
                      <Lock size={13} className="text-amber-500 shrink-0" aria-hidden="true" />
                    )}
                  </div>
                  <p
                    className={cn(
                      'text-xs mt-0.5 font-medium',
                      roleLockReason
                        ? 'text-amber-700 dark:text-amber-300 font-bold'
                        : 'text-muted-foreground'
                    )}
                  >
                    {roleLockReason || '可管理賽季、成員權限與爭議比賽裁決'}
                  </p>
                </div>

                <button
                  type="button"
                  role="switch"
                  aria-checked={editRole === 'admin'}
                  aria-label="系統管理員權限"
                  disabled={Boolean(roleLockReason)}
                  onClick={() => setEditRole((r) => (r === 'admin' ? 'user' : 'admin'))}
                  className={cn(
                    'w-12 h-7 rounded-full transition-colors relative shrink-0 disabled:opacity-50',
                    editRole === 'admin' ? 'bg-amber-500' : 'bg-slate-300 dark:bg-slate-700'
                  )}
                >
                  <motion.div
                    animate={{ x: editRole === 'admin' ? 22 : 3 }}
                    className="size-5 bg-white rounded-full absolute top-1 shadow-xs"
                  />
                </button>
              </div>

              {/* Row B: Active Account Switch */}
              <div className="p-3.5 sm:p-4 flex items-center justify-between gap-4">
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5">
                    <p className="text-sm font-bold text-foreground">帳號啟用狀態</p>
                    {activeLockReason && (
                      <Lock size={13} className="text-amber-500 shrink-0" aria-hidden="true" />
                    )}
                  </div>
                  <p
                    className={cn(
                      'text-xs mt-0.5 font-medium',
                      activeLockReason
                        ? 'text-amber-700 dark:text-amber-300 font-bold'
                        : editActive
                          ? 'text-muted-foreground'
                          : 'text-rose-600 dark:text-rose-400 font-bold'
                    )}
                  >
                    {activeLockReason ||
                      (editActive
                        ? '允許正常登入系統、報分與參與排行'
                        : '已停用：將封鎖登入與新報分，但保留歷史紀錄')}
                  </p>
                </div>

                <button
                  type="button"
                  role="switch"
                  aria-checked={editActive}
                  aria-label="帳號啟用狀態"
                  disabled={Boolean(activeLockReason)}
                  onClick={() => setEditActive((v) => !v)}
                  className={cn(
                    'w-12 h-7 rounded-full transition-colors relative shrink-0 disabled:opacity-50',
                    editActive ? 'bg-emerald-500' : 'bg-slate-300 dark:bg-slate-700'
                  )}
                >
                  <motion.div
                    animate={{ x: editActive ? 22 : 3 }}
                    className="size-5 bg-white rounded-full absolute top-1 shadow-xs"
                  />
                </button>
              </div>
            </div>
          </div>
        )}
      </ResponsiveFormModal>

      {/* Modal 2: Focused Score Calibration Stage */}
      <ResponsiveFormModal
        open={!!mmrUser}
        onOpenChange={(open) => {
          if (!open && !adjustMmrMutation.isPending) setMmrUser(null);
        }}
        size="md"
        tone="gold"
        icon={<Scale size={18} />}
        title={mmrUser ? `校準積分 · ${mmrUser.name}` : '校準積分'}
        description="調整結果將寫入選手歷史曲線並寄送通知。"
        onSubmit={handleSaveMmr}
        footer={
          <>
            <Button
              type="button"
              variant="outline"
              disabled={adjustMmrMutation.isPending}
              onClick={() => setMmrUser(null)}
              className="w-full sm:w-auto min-h-11 py-2 px-5 rounded-xl font-semibold"
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
              className="w-full sm:w-auto min-h-11 py-2 px-6 rounded-xl bg-amber-600 hover:bg-amber-700 text-white font-display font-semibold text-sm"
            >
              {adjustMmrMutation.isPending ? '套用中...' : '確認校準積分'}
            </Button>
          </>
        }
      >
        {mmrUser && (
          <div className="space-y-4">
            {/* Section 1: Hero Score Calibration Stage */}
            <div className="rounded-2xl border border-border bg-surface-subtle/60 p-4 space-y-3.5">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <span className="text-xs font-medium text-muted-foreground block">
                    調整前後即時預覽 {mmrPreview?.clamped ? '(已套用 600–3000 上下限)' : ''}
                  </span>
                  <div className="flex items-center gap-2 mt-0.5 font-display font-bold text-base sm:text-lg tabular-nums">
                    <span className="text-muted-foreground">{Math.round(mmrUser.global_mmr)}</span>
                    <span className="text-muted-foreground/45">→</span>
                    <span className="text-foreground">
                      {Math.round(mmrPreview?.nextMmr ?? mmrUser.global_mmr)} 分
                    </span>
                    {mmrPreview && (
                      <span
                        className={cn(
                          'inline-flex items-center gap-0.5 px-2 py-0.5 rounded-lg text-xs font-display font-semibold tabular-nums',
                          mmrPreview.delta > 0
                            ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-300'
                            : mmrPreview.delta < 0
                              ? 'bg-rose-100 text-rose-700 dark:bg-rose-500/20 dark:text-rose-300'
                              : 'bg-secondary text-muted-foreground'
                        )}
                      >
                        {mmrPreview.delta > 0 ? (
                          <TrendingUp size={12} aria-hidden="true" />
                        ) : mmrPreview.delta < 0 ? (
                          <TrendingDown size={12} aria-hidden="true" />
                        ) : null}
                        {mmrPreview.delta > 0 ? `+${mmrPreview.delta}` : mmrPreview.delta}
                      </span>
                    )}
                  </div>
                </div>

                {/* Mode Pill Toggle */}
                <div className="inline-flex p-0.5 rounded-xl bg-secondary border border-border">
                  <button
                    type="button"
                    onClick={() => {
                      setMmrMode('delta');
                      setMmrInput('20');
                    }}
                    className={cn(
                      'min-h-8 px-2.5 py-1 rounded-lg text-xs font-semibold transition-all',
                      mmrMode === 'delta'
                        ? 'bg-card text-foreground shadow-xs'
                        : 'text-muted-foreground hover:text-foreground'
                    )}
                  >
                    增減微調
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setMmrMode('target');
                      setMmrInput(String(Math.round(mmrUser.global_mmr)));
                    }}
                    className={cn(
                      'min-h-8 px-2.5 py-1 rounded-lg text-xs font-semibold transition-all',
                      mmrMode === 'target'
                        ? 'bg-card text-foreground shadow-xs'
                        : 'text-muted-foreground hover:text-foreground'
                    )}
                  >
                    指定目標
                  </button>
                </div>
              </div>

              {/* Stepper + Centered Numeric Input */}
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  aria-label="減少 5 分"
                  onClick={() => stepMmrInput(-5)}
                  className="size-11 rounded-xl bg-card border border-border flex items-center justify-center text-foreground hover:bg-secondary active:scale-95 transition-all shrink-0"
                >
                  <Minus size={16} strokeWidth={2.5} aria-hidden="true" />
                </button>
                <input
                  id="admin-mmr-input"
                  type="number"
                  step="0.5"
                  inputMode="decimal"
                  aria-label={mmrMode === 'delta' ? '調整幅度' : '目標積分'}
                  value={mmrInput}
                  onChange={(e) => setMmrInput(e.target.value)}
                  className="arena-input text-center font-display font-bold text-lg tabular-nums"
                />
                <button
                  type="button"
                  aria-label="增加 5 分"
                  onClick={() => stepMmrInput(5)}
                  className="size-11 rounded-xl bg-card border border-border flex items-center justify-center text-foreground hover:bg-secondary active:scale-95 transition-all shrink-0"
                >
                  <Plus size={16} strokeWidth={2.5} aria-hidden="true" />
                </button>
              </div>

              {/* 6 Quick-Adjust Pills */}
              <div className="grid grid-cols-6 gap-1.5">
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
                        'min-h-9 py-1.5 rounded-xl border text-xs font-display font-semibold tabular-nums transition-all active:scale-95',
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

            {/* Section 2: Required Calibration Reason */}
            <div className="space-y-2">
              <label htmlFor="admin-mmr-reason" className="arena-label">
                校準原因 <span className="text-rose-500">*</span>
              </label>
              <input
                id="admin-mmr-reason"
                type="text"
                required
                placeholder="例如：賽事積分誤算補正（必填）"
                value={mmrReason}
                onChange={(e) => setMmrReason(e.target.value)}
                className="arena-input"
              />
              <div className="flex flex-wrap gap-1.5">
                {QUICK_MMR_REASONS.map((preset) => (
                  <button
                    key={preset}
                    type="button"
                    onClick={() => setMmrReason(preset)}
                    className={cn(
                      'px-2.5 py-1 rounded-lg border text-xs font-bold transition-colors',
                      mmrReason === preset
                        ? 'bg-amber-500/15 border-amber-500 text-amber-800 dark:text-amber-300'
                        : 'bg-secondary/70 border-border text-muted-foreground hover:text-foreground'
                    )}
                  >
                    {preset}
                  </button>
                ))}
              </div>
              <p className="text-xs font-medium text-muted-foreground">
                將寫入選手戰績曲線並發送系統通知，確保排行公開透明。
              </p>
            </div>
          </div>
        )}
      </ResponsiveFormModal>

      {/* Modal 3: Batch Set Department */}
      <ResponsiveFormModal
        open={batchDeptOpen}
        onOpenChange={(open) => {
          if (!open && !batchDeptMutation.isPending) setBatchDeptOpen(false);
        }}
        size="md"
        tone="default"
        icon={<Building2 size={18} />}
        title={`批次設定單位（已選 ${selectedValidIds.length} 人）`}
        description="將選取成員統一設定為指定處室／部門，適合新人批量報到分組。"
        onSubmit={handleSaveBatchDepartment}
        footer={
          <>
            <Button
              type="button"
              variant="outline"
              disabled={batchDeptMutation.isPending}
              onClick={() => setBatchDeptOpen(false)}
              className="w-full sm:w-auto min-h-11 py-2 px-5 rounded-xl font-semibold"
            >
              取消
            </Button>
            <Button
              type="submit"
              disabled={batchDeptMutation.isPending || !batchDepartment.trim()}
              className="w-full sm:w-auto min-h-11 py-2 px-6 rounded-xl bg-sapphire-blue hover:bg-blue-700 text-white font-display font-semibold text-sm"
            >
              {batchDeptMutation.isPending
                ? '套用中...'
                : `套用至 ${selectedValidIds.length} 位成員`}
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <div className="rounded-2xl bg-surface-subtle/70 border border-border p-3 space-y-1.5">
            <p className="text-xs font-semibold text-muted-foreground">
              目標成員預覽
            </p>
            <div className="flex flex-wrap gap-1.5">
              {selectedUsersList.slice(0, 8).map((u) => (
                <span
                  key={u.id}
                  className="px-2 py-0.5 rounded-lg bg-card border border-border text-xs font-bold text-foreground"
                >
                  {u.name}
                </span>
              ))}
              {selectedUsersList.length > 8 && (
                <span className="px-2 py-0.5 rounded-lg bg-secondary text-xs font-medium text-muted-foreground">
                  +{selectedUsersList.length - 8} 人
                </span>
              )}
            </div>
          </div>

          <div className="space-y-2">
            <label htmlFor="batch-dept-input" className="arena-label">
              目標處室 / 單位名稱 <span className="text-rose-500">*</span>
            </label>
            <DepartmentCombobox
              id="batch-dept-input"
              value={batchDepartment}
              onChange={setBatchDepartment}
              choices={departmentChoices}
              placeholder="搜尋現有單位，或直接輸入新處室名稱"
              required
            />
          </div>
        </div>
      </ResponsiveFormModal>

      {/* Modal 4: Create Test Account */}
      <ResponsiveFormModal
        open={createTestOpen}
        onOpenChange={(open) => {
          if (!open && !createTestMutation.isPending) setCreateTestOpen(false);
        }}
        size="sm"
        tone="default"
        icon={<FlaskConical size={18} />}
        title="建立測試球友帳號"
        description="供單一管理員帳號切換身分實測約戰、報分與通知流程，不影響正式會員。"
        onSubmit={handleCreateTestAccount}
        footer={
          <>
            <Button
              type="button"
              variant="outline"
              disabled={createTestMutation.isPending}
              onClick={() => setCreateTestOpen(false)}
              className="w-full sm:w-auto min-h-11 py-2 px-5 rounded-xl font-semibold"
            >
              取消
            </Button>
            <Button
              type="submit"
              disabled={createTestMutation.isPending}
              className="w-full sm:w-auto min-h-11 py-2 px-6 rounded-xl bg-violet-600 hover:bg-violet-700 text-white font-display font-semibold text-sm"
            >
              {createTestMutation.isPending ? '建立中...' : '確認建立測試帳號'}
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <div>
            <label htmlFor="test-user-name" className="arena-label">
              顯示姓名（選填）
            </label>
            <input
              id="test-user-name"
              type="text"
              maxLength={40}
              value={testNameInput}
              onChange={(e) => setTestNameInput(e.target.value)}
              placeholder="留空將自動命名為 測試球友 A / B…"
              className="arena-input"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label htmlFor="test-user-dept" className="arena-label">
                單位 / 組別
              </label>
              <input
                id="test-user-dept"
                type="text"
                maxLength={60}
                value={testDeptInput}
                onChange={(e) => setTestDeptInput(e.target.value)}
                placeholder="測試組"
                className="arena-input"
              />
            </div>

            <div>
              <label htmlFor="test-user-mmr" className="arena-label">
                初始積分
              </label>
              <input
                id="test-user-mmr"
                type="number"
                min={600}
                max={3000}
                value={testMmrInput}
                onChange={(e) => setTestMmrInput(e.target.value)}
                className="arena-input tabular-nums"
              />
            </div>
          </div>
        </div>
      </ResponsiveFormModal>

      {/* Slide-Over / Bottom Sheet: Member Score Change Timeline */}
      <AdminUserMmrLogsDrawer user={logsUser} onClose={() => setLogsUser(null)} />
    </section>
  );
}
