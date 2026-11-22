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

      {/* My Standing Banner Skeleton */}
      <div className="arena-hero-surface rounded-2xl md:rounded-3xl p-4 sm:p-5 border border-blue-200/70 dark:border-slate-700/70">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3.5">
            <Skeleton className="size-12 rounded-2xl shrink-0" />
            <div className="space-y-2">
              <Skeleton className="h-5 w-36 rounded-lg" />
              <Skeleton className="h-3.5 w-52 rounded-md" />
            </div>
          </div>
          <div className="grid grid-cols-3 gap-2 sm:flex sm:gap-5">
            <Skeleton className="h-12 w-full sm:w-20 rounded-xl" />
            <Skeleton className="h-12 w-full sm:w-20 rounded-xl" />
            <Skeleton className="h-12 w-full sm:w-20 rounded-xl" />
          </div>
        </div>
      </div>

      {/* Control Bar Skeleton */}
      <div className="arena-surface p-3 sm:p-4 space-y-3">
        <div className="flex flex-col sm:flex-row gap-2.5">
          <Skeleton className="h-11 w-full sm:w-60 rounded-xl" />
          <Skeleton className="h-11 w-full sm:w-44 rounded-xl" />
          <Skeleton className="h-11 flex-1 rounded-xl" />
        </div>
        <div className="flex flex-wrap gap-2 pt-2.5 border-t border-border/60">
          <Skeleton className="h-9 w-24 rounded-xl" />
          <Skeleton className="h-9 w-28 rounded-xl" />
          <Skeleton className="h-9 w-24 rounded-xl" />
          <Skeleton className="h-9 w-24 rounded-xl" />
        </div>
      </div>

      {/* Mobile 1+2 / Desktop 3-Column Hero Podium Skeleton */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3 sm:gap-4 items-stretch">
        <div className="col-span-2 md:col-span-1 order-1 md:order-2 rounded-2xl md:rounded-3xl bg-card border border-border p-4 sm:p-5 space-y-4">
          <div className="flex items-center justify-between">
            <Skeleton className="h-6 w-24 rounded-full" />
            <Skeleton className="h-5 w-16 rounded-full" />
          </div>
          <div className="flex md:flex-col items-center gap-3.5">
            <Skeleton className="size-16 sm:size-20 rounded-full shrink-0" />
            <div className="space-y-2 flex-1 md:flex-none md:items-center md:flex md:flex-col">
              <Skeleton className="h-5 w-28 rounded-md" />
              <Skeleton className="h-7 w-20 rounded-md" />
            </div>
          </div>
          <Skeleton className="h-2.5 w-full rounded-full" />
        </div>

        {[2, 3].map((slot) => (
          <div
            key={slot}
            className={
              slot === 2
                ? 'col-span-1 order-2 md:order-1 rounded-2xl md:rounded-3xl bg-card border border-border p-3.5 sm:p-5 space-y-3'
                : 'col-span-1 order-3 md:order-3 rounded-2xl md:rounded-3xl bg-card border border-border p-3.5 sm:p-5 space-y-3'
            }
          >
            <Skeleton className="h-5 w-16 rounded-full" />
            <div className="flex flex-col items-center space-y-2 py-1">
              <Skeleton className="size-12 sm:size-16 rounded-full" />
              <Skeleton className="h-4 w-20 rounded-md" />
              <Skeleton className="h-6 w-14 rounded-md" />
            </div>
            <Skeleton className="h-2 w-full rounded-full" />
          </div>
        ))}
      </div>

      {/* List Skeleton */}
      <div className="arena-card overflow-hidden">
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
