import axios from 'axios';
import apiClient from '@/utils/apiClient';
import type {
  AdminParticipantResponse,
  Announcement,
  SeasonPrize,
  SystemConfig,
  TournamentEvent,
} from '@/types/admin';
import type { AnnouncementType } from '@/types/api.types';

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
  // Configs
  getConfigs: () => adminFetch<SystemConfig[]>("/config"),
  updateConfig: (key: string, value: string) =>
    adminFetch<SystemConfig>(`/config/${key}`, { method: "PUT", body: JSON.stringify({ value }) }),

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
