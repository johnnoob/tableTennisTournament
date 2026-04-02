import * as React from "react"
import { Camera, User, Building2, LogOut, Shield, Trophy, Settings, CheckCircle2, Target } from "lucide-react"
import { useMediaQuery } from "@/hooks/use-media-query"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Drawer, DrawerClose, DrawerContent, DrawerFooter, DrawerHeader, DrawerTitle, DrawerTrigger } from "@/components/ui/drawer"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { cn } from "@/lib/utils"
import { currentUser } from "@/data/mockData" // 暫時使用 mockData，未來替換為 Context 或 Redux 狀態

const RUBBER_OPTIONS = [
  "平面-澀性膠皮",
  "平面-黏性膠皮",
  "長顆粒",
  "短顆粒",
  "不知道"
]

interface UserProfileSettingsProps {
  trigger: React.ReactElement;
}

export function UserProfileSettings({ trigger }: UserProfileSettingsProps) {
  const [open, setOpen] = React.useState(false)
  const isDesktop = useMediaQuery("(min-width: 1024px)")
  
  // 表單狀態
  const [name, setName] = React.useState(currentUser.name)
  const [department, setDepartment] = React.useState(currentUser.department || "秘書處 / 總務組")
  const [forehand, setForehand] = React.useState(currentUser.racketConfig?.forehand || "")
  const [backhand, setBackhand] = React.useState(currentUser.racketConfig?.backhand || "")
  const [isSaving, setIsSaving] = React.useState(false)
  const [isSuccess, setIsSuccess] = React.useState(false)

  // 每次打開時重設狀態
  React.useEffect(() => {
    if (open) {
      setName(currentUser.name);
      setDepartment(currentUser.department || "秘書處 / 總務組");
      setForehand(currentUser.racketConfig?.forehand || "");
      setBackhand(currentUser.racketConfig?.backhand || "");
      setIsSuccess(false);
    }
  }, [open]);

  const handleSave = async () => {
    setIsSaving(true)
    // 模擬 API 延遲
    await new Promise(resolve => setTimeout(resolve, 1000))
    setIsSaving(false)
    setIsSuccess(true)
    
    // 成功後延遲關閉視窗
    setTimeout(() => {
      setOpen(false)
    }, 1500)
  }

  // 共用的內容區塊 (Form Content)
  const content = (
    <div className="px-6 py-2 space-y-8">
      {/* ... (頂部大頭貼區與數據總覽小卡保持不變) */}
      <div className="flex flex-col items-center justify-center space-y-4">
        <div className="relative group cursor-pointer">
          <div className="size-24 rounded-full p-1 border-2 border-slate-200 bg-white shadow-sm transition-all group-hover:border-sapphire-blue group-hover:shadow-md">
            <img src={currentUser.avatar} alt="Profile" className="size-full rounded-full object-cover" />
          </div>
          <div className="absolute bottom-0 right-0 size-8 bg-sapphire-blue rounded-full border-2 border-white flex items-center justify-center text-white shadow-md transition-transform group-hover:scale-110">
            <Camera size={14} />
          </div>
        </div>
        <div className="text-center">
          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Account ID: {currentUser.id.split('-')[0]}</p>
          <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-amber-50 border border-amber-200 text-amber-600 text-xs font-black uppercase tracking-widest">
            <Shield size={12} />
            已驗證同仁
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="bg-slate-50 rounded-2xl p-4 border border-slate-100 flex flex-col items-center">
          <Trophy size={16} className="text-amber-500 mb-1" />
          <span className="text-2xl font-display font-black text-primary-navy">{Math.floor(currentUser.rating * 0.8)}</span>
          <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest mt-0.5">本季排行分</span>
        </div>
        <div className="bg-slate-50 rounded-2xl p-4 border border-slate-100 flex flex-col items-center">
          <Shield size={16} className="text-sapphire-blue mb-1" />
          <span className="text-2xl font-display font-black text-primary-navy">{currentUser.rating}</span>
          <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest mt-0.5">隱藏實力分</span>
        </div>
      </div>

      {/* 表單區 */}
      <div className="space-y-5">
        <div className="space-y-2">
          <label className="text-xs font-black uppercase tracking-widest text-slate-500 flex items-center gap-2 ml-1">
            <User size={14} /> 顯示姓名
          </label>
          <Input 
            value={name} 
            onChange={(e) => setName(e.target.value)}
            className="h-12 bg-slate-50 border-slate-200 focus-visible:ring-sapphire-blue/20 focus-visible:border-sapphire-blue font-bold text-primary-navy rounded-xl"
          />
        </div>
        
        <div className="space-y-2">
          <label className="text-xs font-black uppercase tracking-widest text-slate-500 flex items-center gap-2 ml-1">
            <Building2 size={14} /> 所屬單位 / 處室
          </label>
          <Input 
            value={department} 
            onChange={(e) => setDepartment(e.target.value)}
            placeholder="例如：資訊室"
            className="h-12 bg-slate-50 border-slate-200 focus-visible:ring-sapphire-blue/20 focus-visible:border-sapphire-blue font-bold text-primary-navy rounded-xl"
          />
        </div>

        {/* 🏆 球拍配置設定 (膠皮種類 - Select) */}
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <label className="text-xs font-black uppercase tracking-widest text-slate-500 flex items-center gap-2 ml-1">
              <Target size={14} className="text-red-500" /> 正手膠皮
            </label>
            <Select value={forehand} onValueChange={(val) => setForehand(val ?? "")}>
              <SelectTrigger className="w-full h-12 bg-slate-50 border-slate-200 focus-visible:ring-sapphire-blue/20 focus-visible:border-sapphire-blue font-bold text-primary-navy rounded-xl px-4 py-2 flex items-center justify-between">
                <SelectValue placeholder="選擇膠皮" />
              </SelectTrigger>
              <SelectContent className="z-9999">
                {RUBBER_OPTIONS.map(option => (
                  <SelectItem key={option} value={option}>{option}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <label className="text-xs font-black uppercase tracking-widest text-slate-500 flex items-center gap-2 ml-1">
              <Target size={14} className="text-slate-700" /> 反手膠皮
            </label>
            <Select value={backhand} onValueChange={(val) => setBackhand(val ?? "")}>
              <SelectTrigger className="w-full h-12 bg-slate-50 border-slate-200 focus-visible:ring-sapphire-blue/20 focus-visible:border-sapphire-blue font-bold text-primary-navy rounded-xl px-4 py-2 flex items-center justify-between">
                <SelectValue placeholder="選擇膠皮" />
              </SelectTrigger>
              <SelectContent className="z-9999">
                {RUBBER_OPTIONS.map(option => (
                  <SelectItem key={option} value={option}>{option}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>



      {/* 登出按鈕 */}
      <div className="pt-6 border-t border-slate-100">
        <Button variant="ghost" className="w-full text-red-500 hover:text-red-600 hover:bg-red-50 font-black tracking-widest h-12 rounded-xl">
          <LogOut size={16} className="mr-2" />
          登出戰情室 (Log Out)
        </Button>
      </div>
    </div>
  )

  const SaveButton = () => (
    <Button 
      onClick={handleSave} 
      disabled={isSaving || isSuccess || !name}
      className={cn(
        "w-full h-12 md:h-14 rounded-xl md:rounded-2xl font-display font-black tracking-wider transition-all shadow-xl",
        isSuccess 
          ? "bg-emerald-500 hover:bg-emerald-600 text-white shadow-emerald-500/20" 
          : "bg-primary-navy hover:bg-slate-800 text-white shadow-primary-navy/20"
      )}
    >
      {isSaving ? "儲存中..." : isSuccess ? <><CheckCircle2 className="mr-2" size={20} /> 儲存成功</> : "儲存變更"}
    </Button>
  )

  // 根據裝置渲染 Dialog 或 Drawer
  if (isDesktop) {
    return (
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogTrigger render={trigger} />
        <DialogContent className="max-w-md p-0 overflow-hidden border-none bg-white rounded-4xl">
          <DialogHeader className="p-8 pb-2 bg-slate-50/50 border-b border-slate-100 text-left">
            <DialogTitle className="flex items-center gap-3 text-xl font-display font-black text-primary-navy">
              <Settings className="text-sapphire-blue" size={24} />
              個人設定
            </DialogTitle>
            <DialogDescription className="sr-only">編輯您的個人資料與球拍配置</DialogDescription>
          </DialogHeader>
          <div className="max-h-[70vh] overflow-y-auto no-scrollbar">
            {content}
          </div>
          <div className="p-6 pt-2 bg-white border-t border-slate-50">
             <SaveButton />
          </div>
        </DialogContent>
      </Dialog>
    )
  }

  return (
    <Drawer open={open} onOpenChange={setOpen}>
      <DrawerTrigger asChild>{trigger}</DrawerTrigger>
      <DrawerContent className="p-0 border-none bg-white z-100 flex flex-col max-h-[96vh]">
        <div className="flex-1 overflow-y-auto no-scrollbar">
          <DrawerHeader className="p-6 pb-2 text-left">
            <DrawerTitle className="flex items-center gap-3 text-xl font-display font-black text-primary-navy">
              <Settings className="text-sapphire-blue" size={24} />
              個人設定
            </DrawerTitle>
          </DrawerHeader>
          <div className="pb-6">
            {content}
          </div>
        </div>
        <DrawerFooter className="px-6 pt-2 pb-8 border-t border-slate-50 bg-white/80 backdrop-blur-md">
          <SaveButton />
          <DrawerClose asChild>
            <Button variant="outline" className="w-full h-12 rounded-xl border-slate-200 text-slate-500 font-bold hover:bg-slate-50 uppercase tracking-widest mt-2">
              取消
            </Button>
          </DrawerClose>
        </DrawerFooter>
      </DrawerContent>
    </Drawer>
  )
}
