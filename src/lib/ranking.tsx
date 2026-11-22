import { Shield, Trophy, Medal, Award } from 'lucide-react';
import React from 'react';

// 賽季起始基準分與定級門檻
export const SEASON_BASE_SCORE = 1000;
export const SEASON_PLACEMENT_MATCHES = 5;

// 段位徽章邏輯 (全域唯一標準)
// 客觀標準（基準分 1000）：菁英 (>= 1320) > 金牌 (1180 ~ 1319) > 銀牌 (1050 ~ 1179) > 銅牌 (< 1050)
export const getTierBadge = (mmr: number, iconSize: number = 14) => {
  if (mmr >= 1320) {
    return {
      name: '菁英 (Elite)',
      icon: React.createElement(Shield, { size: iconSize }),
      color: 'bg-slate-900 text-amber-400 border-amber-400/50 shadow-md shadow-amber-500/20 dark:bg-amber-500/15 dark:text-amber-300 dark:border-amber-400/50'
    };
  }
  if (mmr >= 1180) {
    return {
      name: '金牌 (Gold)',
      icon: React.createElement(Trophy, { size: iconSize }),
      color: 'bg-amber-100 text-amber-700 border-amber-300 dark:bg-amber-500/15 dark:text-amber-300 dark:border-amber-500/35'
    };
  }
  if (mmr >= 1050) {
    return {
      name: '銀牌 (Silver)',
      icon: React.createElement(Medal, { size: iconSize }),
      color: 'bg-slate-100 text-slate-600 border-slate-300 dark:bg-slate-500/20 dark:text-slate-200 dark:border-slate-500/35'
    };
  }
  return {
    name: '銅牌 (Bronze)',
    icon: React.createElement(Award, { size: iconSize }),
    color: 'bg-orange-50 text-orange-700 border-orange-200 dark:bg-orange-500/15 dark:text-orange-300 dark:border-orange-500/30'
  };
};

export type TierKey = 'elite' | 'gold' | 'silver' | 'bronze';

export const getTierKey = (mmr: number): TierKey => {
  if (mmr >= 1320) return 'elite';
  if (mmr >= 1180) return 'gold';
  if (mmr >= 1050) return 'silver';
  return 'bronze';
};

export const getShortTierName = (mmr: number): string => {
  if (mmr >= 1320) return '菁英';
  if (mmr >= 1180) return '金牌';
  if (mmr >= 1050) return '銀牌';
  return '銅牌';
};

export interface TierProgress {
  currentTierName: string;
  nextTierName: string | null;
  targetMmr: number;
  remainingMmr: number;
  progressPercent: number;
}

export const getTierProgress = (mmr: number): TierProgress => {
  const roundedMmr = Math.round(mmr);

  if (mmr >= 1320) {
    return {
      currentTierName: '菁英 (Elite)',
      nextTierName: null,
      targetMmr: 1320,
      remainingMmr: 0,
      progressPercent: 100,
    };
  }

  let floor = 900;
  let targetMmr = 1050;
  let currentTierName = '銅牌 (Bronze)';
  let nextTierName = '銀牌 (Silver)';

  if (mmr >= 1180) {
    floor = 1180;
    targetMmr = 1320;
    currentTierName = '金牌 (Gold)';
    nextTierName = '菁英 (Elite)';
  } else if (mmr >= 1050) {
    floor = 1050;
    targetMmr = 1180;
    currentTierName = '銀牌 (Silver)';
    nextTierName = '金牌 (Gold)';
  }

  const rawPercent = ((mmr - floor) / (targetMmr - floor)) * 100;
  const progressPercent = Math.min(100, Math.max(8, Math.round(rawPercent)));
  const remainingMmr = Math.max(0, targetMmr - roundedMmr);

  return {
    currentTierName,
    nextTierName,
    targetMmr,
    remainingMmr,
    progressPercent,
  };
};

/**
 * 專業排行榜名次計算法 (Standard Competition Ranking)
 * 1. 同積分並列同一名次，下個不同積分跳號 (1, 1, 3, 4)
 * 2. 只有 0 場對戰紀錄者，名次顯示為 "-"
 * 3. 排序規則：有紀錄者優先 (Active)，且依積分降冪；無紀錄者 (Inactive) 墊底。
 */
export const calculateRankings = <
  T extends { matches_played?: number; global_mmr?: number; rank?: number | string }
>(
  players: T[]
): T[] => {
  if (!players || players.length === 0) return [];

  // 深拷貝避免影響原始資料 (Redux/State Safety)
  const data = JSON.parse(JSON.stringify(players)) as T[];

  // 1. 分類：參賽者 (Active) 與 未參賽者 (Inactive)
  const active = data.filter((p) => (p.matches_played || 0) > 0);
  const inactive = data.filter((p) => (p.matches_played || 0) === 0);

  // 2. 排序 Active Players (積分由高到低)
  active.sort((a, b) => (b.global_mmr || 0) - (a.global_mmr || 0));

  // 3. 計算名次
  let currentRank = 1;
  for (let i = 0; i < active.length; i++) {
    // 如果不是第一個，且分數比前一個低，則跳到正確的流水號名次
    if (i > 0 && (active[i].global_mmr || 0) < (active[i - 1].global_mmr || 0)) {
      currentRank = i + 1;
    }
    active[i].rank = currentRank;
  }

  // 4. 依基準分排序並設定 Inactive 名次
  inactive.sort((a, b) => (b.global_mmr || 0) - (a.global_mmr || 0));
  inactive.forEach((p) => {
    p.rank = "-";
  });

  // 5. 合併回傳 (Active 優先展示)
  return [...active, ...inactive];
};

/**
 * 判斷是否為頂尖名次 (前兩名)
 * 用於顯示驗證徽章或特殊標記
 */
export const isTopTierRank = (rank: string | number | undefined): boolean => {
  if (!rank || rank === "-") return false;
  const rankNum = parseInt(String(rank), 10);
  return !isNaN(rankNum) && rankNum <= 2;
};
