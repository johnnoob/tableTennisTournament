import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { ArrowLeftRight, FlaskConical, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import apiClient from '@/utils/apiClient';
import type { User } from '@/types/api.types';

export function ImpersonationBanner({ user }: { user?: User | null }) {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [isStopping, setIsStopping] = useState(false);

  if (!user?.is_impersonating) return null;

  const handleStopImpersonation = async () => {
    if (isStopping) return;
    setIsStopping(true);
    try {
      const res = await apiClient.post<{ message?: string; admin_name?: string }>(
        '/auth/impersonation/stop',
        {},
        { skipGlobalErrorToast: true }
      );
      queryClient.clear();
      await queryClient.invalidateQueries({ queryKey: ['authUser'] });
      toast.success(res.data?.message || '已切回管理員帳號');
      navigate('/admin?tab=users');
    } catch {
      toast.error('切回管理員失敗，請重新整理或重新登入');
    } finally {
      setIsStopping(false);
    }
  };

  return (
    <div
      role="status"
      className="sticky top-0 z-40 px-4 py-2.5 bg-gradient-to-r from-violet-600 via-indigo-600 to-violet-700 text-white border-b border-white/15 shadow-sm flex flex-wrap items-center justify-between gap-2.5"
    >
      <div className="flex items-center gap-2 min-w-0 text-xs sm:text-sm font-bold">
        <div className="size-7 rounded-lg bg-white/15 flex items-center justify-center shrink-0">
          <FlaskConical size={15} aria-hidden="true" />
        </div>
        <p className="truncate">
          測試模擬中：目前以 <strong className="font-display font-black underline decoration-white/50 underline-offset-2">「{user.name}」</strong> 身分操作
          {user.impersonator_name && (
            <span className="hidden sm:inline text-white/80 font-medium">
              （原管理員：{user.impersonator_name}）
            </span>
          )}
        </p>
      </div>

      <Button
        type="button"
        size="sm"
        disabled={isStopping}
        onClick={handleStopImpersonation}
        className="h-8 px-3 rounded-lg bg-white text-violet-700 hover:bg-violet-50 font-black text-xs gap-1.5 shrink-0 shadow-xs"
      >
        {isStopping ? (
          <Loader2 size={13} className="animate-spin" aria-hidden="true" />
        ) : (
          <ArrowLeftRight size={13} aria-hidden="true" />
        )}
        一鍵切回管理員
      </Button>
    </div>
  );
}
