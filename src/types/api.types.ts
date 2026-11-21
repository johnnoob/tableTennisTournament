import type { SeasonPrize } from '@/types/admin';

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
  avatar?: string | null;
  department?: string | null;
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

export interface MatchHistoryResponse {
  total: number;
  matches: MatchFeedItem[];
  hasMore: boolean;
}

export interface User {
  id: string;
  email?: string | null;
  name: string;
  username?: string; // 從 OAuth 或前端推導
  department?: string | null;
  avatar?: string | null;
  avatar_url?: string | null;
  isVerified?: boolean;
  mmr?: number;
  global_mmr?: number;
  role?: string;
  auth_provider?: string;
  dominant_hand?: string | null;
  rubber_forehand?: string | null;
  rubber_backhand?: string | null;
  gender?: string | null;
}

export interface ChartDataPoint {
  name: string; // 用於 X 軸顯示 (原本是 date)
  rating: number; // 用於 Y 軸 (原本是 mmr)
  event_type?: 'match' | 'soft_reset' | 'decay';
}

export interface NextRivalInfo {
  id: string;
  name: string;
  avatar?: string | null;
  mmr: number;
  mmr_gap: number;
  target_rank: number;
}

export interface PlayerStats {
  rank: string | number;
  season_lp?: number;
  global_mmr: number;
  matches_played?: number;
  wins: number;
  losses: number;
  win_rate: string;
  trend?: string;
  pts_change?: number;
  recent_form?: string[];
  recent_5_delta?: number;
  current_streak?: number;
  peak_mmr?: number;
  next_rival?: NextRivalInfo | null;
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
  season_lp?: number;
  global_mmr: number;
  avatar_url?: string;
  department?: string;
  wins: number;
  losses?: number;
  matches_played: number;
  win_rate: string;
  trend?: string;
  recent_form?: string[];
}

export interface LeaderboardResponse {
  season_id?: string | null;
  season_name?: string;
  leaderboard: RawLeaderboardItem[];
}

export interface SeasonSummary {
  id: string;
  name: string;
  status: string;
  start_date: string;
  end_date: string;
  participants_count?: number;
}

export interface SeasonDetailResponse extends SeasonSummary {
  prizes?: SeasonPrize[];
}

// 用於 Dashboard 渲染的 Player 映射結構 (相容 RankingCard)
export interface DashboardPlayer {
  id: string;
  name: string;
  username: string;
  rank: string | number;
  rating: number;
  mmr: number;
  global_mmr?: number;
  avatar: string;
  isVerified: boolean;
  department?: string;
  dominantHand?: string | null;
  rubberForehand?: string | null;
  rubberBackhand?: string | null;
  ptsChange?: number;
  recentForm?: string[];
  recent5Delta?: number;
  currentStreak?: number;
  peakMmr?: number;
  nextRival?: NextRivalInfo | null;
  stats: {
    wins: number;
    losses: number;
    winRate: number | string;
    avgScore?: number;
  };
}

export interface MatchPresetPlayer {
  id: string;
  name: string;
  avatar?: string | null;
  department?: string | null;
}

export interface MatchPreset {
  id: string;
  match_type: 'singles' | 'doubles';
  label?: string | null;
  sort_order: number;
  partner?: MatchPresetPlayer | null;
  opponent1?: MatchPresetPlayer | null;
  opponent2?: MatchPresetPlayer | null;
  created_at: string;
}

export interface MatchPresetCreatePayload {
  match_type: 'singles' | 'doubles';
  label?: string | null;
  partner_id?: string | null;
  opponent1_id?: string | null;
  opponent2_id?: string | null;
}

export interface MatchPresetUpdatePayload {
  match_type?: 'singles' | 'doubles';
  label?: string | null;
  partner_id?: string | null;
  opponent1_id?: string | null;
  opponent2_id?: string | null;
  sort_order?: number;
}
