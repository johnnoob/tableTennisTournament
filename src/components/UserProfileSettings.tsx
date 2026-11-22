import * as React from "react"
import { useLocation } from "react-router-dom"
import { toast } from "sonner"
import {
  User, Building2, LogOut, Shield, Trophy, Settings,
  CheckCircle2, Target, Hand, Venus, Mars, HelpCircle, Loader2, Palette, Link2, Unlink
} from "lucide-react"
import { ResponsiveFormModal } from "@/components/ResponsiveFormModal"
import { Button } from "@/components/ui/button"
import { ThemeToggle } from "@/components/ThemeToggle"
import { cn } from "@/lib/utils"
import { getTierBadge } from "@/lib/ranking"
import { PlayerAvatar } from "@/components/PlayerAvatar"
import { useAuth, useAuthProviders } from '@/hooks/useAuth'
import { useQueryClient } from '@tanstack/react-query'
import apiClient, { API_BASE_URL } from '@/utils/apiClient'

// ===================== 選項常數 =====================
const RUBBER_OPTIONS = [
  { value: "平面-澀性膠皮", label: "平面 · 澀性" },
  { value: "平面-黏性膠皮", label: "平面 · 黏性" },
  { value: "長顆粒", label: "長顆粒" },
  { value: "短顆粒", label: "短顆粒" },
  { value: "生膠", label: "生膠" },
  { value: "防弧膠皮", label: "防弧膠皮" },
  { value: "不知道", label: "不清楚" },
]

const HAND_OPTIONS = [
  { value: "右手", label: "右手", icon: "👉" },
  { value: "左手", label: "左手", icon: "👈" },
]

const GENDER_OPTIONS = [
  { value: "男", label: "男", icon: Mars },
  { value: "女", label: "女", icon: Venus },
  { value: "不公開", label: "不公開", icon: HelpCircle },
]

// ===================== 標籤元件 =====================
function FieldLabel({
  htmlFor,
  icon: Icon,
  label,
  required,
}: {
  htmlFor?: string
  icon: React.ElementType
  label: string
  required?: boolean
}) {
  return (
    <label htmlFor={htmlFor} className="arena-label flex items-center gap-1.5 text-muted-foreground">
      <Icon size={13} aria-hidden="true" />
      <span>{label}</span>
      {required && <span aria-hidden="true" className="text-rose-500">*</span>}
    </label>
  )
}

// ===================== 主組件 =====================
interface UserProfileSettingsProps {
  trigger: React.ReactElement
}

export function UserProfileSettings({ trigger }: UserProfileSettingsProps) {
  const [open, setOpen] = React.useState(false)
  const { data: user, logout } = useAuth()
  const { data: providers } = useAuthProviders(open)
  const location = useLocation()
  const queryClient = useQueryClient()

  const nameId = React.useId()
  const nameErrId = React.useId()
  const deptId = React.useId()

  // 表單狀態
  const [name, setName] = React.useState("")
  const [department, setDepartment] = React.useState("")
  const [gender, setGender] = React.useState("")
  const [dominantHand, setDominantHand] = React.useState("右手")
  const [forehand, setForehand] = React.useState("")
  const [backhand, setBackhand] = React.useState("")
  const [isSaving, setIsSaving] = React.useState(false)
  const [isSuccess, setIsSuccess] = React.useState(false)
  const [errorMsg, setErrorMsg] = React.useState("")
  const [confirmUnlinkProvider, setConfirmUnlinkProvider] = React.useState<'google' | 'line' | null>(null)
  const [unlinkingProvider, setUnlinkingProvider] = React.useState<'google' | 'line' | null>(null)
  const closeTimerRef = React.useRef<number | null>(null)

  React.useEffect(() => {
    return () => {
      if (closeTimerRef.current !== null) {
        window.clearTimeout(closeTimerRef.current)
      }
    }
  }, [])

  // 每次開啟時從 user 狀態重設表單，避免 useEffect set-state
  const handleOpenChange = (nextOpen: boolean) => {
    if (closeTimerRef.current !== null) {
      window.clearTimeout(closeTimerRef.current)
      closeTimerRef.current = null
    }
    setOpen(nextOpen)
    setConfirmUnlinkProvider(null)
    if (nextOpen && user) {
      setName(user.name || "")
      setDepartment(user.department || "")
      setGender(user.gender || "")
      setDominantHand(user.dominant_hand || "右手")
      setForehand(user.rubber_forehand || "")
      setBackhand(user.rubber_backhand || "")
      setIsSuccess(false)
      setErrorMsg("")
    }
  }

  const handleLinkProvider = (provider: 'google' | 'line') => {
    const nextPath = encodeURIComponent(location.pathname || '/')
    window.location.href = `${API_BASE_URL}/auth/${provider}/link?next=${nextPath}`
  }

  const handleUnlinkProvider = async (provider: 'google' | 'line') => {
    setUnlinkingProvider(provider)
    try {
      await apiClient.delete(`/auth/providers/${provider}`, {
        skipGlobalErrorToast: true,
      })
      queryClient.invalidateQueries({ queryKey: ['authUser'] })
      setConfirmUnlinkProvider(null)
      toast.success(provider === 'line' ? '已解除 LINE 帳號綁定' : '已解除 Google 帳號綁定')
    } catch (err: unknown) {
      const detail = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail
      toast.error(detail || '解除綁定失敗，請稍後再試')
    } finally {
      setUnlinkingProvider(null)
    }
  }

  const handleSave = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    if (!name.trim()) {
      setErrorMsg("顯示姓名不得為空")
      return
    }

    setIsSaving(true)
    setErrorMsg("")
    const startTime = Date.now()

    try {
      await apiClient.patch(
        '/users/me',
        {
          name: name.trim(),
          department: department.trim() || null,
          gender: gender || null,
          dominant_hand: dominantHand || null,
          rubber_forehand: forehand || null,
          rubber_backhand: backhand || null,
        },
        { skipGlobalErrorToast: true }
      )

      const elapsedTime = Date.now() - startTime
      if (elapsedTime < 500) {
        await new Promise((resolve) => setTimeout(resolve, 500 - elapsedTime))
      }

      queryClient.invalidateQueries({ queryKey: ['authUser'] })
      setIsSuccess(true)
      toast.success("個人設定已更新")
      closeTimerRef.current = window.setTimeout(() => {
        closeTimerRef.current = null
        setOpen(false)
      }, 900)
    } catch (err: unknown) {
      const detail = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail
      const msg = detail || (err instanceof Error ? err.message : "儲存失敗，請稍後再試")
      setErrorMsg(msg)
      toast.error(msg)
    } finally {
      setIsSaving(false)
    }
  }

  if (!user) return null

  const currentMmr = Math.round(user.global_mmr ?? user.mmr ?? 1000)
  const currentTier = getTierBadge(currentMmr, 14)
  const googleLinked = Boolean(user.google_linked ?? user.auth_provider === 'google')
  const lineLinked = Boolean(user.line_linked ?? user.auth_provider === 'line')
  const canUnlink = googleLinked && lineLinked

  return (
    <ResponsiveFormModal
      open={open}
      onOpenChange={handleOpenChange}
      trigger={trigger}
      size="md"
      tone={isSuccess ? "success" : "default"}
      icon={isSuccess ? <CheckCircle2 size={18} /> : <Settings size={18} />}
      title="個人設定"
      description="管理您的顯示名稱、所屬單位與球拍膠皮配置"
      onSubmit={handleSave}
      footer={
        <>
          <Button
            type="button"
            variant="outline"
            disabled={isSaving}
            onClick={() => setOpen(false)}
            className="w-full sm:w-auto h-11 px-5 rounded-xl border-border text-muted-foreground font-bold hover:bg-secondary hover:text-foreground"
          >
            取消
          </Button>
          <Button
            type="submit"
            disabled={isSaving || isSuccess || !name.trim()}
            className={cn(
              "w-full sm:w-auto h-11 px-6 rounded-xl font-display font-black text-sm tracking-wide transition-all gap-2 shadow-sm",
              isSuccess
                ? "bg-emerald-600 text-white"
                : "bg-primary hover:opacity-90 text-primary-foreground disabled:opacity-40"
            )}
          >
            {isSaving ? (
              <>
                <Loader2 className="size-4 animate-spin" aria-hidden="true" />
                儲存中...
              </>
            ) : isSuccess ? (
              <>
                <CheckCircle2 size={16} aria-hidden="true" />
                已儲存！
              </>
            ) : (
              "儲存變更"
            )}
          </Button>
        </>
      }
    >
      <div className="space-y-5">
        {/* ── 大頭貼 + 帳號狀態 ── */}
        <div className="flex flex-col items-center gap-3 py-1">
          <div className="size-20 rounded-2xl p-0.5 bg-gradient-to-br from-sapphire-blue/25 to-slate-200 dark:to-slate-700 shadow-sm">
            <PlayerAvatar
              src={user.avatar_url || user.avatar}
              name={user.name}
              className="size-full rounded-[14px] text-2xl"
            />
          </div>
          <div className="text-center space-y-1.5">
            <p className="text-xs font-black text-muted-foreground uppercase tracking-widest">
              Account · {String(user.id).substring(0, 8).toUpperCase()}
            </p>
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-50 border border-amber-200 text-amber-700 dark:bg-amber-500/12 dark:border-amber-500/25 dark:text-amber-300 text-xs font-black">
              <Shield size={12} aria-hidden="true" />
              已驗證同仁
            </div>
          </div>
        </div>

        {/* ── 單軌 Elo 數據卡片 ── */}
        <div className="grid grid-cols-2 gap-2.5">
          <div className="bg-blue-50/70 border border-blue-200/70 dark:bg-blue-500/12 dark:border-blue-500/25 rounded-2xl p-3.5 flex flex-col items-center gap-0.5">
            <Trophy size={14} className="text-sapphire-blue mb-0.5" aria-hidden="true" />
            <span className="text-xl font-display font-black text-foreground tabular-nums leading-tight">
              {currentMmr}
            </span>
            <span className="text-xs font-black text-sapphire-blue/85 dark:text-blue-300">目前積分 (ELO)</span>
          </div>
          <div className="bg-amber-50/70 border border-amber-200/70 dark:bg-amber-500/12 dark:border-amber-500/25 rounded-2xl p-3.5 flex flex-col items-center justify-center gap-1">
            <span className="text-amber-600 dark:text-amber-400">{currentTier.icon}</span>
            <span className="text-sm font-display font-black text-foreground leading-tight text-center">
              {currentTier.name}
            </span>
            <span className="text-xs font-black text-amber-700/80 dark:text-amber-300">目前段位</span>
          </div>
        </div>

        {/* ── 可編輯欄位 ── */}
        <div>
          <FieldLabel htmlFor={nameId} icon={User} label="顯示姓名" required />
          <input
            id={nameId}
            name="name"
            type="text"
            required
            autoComplete="name"
            value={name}
            onChange={(e) => {
              setName(e.target.value)
              setErrorMsg("")
            }}
            aria-invalid={Boolean(errorMsg)}
            aria-describedby={errorMsg ? nameErrId : undefined}
            placeholder="您的顯示名稱"
            className="arena-input"
          />
          {errorMsg && (
            <p id={nameErrId} role="alert" className="text-xs font-bold text-rose-600 mt-1.5">
              {errorMsg}
            </p>
          )}
        </div>

        <div>
          <FieldLabel htmlFor={deptId} icon={Building2} label="所屬單位 / 處室" />
          <input
            id={deptId}
            name="department"
            type="text"
            autoComplete="organization"
            value={department}
            onChange={(e) => setDepartment(e.target.value)}
            placeholder="例如：資訊室、秘書處"
            className="arena-input"
          />
        </div>

        {/* 性別 & 慣用手 */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <fieldset>
            <legend className="arena-label flex items-center gap-1.5 text-muted-foreground">
              <Venus size={13} aria-hidden="true" />
              <span>性別</span>
            </legend>
            <div className="flex gap-1.5">
              {GENDER_OPTIONS.map(({ value, label }) => {
                const selected = gender === value
                return (
                  <button
                    type="button"
                    key={value}
                    aria-pressed={selected}
                    onClick={() => setGender(selected ? "" : value)}
                    className={cn(
                      "flex-1 min-h-11 rounded-xl border text-xs font-black transition-all",
                      selected
                        ? "bg-sapphire-blue text-white border-sapphire-blue shadow-xs"
                        : "bg-card text-muted-foreground border-input hover:border-slate-400 hover:bg-secondary/60 hover:text-foreground"
                    )}
                  >
                    {label}
                  </button>
                )
              })}
            </div>
          </fieldset>

          <fieldset>
            <legend className="arena-label flex items-center gap-1.5 text-muted-foreground">
              <Hand size={13} aria-hidden="true" />
              <span>慣用手</span>
            </legend>
            <div className="flex gap-1.5">
              {HAND_OPTIONS.map(({ value, label, icon }) => {
                const selected = dominantHand === value
                return (
                  <button
                    type="button"
                    key={value}
                    aria-pressed={selected}
                    onClick={() => setDominantHand(value)}
                    className={cn(
                      "flex-1 min-h-11 rounded-xl border text-xs font-black transition-all flex items-center justify-center gap-1.5",
                      selected
                        ? "bg-primary text-primary-foreground border-primary shadow-xs"
                        : "bg-card text-muted-foreground border-input hover:border-slate-400 hover:bg-secondary/60 hover:text-foreground"
                    )}
                  >
                    <span className="text-sm leading-none" aria-hidden="true">{icon}</span>
                    <span>{label}</span>
                  </button>
                )
              })}
            </div>
          </fieldset>
        </div>

        {/* 球拍膠皮 */}
        <fieldset className="space-y-3.5">
          <legend className="arena-label flex items-center gap-1.5 text-muted-foreground">
            <Target size={13} aria-hidden="true" />
            <span>球拍 · 膠皮配置（點擊直接選取）</span>
          </legend>

          {/* 正手 (紅面) */}
          <div className="space-y-2">
            <div className="flex items-center justify-between gap-2">
              <span className="arena-label mb-0 flex items-center gap-1.5 text-rose-600 dark:text-rose-400">
                <span className="size-2.5 rounded-full bg-rose-500 inline-block" aria-hidden="true" />
                <span>正手膠皮</span>
              </span>
              <span className="text-[11px] font-bold text-muted-foreground">
                {forehand || "未設定"}
              </span>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5" role="group" aria-label="正手膠皮選擇">
              {[...RUBBER_OPTIONS, { value: "", label: "未設定" }].map((opt) => {
                const selected = forehand === opt.value
                return (
                  <button
                    key={`fh-${opt.value || "none"}`}
                    type="button"
                    aria-pressed={selected}
                    onClick={() => setForehand(selected && opt.value !== "" ? "" : opt.value)}
                    className={cn(
                      "min-h-10 px-2.5 py-2 rounded-xl border text-xs font-black transition-all truncate",
                      selected
                        ? "bg-rose-600 text-white border-rose-600 shadow-xs dark:bg-rose-500 dark:border-rose-500"
                        : "bg-card text-muted-foreground border-input hover:border-slate-400 hover:bg-secondary/60 hover:text-foreground"
                    )}
                  >
                    {opt.label}
                  </button>
                )
              })}
            </div>
          </div>

          {/* 反手 (黑面) */}
          <div className="space-y-2">
            <div className="flex items-center justify-between gap-2">
              <span className="arena-label mb-0 flex items-center gap-1.5 text-muted-foreground">
                <span className="size-2.5 rounded-full bg-primary-navy dark:bg-slate-300 inline-block" aria-hidden="true" />
                <span>反手膠皮</span>
              </span>
              <span className="text-[11px] font-bold text-muted-foreground">
                {backhand || "未設定"}
              </span>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5" role="group" aria-label="反手膠皮選擇">
              {[...RUBBER_OPTIONS, { value: "", label: "未設定" }].map((opt) => {
                const selected = backhand === opt.value
                return (
                  <button
                    key={`bh-${opt.value || "none"}`}
                    type="button"
                    aria-pressed={selected}
                    onClick={() => setBackhand(selected && opt.value !== "" ? "" : opt.value)}
                    className={cn(
                      "min-h-10 px-2.5 py-2 rounded-xl border text-xs font-black transition-all truncate",
                      selected
                        ? "bg-sapphire-blue text-white border-sapphire-blue shadow-xs"
                        : "bg-card text-muted-foreground border-input hover:border-slate-400 hover:bg-secondary/60 hover:text-foreground"
                    )}
                  >
                    {opt.label}
                  </button>
                )
              })}
            </div>
          </div>
        </fieldset>

        {/* 外觀主題 */}
        <fieldset>
          <legend className="arena-label flex items-center gap-1.5 text-muted-foreground mb-2">
            <Palette size={13} aria-hidden="true" />
            <span>外觀主題</span>
          </legend>
          <ThemeToggle variant="cards" />
        </fieldset>

        {/* 登入方式與雙帳號綁定 */}
        <div className="bg-surface-subtle/80 border border-border rounded-2xl overflow-hidden">
          <div className="px-4 py-2.5 border-b border-border flex items-center justify-between gap-2">
            <span className="text-xs font-black text-muted-foreground flex items-center gap-1.5">
              <Link2 size={13} aria-hidden="true" />
              登入方式與帳號綁定
            </span>
            <span className="text-[11px] font-bold text-muted-foreground">
              {canUnlink ? "已啟用雙帳號登入" : "可綁定雙登入來源"}
            </span>
          </div>

          {/* Google 列 */}
          <div className="flex items-center justify-between gap-3 px-4 py-3 border-b border-border">
            <div className="flex items-center gap-3 min-w-0">
              <div className="size-9 rounded-xl bg-card border border-border flex items-center justify-center shrink-0">
                <svg className="size-4" viewBox="0 0 24 24" aria-hidden="true">
                  <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
                  <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
                  <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
                  <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
                </svg>
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-1.5">
                  <p className="text-xs font-black text-foreground">Google 帳號</p>
                  {googleLinked && (
                    <span className="px-1.5 py-0.5 rounded-md bg-emerald-500/12 text-emerald-700 dark:text-emerald-300 text-[10px] font-black leading-none">
                      已綁定
                    </span>
                  )}
                </div>
                <p className="text-[11px] font-medium text-muted-foreground truncate">
                  {googleLinked ? (user.email || "已連結 Google 帳號") : "透過 Google 帳號一鍵登入"}
                </p>
              </div>
            </div>

            <div className="shrink-0 flex items-center gap-1.5">
              {!googleLinked ? (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={providers?.google === false}
                  onClick={() => handleLinkProvider('google')}
                  className="h-8 px-3 rounded-lg text-xs font-black"
                >
                  {providers?.google === false ? "尚未啟用" : "綁定"}
                </Button>
              ) : !canUnlink ? (
                <span className="px-2.5 py-1 rounded-full bg-secondary text-muted-foreground text-[11px] font-bold">
                  唯一登入方式
                </span>
              ) : confirmUnlinkProvider === 'google' ? (
                <>
                  <Button
                    type="button"
                    size="sm"
                    variant="destructive"
                    disabled={unlinkingProvider === 'google'}
                    onClick={() => handleUnlinkProvider('google')}
                    className="h-8 px-2.5 rounded-lg text-xs font-black"
                  >
                    {unlinkingProvider === 'google' ? <Loader2 className="size-3.5 animate-spin" /> : "確定解除"}
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    disabled={unlinkingProvider === 'google'}
                    onClick={() => setConfirmUnlinkProvider(null)}
                    className="h-8 px-2 rounded-lg text-xs font-bold"
                  >
                    取消
                  </Button>
                </>
              ) : (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setConfirmUnlinkProvider('google')}
                  className="h-8 px-2.5 rounded-lg text-xs font-bold text-muted-foreground hover:text-rose-600 gap-1"
                >
                  <Unlink size={12} aria-hidden="true" />
                  解除
                </Button>
              )}
            </div>
          </div>

          {/* LINE 列 */}
          <div className="flex items-center justify-between gap-3 px-4 py-3">
            <div className="flex items-center gap-3 min-w-0">
              <div className="size-9 rounded-xl bg-[#06C755] text-white flex items-center justify-center shrink-0">
                <svg className="size-5" viewBox="0 0 24 24" aria-hidden="true">
                  <path
                    fill="currentColor"
                    d="M12 3C6.48 3 2 6.58 2 11c0 3.95 3.51 7.26 8.26 7.89.32.07.76.21.87.49.1.25.06.64.03.9l-.14.84c-.04.25-.2.98.86.53 1.06-.44 5.71-3.36 7.79-5.75C21.14 14.28 22 12.73 22 11c0-4.42-4.48-8-10-8zm-4.18 10.1H5.97a.46.46 0 0 1-.46-.46V8.94c0-.25.21-.46.46-.46s.46.21.46.46v3.24h1.39c.25 0 .46.21.46.46s-.21.46-.46.46zm1.93-.46c0 .25-.21.46-.46.46s-.46-.21-.46-.46V8.94c0-.25.21-.46.46-.46s.46.21.46.46v3.7zm4.32 0c0 .2-.13.38-.32.44-.05.01-.09.02-.14.02-.15 0-.29-.07-.37-.19l-1.91-2.59v2.32c0 .25-.21.46-.46.46s-.46-.21-.46-.46V8.94c0-.2.13-.38.32-.44.19-.06.4.01.51.17l1.91 2.59V8.94c0-.25.21-.46.46-.46s.46.21.46.46v3.7zm3.4-2.31c.25 0 .46.21.46.46s-.21.46-.46.46h-1.39v.93h1.39c.25 0 .46.21.46.46s-.21.46-.46.46h-1.85a.46.46 0 0 1-.46-.46V8.94c0-.25.21-.46.46-.46h1.85c.25 0 .46.21.46.46s-.21.46-.46.46h-1.39v.93h1.39z"
                  />
                </svg>
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-1.5">
                  <p className="text-xs font-black text-foreground">LINE 帳號</p>
                  {lineLinked && (
                    <span className="px-1.5 py-0.5 rounded-md bg-emerald-500/12 text-emerald-700 dark:text-emerald-300 text-[10px] font-black leading-none">
                      已綁定
                    </span>
                  )}
                </div>
                <p className="text-[11px] font-medium text-muted-foreground truncate">
                  {lineLinked ? (user.line_display_name || "已連結 LINE 帳號") : "群組點連結免輸密碼一鍵登入"}
                </p>
              </div>
            </div>

            <div className="shrink-0 flex items-center gap-1.5">
              {!lineLinked ? (
                providers?.line === false ? (
                  <span className="px-2.5 py-1 rounded-full bg-secondary text-muted-foreground text-[11px] font-bold">
                    尚未啟用
                  </span>
                ) : (
                  <Button
                    type="button"
                    size="sm"
                    onClick={() => handleLinkProvider('line')}
                    className="h-8 px-3 rounded-lg bg-[#06C755] hover:bg-[#05b34c] text-white text-xs font-black border-none"
                  >
                    綁定 LINE
                  </Button>
                )
              ) : !canUnlink ? (
                <span className="px-2.5 py-1 rounded-full bg-secondary text-muted-foreground text-[11px] font-bold">
                  唯一登入方式
                </span>
              ) : confirmUnlinkProvider === 'line' ? (
                <>
                  <Button
                    type="button"
                    size="sm"
                    variant="destructive"
                    disabled={unlinkingProvider === 'line'}
                    onClick={() => handleUnlinkProvider('line')}
                    className="h-8 px-2.5 rounded-lg text-xs font-black"
                  >
                    {unlinkingProvider === 'line' ? <Loader2 className="size-3.5 animate-spin" /> : "確定解除"}
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    disabled={unlinkingProvider === 'line'}
                    onClick={() => setConfirmUnlinkProvider(null)}
                    className="h-8 px-2 rounded-lg text-xs font-bold"
                  >
                    取消
                  </Button>
                </>
              ) : (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setConfirmUnlinkProvider('line')}
                  className="h-8 px-2.5 rounded-lg text-xs font-bold text-muted-foreground hover:text-rose-600 gap-1"
                >
                  <Unlink size={12} aria-hidden="true" />
                  解除
                </Button>
              )}
            </div>
          </div>

          <div className="px-4 py-2 border-t border-border bg-card/50">
            <p className="text-[11px] font-medium text-muted-foreground">
              同時綁定 Google 與 LINE 後，兩者皆會登入同一份戰績與積分。
            </p>
          </div>
        </div>

        {/* 帳號資訊（唯讀） */}
        <div className="bg-surface-subtle/80 border border-border rounded-2xl overflow-hidden">
          <div className="px-4 py-2 border-b border-border">
            <span className="text-xs font-black text-muted-foreground">帳號資訊（唯讀）</span>
          </div>
          {[
            { label: "Email", value: user.email || "未綁定" },
            { label: "權限等級", value: user.role === "admin" ? "管理員" : "一般同仁" },
          ].map(({ label, value }) => (
            <div key={label} className="flex items-center justify-between px-4 py-2.5 border-b border-border last:border-b-0">
              <span className="text-xs font-bold text-muted-foreground">{label}</span>
              <span className="text-xs font-black text-foreground">{value}</span>
            </div>
          ))}
        </div>

        {/* 登出 */}
        <Button
          type="button"
          variant="outline"
          className="w-full h-11 rounded-xl border-rose-200 dark:border-rose-500/30 text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-500/15 hover:text-rose-700 dark:hover:text-rose-300 font-black gap-2 text-sm"
          onClick={() => logout()}
        >
          <LogOut size={15} aria-hidden="true" />
          登出戰情室 (Log Out)
        </Button>
      </div>
    </ResponsiveFormModal>
  )
}
