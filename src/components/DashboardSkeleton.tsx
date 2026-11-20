import { Skeleton } from '@/components/ui/skeleton';

export function DashboardSkeleton() {
  return (
    <div className="arena-page">
      {/* Header Skeleton */}
      <header className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <Skeleton className="w-2 h-14 rounded-full" />
          <div className="space-y-2.5">
            <Skeleton className="h-9 w-40 sm:w-56 rounded-xl" />
            <Skeleton className="h-4 w-32 sm:w-44 rounded-md" />
          </div>
        </div>
        <Skeleton className="hidden lg:block h-12 w-28 rounded-2xl" />
      </header>

      {/* Banner Skeleton */}
      <div className="arena-surface p-5 md:p-7 h-[140px] flex flex-col md:flex-row items-center justify-between gap-4">
        <div className="flex items-center gap-4 w-full">
          <Skeleton className="size-12 md:size-14 rounded-2xl shrink-0" />
          <div className="space-y-2 flex-1">
            <Skeleton className="h-4 w-20 rounded-md" />
            <Skeleton className="h-5 w-3/4 rounded-lg" />
            <Skeleton className="h-4 w-1/2 rounded-md" />
          </div>
        </div>
        <Skeleton className="h-10 w-full md:w-32 rounded-xl shrink-0" />
      </div>

      {/* Main Grid Skeleton */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-8 md:gap-10">
        <div className="xl:col-span-8 space-y-8">
          <div className="relative rounded-2xl md:rounded-3xl bg-slate-100/80 p-6 h-[220px]">
            <div className="flex items-center gap-4">
              <Skeleton className="size-16 rounded-full" />
              <div className="space-y-2">
                <Skeleton className="h-7 w-36 rounded-lg" />
                <Skeleton className="h-4 w-24 rounded-md" />
              </div>
              <div className="ml-auto space-y-2 text-right">
                <Skeleton className="h-10 w-24 rounded-lg ml-auto" />
                <Skeleton className="h-3 w-12 rounded-md ml-auto" />
              </div>
            </div>
            <div className="grid grid-cols-3 gap-4 mt-8 pt-4 border-t border-slate-200/70">
              <Skeleton className="h-10 w-full rounded-xl" />
              <Skeleton className="h-10 w-full rounded-xl" />
              <Skeleton className="h-10 w-full rounded-xl" />
            </div>
          </div>

          <div className="arena-surface p-6 h-[340px] flex flex-col">
            <div className="flex justify-between items-start mb-6">
              <div className="space-y-2">
                <Skeleton className="h-6 w-36 rounded-lg" />
                <Skeleton className="h-3 w-28 rounded-md" />
              </div>
              <Skeleton className="h-9 w-48 rounded-xl" />
            </div>
            <Skeleton className="flex-1 w-full rounded-2xl" />
          </div>
        </div>

        <div className="xl:col-span-4 space-y-4">
          <Skeleton className="h-7 w-32 rounded-lg" />
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-32 w-full rounded-2xl" />
          ))}
          <Skeleton className="h-12 w-full rounded-2xl" />
        </div>
      </div>
    </div>
  );
}
