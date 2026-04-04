import { Skeleton } from "@/components/ui/skeleton";

export function MatchHistorySkeleton() {
  return (
    <div className="pb-24 pt-8 px-6 space-y-8 bg-[#fbfcfe] min-h-screen">
      {/* Header Skeleton */}
      <header className="flex flex-col gap-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Skeleton className="size-10 rounded-full" />
            <div className="space-y-2">
              <Skeleton className="h-8 w-40 rounded-lg" />
              <Skeleton className="h-4 w-24 rounded-md" />
            </div>
          </div>
          <Skeleton className="size-10 rounded-full" />
        </div>

        {/* Search & Filter Skeleton */}
        <div className="space-y-4">
          <Skeleton className="h-12 w-full rounded-2xl" />
          <div className="flex items-center gap-3">
             <Skeleton className="h-10 w-24 rounded-full" />
             <Skeleton className="h-10 w-24 rounded-full" />
             <Skeleton className="h-10 w-24 rounded-full" />
          </div>
        </div>
      </header>

      {/* Match Timeline Skeleton */}
      <section className="space-y-6">
        <div className="flex items-center gap-4 py-2">
          <Skeleton className="h-4 w-32 rounded-md" />
          <div className="h-px bg-slate-100 flex-1" />
        </div>

        {/* Match Items Skeleton */}
        <div className="space-y-4">
          {[1, 2, 3, 4, 5].map(i => (
            <div key={i} className="bg-white p-5 rounded-3xl border border-slate-50 flex items-center gap-4">
               <Skeleton className="size-12 md:size-14 rounded-2xl shrink-0" />
               <div className="flex-1 space-y-2">
                  <div className="flex justify-between">
                    <Skeleton className="h-5 w-40 rounded-lg" />
                    <Skeleton className="h-4 w-16 rounded-md" />
                  </div>
                  <Skeleton className="h-4 w-24 rounded-md" />
               </div>
               <Skeleton className="h-10 w-24 rounded-2xl" />
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
