import { Skeleton } from "@/components/ui/skeleton";

export function DashboardSkeleton() {
  return (
    <div className="pb-24 pt-8 md:pt-12 px-6 md:px-12 space-y-8 bg-white overflow-hidden">
      {/* Header Skeleton */}
      <header className="flex items-center justify-between">
        <div className="space-y-3">
          <Skeleton className="h-10 md:h-14 w-48 md:w-64 rounded-xl" />
          <Skeleton className="h-4 w-32 md:w-40 rounded-lg" />
        </div>
        <div className="flex items-center gap-2 md:gap-3">
          <Skeleton className="hidden md:block size-14 rounded-2xl" />
          <Skeleton className="size-10 md:size-14 rounded-xl md:rounded-2xl" />
        </div>
      </header>

      {/* Banner Skeleton */}
      <div className="bg-slate-50/50 rounded-4xl p-5 md:p-8 h-[180px] md:h-[220px] flex flex-col md:flex-row items-center justify-between gap-6 relative overflow-hidden border border-slate-100/50">
         <div className="flex items-center gap-4 md:gap-6 w-full">
            <Skeleton className="size-12 md:size-16 rounded-2xl shrink-0" />
            <div className="space-y-3 flex-1">
              <Skeleton className="h-4 w-20 rounded-md" />
              <Skeleton className="h-6 md:h-8 w-3/4 rounded-lg" />
              <Skeleton className="h-4 w-1/2 rounded-md" />
            </div>
         </div>
         <Skeleton className="h-12 md:h-14 w-full md:w-40 rounded-xl shrink-0" />
      </div>

      {/* Main Grid Skeleton */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-8 md:gap-12">
        <div className="xl:col-span-8 space-y-10">
          
          {/* Main Card Skeleton */}
          <section>
            <div className="relative rounded-3xl bg-slate-50/80 p-8 h-[240px] md:h-[260px] border border-slate-100/50">
               <div className="absolute -left-4 -top-4 size-16 rounded-full bg-slate-200 border-4 border-white animate-pulse" />
               <div className="flex items-center gap-6 mt-2">
                 <Skeleton className="size-20 rounded-full" />
                 <div className="space-y-2">
                   <Skeleton className="h-8 w-40 rounded-lg" />
                   <Skeleton className="h-4 w-24 rounded-md" />
                 </div>
                 <div className="ml-auto space-y-2 text-right">
                   <Skeleton className="h-12 w-28 rounded-lg ml-auto" />
                   <Skeleton className="h-4 w-16 rounded-md ml-auto" />
                 </div>
               </div>
               <div className="grid grid-cols-3 gap-6 mt-10 pt-6 border-t border-slate-200/50">
                 <Skeleton className="h-12 w-full rounded-xl" />
                 <Skeleton className="h-12 w-full rounded-xl" />
                 <Skeleton className="h-12 w-full rounded-xl" />
               </div>
            </div>
          </section>

          {/* Chart Section Skeleton */}
          <section className="bg-slate-50/30 p-6 md:p-8 rounded-[2.5rem] border border-slate-100/50 h-[400px] flex flex-col">
            <div className="flex justify-between items-start mb-10">
              <div className="space-y-2">
                <Skeleton className="h-6 w-48 rounded-lg" />
                <Skeleton className="h-4 w-32 rounded-md" />
              </div>
              <Skeleton className="h-10 w-48 rounded-xl" />
            </div>
            <Skeleton className="flex-1 w-full rounded-2xl mt-auto" />
          </section>

          {/* Feed List Skeleton */}
          <section className="space-y-6">
            <div className="flex justify-between items-center px-2">
              <Skeleton className="h-8 w-40 rounded-lg" />
              <Skeleton className="h-4 w-16 rounded-md" />
            </div>
            {[1, 2, 3].map(i => (
              <div key={i} className="bg-white p-5 rounded-3xl border border-slate-100 flex items-center gap-4">
                <Skeleton className="size-12 rounded-2xl" />
                <div className="flex-1 space-y-2">
                   <Skeleton className="h-5 w-3/4 rounded-lg" />
                   <Skeleton className="h-4 w-1/4 rounded-md" />
                </div>
                <Skeleton className="h-10 w-20 rounded-xl" />
              </div>
            ))}
          </section>
        </div>

        <div className="xl:col-span-4 space-y-10">
          {/* Top Rivals Skeleton */}
          <section className="space-y-6">
             <div className="flex justify-between items-center">
               <Skeleton className="h-6 w-32 rounded-lg" />
               <Skeleton className="h-8 w-24 rounded-lg" />
             </div>
             {[1, 2, 3].map(i => (
               <Skeleton key={i} className="h-28 w-full rounded-2xl mb-4" />
             ))}
             <Skeleton className="h-14 w-full rounded-3xl" />
          </section>
        </div>
      </div>
    </div>
  );
}
