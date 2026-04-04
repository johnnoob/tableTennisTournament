import { Skeleton } from "@/components/ui/skeleton";

export function LeaderboardSkeleton() {
  return (
    <div className="pb-24 pt-8 md:pt-12 px-6 md:px-12 space-y-10 bg-white min-h-screen">
      {/* Header Skeleton */}
      <header className="flex flex-col md:flex-row md:items-end justify-between gap-6">
        <div className="space-y-4">
          <Skeleton className="h-10 md:h-14 w-48 md:w-64 rounded-xl" />
          <div className="flex items-center gap-3">
             <Skeleton className="h-6 w-32 rounded-lg" />
             <Skeleton className="h-4 w-24 rounded-md" />
          </div>
        </div>
        <div className="flex flex-col md:flex-row items-stretch md:items-center gap-4">
           <Skeleton className="h-10 w-48 rounded-xl" />
           <Skeleton className="h-12 w-full md:w-80 rounded-xl" />
        </div>
      </header>

      {/* Podium Skeleton */}
      <div className="flex justify-center items-end h-64 md:h-72 gap-4 mt-12 mb-16">
         <div className="flex flex-col items-center w-24 md:w-32">
            <Skeleton className="size-16 md:size-20 rounded-full mb-8" />
            <Skeleton className="w-full h-24 md:h-32 rounded-t-xl" />
         </div>
         <div className="flex flex-col items-center w-28 md:w-40 -mt-8">
            <Skeleton className="size-20 md:size-24 rounded-full mb-8" />
            <Skeleton className="w-full h-32 md:h-44 rounded-t-xl" />
         </div>
         <div className="flex flex-col items-center w-24 md:w-32">
            <Skeleton className="size-16 md:size-20 rounded-full mb-8" />
            <Skeleton className="w-full h-20 md:h-24 rounded-t-xl" />
         </div>
      </div>

      {/* Table Skeleton */}
      <div className="bg-white rounded-4xl border border-slate-100 overflow-hidden shadow-sm">
         <div className="bg-slate-50/80 p-5 border-b border-slate-100 flex justify-between">
            <Skeleton className="h-4 w-16" />
            <Skeleton className="h-4 w-32" />
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-4 w-20" />
         </div>
         <div className="divide-y divide-slate-50">
            {[1, 2, 3, 4, 5].map(i => (
              <div key={i} className="p-5 flex items-center justify-between">
                 <Skeleton className="h-6 w-8 rounded-md" />
                 <div className="flex items-center gap-4 flex-1 ml-10">
                    <Skeleton className="size-10 rounded-full" />
                    <div className="space-y-1">
                       <Skeleton className="h-5 w-32 rounded-lg" />
                       <Skeleton className="h-3 w-20 rounded-md" />
                    </div>
                 </div>
                 <Skeleton className="h-6 w-24 rounded-lg" />
                 <Skeleton className="h-8 w-16 rounded-lg ml-10" />
              </div>
            ))}
         </div>
      </div>
    </div>
  );
}
