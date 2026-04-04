const BASE_URL = "http://localhost:8000/api/admin";

async function adminFetch(endpoint: string, options: RequestInit = {}) {
  const token = localStorage.getItem('auth_token');
  const res = await fetch(`${BASE_URL}${endpoint}`, {
    ...options,
    headers: {
      "Authorization": `Bearer ${token}`,
      "Content-Type": "application/json",
      ...options.headers,
    },
  });
  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.detail || "管理員請求失敗");
  }
  return res.json();
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
  deleteAnnouncement: (id: string) => 
    adminFetch(`/announcements/${id}`, { method: "DELETE" }),

  // Season Prizes
  getSeasonPrizes: (seasonId: string) => adminFetch(`/season-prizes/${seasonId}`),
  saveSeasonPrize: (data: any) => 
    adminFetch("/season-prizes", { method: "POST", body: JSON.stringify(data) }),

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
};
