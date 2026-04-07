import * as React from "react"
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import apiClient from '@/utils/apiClient'
import { Plus, Minus, Trophy, User, CheckCircle2, Swords, Search } from "lucide-react"
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
  Tabs,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs"
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
import { cn, formatLocalTime } from "@/lib/utils"
import { useAuth } from '@/hooks/useAuth';

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
  const { data: currentUser } = useAuth();
  const [open, setOpen] = React.useState(false)
  const isDesktop = useMediaQuery("(min-width: 1024px)")
  const [scoreA, setScoreA] = React.useState(initialScoreA)
  const [scoreB, setScoreB] = React.useState(initialScoreB)
  const [matchType, setMatchType] = React.useState<'singles' | 'doubles'>('singles')
  const [searchTerm, setSearchTerm] = React.useState("")
  const [selectedOpponentId, setSelectedOpponentId] = React.useState<string | null>(initialOpponentId)
  const [selectedPartnerId, setSelectedPartnerId] = React.useState<string | null>(null)
  const [selectedOpponentIds, setSelectedOpponentIds] = React.useState<string[]>([])
  const [isSuccess, setIsSuccess] = React.useState(false)

  const queryClient = useQueryClient();

  const { data: configData } = useQuery({
    queryKey: ['config', 'public'],
    queryFn: async () => {
      const res = await apiClient.get("/config/public");
      return res.data;
    },
    enabled: open
  });
  const seasonPaused = configData?.season_paused === 'true';

  const { data: realPlayers = [] } = useQuery({
    queryKey: ['users'],
    queryFn: async () => {
      const res = await apiClient.get<any[]>("/users");
      return res.data;
    },
    enabled: open && !!currentUser
  });

  const mutation = useMutation({
    mutationFn: async (payload: any) => {
      return apiClient.post("/matches", payload);
    },
    onMutate: async (newMatch) => {
      await queryClient.cancelQueries({ queryKey: ['matches', 'recent'] });
      const previousMatches = queryClient.getQueryData(['matches', 'recent']);

      const optimisticMatch = {
        id: 'temp-' + Date.now(),
        date: formatLocalTime(new Date().toISOString(), 'yyyy/MM/dd'),
        score: [newMatch.score_a, newMatch.score_b],
        match_type: newMatch.match_type,
        created_at: new Date().toISOString(),
        status: 'pending',
        player1: matchType === 'doubles' && selectedPartner 
          ? [currentUser, selectedPartner] 
          : [currentUser],
        opponent: matchType === 'doubles' 
          ? selectedOpponents 
          : (selectedOpponent ? [selectedOpponent] : []),
      };

      queryClient.setQueryData(['matches', 'recent'], (old: any) => {
        return old ? [optimisticMatch, ...old] : [optimisticMatch];
      });

      return { previousMatches };
    },
    onError: (err, _newMatch, context) => {
      if (context?.previousMatches) {
        queryClient.setQueryData(['matches', 'recent'], context.previousMatches);
      }
      
      let errorMessage = "報分失敗";
      const errorData = (err as any).response?.data;
      if (errorData?.detail) {
        if (typeof errorData.detail === "string") {
          errorMessage = errorData.detail;
        } else if (Array.isArray(errorData.detail)) {
          errorMessage = errorData.detail.map((e: any) =>
            `欄位 [${e.loc[e.loc.length - 1]}]: ${e.msg}`
          ).join('\n');
        }
      } else if ((err as any).message) {
          errorMessage = (err as any).message;
      }
      alert(`報分發生錯誤: ${errorMessage}`);
    },
    onSuccess: () => {
      setIsSuccess(true);
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['matches', 'recent'] });
      queryClient.invalidateQueries({ queryKey: ['users', 'me', 'stats'] });
      queryClient.invalidateQueries({ queryKey: ['leaderboard'] });
      queryClient.invalidateQueries({ queryKey: ['users', 'me', 'rivals'] });
      queryClient.invalidateQueries({ queryKey: ['users', 'me', 'partners'] });
    },
  });

  const isSubmitting = mutation.isPending;

  // Reset or initialize state when opening the dialog
  React.useEffect(() => {
    if (open && !isSuccess) {
      setScoreA(initialScoreA)
      setScoreB(initialScoreB)
      setSelectedOpponentId(initialOpponentId)
      setSelectedPartnerId(null)
      setSelectedOpponentIds([])
      setMatchType('singles')
      setSearchTerm("")
    }
  }, [open, initialScoreA, initialScoreB, initialOpponentId, isSuccess])

  const selectedOpponent = realPlayers.find(p => p.id === selectedOpponentId)
  const selectedPartner = realPlayers.find(p => p.id === selectedPartnerId)
  const selectedOpponents = realPlayers.filter(p => selectedOpponentIds.includes(p.id))

  const isReady = matchType === 'singles'
    ? !!selectedOpponentId
    : (!!selectedPartnerId && selectedOpponentIds.length === 2)

  // 智慧推斷：判斷局數與參與者是否合法，並回傳對應的 UI 狀態
  const getScoreValidation = (a: number, b: number, ready: boolean) => {
    const max = Math.max(a, b);
    const min = Math.min(a, b);

    if (seasonPaused) return { valid: false, text: "⛔ 賽季已暫停，目前無法申報新比分", style: "bg-rose-50 text-rose-600 border-rose-200 shadow-sm" };
    if (a === 0 && b === 0) return { valid: false, text: "請輸入最終局數", style: "bg-slate-50 text-slate-400 border-slate-200" };
    if (a === b) return { valid: false, text: "平手無法送出", style: "bg-slate-50 text-slate-500 border-slate-200" };

    const scoreIsValid = (max === 2 && min <= 1) || (max === 3 && min <= 2);

    if (scoreIsValid) {
      if (!ready) {
        return {
          valid: false,
          text: matchType === 'singles' ? "👤 請點擊上方選擇對手" : "👥 請點擊上方選齊搭檔與對手",
          style: "bg-amber-50 text-amber-600 border-amber-200 shadow-sm shadow-olympic-gold/10 animate-pulse"
        };
      }
      return {
        valid: true,
        text: max === 2 ? "✅ 合法賽果 (3戰2勝)" : "✅ 合法賽果 (5戰3勝)",
        style: "bg-emerald-50 text-emerald-600 border-emerald-200 shadow-sm shadow-emerald-500/10"
      };
    }

    // 超過合理範圍
    if (max > 3) return { valid: false, text: "❌ 局數異常 (最多3勝)", style: "bg-rose-50 text-rose-500 border-rose-200" };

    return { valid: false, text: "⏳ 比賽尚未分出勝負", style: "bg-slate-50 text-slate-500 border-slate-200" };
  };

  const validation = getScoreValidation(scoreA, scoreB, isReady);

  const handleSubmit = async () => {
    if (seasonPaused || !isReady || !validation.valid || !currentUser) return
    
    // 1. 已改用 HttpOnly Cookie，由瀏覽器自動處理，無需手動取得 Token

    // 2. 依照選擇的賽制，整理要送給後端的資料格式
    const payload = {
      score_a: scoreA,
      score_b: scoreB,
      match_type: matchType,
      team_a_p1_id: currentUser.id,
      team_a_p2_id: matchType === 'doubles' ? selectedPartnerId : null,
      team_b_p1_id: matchType === 'singles' ? selectedOpponentId : selectedOpponentIds[0],
      team_b_p2_id: matchType === 'doubles' ? selectedOpponentIds[1] : null,
      format: scoreA + scoreB >= 5 ? "BO5" : "BO3",
      reported_by: currentUser.id
    }

    mutation.mutate(payload)
  }

  const content = (
    <div className="px-6 py-4 md:py-2 space-y-8 md:space-y-4">
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
              {/* Me / My Team */}
              <div className="flex flex-col items-center gap-2">
                <div className={cn(
                  "flex items-center justify-center transition-all",
                  matchType === 'doubles' && selectedPartner ? "-space-x-4" : ""
                )}>
                  <div className={cn(
                    "size-14 rounded-2xl p-0.5 border-2 bg-white relative z-10",
                    scoreA > scoreB ? "border-emerald-500" : "border-slate-200"
                  )}>
                    <img src={currentUser.avatar} className="size-full rounded-xl object-cover" alt={currentUser.name} />
                  </div>
                  {matchType === 'doubles' && selectedPartner && (
                    <div className={cn(
                      "size-14 rounded-2xl p-0.5 border-2 bg-white relative z-0",
                      scoreA > scoreB ? "border-emerald-500" : "border-slate-200"
                    )}>
                      <img src={selectedPartner.avatar} className="size-full rounded-xl object-cover" alt={selectedPartner.name} />
                    </div>
                  )}
                </div>
                <span className="text-[10px] font-black text-slate-600 uppercase tracking-widest line-clamp-1 w-20 text-center">
                  {matchType === 'doubles' && selectedPartner ? "TEAM US" : currentUser.name}
                </span>
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

              {/* Opponent / Opponent Team */}
              <div className="flex flex-col items-center gap-2">
                <div className={cn(
                  "flex items-center justify-center transition-all",
                  matchType === 'doubles' && selectedOpponents.length > 1 ? "-space-x-4" : ""
                )}>
                  {matchType === 'doubles' ? (
                    selectedOpponents.map((p, i) => (
                      <div key={p.id} className={cn(
                        "size-14 rounded-2xl p-0.5 border-2 bg-white",
                        scoreB > scoreA ? "border-emerald-500" : "border-slate-200"
                      )} style={{ zIndex: selectedOpponents.length - i }}>
                        <img src={p.avatar} className="size-full rounded-xl object-cover" alt={p.name} />
                      </div>
                    ))
                  ) : (
                    <div className={cn(
                      "size-14 rounded-2xl p-0.5 border-2 bg-white",
                      scoreB > scoreA ? "border-emerald-500" : "border-slate-200"
                    )}>
                      <img src={selectedOpponent?.avatar} className="size-full rounded-xl object-cover" alt={selectedOpponent?.name} />
                    </div>
                  )}
                </div>
                <span className="text-[10px] font-black text-slate-600 uppercase tracking-widest line-clamp-1 w-20 text-center">
                  {matchType === 'doubles' ? "TEAM THEM" : selectedOpponent?.name}
                </span>
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

        </div>
      ) : (
        <>
          {/* Match Type Selection */}
          {!editMode && (
            <Tabs
              value={matchType}
              onValueChange={(val) => {
                setMatchType(val as 'singles' | 'doubles');
                setSelectedOpponentId(null);
                setSelectedPartnerId(null);
                setSelectedOpponentIds([]);
              }}
              className="w-full"
            >
              <TabsList className="grid w-full grid-cols-2 rounded-2xl p-1 bg-slate-100">
                <TabsTrigger value="singles" className="rounded-xl font-bold py-2 data-[state=active]:bg-white data-[state=active]:shadow-sm">單打 Singles</TabsTrigger>
                <TabsTrigger value="doubles" className="rounded-xl font-bold py-2 data-[state=active]:bg-white data-[state=active]:shadow-sm">雙打 Doubles</TabsTrigger>
              </TabsList>
            </Tabs>
          )}

          {/* Player Selection */}
          <section className="space-y-4">
            <div className="flex flex-col gap-3">
              <div className="flex items-center justify-between ml-1">
                <label className="text-xs font-black uppercase tracking-[0.2em] text-slate-500">
                  {matchType === 'singles' ? '選擇對手' : (
                    !selectedPartnerId ? '請選擇您的搭檔 (1/1)' : `請選擇對手 (${selectedOpponentIds.length}/2)`
                  )}
                </label>
                {matchType === 'doubles' && (selectedPartnerId || selectedOpponentIds.length > 0) && (
                  <button
                    onClick={() => {
                      setSelectedPartnerId(null);
                      setSelectedOpponentIds([]);
                    }}
                    className="text-[10px] font-black text-sapphire-blue uppercase tracking-widest hover:underline"
                  >
                    重設選擇
                  </button>
                )}
              </div>

              {/* 🌟 新增：搜尋輸入框 */}
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                <input
                  type="text"
                  placeholder="搜尋同仁姓名..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full h-10 pl-10 pr-4 rounded-xl border border-slate-200 bg-slate-50 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-500 transition-all font-bold text-slate-600 placeholder:text-slate-400 placeholder:font-medium shadow-sm inset-y-0"
                />
              </div>
            </div>

            <div className="flex gap-2 md:gap-3 overflow-x-auto pt-2 pb-4 no-scrollbar -mx-2 px-2 md:grid md:grid-cols-4 md:overflow-visible">
              {/* 🌟 修改：動態過濾名單邏輯 */}
              {(() => {
                const filteredPlayers = realPlayers.filter(p =>
                  p.name.toLowerCase().includes(searchTerm.toLowerCase()) && p.id !== currentUser.id // 這裡的 currentUser 之後也要換成從上層傳下來的真實 user
                )

                // 如果沒有搜尋條件，預設顯示 10 名；有搜尋則顯示所有符合條件的同仁
                const displayPlayers = searchTerm ? filteredPlayers : filteredPlayers.slice(0, 10);

                if (displayPlayers.length === 0) {
                  return (
                    <div className="col-span-4 py-6 text-center text-xs font-bold text-slate-400 uppercase tracking-widest border-2 border-dashed border-slate-100 rounded-2xl w-full">
                      找不到符合的同仁
                    </div>
                  );
                }

                return displayPlayers.map((player) => {
                  const isPartner = selectedPartnerId === player.id;
                  const isOpponent = matchType === 'singles' ? selectedOpponentId === player.id : selectedOpponentIds.includes(player.id);
                  const isSelected = isPartner || isOpponent;

                  return (
                    <button
                      key={player.id}
                      onClick={() => {
                        if (editMode) return;
                        if (matchType === 'singles') {
                          setSelectedOpponentId(player.id);
                        } else {
                          if (!selectedPartnerId) {
                            setSelectedPartnerId(player.id);
                          } else if (isPartner) {
                            setSelectedPartnerId(null);
                          } else if (isOpponent) {
                            setSelectedOpponentIds(prev => prev.filter(id => id !== player.id));
                          } else if (selectedOpponentIds.length < 2) {
                            setSelectedOpponentIds(prev => [...prev, player.id]);
                          }
                        }
                      }}
                      disabled={editMode}
                      className={cn(
                        "flex-shrink-0 flex flex-col items-center gap-1.5 p-2 rounded-2xl transition-all min-w-[70px] md:min-w-[80px] border-2 relative",
                        isSelected
                          ? isPartner
                            ? "bg-amber-50 border-amber-400 shadow-lg shadow-amber-200/20 scale-105 z-10"
                            : "bg-emerald-50 border-emerald-400 shadow-lg shadow-emerald-200/20 scale-105 z-10"
                          : editMode
                            ? "bg-slate-50 border-transparent grayscale opacity-30 cursor-not-allowed"
                            : "bg-slate-50 border-transparent grayscale opacity-60 hover:opacity-100 hover:grayscale-0"
                      )}
                    >
                      <div className="relative">
                        <img src={player.avatar} alt={player.name} className="size-10 md:size-12 rounded-xl object-cover shadow-sm" />
                        {isSelected && (
                          <div className={cn(
                            "absolute -top-1 -right-1 size-4 rounded-full flex items-center justify-center text-[8px] font-black text-white shadow-sm",
                            isPartner ? "bg-olympic-gold" : "bg-emerald-500"
                          )}>
                            {isPartner ? "T" : "O"}
                          </div>
                        )}
                      </div>
                      <span className={cn(
                        "text-[10px] md:text-xs font-bold truncate w-full text-center",
                        isSelected ? "text-primary-navy" : "text-slate-500"
                      )}>{player.name}</span>
                    </button>
                  );
                });
              })()}
            </div>
          </section>

          {/* Score Input */}
          <section className="space-y-2 md:space-y-0">
            <div className="flex items-center justify-between gap-4">
              <ScoreControl
                value={scoreA}
                onChange={setScoreA}
                avatars={matchType === 'doubles' && selectedPartner ? [currentUser.avatar, selectedPartner.avatar] : [currentUser.avatar]}
                names={matchType === 'doubles' && selectedPartner ? [currentUser.name, selectedPartner.name] : [currentUser.name]}
                status={scoreA > scoreB ? 'win' : scoreA < scoreB ? 'loss' : 'draw'}
              />
              <div className="text-2xl font-display font-black text-slate-500 transform translate-y-4">:</div>
              <ScoreControl
                value={scoreB}
                onChange={setScoreB}
                avatars={matchType === 'doubles'
                  ? selectedOpponents.map(p => p.avatar)
                  : selectedOpponent ? [selectedOpponent.avatar] : []
                }
                names={matchType === 'doubles'
                  ? selectedOpponents.map(p => p.name)
                  : selectedOpponent ? [selectedOpponent.name] : ["???"]
                }
                placeholder={matchType === 'singles' ? !selectedOpponentId : selectedOpponentIds.length < 2}
                status={scoreB > scoreA ? 'win' : scoreB < scoreA ? 'loss' : 'draw'}
              />
            </div>
          </section>

          {/* 新增：動態防呆提示標籤 */}
          <div className="flex justify-center pt-2 pb-4">
            <div className={cn(
              "px-4 py-2 rounded-full border text-xs font-black tracking-widest transition-all duration-300",
              validation.style
            )}>
              {validation.text}
            </div>
          </div>

          {/* Conditional Desktop Submit Button - Moved to Dialog footer below */}

        </>
      )}
    </div>
  )

  if (isDesktop) {
    return (
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogTrigger render={trigger} />
        <DialogContent className="max-w-xl p-0 overflow-hidden border-none bg-white">
          <DialogHeader className="p-8 pb-0 md:p-6 md:pb-0">
            <DialogTitle className={cn("flex items-center gap-3", isSuccess && "text-emerald-600")}>
              {isSuccess ? <CheckCircle2 className="text-emerald-500" /> : <Trophy className="text-olympic-gold" />}
              {isSuccess ? "申報成功" : (editMode ? "修改賽果" : "申報比賽結果")}
            </DialogTitle>
            <DialogDescription>
              {isSuccess
                ? "賽果已提交，等待對手系統確認中。"
                : "請確認比分正確，送出後對手將收到確認通知。"}
            </DialogDescription>
          </DialogHeader>
          <div className="max-h-[calc(85vh-160px)] overflow-y-auto no-scrollbar border-y border-slate-50 md:border-none">
            {content}
          </div>
          {!isSuccess && !isDesktop && (
            <div className="p-6 pt-0 border-t border-slate-50 flex gap-3">
              <Button
                onClick={handleSubmit}
                disabled={seasonPaused || !isReady || isSubmitting || !validation.valid}
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
            <div className="p-8 pt-4 md:p-6 md:pt-2 flex justify-end gap-3">
              <Button variant="outline" onClick={() => setOpen(false)} className="h-12 px-8 rounded-xl border-slate-200 text-slate-600 font-bold hover:bg-slate-50">
                取消
              </Button>
              <Button
                onClick={handleSubmit}
                disabled={seasonPaused || !isReady || isSubmitting || !validation.valid}
                className="h-12 px-10 rounded-xl bg-primary-navy hover:bg-slate-800 text-white font-display font-black tracking-wider transition-all disabled:opacity-30 shadow-xl shadow-primary-navy/20"
              >
                {isSubmitting ? "正在送出..." : editMode ? "送出修改" : "確認申報"}
              </Button>
            </div>
          )}
          {isDesktop && isSuccess && (
            <div className="p-8 pt-0">
              <Button
                onClick={() => {
                  setOpen(false)
                  setTimeout(() => {
                    setIsSuccess(false)
                    setScoreA(0)
                    setScoreB(0)
                    setSelectedOpponentId(null)
                    setSelectedPartnerId(null)
                    setSelectedOpponentIds([])
                    setMatchType('singles')
                  }, 300)
                }}
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
            <DrawerTitle className={cn("flex items-center justify-center gap-3", isSuccess && "text-emerald-600")}>
              {isSuccess ? <CheckCircle2 className="text-emerald-500" size={20} /> : <Trophy className="text-olympic-gold" size={20} />}
              {isSuccess ? "申報成功" : (editMode ? "修改賽果" : "申報比賽結果")}
            </DrawerTitle>
            <DrawerDescription className="text-center">
              {isSuccess ? "您的戰果已成功提交" : "請輸入最終局數比分"}
            </DrawerDescription>
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
              disabled={seasonPaused || !isReady || isSubmitting || !validation.valid}
              className="w-full h-14 rounded-2xl bg-primary-navy hover:bg-slate-800 text-white font-display font-black text-lg tracking-wider transition-all disabled:opacity-30 shadow-2xl shadow-primary-navy/20 mb-4"
            >
              {isSubmitting ? "正在送出..." : editMode ? "送出修改" : "確認申報"}
            </Button>
          )}
          <DrawerClose asChild>
            <Button
              variant={isSuccess ? "default" : "outline"}
              onClick={() => {
                if (isSuccess) {
                  setTimeout(() => {
                    setIsSuccess(false)
                    setScoreA(0)
                    setScoreB(0)
                    setSelectedOpponentId(null)
                    setSelectedPartnerId(null)
                    setSelectedOpponentIds([])
                    setMatchType('singles')
                  }, 300)
                }
              }}
              className={cn(
                "w-full h-12 rounded-xl border-slate-200 font-bold uppercase tracking-widest",
                isSuccess
                  ? "bg-primary-navy hover:bg-slate-800 text-white border-none"
                  : "text-slate-500 hover:bg-slate-50"
              )}
            >
              {isSuccess ? "知道了" : "取消操作"}
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
  avatars,
  names,
  placeholder = false,
  status
}: {
  value: number;
  onChange: (val: number) => void;
  avatars: string[];
  names: string[];
  placeholder?: boolean;
  status?: 'win' | 'loss' | 'draw';
}) {
  return (
    <div className="flex-1 flex flex-col items-center space-y-3 md:space-y-2">
      <div className="relative group">
        <div className={cn(
          "flex items-center justify-center transition-all",
          avatars.length > 1 ? "-space-x-4" : ""
        )}>
          {avatars.length > 0 ? (
            avatars.map((avatar, i) => (
              <div
                key={i}
                className={cn(
                  "size-14 md:size-11 rounded-[1.5rem] md:rounded-xl overflow-hidden border-2 transition-all relative z-[1]",
                  "border-white bg-slate-50 shadow-md transform group-hover:rotate-6",
                  status === 'win' && "border-green-200 ring-4 ring-green-500/10",
                  status === 'loss' && "border-red-200 opacity-80"
                )}
                style={{ zIndex: avatars.length - i }}
              >
                <img src={avatar} alt={names[i]} className="size-full object-cover" />
              </div>
            ))
          ) : (
            <div className={cn(
              "size-14 md:size-11 rounded-[1.5rem] md:rounded-xl overflow-hidden border-2 border-dashed border-slate-300 bg-slate-100 flex items-center justify-center text-slate-400",
            )}>
              <User size={20} />
            </div>
          )}
        </div>
        <div className={cn(
          "absolute -bottom-2 -right-2 size-7 rounded-full shadow-lg flex items-center justify-center border-2 z-10",
          status === 'win' ? "bg-green-500 text-white border-white" :
            status === 'loss' ? "bg-red-500 text-white border-white" :
              "bg-white text-primary-navy border-slate-100"
        )}>
          {placeholder ? <Swords size={14} strokeWidth={3} /> : <User size={14} strokeWidth={3} />}
        </div>
      </div>
      <span className={cn(
        "text-[10px] font-black uppercase tracking-widest transition-colors text-center line-clamp-1 h-4",
        status === 'win' ? "text-green-600" : status === 'loss' ? "text-red-500" : "text-slate-500"
      )}>
        {names.length > 1 ? `${names[0]} & ${names[1]}` : names[0] || ""}
      </span>

      <div className={cn(
        "flex flex-col items-center gap-4 md:gap-2 p-4 md:p-3 rounded-[2.5rem] md:rounded-[1.5rem] border transition-all duration-500",
        status === 'win' ? "bg-green-50 border-green-100 shadow-lg shadow-green-200/20" :
          status === 'loss' ? "bg-red-50 border-red-100 opacity-90" :
            "bg-slate-50/50 border-slate-100/50"
      )}>
        <button
          onClick={() => onChange(Math.min(3, value + 1))}
          className={cn(
            "size-14 md:size-10 rounded-2xl md:rounded-xl shadow-sm border flex items-center justify-center active:scale-95 transition-all text-primary-navy hover:bg-slate-50",
            status === 'win' && "bg-white border-green-200 text-green-600 hover:bg-green-100/50",
            status === 'loss' && "bg-white border-red-200 text-red-600 hover:bg-red-100/50"
          )}
        >
          <Plus size={20} strokeWidth={3} />
        </button>
        <span className={cn(
          "text-5xl md:text-4xl font-display font-black tabular-nums min-w-[60px] text-center transition-colors",
          status === 'win' ? "text-green-600" : status === 'loss' ? "text-red-600" : "text-primary-navy"
        )}>{value}</span>
        <button
          onClick={() => onChange(Math.max(0, value - 1))}
          className={cn(
            "size-14 md:size-10 rounded-2xl md:rounded-xl shadow-sm border flex items-center justify-center active:scale-95 transition-all text-primary-navy hover:bg-slate-50",
            status === 'win' && "bg-white border-green-200 text-green-600 hover:bg-green-100/50",
            status === 'loss' && "bg-white border-red-200 text-red-600 hover:bg-red-100/50"
          )}
        >
          <Minus size={20} strokeWidth={3} />
        </button>
      </div>
    </div>
  );
}
