import * as React from "react"
import { Plus, Minus, Trophy, User, CheckCircle2 } from "lucide-react"
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
  trigger: React.ReactElement
}

export function ReportScore({ trigger }: ReportScoreProps) {
  const [open, setOpen] = React.useState(false)
  const isDesktop = useMediaQuery("(min-width: 1024px)")
  const [scoreA, setScoreA] = React.useState(0)
  const [scoreB, setScoreB] = React.useState(0)
  const [selectedOpponentId, setSelectedOpponentId] = React.useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = React.useState(false)
  const [isSuccess, setIsSuccess] = React.useState(false)

  const selectedOpponent = allPlayers.find(p => p.id === selectedOpponentId)

  const handleSubmit = async () => {
    if (!selectedOpponentId) return
    setIsSubmitting(true)
    // Simulate API call
    await new Promise(resolve => setTimeout(resolve, 1500))
    setIsSubmitting(false)
    setIsSuccess(true)
    // Reset after success
    setTimeout(() => {
      setOpen(false)
      setIsSuccess(false)
      setScoreA(0)
      setScoreB(0)
      setSelectedOpponentId(null)
    }, 2000)
  }

  const content = (
    <div className="px-6 py-4 space-y-8">
      {isSuccess ? (
        <div className="flex flex-col items-center justify-center py-12 space-y-4 animate-in fade-in zoom-in duration-500">
          <div className="size-20 rounded-full bg-green-100 flex items-center justify-center text-green-600 shadow-xl shadow-green-100/50">
            <CheckCircle2 size={48} />
          </div>
          <div className="text-center">
            <h3 className="text-xl font-display font-black text-primary-navy">申報成功！</h3>
            <p className="text-sm text-primary-slate/60 mt-1">已寄送確認信給對手，48小時內未異議將自動生效。</p>
          </div>
        </div>
      ) : (
        <>
          {/* Opponent Selection */}
          <section className="space-y-4">
            <label className="text-[10px] font-black uppercase tracking-[0.2em] text-primary-slate/40 ml-1">選擇對手</label>
            <div className="flex gap-2 md:gap-3 overflow-x-auto pb-4 no-scrollbar -mx-2 px-2 md:grid md:grid-cols-5 md:overflow-visible">
              {allPlayers.slice(0, 5).map((player) => (
                <button
                  key={player.id}
                  onClick={() => setSelectedOpponentId(player.id)}
                  className={cn(
                    "flex-shrink-0 flex flex-col items-center gap-1.5 p-2 rounded-2xl transition-all min-w-[70px] md:min-w-[80px] border-2",
                    selectedOpponentId === player.id 
                      ? "bg-electric-blue/5 border-electric-blue shadow-lg shadow-electric-blue/10 scale-105" 
                      : "bg-slate-50 border-transparent grayscale opacity-60 hover:opacity-100 hover:grayscale-0"
                  )}
                >
                  <img src={player.avatar} alt={player.name} className="size-10 md:size-12 rounded-xl object-cover shadow-sm" />
                  <span className="text-[9px] md:text-[10px] font-bold text-primary-navy truncate w-full text-center">{player.name}</span>
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
              <div className="text-2xl font-display font-black text-slate-300 transform translate-y-4">:</div>
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

          <Button 
            onClick={handleSubmit} 
            disabled={!selectedOpponentId || isSubmitting}
            className="w-full py-8 rounded-[2rem] bg-primary-navy hover:bg-slate-800 text-white font-display font-black text-lg tracking-wider transition-all disabled:opacity-30 shadow-2xl shadow-primary-navy/20"
          >
            {isSubmitting ? "正在送出..." : "確認申報"}
          </Button>
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
              申報比賽結果
            </DialogTitle>
            <DialogDescription>請確認比分正確，送出後對手將收到確認通知。</DialogDescription>
          </DialogHeader>
          {content}
        </DialogContent>
      </Dialog>
    )
  }

  return (
    <Drawer open={open} onOpenChange={setOpen}>
      <DrawerTrigger asChild>
        {trigger}
      </DrawerTrigger>
      <DrawerContent className="p-0 overflow-hidden border-none bg-white">
        <DrawerHeader className="p-6 pb-2 border-none">
          <DrawerTitle className="flex items-center justify-center gap-3">
            <Trophy className="text-neon-orange" size={20} />
            申報比賽結果
          </DrawerTitle>
          <DrawerDescription className="text-center">請輸入最終局數比分</DrawerDescription>
        </DrawerHeader>
        {content}
        <DrawerFooter className="pt-0 pb-8">
          <DrawerClose asChild>
            <Button variant="ghost" className="text-primary-slate/40 text-[10px] font-black uppercase tracking-widest">取消</Button>
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
            <div className="size-full flex items-center justify-center text-slate-300">
              <User size={24} />
            </div>
          )}
        </div>
        <div className={cn(
          "absolute -bottom-2 -right-2 size-6 rounded-lg shadow-sm flex items-center justify-center border",
          status === 'win' ? "bg-green-500 text-white border-green-600" : 
          status === 'loss' ? "bg-red-500 text-white border-red-600" : 
          "bg-white text-primary-navy border-slate-100"
        )}>
           <span className="text-[10px] font-black">{placeholder ? "OPP" : "YOU"}</span>
        </div>
      </div>
      <span className={cn(
        "text-[10px] font-black uppercase tracking-widest transition-colors",
        status === 'win' ? "text-green-600" : status === 'loss' ? "text-red-500" : "text-primary-slate/60"
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
