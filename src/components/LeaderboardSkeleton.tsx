import { Skeleton } from '@/components/ui/skeleton';

export function LeaderboardSkeleton() {
  return (
    <div className="arena-page">
      {/* Header Skeleton */}
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <Skeleton className="w-2 h-14 rounded-full" />
          <div className="space-y-2.5">
            <Skeleton className="h-9 w-44 rounded-xl" />
            <div className="flex items-center gap-2">
              <Skeleton className="h-6 w-28 rounded-lg" />
              <Skeleton className="h-4 w-36 rounded-md" />
            </div>
          </div>
        </div>
        <Skeleton className="h-9 w-36 rounded-xl" />
      </header>

      {/* Control Bar Skeleton */}
      <div className="bg-card border border-border rounded-2xl p-3 sm:p-4 shadow-xs space-y-3">
        <div className="flex flex-col sm:flex-row gap-2.5">
          <Skeleton className="h-11 w-full sm:w-56 rounded-xl" />
          <Skeleton className="h-11 w-full sm:w-48 rounded-xl" />
          <Skeleton className="h-11 flex-1 rounded-xl" />
        </div>
        <div className="flex flex-wrap gap-2 pt-2.5 border-t border-border/60">
          <Skeleton className="h-9 w-24 rounded-xl" />
          <Skeleton className="h-9 w-28 rounded-xl" />
          <Skeleton className="h-9 w-24 rounded-xl" />
          <Skeleton className="h-9 w-24 rounded-xl" />
        </div>
      </div>

      {/* List Skeleton */}
      <div className="bg-card border border-border rounded-2xl shadow-xs overflow-hidden">
        <div className="bg-surface-subtle/80 px-4 py-3.5 border-b border-border hidden md:flex justify-between">
          <Skeleton className="h-4 w-12" />
          <Skeleton className="h-4 w-28" />
          <Skeleton className="h-4 w-24" />
          <Skeleton className="h-4 w-16" />
        </div>
        <div className="divide-y divide-border">
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="p-4 flex items-center justify-between gap-4">
              <Skeleton className="size-8 rounded-full shrink-0" />
              <div className="flex items-center gap-3 flex-1 min-w-0">
                <Skeleton className="size-10 rounded-xl shrink-0" />
                <div className="space-y-1.5 min-w-0">
                  <Skeleton className="h-4 w-28 rounded-md" />
                  <Skeleton className="h-3 w-20 rounded-md" />
                </div>
              </div>
              <Skeleton className="h-6 w-20 rounded-full hidden md:block" />
              <Skeleton className="h-7 w-14 rounded-lg" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
