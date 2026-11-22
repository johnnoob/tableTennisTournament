import axios from 'axios';
import apiClient from '@/utils/apiClient';
import type {
  AdminParticipantResponse,
  AdminSeasonItem,
  Announcement,
  CronRunSummary,
  CronStatusResponse,
  DecayPreviewResponse,
  SeasonPrize,
  SystemConfig,
  TournamentEvent,
} from '@/types/admin';
import type { AnnouncementType } from '@/types/api.types';

export interface SeasonStartPayload {
  name: string;
  start_date?: string | null;
  end_date?: string | null;
}

export interface SeasonUpdatePayload {
  name?: string;
  start_date?: string | null;
  end_date?: string | null;
  clear_end_date?: boolean;
}

export interface SeasonRolloverPayload {
  new_name?: string | null;
  new_start_date?: string | null;
  new_end_date?: string | null;
  apply_soft_reset: boolean;
  start_new_season: boolean;
}

export interface AnnouncementPayload {
  title: string;
  content: string;
  type: AnnouncementType;
  link_url?: string;
  link_text?: string;
  is_active: boolean;
}

export interface TournamentCreatePayload {
  title: string;
  rules?: string;
  image_url?: string;
  start_date?: string | null;
  end_date?: string | null;
}

interface AdminFetchOptions {
  method?: string;
  body?: string;
  headers?: Record<string, string>;
  skipGlobalErrorToast?: boolean;
}

async function adminFetch<T>(endpoint: string, options: AdminFetchOptions = {}): Promise<T> {
  const method = options.method || "GET";
  try {
    const res = await apiClient.request<T>({
      url: `/admin${endpoint}`,
      method,
      data: options.body ? JSON.parse(options.body) : undefined,
      headers: options.headers,
      skipGlobalErrorToast: options.skipGlobalErrorToast ?? method !== "GET",
    });
    return res.data;
  } catch (error: unknown) {
    if (axios.isAxiosError<{ detail?: string }>(error)) {
      throw new Error(error.response?.data?.detail || error.message || "管理員請求失敗");
    }
    throw new Error(error instanceof Error ? error.message : "管理員請求失敗");
  }
}

export const adminApi = {
  // Configs & System Cron
  getConfigs: () => adminFetch<SystemConfig[]>("/config"),
  updateConfig: (key: string, value: string) =>
    adminFetch<SystemConfig>(`/config/${key}`, { method: "PUT", body: JSON.stringify({ value }) }),
  getCronStatus: () => adminFetch<CronStatusResponse>("/system/cron-status"),
  runCronNow: () =>
    adminFetch<CronRunSummary & { message: string }>("/system/run-cron-now", { method: "POST" }),
  getDecayPreview: () => adminFetch<DecayPreviewResponse>("/system/decay-preview"),
  triggerDecay: () =>
    adminFetch<{ message: string; decayed_count: number }>("/system/trigger-decay", {
      method: "POST",
    }),

  // Seasons Management
  getAdminSeasons: () => adminFetch<AdminSeasonItem[]>("/seasons"),
  createSeason: (data: SeasonStartPayload) =>
    adminFetch<AdminSeasonItem>("/seasons", { method: "POST", body: JSON.stringify(data) }),
  updateSeason: (seasonId: string, data: SeasonUpdatePayload) =>
    adminFetch<AdminSeasonItem>(`/seasons/${seasonId}`, {
      method: "PUT",
      body: JSON.stringify(data),
    }),
  rolloverSeason: (data: SeasonRolloverPayload) =>
    adminFetch<{
      settled_season_ids: string[];
      soft_reset_count: number;
      new_season?: AdminSeasonItem | null;
    }>("/seasons/rollover", { method: "POST", body: JSON.stringify(data) }),

  // Announcements
  getAnnouncements: () => adminFetch<Announcement[]>("/announcements"),
  createAnnouncement: (data: AnnouncementPayload) =>
    adminFetch<Announcement>("/announcements", { method: "POST", body: JSON.stringify(data) }),
  updateAnnouncement: (id: string, data: Partial<AnnouncementPayload>) =>
    adminFetch<Announcement>(`/announcements/${id}`, { method: "PUT", body: JSON.stringify(data) }),
  deleteAnnouncement: (id: string) =>
    adminFetch<{ message: string }>(`/announcements/${id}`, { method: "DELETE" }),

  // Season Prizes
  getSeasonPrizes: (seasonId: string) => adminFetch<SeasonPrize[]>(`/season-prizes/${seasonId}`),
  saveSeasonPrize: (data: Partial<SeasonPrize>) =>
    adminFetch<SeasonPrize>("/season-prizes", { method: "POST", body: JSON.stringify(data) }),
  updateSeasonPrize: (id: string, data: Partial<SeasonPrize>) =>
    adminFetch<SeasonPrize>(`/season-prizes/${id}`, { method: "PUT", body: JSON.stringify(data) }),
  deleteSeasonPrize: (id: string) =>
    adminFetch<{ message: string }>(`/season-prizes/${id}`, { method: "DELETE" }),

  // Tournaments
  getTournaments: () => adminFetch<TournamentEvent[]>("/tournaments"),
  createTournament: (data: TournamentCreatePayload) =>
    adminFetch<TournamentEvent>("/tournaments", { method: "POST", body: JSON.stringify(data) }),
  updateTournamentStatus: (id: string, status: string) =>
    adminFetch<TournamentEvent>(`/tournaments/${id}/status?status=${status}`, { method: "PUT" }),
  deleteTournament: (id: string) =>
    adminFetch<{ message: string }>(`/tournaments/${id}`, { method: "DELETE" }),

  // Tournament Participants
  getParticipants: (id: string) => adminFetch<AdminParticipantResponse[]>(`/tournaments/${id}/participants`),
  addParticipant: (tournamentId: string, userId: string) =>
    adminFetch<{ id: string }>(`/tournaments/${tournamentId}/participants`, {
      method: "POST",
      body: JSON.stringify({ user_id: userId }),
    }),
  removeParticipant: (tournamentId: string, userId: string) =>
    adminFetch<{ message: string }>(`/tournaments/${tournamentId}/participants/${userId}`, {
      method: "DELETE",
    }),

  // Utilities
  uploadImage: async (file: File): Promise<{ url: string }> => {
    const formData = new FormData();
    formData.append('file', file);
    try {
      const res = await apiClient.post<{ url: string }>('/admin/upload-image', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
        skipGlobalErrorToast: true,
      });
      return res.data;
    } catch (error: unknown) {
      if (axios.isAxiosError<{ detail?: string }>(error)) {
        throw new Error(error.response?.data?.detail || error.message || "圖片上傳失敗");
      }
      throw new Error(error instanceof Error ? error.message : "圖片上傳失敗");
    }
  },
};
