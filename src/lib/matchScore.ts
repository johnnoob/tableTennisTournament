export type MatchFormat = 'BO3' | 'BO5';

export interface ScoreValidationResult {
  valid: boolean;
  tone: 'idle' | 'warning' | 'error' | 'valid';
  message: string;
}

export function inferMatchFormat(scoreA: number, scoreB: number): MatchFormat {
  return scoreA + scoreB >= 5 || Math.max(scoreA, scoreB) >= 3 ? 'BO5' : 'BO3';
}

export function validateMatchScore(
  scoreA: number,
  scoreB: number,
  format: MatchFormat,
  lineupMessage?: string | null
): ScoreValidationResult {
  if (scoreA === 0 && scoreB === 0) {
    return { valid: false, message: '請點選預設比分或輸入最終局數', tone: 'idle' };
  }
  if (scoreA === scoreB) {
    return { valid: false, message: '平手局數無法送出，請分出勝負', tone: 'error' };
  }

  const maxScore = Math.max(scoreA, scoreB);
  const minScore = Math.min(scoreA, scoreB);
  const winTarget = format === 'BO3' ? 2 : 3;

  if (maxScore > winTarget) {
    return {
      valid: false,
      message: `${format} 最高為 ${winTarget} 勝，請調整比分或切換賽制`,
      tone: 'error',
    };
  }

  if (maxScore !== winTarget || minScore >= winTarget) {
    return {
      valid: false,
      message: `${format} 需先取得 ${winTarget} 局勝利`,
      tone: 'idle',
    };
  }

  if (lineupMessage) {
    return {
      valid: false,
      message: lineupMessage,
      tone: 'warning',
    };
  }

  return {
    valid: true,
    message: `${format === 'BO3' ? '三戰兩勝' : '五戰三勝'} · ${scoreA > scoreB ? '我方獲勝' : '對手獲勝'}`,
    tone: 'valid',
  };
}
