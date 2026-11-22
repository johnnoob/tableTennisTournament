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
  google_linked?: boolean;
  line_linked?: boolean;
  line_display_name?: string | null;
  dominant_hand?: string | null;
  rubber_forehand?: string | null;
  rubber_backhand?: string | null;
  gender?: string | null;
  is_impersonating?: boolean;
  impersonator_name?: string | null;
}

export interface AuthProvidersStatus {
  google: boolean;
  line: boolean;
}

export interface ChartOpponent {
  id: string;
  name: string;
  mmr: number;
}

export interface ChartPartner {
  id: string;
  name: string;
}

export interface ChartDataPoint {
  idx?: number;
  name: string; // 唯一識別標籤 / 舊版日期字串
  recorded_at?: string | null; // UTC ISO 時間戳
  rating: number; // Y 軸 ELO 分數
  delta?: number;
  event_type?: 'match' | 'soft_reset' | 'decay' | 'admin_adjust' | 'start';
  match_id?: string;
  match_type?: 'singles' | 'doubles';
  format?: string;
  result?: 'W' | 'L';
  score?: string;
  opponents?: ChartOpponent[];
  partner?: ChartPartner | null;
}

export interface ProgressionSummary {
  net_delta: number;
  matches: number;
  wins: number;
  losses: number;
  win_rate: number;
  peak_rating: number;
  low_rating: number;
  current_rating: number;
}

export interface RadarAxisItem {
  key: string;
  label: string;
  score: number;
  detail: string;
  sample: number;
}

export interface PlayerArchetype {
  title: string;
  tagline: string;
  badge_tone: 'blue' | 'amber' | 'rose' | 'emerald' | 'violet';
  strength_label: string;
  focus_label: string;
}

export interface FormatSplitStats {
  matches: number;
  wins: number;
  losses: number;
  win_rate: number;
  net_mmr: number;
}

export interface ScorelineBucket {
  count: number;
  pct: number;
}

export interface ScorelineBreakdown {
  total: number;
  sweep_win: ScorelineBucket;
  close_win: ScorelineBucket;
  close_loss: ScorelineBucket;
  sweep_loss: ScorelineBucket;
}

export interface OpponentTierStats {
  key: 'elite' | 'gold' | 'silver' | 'bronze';
  label: string;
  range: string;
  matches: number;
  wins: number;
  losses: number;
  win_rate: number;
}

export interface WeeklyActivityItem {
  label: string;
  matches: number;
  wins: number;
}

export interface PlayerAnalytics {
  unlocked: boolean;
  settled_count: number;
  unlock_required: number;
  radar: RadarAxisItem[];
  archetype: PlayerArchetype;
  breakdown: {
    singles: FormatSplitStats;
    doubles: FormatSplitStats;
    scorelines: ScorelineBreakdown;
    vs_tiers: OpponentTierStats[];
    activity_weeks: WeeklyActivityItem[];
    activity_8w_total: number;
  };
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
  season_matches_played?: number;
  placement_matches_required?: number;
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
  progression_summary?: ProgressionSummary;
  analytics?: PlayerAnalytics;
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
  current_streak?: number;
  weekly_mmr_delta?: number;
}

export interface SeasonPulse {
  season_id: string;
  season_name: string;
  status: string;
  start_date?: string | null;
  end_date?: string | null;
  days_remaining?: number | null;
  progress_percent?: number | null;
  total_matches: number;
  active_players: number;
  matches_last_7d: number;
  total_members: number;
}

export interface ClubSpotlightBase {
  player_id: string;
  player_name: string;
  department?: string | null;
  avatar_url?: string | null;
  global_mmr: number;
}

export interface ClubSpotlightStreak extends ClubSpotlightBase {
  streak: number;
}

export interface ClubSpotlightClimber extends ClubSpotlightBase {
  mmr_delta: number;
  window_label: string;
}

export interface ClubSpotlightActive extends ClubSpotlightBase {
  matches_count: number;
  wins: number;
  scope_label: string;
}

export interface ClubSpotlights {
  hot_streak?: ClubSpotlightStreak | null;
  weekly_climber?: ClubSpotlightClimber | null;
  most_active?: ClubSpotlightActive | null;
}

export interface LeaderboardResponse {
  season_id?: string | null;
  season_name?: string;
  leaderboard: RawLeaderboardItem[];
  season_pulse?: SeasonPulse | null;
  spotlights?: ClubSpotlights | null;
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
  seasonMatchesPlayed?: number;
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

export type ChallengeStatus =
  | 'pending'
  | 'countered'
  | 'accepted'
  | 'declined'
  | 'cancelled'
  | 'completed'
  | 'expired';

export interface ChallengePlayer {
  id: string;
  name: string;
  avatar?: string | null;
  department?: string | null;
  mmr: number;
}

export interface ChallengeReportPrefill {
  match_type: 'singles' | 'doubles';
  format: 'BO3' | 'BO5';
  partner_id?: string | null;
  opponent1_id?: string | null;
  opponent2_id?: string | null;
}

export interface ChallengeItem {
  id: string;
  match_type: 'singles' | 'doubles';
  format: 'BO3' | 'BO5';
  status: ChallengeStatus;
  proposed_at: string;
  proposed_by: string;
  location?: string | null;
  message?: string | null;
  decline_reason?: string | null;
  is_public: boolean;
  reported_matches_count: number;
  last_match_id?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
  challenger: ChallengePlayer | null;
  challenged: ChallengePlayer | null;
  challenger_partner?: ChallengePlayer | null;
  challenged_partner?: ChallengePlayer | null;
  my_role?: 'challenger' | 'challenged' | 'challenger_partner' | 'challenged_partner' | null;
  is_representative: boolean;
  awaiting_my_response: boolean;
  can_accept: boolean;
  can_counter: boolean;
  can_decline: boolean;
  can_cancel: boolean;
  can_report: boolean;
  can_complete: boolean;
  report_prefill?: ChallengeReportPrefill | null;
}

export type PublicChallengeItem = ChallengeItem;

export interface MyChallengesResponse {
  active: ChallengeItem[];
  history: ChallengeItem[];
  pending_response_count: number;
}
