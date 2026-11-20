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

      {/* Filter Bar Skeleton */}
      <div className="arena-surface p-3 sm:p-4 flex flex-col sm:flex-row gap-3">
        <Skeleton className="h-11 w-full sm:w-64 rounded-xl" />
        <Skeleton className="h-11 flex-1 rounded-xl" />
      </div>

      {/* Podium Skeleton */}
      <div className="arena-surface px-4 sm:px-6 pt-5 pb-0">
        <Skeleton className="h-4 w-32 rounded-md mb-6" />
        <div className="grid grid-cols-3 items-end gap-2 sm:gap-5 max-w-3xl mx-auto pt-4">
          <div className="flex flex-col items-center">
            <Skeleton className="size-13 sm:size-18 rounded-full mb-3" />
            <Skeleton className="h-4 w-16 rounded-md mb-1" />
            <Skeleton className="h-4 w-12 rounded-md mb-3" />
            <Skeleton className="w-full h-18 sm:h-24 rounded-t-2xl" />
          </div>
          <div className="flex flex-col items-center">
            <Skeleton className="size-16 sm:size-22 rounded-full mb-3" />
            <Skeleton className="h-4 w-20 rounded-md mb-1" />
            <Skeleton className="h-4 w-14 rounded-md mb-3" />
            <Skeleton className="w-full h-24 sm:h-32 rounded-t-2xl" />
          </div>
          <div className="flex flex-col items-center">
            <Skeleton className="size-13 sm:size-18 rounded-full mb-3" />
            <Skeleton className="h-4 w-16 rounded-md mb-1" />
            <Skeleton className="h-4 w-12 rounded-md mb-3" />
            <Skeleton className="w-full h-14 sm:h-20 rounded-t-2xl" />
          </div>
        </div>
      </div>

      {/* Table Skeleton */}
      <div className="arena-card overflow-hidden">
        <div className="bg-surface-subtle/80 px-4 py-3.5 border-b border-border hidden sm:flex justify-between">
          <Skeleton className="h-4 w-12" />
          <Skeleton className="h-4 w-28" />
          <Skeleton className="h-4 w-24" />
          <Skeleton className="h-4 w-16" />
        </div>
        <div className="divide-y divide-border">
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="p-4 flex items-center justify-between gap-4">
              <Skeleton className="size-8 rounded-full shrink-0" />
              <div className="flex items-center gap-3 flex-1">
                <Skeleton className="size-10 rounded-xl shrink-0" />
                <div className="space-y-1.5">
                  <Skeleton className="h-4 w-28 rounded-md" />
                  <Skeleton className="h-3 w-20 rounded-md" />
                </div>
              </div>
              <Skeleton className="h-6 w-20 rounded-full hidden sm:block" />
              <Skeleton className="h-7 w-14 rounded-lg" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
