import * as React from "react"
import { Plus, Minus, Trophy, User, CheckCircle2, Swords } from "lucide-react"
import { useMediaQuery } from "@/hooks/use-media-query"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import {
  Drawer,
  DrawerClose,
  DrawerContent,
  DrawerDescription,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
  DrawerTrigger,
} from "@/components/ui/drawer"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { players as allPlayers, currentUser } from "@/data/mockData"

interface ReportScoreProps {
  trigger: React.ReactElement;
  editMode?: boolean;
  initialOpponentId?: string | null;
  initialScoreA?: number;
  initialScoreB?: number;
}

export function ReportScore({ 
  trigger,
  editMode = false,
  initialOpponentId = null,
  initialScoreA = 0,
  initialScoreB = 0
}: ReportScoreProps) {
  const [open, setOpen] = React.useState(false)
  const isDesktop = useMediaQuery("(min-width: 1024px)")
  const [scoreA, setScoreA] = React.useState(initialScoreA)
  const [scoreB, setScoreB] = React.useState(initialScoreB)
  const [selectedOpponentId, setSelectedOpponentId] = React.useState<string | null>(initialOpponentId)
  const [isSubmitting, setIsSubmitting] = React.useState(false)
  const [isSuccess, setIsSuccess] = React.useState(false)

  // Reset or initialize state when opening the dialog
  React.useEffect(() => {
    if (open && !isSuccess) {
      setScoreA(initialScoreA)
      setScoreB(initialScoreB)
      setSelectedOpponentId(initialOpponentId)
    }
  }, [open, initialScoreA, initialScoreB, initialOpponentId, isSuccess])

  const selectedOpponent = allPlayers.find(p => p.id === selectedOpponentId)

  const handleSubmit = async () => {
    if (!selectedOpponentId) return
    setIsSubmitting(true)
    // Simulate API call
    await new Promise(resolve => setTimeout(resolve, 1500))
    setIsSubmitting(false)
    setIsSuccess(true)
    // Removed automatic close after 2s to allow viewing the receipt
  }

  const content = (
    <div className="px-6 py-4 space-y-8">
      {isSuccess ? (
        <div className="flex flex-col items-center justify-center py-6 space-y-6 animate-in fade-in zoom-in duration-500">
          <div className="relative">
            <div className="size-20 rounded-full bg-emerald-100 flex items-center justify-center text-emerald-600 shadow-xl shadow-emerald-100/30 relative z-10">
              <CheckCircle2 size={48} strokeWidth={2.5} />
            </div>
            <div className="absolute inset-0 bg-emerald-400 blur-2xl opacity-20 animate-pulse rounded-full" />
          </div>
          
          <div className="text-center space-y-1">
            <h3 className="text-2xl font-display font-black text-primary-navy tracking-tight">申報成功！</h3>
            <p className="text-sm font-medium text-slate-500">賽果已提交，等待對手系統確認中。</p>
          </div>

          {/* Match Receipt Card */}
          <div className="w-full bg-slate-50/80 border border-slate-100 rounded-[2.5rem] p-6 space-y-6 relative overflow-hidden">
            <div className="absolute top-0 right-0 p-4 opacity-5 pointer-events-none">
              <Trophy size={80} />
            </div>
            
            <div className="flex items-center justify-between relative z-10">
              {/* Me */}
              <div className="flex flex-col items-center gap-2">
                <div className={cn(
                  "size-14 rounded-2xl p-0.5 border-2",
                  scoreA > scoreB ? "border-emerald-500 bg-emerald-50" : "border-slate-200"
                )}>
                  <img src={currentUser.avatar} className="size-full rounded-xl object-cover" alt={currentUser.name} />
                </div>
                <span className="text-xs font-black text-slate-600 uppercase tracking-widest">{currentUser.name}</span>
              </div>

              {/* Score Display */}
              <div className="flex flex-col items-center">
                <div className="text-4xl font-display font-black text-primary-navy tabular-nums tracking-tighter">
                  {scoreA} : {scoreB}
                </div>
                <div className={cn(
                  "mt-1 px-3 py-0.5 rounded-full text-[10px] font-black uppercase tracking-widest",
                  scoreA > scoreB ? "bg-emerald-500 text-white" : "bg-rose-500 text-white"
                )}>
                  {scoreA > scoreB ? " Victory " : " Defeat "}
                </div>
              </div>

              {/* Opponent */}
              <div className="flex flex-col items-center gap-2">
                <div className={cn(
                  "size-14 rounded-2xl p-0.5 border-2",
                  scoreB > scoreA ? "border-emerald-500 bg-emerald-50" : "border-slate-200"
                )}>
                  <img src={selectedOpponent?.avatar} className="size-full rounded-xl object-cover" alt={selectedOpponent?.name} />
                </div>
                <span className="text-xs font-black text-slate-600 uppercase tracking-widest">{selectedOpponent?.name}</span>
              </div>
            </div>

            <div className="pt-4 border-t border-dashed border-slate-200 flex justify-between items-center">
               <div className="space-y-0.5">
                  <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest block">Status</span>
                  <div className="flex items-center gap-1.5">
                    <div className="size-2 bg-amber-400 rounded-full animate-pulse" />
                    <span className="text-xs font-bold text-slate-600">等待確認中 (Pending)</span>
                  </div>
               </div>
               <div className="text-right space-y-0.5">
                  <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest block">Auto-Confirm</span>
                  <span className="text-xs font-bold text-slate-600">48 小時內生效</span>
               </div>
            </div>
          </div>

          <Button 
            onClick={() => {
              setOpen(false);
              setTimeout(() => {
                setIsSuccess(false);
                setScoreA(0);
                setScoreB(0);
                setSelectedOpponentId(null);
              }, 300);
            }} 
            className="w-full h-14 rounded-[1.5rem] bg-primary-navy hover:bg-slate-800 text-white font-display font-black tracking-widest uppercase transition-all shadow-xl shadow-primary-navy/20"
          >
            知道了
          </Button>
        </div>
      ) : (
        <>
          {/* Opponent Selection */}
          <section className="space-y-4">
            <label className="text-xs font-black uppercase tracking-[0.2em] text-slate-500 ml-1">選擇對手</label>
            <div className="flex gap-2 md:gap-3 overflow-x-auto pt-4 pb-4 no-scrollbar -mx-2 px-2 md:grid md:grid-cols-5 md:overflow-visible">
              {allPlayers.slice(0, 5).map((player) => (
                <button
                  key={player.id}
                  onClick={() => !editMode && setSelectedOpponentId(player.id)}
                  disabled={editMode}
                  className={cn(
                    "flex-shrink-0 flex flex-col items-center gap-1.5 p-2 rounded-2xl transition-all min-w-[70px] md:min-w-[80px] border-2 relative",
                    selectedOpponentId === player.id 
                      ? "bg-electric-blue/5 border-electric-blue shadow-lg shadow-electric-blue/10 scale-105 z-10" 
                      : editMode
                        ? "bg-slate-50 border-transparent grayscale opacity-30 cursor-not-allowed"
                        : "bg-slate-50 border-transparent grayscale opacity-60 hover:opacity-100 hover:grayscale-0"
                  )}
                >
                  <img src={player.avatar} alt={player.name} className="size-10 md:size-12 rounded-xl object-cover shadow-sm" />
                  <span className="text-sm md:text-sm font-bold text-primary-navy truncate w-full text-center">{player.name}</span>
                </button>
              ))}
            </div>
          </section>

          {/* Score Input */}
          <section className="space-y-6">
            <div className="flex items-center justify-between gap-4">
              {/* My Score */}
              <ScoreControl 
                value={scoreA} 
                onChange={setScoreA} 
                avatar={currentUser.avatar}
                name={currentUser.name}
                status={scoreA > scoreB ? 'win' : scoreA < scoreB ? 'loss' : 'draw'}
              />
              <div className="text-2xl font-display font-black text-slate-500 transform translate-y-4">:</div>
              {/* Opponent Score */}
              <ScoreControl 
                value={scoreB} 
                onChange={setScoreB} 
                avatar={selectedOpponent?.avatar || ""}
                name={selectedOpponent?.name || "???"}
                placeholder
                status={scoreB > scoreA ? 'win' : scoreB < scoreA ? 'loss' : 'draw'}
              />
            </div>
          </section>

          {/* Conditional Desktop Submit Button - Moved to Dialog footer below */}

        </>
      )}
    </div>
  )

  if (isDesktop) {
    return (
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogTrigger render={trigger} />
        <DialogContent className="max-w-2xl p-0 overflow-hidden border-none bg-white">
          <DialogHeader className="p-8 pb-0">
            <DialogTitle className="flex items-center gap-3">
              <Trophy className="text-neon-orange" />
              {editMode ? "修改賽果" : "申報比賽結果"}
            </DialogTitle>
            <DialogDescription>請確認比分正確，送出後對手將收到確認通知。</DialogDescription>
          </DialogHeader>
          {content}
          {!isSuccess && !isDesktop && (
             <div className="p-6 pt-0 border-t border-slate-50 flex gap-3">
                <Button 
                  onClick={handleSubmit} 
                  disabled={!selectedOpponentId || isSubmitting}
                  className="flex-1 h-12 rounded-xl bg-primary-navy hover:bg-slate-800 text-white font-display font-black tracking-wider transition-all disabled:opacity-30 shadow-xl shadow-primary-navy/20"
                >
                  {isSubmitting ? "正在送出..." : editMode ? "送出修改" : "確認申報"}
                </Button>
                <Button variant="outline" onClick={() => setOpen(false)} className="h-12 px-6 rounded-xl border-slate-200 text-slate-600 font-bold hover:bg-slate-50">
                   取消
                </Button>
             </div>
          )}
          {isDesktop && !isSuccess && (
            <div className="p-8 pt-0 flex justify-end gap-3">
              <Button variant="outline" onClick={() => setOpen(false)} className="h-12 px-8 rounded-xl border-slate-200 text-slate-600 font-bold hover:bg-slate-50">
                取消
              </Button>
              <Button 
                onClick={handleSubmit} 
                disabled={!selectedOpponentId || isSubmitting}
                className="h-12 px-10 rounded-xl bg-primary-navy hover:bg-slate-800 text-white font-display font-black tracking-wider transition-all disabled:opacity-30 shadow-xl shadow-primary-navy/20"
              >
                {isSubmitting ? "正在送出..." : editMode ? "送出修改" : "確認申報"}
              </Button>
            </div>
          )}
          {isDesktop && isSuccess && (
             <div className="p-8 pt-0">
               <Button 
                  onClick={() => setOpen(false)}
                  className="w-full h-12 rounded-xl bg-primary-navy hover:bg-slate-800 text-white font-display font-black tracking-wider transition-all"
                >
                  知道了
                </Button>
             </div>
          )}

        </DialogContent>
      </Dialog>
    )
  }

  return (
    <Drawer open={open} onOpenChange={setOpen}>
      <DrawerTrigger asChild>
        {trigger}
      </DrawerTrigger>
      <DrawerContent className="p-0 border-none bg-white z-[100] max-h-[96vh] flex flex-col">
        <div className="flex-1 overflow-y-auto no-scrollbar">
          <DrawerHeader className="p-6 pb-2 border-none">
            <DrawerTitle className="flex items-center justify-center gap-3">
              <Trophy className="text-neon-orange" size={20} />
              {editMode ? "修改賽果" : "申報比賽結果"}
            </DrawerTitle>
            <DrawerDescription className="text-center">請輸入最終局數比分</DrawerDescription>
          </DrawerHeader>
          <div className="pb-4">
            {content}
          </div>
        </div>
        
        {/* Fixed Mobile Footer */}
        <DrawerFooter className="px-6 pt-2 pb-10 border-t border-slate-50 bg-white/80 backdrop-blur-md">
          {!isSuccess && (
            <Button 
              onClick={handleSubmit} 
              disabled={!selectedOpponentId || isSubmitting}
              className="w-full h-14 rounded-2xl bg-primary-navy hover:bg-slate-800 text-white font-display font-black text-lg tracking-wider transition-all disabled:opacity-30 shadow-2xl shadow-primary-navy/20 mb-4"
            >
              {isSubmitting ? "正在送出..." : editMode ? "送出修改" : "確認申報"}
            </Button>
          )}
          <DrawerClose asChild>
            <Button variant="outline" className="w-full h-12 rounded-xl border-slate-200 text-slate-500 font-bold hover:bg-slate-50 uppercase tracking-widest">
              {isSuccess ? "關閉視窗" : "取消操作"}
            </Button>
          </DrawerClose>
        </DrawerFooter>
      </DrawerContent>
    </Drawer>
  )
}

function ScoreControl({ 
  value, 
  onChange, 
  avatar, 
  name,
  placeholder = false,
  status
}: { 
  value: number, 
  onChange: (val: number) => void,
  avatar: string,
  name: string,
  placeholder?: boolean,
  status?: 'win' | 'loss' | 'draw'
}) {
  return (
    <div className="flex-1 flex flex-col items-center space-y-4">
      <div className="relative group">
        <div className={cn(
          "size-14 rounded-[1.5rem] overflow-hidden border-2 transition-all",
          placeholder && !avatar ? "bg-slate-100 border-dashed border-slate-300" : "border-white bg-slate-50 shadow-md transform group-hover:rotate-6",
          status === 'win' && "border-green-200 ring-4 ring-green-500/10",
          status === 'loss' && "border-red-200 opacity-80"
        )}>
          {avatar ? (
            <img src={avatar} alt={name} className="size-full object-cover" />
          ) : (
            <div className="size-full flex items-center justify-center text-slate-500">
              <User size={24} />
            </div>
          )}
        </div>
        <div className={cn(
          "absolute -bottom-2 -right-2 size-7 rounded-full shadow-lg flex items-center justify-center border-2",
          status === 'win' ? "bg-green-500 text-white border-white" : 
          status === 'loss' ? "bg-red-500 text-white border-white" : 
          "bg-white text-primary-navy border-slate-100"
        )}>
           {placeholder ? <Swords size={14} strokeWidth={3} /> : <User size={14} strokeWidth={3} />}
        </div>
      </div>
      <span className={cn(
        "text-sm font-black uppercase tracking-widest transition-colors",
        status === 'win' ? "text-green-600" : status === 'loss' ? "text-red-500" : "text-slate-500"
      )}>{name}</span>
      
      <div className={cn(
        "flex flex-col items-center gap-4 p-4 rounded-[2.5rem] border transition-all duration-500",
        status === 'win' ? "bg-green-50 border-green-100 shadow-lg shadow-green-200/20" : 
        status === 'loss' ? "bg-red-50 border-red-100 opacity-90" : 
        "bg-slate-50/50 border-slate-100/50"
      )}>
        <button 
          onClick={() => onChange(value + 1)}
          className={cn(
            "size-14 rounded-2xl shadow-sm border flex items-center justify-center active:scale-95 transition-all",
            status === 'win' ? "bg-white border-green-200 text-green-600 hover:bg-green-100/50" : 
            status === 'loss' ? "bg-white border-red-200 text-red-600 hover:bg-red-100/50" : 
            "bg-white border-slate-100 text-primary-navy hover:bg-slate-50"
          )}
        >
          <Plus size={24} strokeWidth={3} />
        </button>
        <span className={cn(
          "text-5xl font-display font-black tabular-nums min-w-[60px] text-center transition-colors",
          status === 'win' ? "text-green-600" : status === 'loss' ? "text-red-600" : "text-primary-navy"
        )}>{value}</span>
        <button 
          onClick={() => onChange(Math.max(0, value - 1))}
          className={cn(
            "size-14 rounded-2xl shadow-sm border flex items-center justify-center active:scale-95 transition-all",
            status === 'win' ? "bg-white border-green-200 text-green-600 hover:bg-green-100/50" : 
            status === 'loss' ? "bg-white border-red-200 text-red-600 hover:bg-red-100/50" : 
            "bg-white border-slate-100 text-primary-navy hover:bg-slate-50"
          )}
        >
          <Minus size={24} strokeWidth={3} />
        </button>
      </div>
    </div>
  )
}
