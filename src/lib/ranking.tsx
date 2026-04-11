import { Shield, Trophy, Medal, Award } from 'lucide-react';
import React from 'react';

// 賽季起始基準分
export const SEASON_BASE_SCORE = 1500;

// 段位徽章邏輯 (全域唯一標準)
// 分數區間採用目前最新的測試標準： Elite(2000) > Gold(1260) > Silver(1210)
export const getTierBadge = (mmr: number, iconSize: number = 14) => {
  if (mmr >= 2000) {
    return {
      name: '菁英 (Elite)',
      icon: React.createElement(Shield, { size: iconSize }),
      color: 'bg-slate-900 text-amber-400 border-amber-400/50 shadow-md shadow-amber-500/20'
    };
  }
  if (mmr >= 1260) {
    return {
      name: '金牌 (Gold)',
      icon: React.createElement(Trophy, { size: iconSize }),
      color: 'bg-amber-100 text-amber-700 border-amber-300'
    };
  }
  if (mmr >= 1210) {
    return {
      name: '銀牌 (Silver)',
      icon: React.createElement(Medal, { size: iconSize }),
      color: 'bg-slate-100 text-slate-600 border-slate-300'
    };
  }
  return {
    name: '銅牌 (Bronze)',
    icon: React.createElement(Award, { size: iconSize }),
    color: 'bg-orange-50 text-orange-700 border-orange-200'
  };
};

/**
 * 專業排行榜名次計算法 (Standard Competition Ranking)
 * 1. 同積分並列同一名次，下個不同積分跳號 (1, 1, 3, 4)
 * 2. 只有 0 場對戰紀錄者，名次顯示為 "-"
 * 3. 排序規則：有紀錄者優先 (Active)，且依積分降冪；無紀錄者 (Inactive) 墊底。
 */
export const calculateRankings = (players: any[]) => {
  if (!players || players.length === 0) return [];

  // 深拷貝避免影響原始資料 (Redux/State Safety)
  const data = JSON.parse(JSON.stringify(players));

  // 1. 分類：參賽者 (Active) 與 未參賽者 (Inactive)
  const active = data.filter((p: any) => (p.matches_played || 0) > 0);
  const inactive = data.filter((p: any) => (p.matches_played || 0) === 0);

  // 2. 排序 Active Players (積分由高到低)
  active.sort((a: any, b: any) => (b.global_mmr || 0) - (a.global_mmr || 0));

  // 3. 計算名次
  let currentRank = 1;
  for (let i = 0; i < active.length; i++) {
    // 如果不是第一個，且分數比前一個低，則跳到正確的流水號名次
    if (i > 0 && active[i].global_mmr < active[i - 1].global_mmr) {
      currentRank = i + 1;
    }
    active[i].rank = currentRank;
  }

  // 4. 設定 Inactive 名次
  inactive.forEach((p: any) => {
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
