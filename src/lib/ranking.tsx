import { Shield, Trophy, Medal, Award } from 'lucide-react';
import React from 'react';

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
