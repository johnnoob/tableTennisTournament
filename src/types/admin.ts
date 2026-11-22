export interface SystemConfig {
  key: string;
  value: string;
  description?: string;
  updated_at: string;
}

export interface Announcement {
  id: string;
  title: string;
  content: string;
  type: 'club' | 'system' | 'tournament';
  link_url?: string;
  link_text?: string;
  is_active: boolean;
  created_at: string;
}

export interface SeasonPrize {
  id: string;
  season_id: string;
  rank: number;
  label?: string;
  item_name: string;
  quantity: number;
  image_url?: string;
}

export interface TournamentEvent {
  id: string;
  title: string;
  image_url?: string;
  start_date?: string;
  end_date?: string;
  rules?: string;
  status: 'registering' | 'ongoing' | 'completed';
  created_at: string;
}

export interface TournamentParticipant {
  id: string;
  tournament_id: string;
  user_id: string;
  joined_at: string;
}

export interface AdminParticipantResponse {
  participant: TournamentParticipant;
  user: {
    id: string;
    name: string;
    department?: string;
    avatar_url?: string;
  };
}

export interface CronRunSummary {
  status: 'success' | 'partial_error';
  trigger: 'vercel_cron' | 'manual' | string;
  ran_at: string;
  duration_ms: number;
  auto_confirmed_count: number;
  auto_confirm_threshold: number;
  auto_confirm_unit: 'hours' | 'minutes' | string;
  decay_count: number;
  decay_skipped: boolean;
  season_notice?: string | null;
  tasks_run: string[];
  errors: string[];
}

export interface CronStatusResponse {
  last_run_at?: string | null;
  summary?: CronRunSummary | null;
  cron_schedule: string;
  cron_schedule_label: string;
  cron_test_mode: boolean;
  cron_secret_configured: boolean;
  pending_total_count: number;
  pending_overdue_count: number;
  disputed_count?: number;
  auto_confirm_hours: number;
  decay_enabled: boolean;
  lock_on_expire: boolean;
}

export interface DecayPreviewUser {
  user_id: string;
  name: string;
  department?: string | null;
  avatar_url?: string | null;
  current_mmr: number;
  projected_mmr: number;
  deduction: number;
  inactive_value: number;
}

export interface DecayPreviewResponse {
  decay_enabled: boolean;
  cron_test_mode: boolean;
  time_unit: 'days' | 'minutes' | string;
  threshold: number;
  cycle: number;
  amount: number;
  affected_count: number;
  affected_users: DecayPreviewUser[];
}

export interface AdminSeasonTopPlayer {
  player_id: string;
  player_name: string;
  avatar_url?: string | null;
  global_mmr: number;
}

export interface AdminSeasonItem {
  id: string;
  name: string;
  status: 'active' | 'completed' | string;
  start_date?: string | null;
  end_date?: string | null;
  is_expired: boolean;
  participants_count: number;
  total_matches: number;
  pending_matches: number;
  prizes_count: number;
  top3: AdminSeasonTopPlayer[];
}

export interface AdminUserItem {
  id: string;
  name: string;
  email?: string | null;
  department?: string | null;
  avatar_url?: string | null;
  global_mmr: number;
  role: 'admin' | 'user' | string;
  is_active: boolean;
  auth_provider: string;
  matches_played: number;
  wins: number;
  losses: number;
  is_env_admin: boolean;
}

export interface AdminUserUpdatePayload {
  role?: 'admin' | 'user';
  is_active?: boolean;
  department?: string;
  name?: string;
}

export interface AdminMmrAdjustPayload {
  target_mmr?: number;
  delta?: number;
  reason: string;
}

export interface AdminMatchPlayer {
  id: string;
  name: string;
  avatar_url?: string | null;
  department?: string | null;
  mmr_delta?: number | null;
}

export interface AdminMatchItem {
  id: string;
  match_type: 'singles' | 'doubles' | string;
  format: 'BO3' | 'BO5' | string;
  status: 'pending' | 'disputed' | 'confirmed' | 'completed' | string;
  score_a: number;
  score_b: number;
  mmr_exchanged: number;
  season_id: string;
  season_name: string;
  created_at?: string | null;
  reported_by_id: string;
  reported_by_name: string;
  is_overdue: boolean;
  dispute_reason?: string | null;
  team_a: AdminMatchPlayer[];
  team_b: AdminMatchPlayer[];
}

export interface AdminMatchesCounts {
  disputed: number;
  pending: number;
  overdue: number;
  confirmed: number;
  total: number;
}

export interface AdminMatchesResponse {
  counts: AdminMatchesCounts;
  auto_confirm_hours: number;
  matches: AdminMatchItem[];
}

export interface AdminForceConfirmPayload {
  score_a?: number;
  score_b?: number;
  reason?: string;
}

export interface AdminVoidMatchPayload {
  reason?: string;
}
