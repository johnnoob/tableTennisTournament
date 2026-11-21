import { Skeleton } from '@/components/ui/skeleton';

export function MatchHistorySkeleton() {
  return (
    <div className="arena-page">
      <header className="flex items-center gap-4">
        <Skeleton className="w-2 h-14 rounded-full" />
        <div className="space-y-2.5">
          <Skeleton className="h-9 w-36 rounded-xl" />
          <Skeleton className="h-4 w-32 rounded-md" />
        </div>
      </header>

      <div className="flex flex-col lg:flex-row gap-6 lg:gap-10">
        <div className="flex-1 space-y-6 min-w-0">
          <div className="arena-surface p-4 space-y-3">
            <Skeleton className="h-11 w-full rounded-xl" />
            <div className="flex items-center gap-2">
              <Skeleton className="h-9 w-20 rounded-xl" />
              <Skeleton className="h-9 w-20 rounded-xl" />
              <Skeleton className="h-9 w-20 rounded-xl" />
            </div>
          </div>

          <div className="space-y-2">
            {[1, 2, 3, 4].map((i) => (
              <Skeleton key={i} className="h-20 w-full rounded-2xl" />
            ))}
          </div>
        </div>

        <div className="w-full lg:w-80 xl:w-96 shrink-0 order-first lg:order-last">
          <Skeleton className="h-[320px] w-full rounded-2xl md:rounded-3xl" />
        </div>
      </div>
    </div>
  );
}
