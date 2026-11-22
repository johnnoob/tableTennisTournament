import { Minus, Plus } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { MatchFormat } from '@/lib/matchScore';

const PRESET_SCORES: Record<MatchFormat, Array<{ a: number; b: number; label: string; win: boolean }>> = {
  BO3: [
    { a: 2, b: 0, label: '2 : 0', win: true },
    { a: 2, b: 1, label: '2 : 1', win: true },
    { a: 1, b: 2, label: '1 : 2', win: false },
    { a: 0, b: 2, label: '0 : 2', win: false },
  ],
  BO5: [
    { a: 3, b: 0, label: '3 : 0', win: true },
    { a: 3, b: 1, label: '3 : 1', win: true },
    { a: 3, b: 2, label: '3 : 2', win: true },
    { a: 2, b: 3, label: '2 : 3', win: false },
    { a: 1, b: 3, label: '1 : 3', win: false },
    { a: 0, b: 3, label: '0 : 3', win: false },
  ],
};

interface ScoreInputSectionProps {
  format: MatchFormat;
  onFormatChange: (format: MatchFormat) => void;
  scoreA: number;
  scoreB: number;
  onScoreAChange: (val: number) => void;
  onScoreBChange: (val: number) => void;
  sideALabel?: string;
  sideBLabel?: string;
  winBadgeLabel?: string;
  lossBadgeLabel?: string;
}

export function ScoreInputSection({
  format,
  onFormatChange,
  scoreA,
  scoreB,
  onScoreAChange,
  onScoreBChange,
  sideALabel = '我方',
  sideBLabel = '對手',
  winBadgeLabel = '我勝',
  lossBadgeLabel = '我敗',
}: ScoreInputSectionProps) {
  const maxStepScore = format === 'BO3' ? 2 : 3;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs font-black text-muted-foreground">一鍵點選比分</span>
        <div
          role="group"
          aria-label="比賽賽制"
          className="inline-flex p-0.5 rounded-xl bg-secondary border border-border"
        >
          {(['BO3', 'BO5'] as const).map((fmt) => (
            <button
              type="button"
              key={fmt}
              aria-pressed={format === fmt}
              onClick={() => {
                onFormatChange(fmt);
                if (fmt === 'BO3' && (scoreA > 2 || scoreB > 2)) {
                  onScoreAChange(0);
                  onScoreBChange(0);
                }
              }}
              className={cn(
                'px-3 py-1 rounded-lg text-xs font-black transition-all',
                format === fmt
                  ? 'bg-card text-foreground shadow-xs'
                  : 'text-muted-foreground hover:text-foreground'
              )}
            >
              {fmt === 'BO3' ? '三戰兩勝 BO3' : '五戰三勝 BO5'}
            </button>
          ))}
        </div>
      </div>

      {/* 預設快捷比分膠囊 */}
      <div
        className={cn(
          'grid gap-2',
          format === 'BO3' ? 'grid-cols-4' : 'grid-cols-3 sm:grid-cols-6'
        )}
      >
        {PRESET_SCORES[format].map((preset) => {
          const isSelected = scoreA === preset.a && scoreB === preset.b;
          return (
            <button
              type="button"
              key={preset.label}
              aria-pressed={isSelected}
              onClick={() => {
                onScoreAChange(preset.a);
                onScoreBChange(preset.b);
              }}
              className={cn(
                'min-h-12 px-2 py-1.5 rounded-xl border flex flex-col items-center justify-center transition-all active:scale-95',
                isSelected
                  ? preset.win
                    ? 'bg-emerald-600 text-white border-emerald-600 shadow-sm'
                    : 'bg-rose-600 text-white border-rose-600 shadow-sm'
                  : preset.win
                    ? 'bg-emerald-50/60 text-emerald-700 border-emerald-200 hover:bg-emerald-100/70 dark:bg-emerald-500/12 dark:text-emerald-300 dark:border-emerald-500/30 dark:hover:bg-emerald-500/20'
                    : 'bg-rose-50/60 text-rose-700 border-rose-200 hover:bg-rose-100/70 dark:bg-rose-500/12 dark:text-rose-300 dark:border-rose-500/30 dark:hover:bg-rose-500/20'
              )}
            >
              <span className="font-display font-black text-sm tabular-nums leading-tight">
                {preset.label}
              </span>
              <span className={cn('text-xs font-bold leading-tight', isSelected ? 'text-white/90' : 'opacity-75')}>
                {preset.win ? winBadgeLabel : lossBadgeLabel}
              </span>
            </button>
          );
        })}
      </div>

      {/* 精簡橫排微調器 */}
      <div className="grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-end gap-2 bg-surface-subtle/80 border border-border rounded-xl p-3">
        <CompactStepper
          label={sideALabel}
          value={scoreA}
          max={maxStepScore}
          onChange={onScoreAChange}
          isWinning={scoreA > scoreB}
        />
        <span
          className="h-11 flex items-center justify-center text-lg font-display font-black text-muted-foreground/45 px-0.5"
          aria-hidden="true"
        >
          :
        </span>
        <CompactStepper
          label={sideBLabel}
          value={scoreB}
          max={maxStepScore}
          onChange={onScoreBChange}
          isWinning={scoreB > scoreA}
        />
      </div>
    </div>
  );
}

function CompactStepper({
  label,
  value,
  max,
  onChange,
  isWinning,
}: {
  label: string;
  value: number;
  max: number;
  onChange: (val: number) => void;
  isWinning: boolean;
}) {
  return (
    <div className="flex flex-col items-center gap-1.5">
      <span className="text-xs font-black text-muted-foreground leading-none">{label}</span>
      <div className="flex items-center gap-1.5 sm:gap-2">
        <button
          type="button"
          aria-label={`減少${label}局數`}
          onClick={() => onChange(Math.max(0, value - 1))}
          className="size-11 rounded-xl bg-card border border-border flex items-center justify-center text-foreground hover:bg-secondary active:scale-95 transition-all"
        >
          <Minus size={16} strokeWidth={2.5} aria-hidden="true" />
        </button>
        <span
          className={cn(
            'w-8 text-center font-display font-black text-xl sm:text-2xl tabular-nums',
            isWinning ? 'text-emerald-600 dark:text-emerald-400' : 'text-foreground'
          )}
        >
          {value}
        </span>
        <button
          type="button"
          aria-label={`增加${label}局數`}
          onClick={() => onChange(Math.min(max, value + 1))}
          className="size-11 rounded-xl bg-card border border-border flex items-center justify-center text-foreground hover:bg-secondary active:scale-95 transition-all"
        >
          <Plus size={16} strokeWidth={2.5} aria-hidden="true" />
        </button>
      </div>
    </div>
  );
}
