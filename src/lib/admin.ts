import apiClient from '@/utils/apiClient';

async function adminFetch(endpoint: string, options: any = {}) {
  try {
    const res = await apiClient.request({
      url: `/admin${endpoint}`,
      method: options.method || "GET",
      data: options.body ? JSON.parse(options.body) : undefined,
      headers: options.headers,
    });
    return res.data;
  } catch (error: any) {
    throw new Error(error.response?.data?.detail || "管理員請求失敗");
  }
}

export const adminApi = {
  // Configs
  getConfigs: () => adminFetch("/config"),
  updateConfig: (key: string, value: string) => 
    adminFetch(`/config/${key}`, { method: "PUT", body: JSON.stringify({ value }) }),
  
  // Announcements
  getAnnouncements: () => adminFetch("/announcements"),
  createAnnouncement: (data: any) => 
    adminFetch("/announcements", { method: "POST", body: JSON.stringify(data) }),
  updateAnnouncement: (id: string, data: any) => 
    adminFetch(`/announcements/${id}`, { method: "PUT", body: JSON.stringify(data) }),
  deleteAnnouncement: (id: string) => 
    adminFetch(`/announcements/${id}`, { method: "DELETE" }),

  // Season Prizes
  getSeasonPrizes: (seasonId: string) => adminFetch(`/season-prizes/${seasonId}`),
  saveSeasonPrize: (data: any) => 
    adminFetch("/season-prizes", { method: "POST", body: JSON.stringify(data) }),
  updateSeasonPrize: (id: string, data: any) => 
    adminFetch(`/season-prizes/${id}`, { method: "PUT", body: JSON.stringify(data) }),
  deleteSeasonPrize: (id: string) => 
    adminFetch(`/season-prizes/${id}`, { method: "DELETE" }),

  // Tournaments
  getTournaments: () => adminFetch("/tournaments"),
  createTournament: (data: any) => 
    adminFetch("/tournaments", { method: "POST", body: JSON.stringify(data) }),
  updateTournamentStatus: (id: string, status: string) => 
    adminFetch(`/tournaments/${id}/status?status=${status}`, { method: "PUT" }),
  
  // Tournament Participants
  getParticipants: (id: string) => adminFetch(`/tournaments/${id}/participants`),
  addParticipant: (tournamentId: string, userId: string) => 
    adminFetch(`/tournaments/${tournamentId}/participants`, { method: "POST", body: JSON.stringify({ user_id: userId }) }),
  removeParticipant: (tournamentId: string, userId: string) => 
    adminFetch(`/tournaments/${tournamentId}/participants/${userId}`, { method: "DELETE" }),

  // Utilities
  uploadImage: async (file: File) => {
    const formData = new FormData();
    formData.append('file', file);
    try {
      const res = await apiClient.post('/admin/upload-image', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      return res.data;
    } catch (error: any) {
      throw new Error(error.response?.data?.detail || "圖片上傳失敗");
    }
  },
};
