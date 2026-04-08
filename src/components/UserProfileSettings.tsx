import * as React from "react"
import {
  Camera, User, Building2, LogOut, Shield, Trophy, Settings,
  CheckCircle2, Target, Hand, Venus, Mars, HelpCircle, Loader2
} from "lucide-react"
import { useMediaQuery } from "@/hooks/use-media-query"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Drawer, DrawerClose, DrawerContent, DrawerFooter, DrawerHeader, DrawerTitle, DrawerTrigger } from "@/components/ui/drawer"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { cn } from "@/lib/utils"
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
function FieldLabel({ icon: Icon, label, color = "text-slate-400" }: { icon: React.ElementType; label: string; color?: string }) {
  return (
    <label className={cn("text-[10px] font-black uppercase tracking-[0.15em] flex items-center gap-1.5 ml-0.5 mb-1.5", color)}>
      <Icon size={12} />
      {label}
    </label>
  )
}

// ===================== 主組件 =====================
interface UserProfileSettingsProps {
  trigger: React.ReactElement
}

export function UserProfileSettings({ trigger }: UserProfileSettingsProps) {
  const [open, setOpen] = React.useState(false)
  const isDesktop = useMediaQuery("(min-width: 1024px)")
  const { data: user, logout } = useAuth()
  const queryClient = useQueryClient()

  // 表單狀態
  const [name, setName] = React.useState("")
  const [department, setDepartment] = React.useState("")
  const [gender, setGender] = React.useState("")
  const [dominantHand, setDominantHand] = React.useState("")
  const [forehand, setForehand] = React.useState("")
  const [backhand, setBackhand] = React.useState("")
  const [isSaving, setIsSaving] = React.useState(false)
  const [isSuccess, setIsSuccess] = React.useState(false)
  const [errorMsg, setErrorMsg] = React.useState("")

  // 每次打開時從 user 狀態重設
  React.useEffect(() => {
    if (open && user) {
      setName(user.name || "")
      setDepartment(user.department || "")
      setGender(user.gender || "")
      setDominantHand(user.dominant_hand || "右手")
      setForehand(user.rubber_forehand || "")
      setBackhand(user.rubber_backhand || "")
      setIsSuccess(false)
      setErrorMsg("")
    }
  }, [open, user])

  const handleSave = async () => {
    if (!name.trim()) { setErrorMsg("顯示姓名不得為空"); return }
    setIsSaving(true)
    setErrorMsg("")
    const startTime = Date.now();
    try {
      await apiClient.patch('/users/me', {
          name: name.trim(),
          department: department.trim() || null,
          gender: gender || null,
          dominant_hand: dominantHand || null,
          rubber_forehand: forehand || null,
          rubber_backhand: backhand || null,
      });

      // 🛑 Ensure at least 800ms duration for meaningful feedback
      const elapsedTime = Date.now() - startTime;
      if (elapsedTime < 800) {
        await new Promise(resolve => setTimeout(resolve, 800 - elapsedTime));
      }

      // 同步更新 React Query 快取，讓 Dashboard 即時反映
      queryClient.invalidateQueries({ queryKey: ['authUser'] })
      setIsSuccess(true)
      setTimeout(() => setOpen(false), 1200) // Reduced from 1600ms
    } catch (e: any) {
      setErrorMsg(e.message)
    } finally {
      setIsSaving(false)
    }
  }

  if (!user) return null

  // ===================== 表單內容 =====================
  const content = (
    <div className="px-5 py-4 space-y-6">

      {/* ── 大頭貼 + 帳號狀態 ── */}
      <div className="flex flex-col items-center gap-3 py-2">
        <div className="relative group cursor-pointer">
          <div className="size-20 rounded-[1.75rem] p-0.5 bg-gradient-to-br from-sapphire-blue/20 to-slate-200 shadow-lg">
            <img
              src={user.avatar}
              alt="Profile"
              referrerPolicy="no-referrer"
              className="size-full rounded-[1.5rem] object-cover"
            />
          </div>
          <div className="absolute -bottom-1 -right-1 size-7 bg-sapphire-blue rounded-full border-2 border-white flex items-center justify-center text-white shadow-md transition-transform group-hover:scale-110">
            <Camera size={13} />
          </div>
        </div>
        <div className="text-center space-y-1.5">
          <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">
            Account · {String(user.id).substring(0, 8).toUpperCase()}
          </p>
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-50 border border-amber-200 text-amber-600 text-[10px] font-black uppercase tracking-widest">
            <Shield size={11} />
            已驗證同仁
          </div>
        </div>
      </div>

      {/* ── 數據一覽卡片 ── */}
      <div className="grid grid-cols-2 gap-2.5">
        <div className="bg-gradient-to-br from-amber-50 to-orange-50 border border-amber-100 rounded-2xl p-3.5 flex flex-col items-center gap-0.5">
          <Trophy size={14} className="text-amber-500 mb-0.5" />
          <span className="text-xl font-display font-black text-primary-navy tabular-nums leading-tight">
            {user.season_lp !== undefined ? Math.round(user.season_lp) : "—"}
          </span>
          <span className="text-[9px] font-black text-amber-600/70 uppercase tracking-widest">本季 LP</span>
        </div>
        <div className="bg-gradient-to-br from-blue-50 to-indigo-50 border border-blue-100 rounded-2xl p-3.5 flex flex-col items-center gap-0.5">
          <Shield size={14} className="text-sapphire-blue mb-0.5" />
          <span className="text-xl font-display font-black text-primary-navy tabular-nums leading-tight">
            {Math.round(user.mmr ?? 0)}
          </span>
          <span className="text-[9px] font-black text-sapphire-blue/70 uppercase tracking-widest">隱藏實力</span>
        </div>
      </div>

      {/* ══════════════════════════════
          ── 可編輯欄位 ──
          ══════════════════════════════ */}

      {/* 顯示姓名 */}
      <div>
        <FieldLabel icon={User} label="顯示姓名" />
        <Input
          value={name}
          onChange={(e) => { setName(e.target.value); setErrorMsg("") }}
          placeholder="您的顯示名稱"
          className={cn(
            "h-11 bg-slate-50/80 border-slate-200 focus-visible:ring-2 focus-visible:ring-sapphire-blue/20 focus-visible:border-sapphire-blue font-bold text-primary-navy rounded-xl text-sm",
            errorMsg && !name.trim() && "border-rose-300 focus-visible:ring-rose-200/30"
          )}
        />
        {errorMsg && <p className="text-[10px] font-bold text-rose-500 mt-1 ml-1">{errorMsg}</p>}
      </div>

      {/* 所屬單位 */}
      <div>
        <FieldLabel icon={Building2} label="所屬單位 / 處室" />
        <Input
          value={department}
          onChange={(e) => setDepartment(e.target.value)}
          placeholder="例如：資訊室、秘書處"
          className="h-11 bg-slate-50/80 border-slate-200 focus-visible:ring-2 focus-visible:ring-sapphire-blue/20 focus-visible:border-sapphire-blue font-bold text-primary-navy rounded-xl text-sm"
        />
      </div>

      {/* 性別 & 慣用手 — 並排 */}
      <div className="grid grid-cols-2 gap-3">
        {/* 性別 */}
        <div>
          <FieldLabel icon={Venus} label="性別" />
          <div className="flex gap-1.5">
            {GENDER_OPTIONS.map(({ value, label }) => (
              <button
                key={value}
                onClick={() => setGender(gender === value ? "" : value)}
                className={cn(
                  "flex-1 h-11 rounded-xl border-2 text-xs font-black transition-all",
                  gender === value
                    ? "bg-sapphire-blue text-white border-sapphire-blue shadow-lg shadow-sapphire-blue/20"
                    : "bg-slate-50 text-slate-500 border-slate-200 hover:border-slate-300"
                )}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        {/* 慣用手 */}
        <div>
          <FieldLabel icon={Hand} label="慣用手" />
          <div className="flex gap-1.5">
            {HAND_OPTIONS.map(({ value, label, icon }) => (
              <button
                key={value}
                onClick={() => setDominantHand(value)}
                className={cn(
                  "flex-1 h-11 rounded-xl border-2 text-xs font-black transition-all items-center justify-center flex flex-col gap-0.5",
                  dominantHand === value
                    ? "bg-primary-navy text-white border-primary-navy shadow-lg shadow-primary-navy/20"
                    : "bg-slate-50 text-slate-500 border-slate-200 hover:border-slate-300"
                )}
              >
                <span className="text-base leading-none">{icon}</span>
                <span className="text-[10px]">{label}</span>
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* 球拍膠皮 */}
      <div>
        <div className="flex items-center gap-1.5 mb-3">
          <Target size={12} className="text-slate-400" />
          <span className="text-[10px] font-black uppercase tracking-[0.15em] text-slate-400">球拍 · 膠皮配置</span>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-[10px] font-black text-red-400 uppercase tracking-widest flex items-center gap-1 mb-1.5">
              <span className="size-3 rounded-full bg-red-400 inline-block" /> 正手
            </label>
            <Select value={forehand} onValueChange={(v) => setForehand(v === "__none__" ? "" : (v ?? ""))}>
              <SelectTrigger className="h-11 bg-slate-50/80 border-slate-200 focus:ring-2 focus:ring-sapphire-blue/20 font-bold text-primary-navy rounded-xl text-sm">
                <SelectValue placeholder="選擇膠皮" />
              </SelectTrigger>
              <SelectContent className="z-[9999]">
                <SelectItem value="__none__">未設定</SelectItem>
                {RUBBER_OPTIONS.map(o => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div>
            <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest flex items-center gap-1 mb-1.5">
              <span className="size-3 rounded-full bg-slate-400 inline-block" /> 反手
            </label>
            <Select value={backhand} onValueChange={(v) => setBackhand(v === "__none__" ? "" : (v ?? ""))}>
              <SelectTrigger className="h-11 bg-slate-50/80 border-slate-200 focus:ring-2 focus:ring-sapphire-blue/20 font-bold text-primary-navy rounded-xl text-sm">
                <SelectValue placeholder="選擇膠皮" />
              </SelectTrigger>
              <SelectContent className="z-[9999]">
                <SelectItem value="__none__">未設定</SelectItem>
                {RUBBER_OPTIONS.map(o => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>

      {/* 帳號資訊（唯讀） */}
      <div className="bg-slate-50 border border-slate-100 rounded-2xl overflow-hidden">
        <div className="px-4 py-2 border-b border-slate-100">
          <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">帳號資訊（唯讀）</span>
        </div>
        {[
          { label: "Email", value: user.email || "未綁定" },
          { label: "登入方式", value: user.auth_provider === "google" ? "Google 帳號" : user.auth_provider || "—" },
          { label: "權限等級", value: user.role === "admin" ? "⭐ 管理員" : "一般同仁" },
        ].map(({ label, value }) => (
          <div key={label} className="flex items-center justify-between px-4 py-2.5 border-b border-slate-100 last:border-b-0">
            <span className="text-xs font-bold text-slate-400">{label}</span>
            <span className="text-xs font-black text-primary-navy">{value}</span>
          </div>
        ))}
      </div>

      {/* 登出 */}
      <div className="pt-2">
        <Button
          variant="ghost"
          className="w-full text-rose-500 hover:text-rose-600 hover:bg-rose-50 font-black tracking-widest h-11 rounded-xl gap-2 text-sm"
          onClick={() => logout()}
        >
          <LogOut size={15} />
          登出戰情室 (Log Out)
        </Button>
      </div>
    </div>
  )

  // ===================== 儲存按鈕 =====================
  const SaveButton = () => (
    <Button
      onClick={handleSave}
      disabled={isSaving || isSuccess || !name.trim()}
      className={cn(
        "w-full h-13 rounded-2xl font-display font-black tracking-wider transition-all duration-200 active:scale-[0.98] shadow-xl text-base gap-2 flex items-center justify-center",
        isSuccess
          ? "bg-emerald-500 text-white shadow-emerald-500/25 animate-in zoom-in-95 duration-200"
          : "bg-primary-navy hover:bg-slate-800 text-white shadow-primary-navy/20 disabled:opacity-40"
      )}
    >
      {isSaving
        ? <><Loader2 className="size-5 animate-spin mr-1" /> 儲存中...</>
        : isSuccess
        ? <><CheckCircle2 size={18} /> 已儲存！</>
        : "儲存變更"
      }
    </Button>
  )

  // ===================== Dialog / Drawer 渲染 =====================
  if (isDesktop) {
    return (
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogTrigger render={trigger} />
        <DialogContent className="max-w-md p-0 overflow-hidden border-none bg-white rounded-[2.5rem]">
          <DialogHeader className="px-6 pt-6 pb-3 bg-gradient-to-b from-slate-50/80 to-white border-b border-slate-100 text-left">
            <DialogTitle className="flex items-center gap-2.5 text-lg font-display font-black text-primary-navy tracking-tight">
              <div className="size-9 rounded-xl bg-sapphire-blue/10 flex items-center justify-center">
                <Settings size={18} className="text-sapphire-blue" />
              </div>
              個人設定
            </DialogTitle>
            <DialogDescription className="sr-only">編輯您的個人資料與球拍配置</DialogDescription>
          </DialogHeader>
          <div className="max-h-[72vh] overflow-y-auto no-scrollbar">
            {content}
          </div>
          <div className="px-5 pb-6 pt-3 bg-white border-t border-slate-50">
            <SaveButton />
          </div>
        </DialogContent>
      </Dialog>
    )
  }

  return (
    <Drawer open={open} onOpenChange={setOpen}>
      <DrawerTrigger asChild>{trigger}</DrawerTrigger>
      <DrawerContent className="p-0 border-none bg-white z-[100] flex flex-col max-h-[96vh]">
        <div className="w-12 h-1.5 bg-slate-200 rounded-full mx-auto mt-3" />
        <div className="flex-1 overflow-y-auto no-scrollbar">
          <DrawerHeader className="px-5 pt-4 pb-2 text-left">
            <DrawerTitle className="flex items-center gap-2.5 text-lg font-display font-black text-primary-navy">
              <div className="size-9 rounded-xl bg-sapphire-blue/10 flex items-center justify-center">
                <Settings size={18} className="text-sapphire-blue" />
              </div>
              個人設定
            </DrawerTitle>
          </DrawerHeader>
          <div className="pb-4">{content}</div>
        </div>
        <DrawerFooter className="px-5 pt-3 pb-10 border-t border-slate-50 bg-white/90 backdrop-blur-md space-y-2">
          <SaveButton />
          <DrawerClose asChild>
            <Button variant="outline" className="w-full h-11 rounded-xl border-slate-200 text-slate-500 font-bold hover:bg-slate-50 uppercase tracking-widest text-xs">
              取消
            </Button>
          </DrawerClose>
        </DrawerFooter>
      </DrawerContent>
    </Drawer>
  )
}
