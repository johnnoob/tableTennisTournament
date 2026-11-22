import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Calendar, Clock, Globe, Lock, MapPin, MessageSquare, Swords, Users } from 'lucide-react';
import { ResponsiveFormModal } from '@/components/ResponsiveFormModal';
import { Button } from '@/components/ui/button';
import { PlayerAvatar } from '@/components/PlayerAvatar';
import { cn } from '@/lib/utils';
import { useAuth } from '@/hooks/useAuth';
import { useCreateChallenge, useCounterChallenge } from '@/hooks/useChallenges';
import {
  CHALLENGE_MESSAGE_TEMPLATES,
  combineLocalDateTimeToIso,
  formatChallengeDateTimeLabel,
  getDefaultChallengeDateTime,
  getTodayLocalDateStr,
} from '@/lib/challengeUtils';
import apiClient from '@/utils/apiClient';
import type { ChallengeItem } from '@/types/api.types';

interface SimpleUserOption {
  id: string;
  name: string;
  department?: string | null;
  avatar?: string | null;
}

export interface ChallengeTargetPlayer {
  id: string;
  name: string;
  avatar?: string | null;
  department?: string | null;
}

type ChallengeModalProps =
  | {
      open: boolean;
      onOpenChange: (open: boolean) => void;
      mode?: 'create';
      targetPlayer: ChallengeTargetPlayer;
      challenge?: undefined;
    }
  | {
      open: boolean;
      onOpenChange: (open: boolean) => void;
      mode: 'counter';
      challenge: ChallengeItem;
      targetPlayer?: undefined;
    };

export function ChallengeModal(props: ChallengeModalProps) {
  if (!props.open) return null;

  if (props.mode === 'counter') {
    return (
      <CounterChallengeModalBody
        key={`counter-${props.challenge.id}-${props.challenge.proposed_at}`}
        open={props.open}
        onOpenChange={props.onOpenChange}
        challenge={props.challenge}
      />
    );
  }

  return (
    <CreateChallengeModalBody
      key={`create-${props.targetPlayer.id}`}
      open={props.open}
      onOpenChange={props.onOpenChange}
      targetPlayer={props.targetPlayer}
    />
  );
}

function CreateChallengeModalBody({
  open,
  onOpenChange,
  targetPlayer,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  targetPlayer: ChallengeTargetPlayer;
}) {
  const { data: currentUser } = useAuth();
  const createMutation = useCreateChallenge();
  const defaultDt = getDefaultChallengeDateTime();

  const [matchType, setMatchType] = useState<'singles' | 'doubles'>('singles');
  const [format, setFormat] = useState<'BO3' | 'BO5'>('BO3');
  const [myPartnerId, setMyPartnerId] = useState<string>('');
  const [oppPartnerId, setOppPartnerId] = useState<string>('');
  const [dateStr, setDateStr] = useState<string>(defaultDt.date);
  const [timeStr, setTimeStr] = useState<string>(defaultDt.time);
  const [location, setLocation] = useState<string>('');
  const [message, setMessage] = useState<string>('');
  const [isPublic, setIsPublic] = useState<boolean>(true);
  const [formError, setFormError] = useState<string>('');

  const { data: allPlayers = [] } = useQuery<SimpleUserOption[]>({
    queryKey: ['users'],
    queryFn: async () => {
      const res = await apiClient.get<SimpleUserOption[]>('/users');
      return res.data;
    },
    enabled: open && matchType === 'doubles',
  });

  const partnerCandidates = allPlayers.filter(
    (p) => p.id !== currentUser?.id && p.id !== targetPlayer.id
  );

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setFormError('');

    const iso = combineLocalDateTimeToIso(dateStr, timeStr);
    if (!iso) {
      setFormError('請選擇完整的約戰日期與時間');
      return;
    }
    if (new Date(iso).getTime() < Date.now() - 2 * 60 * 1000) {
      setFormError('約戰時間不可早於現在');
      return;
    }

    try {
      await createMutation.mutateAsync({
        challenged_id: targetPlayer.id,
        match_type: matchType,
        format,
        challenger_partner_id: matchType === 'doubles' && myPartnerId ? myPartnerId : null,
        challenged_partner_id: matchType === 'doubles' && oppPartnerId ? oppPartnerId : null,
        proposed_at: iso,
        location: location.trim() || null,
        message: message.trim() || null,
        is_public: isPublic,
      });
      onOpenChange(false);
    } catch {
      // toast is handled inside useCreateChallenge
    }
  };

  return (
    <ResponsiveFormModal
      open={open}
      onOpenChange={onOpenChange}
      size="md"
      tone="gold"
      icon={<Swords size={18} />}
      title={`向 ${targetPlayer.name} 發起挑戰`}
      description="指定明確日期與時間發出戰帖，對方接受即可開打並於賽後一鍵報分。"
      onSubmit={handleSubmit}
      footer={
        <>
          <Button
            type="button"
            variant="outline"
            disabled={createMutation.isPending}
            onClick={() => onOpenChange(false)}
            className="w-full sm:w-auto h-11 px-5 rounded-xl border-border text-muted-foreground font-bold"
          >
            取消
          </Button>
          <Button
            type="submit"
            disabled={createMutation.isPending}
            className="w-full sm:w-auto h-11 px-6 rounded-xl bg-gradient-to-r from-smash-orange to-orange-600 hover:opacity-95 text-white font-display font-black text-sm shadow-sm gap-1.5"
          >
            <Swords size={15} aria-hidden="true" />
            {createMutation.isPending ? '發送戰帖中...' : '送出戰帖'}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        {/* 對手資訊卡（無 ELO 賭注） */}
        <div className="flex items-center gap-3 p-3 rounded-2xl bg-surface-subtle/80 border border-border">
          <PlayerAvatar
            src={targetPlayer.avatar}
            name={targetPlayer.name}
            className="size-11 rounded-xl border border-border text-sm"
          />
          <div className="min-w-0 flex-1">
            <p className="text-xs font-bold text-muted-foreground">受邀對手</p>
            <p className="text-sm font-display font-black text-foreground truncate">{targetPlayer.name}</p>
            <p className="text-[11px] font-bold text-muted-foreground truncate">
              {targetPlayer.department || '未設定單位'}
            </p>
          </div>
        </div>

        {/* 賽制與局制 */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <span className="arena-label text-muted-foreground">賽制</span>
            <div className="grid grid-cols-2 gap-1.5 p-1 rounded-xl bg-secondary border border-border">
              {([
                { value: 'singles', label: '單打 1v1' },
                { value: 'doubles', label: '雙打 2v2' },
              ] as const).map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => setMatchType(opt.value)}
                  className={cn(
                    'min-h-9 rounded-lg text-xs font-black transition-all',
                    matchType === opt.value
                      ? 'bg-card text-foreground shadow-xs'
                      : 'text-muted-foreground hover:text-foreground'
                  )}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          <div>
            <span className="arena-label text-muted-foreground">局制</span>
            <div className="grid grid-cols-2 gap-1.5 p-1 rounded-xl bg-secondary border border-border">
              {([
                { value: 'BO3', label: 'BO3 三戰兩勝' },
                { value: 'BO5', label: 'BO5 五戰三勝' },
              ] as const).map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => setFormat(opt.value)}
                  className={cn(
                    'min-h-9 rounded-lg text-xs font-black transition-all',
                    format === opt.value
                      ? 'bg-card text-foreground shadow-xs'
                      : 'text-muted-foreground hover:text-foreground'
                  )}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* 輕量雙打搭檔（雙方代表確認制） */}
        {matchType === 'doubles' && (
          <div className="rounded-2xl bg-surface-subtle/70 border border-border p-3.5 space-y-3">
            <div className="flex items-start gap-2">
              <Users size={15} className="text-sapphire-blue shrink-0 mt-0.5" aria-hidden="true" />
              <div>
                <p className="text-xs font-black text-foreground">雙打搭檔（選填，採雙方代表確認制）</p>
                <p className="text-[11px] font-medium text-muted-foreground mt-0.5">
                  仍由你與 {targetPlayer.name} 兩人確認時間即可成局；留空代表現場湊咖，有指定搭檔會同步通知對方。
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              <div>
                <label htmlFor="my-doubles-partner" className="text-[11px] font-black text-muted-foreground block mb-1">
                  我方搭檔
                </label>
                <select
                  id="my-doubles-partner"
                  value={myPartnerId}
                  onChange={(e) => setMyPartnerId(e.target.value)}
                  className="arena-input h-10 text-xs"
                >
                  <option value="">現場湊咖（不指定）</option>
                  {partnerCandidates
                    .filter((p) => p.id !== oppPartnerId)
                    .map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name}
                        {p.department ? ` (${p.department})` : ''}
                      </option>
                    ))}
                </select>
              </div>

              <div>
                <label htmlFor="opp-doubles-partner" className="text-[11px] font-black text-muted-foreground block mb-1">
                  對方搭檔
                </label>
                <select
                  id="opp-doubles-partner"
                  value={oppPartnerId}
                  onChange={(e) => setOppPartnerId(e.target.value)}
                  className="arena-input h-10 text-xs"
                >
                  <option value="">由對方決定 / 現場湊咖</option>
                  {partnerCandidates
                    .filter((p) => p.id !== myPartnerId)
                    .map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name}
                        {p.department ? ` (${p.department})` : ''}
                      </option>
                    ))}
                </select>
              </div>
            </div>
          </div>
        )}

        {/* 精確日期與時間 */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label htmlFor="challenge-date" className="arena-label flex items-center gap-1.5 text-muted-foreground">
              <Calendar size={13} aria-hidden="true" />
              <span>約戰日期</span>
              <span className="text-rose-500" aria-hidden="true">*</span>
            </label>
            <input
              id="challenge-date"
              type="date"
              required
              min={getTodayLocalDateStr()}
              value={dateStr}
              onChange={(e) => {
                setDateStr(e.target.value);
                setFormError('');
              }}
              className="arena-input"
            />
          </div>

          <div>
            <label htmlFor="challenge-time" className="arena-label flex items-center gap-1.5 text-muted-foreground">
              <Clock size={13} aria-hidden="true" />
              <span>開打時間</span>
              <span className="text-rose-500" aria-hidden="true">*</span>
            </label>
            <input
              id="challenge-time"
              type="time"
              required
              value={timeStr}
              onChange={(e) => {
                setTimeStr(e.target.value);
                setFormError('');
              }}
              className="arena-input"
            />
          </div>
        </div>

        {/* 地點 / 桌號 */}
        <div>
          <label htmlFor="challenge-location" className="arena-label flex items-center gap-1.5 text-muted-foreground">
            <MapPin size={13} aria-hidden="true" />
            <span>地點 / 桌號（選填）</span>
          </label>
          <input
            id="challenge-location"
            type="text"
            maxLength={80}
            value={location}
            onChange={(e) => setLocation(e.target.value)}
            placeholder="例如：B1 桌球室 第 2 桌"
            className="arena-input"
          />
        </div>

        {/* 戰帖喊話 + 趣味快選 */}
        <div className="space-y-2">
          <label htmlFor="challenge-message" className="arena-label flex items-center gap-1.5 text-muted-foreground">
            <MessageSquare size={13} aria-hidden="true" />
            <span>戰帖喊話（選填）</span>
          </label>
          <input
            id="challenge-message"
            type="text"
            maxLength={120}
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder="寫一句給對手的約戰喊話..."
            className="arena-input"
          />
          <div className="flex flex-wrap gap-1.5">
            {CHALLENGE_MESSAGE_TEMPLATES.map((tpl) => (
              <button
                key={tpl}
                type="button"
                onClick={() => setMessage(tpl)}
                className={cn(
                  'px-2.5 py-1 rounded-full text-[11px] font-bold border transition-colors',
                  message === tpl
                    ? 'bg-smash-orange/15 border-smash-orange/50 text-smash-orange'
                    : 'bg-card border-border text-muted-foreground hover:text-foreground hover:bg-secondary/70'
                )}
              >
                {tpl}
              </button>
            ))}
          </div>
        </div>

        {/* 公開於社團約戰預告牆 */}
        <button
          type="button"
          onClick={() => setIsPublic((prev) => !prev)}
          aria-pressed={isPublic}
          className="w-full flex items-center justify-between gap-3 px-3.5 py-2.5 rounded-xl bg-surface-subtle/80 border border-border text-left transition-colors hover:bg-secondary/60"
        >
          <div className="flex items-center gap-2.5 min-w-0">
            {isPublic ? (
              <Globe size={16} className="text-sapphire-blue shrink-0" aria-hidden="true" />
            ) : (
              <Lock size={16} className="text-muted-foreground shrink-0" aria-hidden="true" />
            )}
            <div className="min-w-0">
              <p className="text-xs font-black text-foreground">
                {isPublic ? '公開到「近期公開約戰預告」' : '僅雙方私下約戰（不公開預告）'}
              </p>
              <p className="text-[11px] font-medium text-muted-foreground">
                成立後會顯示於首頁右側約戰預告牆，讓球友觀戰加油
              </p>
            </div>
          </div>
          <span
            className={cn(
              'px-2 py-0.5 rounded-full text-[10px] font-black shrink-0',
              isPublic
                ? 'bg-sapphire-blue text-white'
                : 'bg-secondary text-muted-foreground'
            )}
          >
            {isPublic ? '公開' : '私約'}
          </span>
        </button>

        {formError && (
          <p role="alert" className="text-xs font-bold text-rose-600 dark:text-rose-400">
            {formError}
          </p>
        )}
      </div>
    </ResponsiveFormModal>
  );
}

function CounterChallengeModalBody({
  open,
  onOpenChange,
  challenge,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  challenge: ChallengeItem;
}) {
  const counterMutation = useCounterChallenge();
  const initialDt = getDefaultChallengeDateTime(challenge.proposed_at);

  const [dateStr, setDateStr] = useState<string>(initialDt.date);
  const [timeStr, setTimeStr] = useState<string>(initialDt.time);
  const [location, setLocation] = useState<string>(challenge.location || '');
  const [message, setMessage] = useState<string>('');
  const [formError, setFormError] = useState<string>('');

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setFormError('');

    const iso = combineLocalDateTimeToIso(dateStr, timeStr);
    if (!iso) {
      setFormError('請選擇完整的新約戰日期與時間');
      return;
    }
    if (new Date(iso).getTime() < Date.now() - 2 * 60 * 1000) {
      setFormError('改約時間不可早於現在');
      return;
    }

    try {
      await counterMutation.mutateAsync({
        challengeId: challenge.id,
        proposed_at: iso,
        location: location.trim() || null,
        message: message.trim() || null,
      });
      onOpenChange(false);
    } catch {
      // handled by mutation toast
    }
  };

  return (
    <ResponsiveFormModal
      open={open}
      onOpenChange={onOpenChange}
      size="sm"
      tone="default"
      icon={<Clock size={18} />}
      title="改約其他日期與時間"
      description="提出新的對戰時間後，將通知對方確認是否接受。"
      onSubmit={handleSubmit}
      footer={
        <>
          <Button
            type="button"
            variant="outline"
            disabled={counterMutation.isPending}
            onClick={() => onOpenChange(false)}
            className="w-full sm:w-auto h-11 px-5 rounded-xl border-border text-muted-foreground font-bold"
          >
            取消
          </Button>
          <Button
            type="submit"
            disabled={counterMutation.isPending}
            className="w-full sm:w-auto h-11 px-6 rounded-xl bg-sapphire-blue hover:bg-blue-700 text-white font-display font-black text-sm shadow-sm"
          >
            {counterMutation.isPending ? '送出中...' : '送出新時間'}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <div className="rounded-xl bg-surface-subtle border border-border px-3.5 py-2.5 text-xs">
          <span className="font-bold text-muted-foreground">原提案時間：</span>
          <span className="font-black text-foreground">
            {formatChallengeDateTimeLabel(challenge.proposed_at)}
          </span>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label htmlFor="counter-date" className="arena-label flex items-center gap-1.5 text-muted-foreground">
              <Calendar size={13} aria-hidden="true" />
              <span>新日期</span>
            </label>
            <input
              id="counter-date"
              type="date"
              required
              min={getTodayLocalDateStr()}
              value={dateStr}
              onChange={(e) => {
                setDateStr(e.target.value);
                setFormError('');
              }}
              className="arena-input"
            />
          </div>

          <div>
            <label htmlFor="counter-time" className="arena-label flex items-center gap-1.5 text-muted-foreground">
              <Clock size={13} aria-hidden="true" />
              <span>新時間</span>
            </label>
            <input
              id="counter-time"
              type="time"
              required
              value={timeStr}
              onChange={(e) => {
                setTimeStr(e.target.value);
                setFormError('');
              }}
              className="arena-input"
            />
          </div>
        </div>

        <div>
          <label htmlFor="counter-location" className="arena-label flex items-center gap-1.5 text-muted-foreground">
            <MapPin size={13} aria-hidden="true" />
            <span>地點 / 桌號（選填）</span>
          </label>
          <input
            id="counter-location"
            type="text"
            maxLength={80}
            value={location}
            onChange={(e) => setLocation(e.target.value)}
            placeholder="例如：B1 桌球室 第 2 桌"
            className="arena-input"
          />
        </div>

        <div>
          <label htmlFor="counter-message" className="arena-label flex items-center gap-1.5 text-muted-foreground">
            <MessageSquare size={13} aria-hidden="true" />
            <span>改約說明（選填）</span>
          </label>
          <input
            id="counter-message"
            type="text"
            maxLength={120}
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder="例如：中午有會議，改約傍晚可以嗎？"
            className="arena-input"
          />
        </div>

        {formError && (
          <p role="alert" className="text-xs font-bold text-rose-600 dark:text-rose-400">
            {formError}
          </p>
        )}
      </div>
    </ResponsiveFormModal>
  );
}
