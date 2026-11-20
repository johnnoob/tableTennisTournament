/**
 * 全站 API 型別定義中心
 * 建立嚴謹的 TypeScript 防護網，消滅 any
 */

export type AnnouncementType = 'system' | 'club' | 'tournament';

export interface Announcement {
  id: string;
  title: string;
  content: string;
  type: AnnouncementType;
  link_text?: string;
  link_url?: string;
  created_at: string;
}

export interface MatchPlayer {
  id: string;
  name: string;
  avatar: string;
}

export interface MatchFeedItem {
  id: string;
  date?: string;
  created_at: string;
  score: [number, number];
  result: 'win' | 'loss';
  status: 'pending' | 'confirmed' | 'disputed' | 'completed';
  type: 'singles' | 'doubles';
  tournament?: string;
  mmrChange?: [number, number];
  player1: MatchPlayer[];
  opponent: MatchPlayer[];
}

export interface User {
  id: string;
  email?: string;
  name: string;
  username: string; // 從 OAuth 或前端推導
  department?: string;
  avatar?: string;
  isVerified?: boolean;
  mmr?: number;
}

export interface ChartDataPoint {
  name: string; // 用於 X 軸顯示 (原本是 date)
  rating: number; // 用於 Y 軸 (原本是 mmr)
  event_type?: 'match' | 'soft_reset';
}

export interface PlayerStats {
  rank: string | number;
  season_lp: number;
  global_mmr: number;
  wins: number;
  losses: number;
  win_rate: string;
  pts_change?: number;
  chart_data: ChartDataPoint[];
}

export interface H2HRecentMatch {
  id: string;
  date: string;
  my_score: number;
  opp_score: number;
  is_winner: boolean;
  mmr_delta: number;
  format: string;
}

export interface H2HBucket {
  matches: number;
  wins: number;
  losses: number;
  win_rate: number;
  net_mmr: number;
  recent: H2HRecentMatch[];
}

export interface H2HResponse {
  is_self: boolean;
  total_matches: number;
  total_vs_matches: number;
  singles_vs: H2HBucket;
  doubles_vs: H2HBucket;
  doubles_with: H2HBucket;
}

export interface RivalryItem {
  id: string;
  name: string;
  avatar: string;
  winRate: number;
  matches: number;
  pointsExchanged: number;
}

export interface RivalsResponse {
  nemesis: RivalryItem[];
  minions: RivalryItem[];
}

export interface PartnersResponse {
  golden_partners: RivalryItem[];
  worst_partners: RivalryItem[];
}

export interface RawLeaderboardItem {
  player_id: string;
  player_name: string;
  rank: string | number;
  season_lp: number;
  global_mmr: number;
  avatar_url?: string;
  department?: string;
  wins: number;
  matches_played: number;
  win_rate: string;
}

export interface LeaderboardResponse {
  leaderboard: RawLeaderboardItem[];
}

// 用於 Dashboard 渲染的 Player 映射結構 (相容 RankingCard)
export interface DashboardPlayer {
  id: string;
  name: string;
  username: string;
  rank: string | number;
  rating: number;
  mmr: number;
  avatar: string;
  isVerified: boolean;
  department?: string;
  stats: {
    wins: number;
    losses: number;
    winRate: number | string;
    avgScore: number;
  };
}
