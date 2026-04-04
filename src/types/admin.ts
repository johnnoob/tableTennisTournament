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
  link_url?: string;
  link_text?: string;
  is_active: boolean;
  created_at: string;
}

export interface SeasonPrize {
  id: string;
  season_id: string;
  rank: number;
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
  status: 'upcoming' | 'ongoing' | 'completed';
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
