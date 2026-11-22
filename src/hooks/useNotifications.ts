import { useQuery } from '@tanstack/react-query';
import apiClient from '@/utils/apiClient';

export type NotificationCategory =
  | 'action_required'
  | 'disputed'
  | 'arbitration'
  | 'season'
  | 'match_settled';

export interface NotificationItem {
  id: string;
  type: 'pending_confirm' | 'match_confirmed' | 'match_rejected' | 'match_disputed' | string;
  category: NotificationCategory;
  content: string;
  match_id?: string | null;
  match_status?: string | null;
  is_read: boolean;
  created_at?: string | null;
}

export interface NotificationsResponse {
  unread_count: number;
  total_count: number;
  notifications: NotificationItem[];
}

export function useNotificationsQuery(enabled: boolean) {
  return useQuery<NotificationsResponse>({
    queryKey: ['notifications'],
    queryFn: async () => {
      const res = await apiClient.get<NotificationsResponse>('/users/me/notifications?limit=60');
      return res.data;
    },
    enabled,
    refetchInterval: 15000,
  });
}
