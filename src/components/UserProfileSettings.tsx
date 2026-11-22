import * as React from "react"
import { toast } from "sonner"
import {
  User, Building2, LogOut, Shield, Trophy, Settings,
  CheckCircle2, Target, Hand, Venus, Mars, HelpCircle, Loader2, Palette
} from "lucide-react"
import { ResponsiveFormModal } from "@/components/ResponsiveFormModal"
import { Button } from "@/components/ui/button"
import { ThemeToggle } from "@/components/ThemeToggle"
import { cn } from "@/lib/utils"
import { getTierBadge } from "@/lib/ranking"
import { PlayerAvatar } from "@/components/PlayerAvatar"
import { useAuth } from '@/hooks/useAuth'
import { useQueryClient } from '@tanstack/react-query'
import apiClient from '@/utils/apiClient'

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

        {/* 帳號資訊（唯讀） */}
        <div className="bg-surface-subtle/80 border border-border rounded-2xl overflow-hidden">
          <div className="px-4 py-2 border-b border-border">
            <span className="text-xs font-black text-muted-foreground">帳號資訊（唯讀）</span>
          </div>
          {[
            { label: "Email", value: user.email || "未綁定" },
            { label: "登入方式", value: user.auth_provider === "google" ? "Google 帳號" : user.auth_provider || "—" },
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
